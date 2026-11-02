"""Reproduce the observed MyID photo form, using the caller's own session.

Inspection: python scripts/myid_photo.py
Upload:     python scripts/myid_photo.py path/to/photo.png --send
Secrets are read only from environment variables; they are never printed.
Exit codes: 0 = inspection or exact image confirmed, 1 = error, 2 = unconfirmed write.
"""

import argparse
import getpass
import hashlib
import os
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote

import requests
from bs4 import BeautifulSoup


class MyIDError(Exception):
    pass


class Portal:
    def __init__(self, origin):
        parts = urlsplit(origin)
        if (parts.scheme not in ("http", "https") or not parts.hostname
                or parts.username or parts.password or parts.path not in ("", "/")
                or parts.query or parts.fragment):
            raise MyIDError("MYID_ORIGIN deve conter somente a origem, sem credenciais.")
        self.origin = origin.rstrip("/")
        self.session = requests.Session()
        for variable, name, required in (
            ("MYID_JSESSIONID", "JSESSIONID", True),
            ("MYID_REMEMBER_ME", "grails_remember_me", False),
        ):
            value = os.environ.get(variable, "")
            if required and not value:
                if not sys.stdin.isatty():
                    raise MyIDError(f"Defina {variable} localmente.")
                value = getpass.getpass("JSESSIONID da sua própria sessão (entrada oculta): ")
                if not value:
                    raise MyIDError("Sessão não fornecida.")
            if value:
                if any(c in value for c in "\r\n;"):
                    raise MyIDError(f"{variable}: forneça somente o valor do cookie.")
                self.session.cookies.set(
                    name, value, domain=parts.hostname, path="/",
                    secure=parts.scheme == "https",
                )

    def url(self, value, base=None):
        url = urljoin(base or self.origin + "/", value)
        parts = urlsplit(url)
        if (parts.scheme, parts.netloc) != (
                urlsplit(self.origin).scheme, urlsplit(self.origin).netloc):
            raise MyIDError("Redirecionamento ou recurso fora da origem configurada.")
        if parts.username or parts.password or parts.fragment:
            raise MyIDError("Endereço inesperado no portal.")
        if re.match(r"/login(?:/|$)", parts.path):
            raise MyIDError("Sessão expirada: o portal redirecionou para o login.")
        return url

    def request(self, method, path, **kwargs):
        url = self.url(path)
        # No HTTP retries: a timeout during a POST does not prove it was rejected.
        with self.session.request(
            method, url, allow_redirects=False, timeout=(10, 60), stream=True,
            **kwargs,
        ) as response:
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > 8 * 1024 * 1024:
                    raise MyIDError("Resposta do portal acima do limite de 8 MB.")
                chunks.append(chunk)
            return response.status_code, response.headers.copy(), b"".join(chunks)

    def get(self, path):
        url = self.url(path)
        for _ in range(6):
            status, headers, body = self.request(
                "GET", url, headers={"Cache-Control": "no-cache", "Pragma": "no-cache"}
            )
            if status in (301, 302, 303, 307, 308):
                if not headers.get("Location"):
                    raise MyIDError("GET com redirecionamento sem Location.")
                url = self.url(headers["Location"], url)
                continue
            if status != 200:
                raise MyIDError(f"GET retornou HTTP {status}.")
            return url, headers, body
        raise MyIDError("Limite de redirecionamentos de leitura excedido.")


def document(body):
    soup = BeautifulSoup(body, "html.parser")
    if soup.select_one('input[type="password"]'):
        raise MyIDError("O portal retornou uma página de login; sessão não confirmada.")
    return soup


def form_contract(portal, edit_url, body, profile_id):
    soup = document(body)
    forms = [f for f in soup.find_all("form")
             if urljoin(edit_url, f.get("action", "")) == portal.origin + "/perfil/update"]
    if len(forms) != 1:
        raise MyIDError("Não foi encontrado um único formulário /perfil/update.")
    form = forms[0]
    if (form.get("method", "get").lower() != "post"
            or form.get("enctype", "").lower() != "multipart/form-data"):
        raise MyIDError("Método ou codificação do formulário mudou.")
    uploads = form.select('input[type="file"][name]:not([disabled])')
    if len(uploads) != 1 or uploads[0]["name"] != "imagemUpload":
        raise MyIDError("Campo de upload diferente do contrato observado: confira o Payload.")

    fields = []  # List preserves duplicate names, including hidden tokens.
    for control in form.select("input[name], textarea[name], select[name], button[name]"):
        if control.has_attr("disabled"):
            continue
        if control.find_parent("fieldset", disabled=True):
            raise MyIDError("Formulário com fieldset desabilitado: confira os controles no Payload.")
        kind = control.get("type", "text").lower()
        if control.name == "button" or kind in ("submit", "image"):
            raise MyIDError("Botão nomeado encontrado: confirme seu nome/valor no Payload.")
        if kind in ("file", "reset", "button"):
            continue
        if kind in ("checkbox", "radio") and not control.has_attr("checked"):
            continue
        name = control["name"]
        if kind == "password":
            raise MyIDError("Campo de senha inesperado no formulário de foto.")
        if control.name == "select":
            options = [o for o in control.find_all("option")
                       if not o.has_attr("disabled")
                       and not o.find_parent("optgroup", disabled=True)]
            selected = [o for o in options if o.has_attr("selected")]
            if not control.has_attr("multiple"):
                selected = selected[:1] or options[:1]
            fields.extend((name, o.get("value", o.get_text())) for o in selected)
        elif control.name == "textarea":
            fields.append((name, control.get_text()))
        else:
            fields.append((name, control.get("value", "on" if kind in ("checkbox", "radio") else "")))

    if [value for name, value in fields if name == "id"] != [profile_id]:
        raise MyIDError("O id do formulário não corresponde ao perfil informado.")
    if len([value for name, value in fields if name == "version"]) != 1:
        raise MyIDError("Campo version ausente ou duplicado; confira o formulário atual.")
    return fields


def photo(portal, profile_url):
    final_url, _, body = portal.get(profile_url)
    if urlsplit(final_url).path != urlsplit(profile_url).path:
        raise MyIDError("O portal não retornou o perfil esperado.")
    soup = document(body)
    candidates = []
    for box in soup.select(".caixa-foto-perfil"):
        candidates.extend(i["src"] for i in box.select("img[src]"))
        candidates.extend(re.findall(r"url\(\s*['\"]?([^'\")]+)", box.get("style", "")))
    for style in soup.find_all("style"):
        for rule in re.findall(r"\.caixa-foto-perfil\s*\{([^}]+)\}", style.get_text()):
            candidates.extend(re.findall(r"url\(\s*['\"]?([^'\")]+)", rule))
    for candidate in candidates:
        url = portal.url(candidate, profile_url)
        path = unquote(urlsplit(url).path)
        if not path.startswith("/storage/uploads/") or ".." in path.split("/"):
            continue
        _, _, image = portal.get(url)
        image_type(image)  # Reject an HTML error page masquerading as an image.
        return hashlib.sha256(image).digest()
    return None


def image_type(data):
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise MyIDError("Imagem sem assinatura JPG, PNG ou WebP reconhecida.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", nargs="?", type=Path)
    parser.add_argument("--send", action="store_true", help="Efetua um único POST da imagem escolhida.")
    args = parser.parse_args()
    if args.send and not args.image:
        parser.error("Informe a imagem local para --send.")
    profile_id = os.environ.get("MYID_PROFILE_ID", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", profile_id):
        raise MyIDError("Defina MYID_PROFILE_ID com o identificador da sua própria conta.")
    portal = Portal(os.environ.get("MYID_ORIGIN", "http://my.id-idiomas.com.br"))
    try:
        profile_url = portal.origin + "/perfil/show/" + profile_id
        edit_url = portal.origin + "/perfil/edit/" + profile_id
        final_url, _, body = portal.get(edit_url)
        if urlsplit(final_url).path != urlsplit(edit_url).path:
            raise MyIDError("A edição redirecionou para outra página.")
        fields = form_contract(portal, edit_url, body, profile_id)
        print("Formulário confirmado: POST multipart /perfil/update.")
        print("Campos de texto:", ", ".join(name for name, _ in fields))
        print("Campo de arquivo: imagemUpload. Valores ocultos não serão exibidos.")
        if not args.send:
            print("Somente inspeção. Use CAMINHO_DA_IMAGEM --send para enviar.")
            return 0

        if not args.image.is_file() or not 0 < args.image.stat().st_size <= 5 * 1024 * 1024:
            raise MyIDError("Escolha um arquivo de imagem entre 1 byte e 5 MB.")
        chosen = args.image.read_bytes()
        mime = image_type(chosen)
        digest = hashlib.sha256(chosen).digest()
        previous = photo(portal, profile_url)
        if previous == digest:
            print("O portal já retorna exatamente essa imagem. Nenhum POST foi enviado.")
            return 0

        # requests generates both the multipart boundary and Content-Length.
        # Do not copy either value from a different browser request.
        try:
            with args.image.open("rb") as image_file:
                status, headers, _ = portal.request(
                    "POST", "/perfil/update", data=fields,
                    files={"imagemUpload": (args.image.name, image_file, mime)},
                    headers={"Origin": portal.origin, "Referer": edit_url},
                )
            print(f"POST retornou HTTP {status}.")
            if status in (302, 303):
                location = portal.url(headers.get("Location", ""), portal.origin + "/perfil/update")
                if urlsplit(location).path != urlsplit(profile_url).path:
                    print("Redirecionamento diferente do perfil esperado; resultado incerto.")
            elif status != 200:
                print("Resposta inesperada; será feita apenas uma verificação de leitura.")
        except (requests.RequestException, MyIDError):
            print("Envio sem confirmação. Não repetindo o POST; consultando o perfil.")

        try:
            current = photo(portal, profile_url)
        except (requests.RequestException, MyIDError):
            print("Não foi possível confirmar a imagem no perfil. Não reenvie sem conferir o portal.")
            return 2
        if current == digest:
            print("CONFIRMADO: a foto servida pelo MyID corresponde exatamente ao arquivo enviado.")
            return 0
        if current is not None and previous is not None and current != previous:
            print("A imagem mudou, mas os bytes diferem. Pode ter sido transformada; confira visualmente.")
        else:
            print("Atualização NÃO confirmada: foto anterior ou imagem indisponível.")
        return 2
    finally:
        portal.session.close()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except MyIDError as error:
        print(f"Erro: {error}", file=sys.stderr)
        sys.exit(1)
    except requests.RequestException:
        print("Erro de conexão com o portal. Dados da sessão não serão exibidos.", file=sys.stderr)
        sys.exit(1)
    except OSError:
        print("Não foi possível ler o arquivo local.", file=sys.stderr)
        sys.exit(1)
