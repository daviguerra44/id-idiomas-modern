# Reprodução local do upload de foto com Python

O script `scripts/myid_photo.py` é independente do frontend e não altera a implementação publicada. Ele não faz login nem busca cookies do navegador: recebe a sessão da própria conta pelo ambiente ou solicita JSESSIONID com entrada oculta no terminal. Nunca compartilhe esses valores em chat, capturas ou repositórios.

## Contrato confirmado

Na inspeção autenticada anterior, o formulário original apresentou:

- GET `/perfil/edit/{perfilId}` para obter o formulário atual.
- POST `/perfil/update`, codificação `multipart/form-data`.
- Campos ocultos `id` e `version`.
- Arquivo `imagemUpload`.
- Submit sem `name`, portanto sem par nome/valor adicional a enviar.

Na captura descrita pelo titular, o POST retorna 302 com Location apontando para `/perfil/show/{perfilId}`. Esse retorno não prova a gravação. O tamanho 847520 é o tamanho de todo o multipart, incluindo campos e delimitadores; não precisa ser reproduzido. Não foi identificado um token CSRF obrigatório no formulário inspecionado. O script preserva campos ocultos presentes na resposta atual, incluindo eventuais tokens, sem criar nomes presumidos. Se o navegador acrescentar um token via JavaScript ou cabeçalho, será necessária uma captura desse contrato adicional.

## Conferência no Network

1. Abra a edição do seu próprio perfil e selecione a foto.
2. Em F12 → Network, marque Preserve log e salve no portal original.
3. Selecione o POST `/perfil/update`, não o GET gerado pelo redirecionamento.
4. Em Payload → Form Data, confira `id`, `version`, `imagemUpload` e qualquer campo adicional. O arquivo pode aparecer como `(binary)`.
5. Se necessário, use View source: a parte do arquivo deve apresentar `Content-Disposition: form-data; name="imagemUpload"; filename="..."`.
6. Procure nomes de tokens nos campos e nos Request Headers. Não publique seus valores. Não é necessário exportar cookies ou um HAR completo para conferir os nomes.

`version` pode ter função de controle de concorrência, compatível com Grails, mas essa função específica não foi demonstrada. O script sempre obtém o valor atual em vez de fixá-lo.

## Instalação e uso no PowerShell

Na raiz do projeto, com Python 3.10 ou superior disponível:

```powershell
python -m pip install -r scripts/requirements-myid-photo.txt
$env:MYID_ORIGIN = 'http://my.id-idiomas.com.br'
$env:MYID_PROFILE_ID = 'ID_DA_SUA_PROPRIA_CONTA'
python scripts/myid_photo.py
```

Sem `--send`, somente consulta e valida o formulário. Se MYID_JSESSIONID não estiver no ambiente, solicita o valor no terminal com entrada oculta. A sessão precisa estar válida. `MYID_REMEMBER_ME` é opcional, para fornecer localmente o cookie `grails_remember_me` se necessário; seu papel como requisito para esta operação não foi confirmado.

Para efetuar a alteração com o arquivo escolhido:

```powershell
python scripts/myid_photo.py 'C:\caminho\minha-foto.png' --send
```

O HTTP direto é usado conforme a autorização já dada para este projeto. O script não transforma esse transporte em HTTPS.

## Envio e confirmação

O script usa `requests.Session()`, atualiza os cookies recebidos do servidor, carrega o formulário atual e preserva seus controles enviados, inclusive nomes repetidos. Verifica a correspondência do `id` com o perfil informado. Não enumera identificadores de outras contas.

Abre a imagem em modo binário e envia `data=fields` junto com `files={"imagemUpload": (...)}`. O Requests gera boundary e Content-Length. Não há Content-Type ou Content-Length multipart fixado manualmente.

O POST tem `allow_redirects=False`. O script não repete envios após timeout, 404, 307/308 ou outra resposta incerta. Em seguida, apenas consulta o perfil e a imagem, mantendo as leituras e redirecionamentos na mesma origem.

Compara SHA-256 dos bytes servidos pelo portal com o arquivo selecionado:

- Iguais: confirmação exata, código de saída 0.
- Foto já igual antes do POST: nenhuma alteração necessária, código 0.
- Imagem alterada mas com bytes diferentes: inconclusivo; o servidor pode ter redimensionado ou recomprimido. Confira visualmente. Código 2.
- Imagem anterior, indisponível ou verificação falhou após o envio: não confirmado, código 2.
- Sessão expirada, formulário incompatível, erro de leitura ou configuração: código 1.

Um código 2 não significa necessariamente que a escrita falhou; não reenvie automaticamente sem conferir o original. As imagens são reconhecidas por assinatura JPG/PNG/WebP, não por uma validação completa de decodificação.

## Validação realizada

O contrato dos nomes e da estrutura veio da inspeção autenticada descrita acima. O fluxo do código foi revisado, mas não foi executado neste ambiente: não há interpretador Python instalado. Nenhuma imagem de teste ou credencial foi enviada ao portal para validar este script. A execução local com a imagem escolhida pelo titular continua necessária.

Referências oficiais: [Requests — multipart](https://requests.readthedocs.io/en/latest/user/quickstart/#post-a-multipart-encoded-file) e [Requests — Session](https://requests.readthedocs.io/en/latest/user/advanced/#session-objects).
