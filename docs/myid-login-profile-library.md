# Entrada, foto original e biblioteca

## Entrada objetiva

O botão MyID verifica a sessão antes de abrir a janela. Uma conta já conectada entra direto na visão geral. Sem conexão, aparece apenas o formulário de usuário/senha, o botão Entrar e Esqueci minha senha. A troca de conta fica no perfil; não há mais CTAs de painel ou de acesso à prévia dentro do login.

A recuperação usa o formulário público observado em `/redefinirSenha`: POST urlencoded para `/redefinirSenha/create`, campo `username`. O backend busca o formulário antes do envio, preserva campos ocultos caso existam e interpreta a mensagem devolvida no elemento `#alert`. A solicitação só é enviada quando o usuário aciona Enviar instruções. Não houve solicitação real de recuperação durante o desenvolvimento.

## Foto do perfil original

O formulário autenticado foi inspecionado na própria conta. Contrato observado: POST multipart para `/perfil/update`, campos ocultos `id` e `version`, arquivo `imagemUpload`. A ponte relê o formulário a cada envio e exige que o ID oculto corresponda ao perfil descoberto na sessão. Nenhum outro dado cadastral é editado.

O usuário escolhe JPG, PNG ou WebP e confirma Salvar foto. O backend valida o arquivo, envia o multipart com seus cookies privados, relê o perfil e só informa sucesso após localizar e obter a imagem do original. A cópia privada usada no avatar vem dessa imagem confirmada. O cookie original não é devolvido ao navegador.

O contrato HTTP e a serialização multipart foram conferidos; não foi enviada uma foto de teste ao perfil real. A gravação real depende da imagem escolhida pelo titular.

## Biblioteca

Boletos, contratos, Report Cards e demais documentos acadêmicos administrativos continuam acessíveis nas áreas da matrícula. Não aparecem em Biblioteca, Favoritos ou Concluídos da biblioteca, nem entram na contagem de materiais de estudo. Além da categoria `document`, o filtro considera os IDs relacionados em `course.documents`, cobrindo registros antigos sem categoria.

O leitor de documento retorna a Documentos e não apresenta marcar como estudado ou anotações de aula. Os arquivos e os vínculos de documentos não são apagados.
