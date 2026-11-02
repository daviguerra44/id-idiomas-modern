# Ponte MyID multiusuário — versão 20

Implementado no adaptador existente, preservando o design. Usuários autorizados pelo Sites conectam sua própria conta; nenhum aluno ou matrícula serve de fallback. As permissões atuais do Site foram preservadas.

## Verificação local

- TypeScript e build Worker.
- Contrato do formulário público capturado: username/password, POST urlencoded e nomes dos campos opcionais. Campos ocultos são preservados no GET de cada login.
- Testes com transporte interceptado: descoberta de perfil, cookies pré-login e autenticados, redirecionamentos, erros, expiração, criptografia vinculada ao usuário, importação e idempotência.
- Dois usuários em escopos diferentes; bloqueio de PDF cruzado; troca de perfil no mesmo usuário sem reaproveitar notas pessoais ou arquivos; logout de uma conta preserva a outra.
- API: sem fallback ao desconectar, dados acadêmicos imutáveis no frontend, anotações próprias persistidas, conflitos de revisão e bloqueio de Origin externo.
- Componentes: cursos, boletins, documentos, login, progresso, tema e navegação. Fixtures são exclusivamente testes e não são respostas autenticadas reais.

## Validação externa pendente

Última tentativa HTTPS em my.id-idiomas.com.br:443 recusada em 01/11/2026 23:42 UTC. Isso descreve esse caminho e momento, não prova ausência permanente de HTTPS. O link MyID publicado no site institucional apontou HTTP. Nenhum canal seguro alternativo foi confirmado. MYID_ORIGIN e MYID_CONNECTION_VERIFIED continuam desativados; o segredo de criptografia já existe. Nenhuma senha ou cookie real foi enviado ao servidor legado.

Ainda faltam respostas autenticadas reais para validar os seletores, os métodos GET e o formato de cursos, aulas, avaliações, documentos e PDFs. A amostra pública de login não confirmou cookies iniciais ou CSRF de outra sessão. A ponte lê o formulário a cada login e rejeita contratos incompatíveis. Não existe escrita de cadastro ou aceite contratual. Não foi validada autenticação real.
