# Evidência pública e fixtures de teste

`myid-login-public.html` é a cópia da página pública de login previamente capturada no trabalho de 01/11/2026. Não contém credenciais nem cookies. O formulário declara POST para `/login/authenticate`, com campos `username` e `password`, sem `enctype` explícito. Esses nomes são evidência do HTML público; o Payload e a resposta de uma autenticação real continuam pendentes.

As respostas autenticadas usadas em `test-myid-integration.cjs` são sintéticas e identificadas como fixtures. Não representam capturas reais do perfil, boletim, Evaluation, aulas ou documentos. Não substituir essa distinção por uma afirmação de integração validada.
