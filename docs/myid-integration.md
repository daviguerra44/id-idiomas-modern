# Adaptador MyID

O frontend mantém a autenticação da plataforma Sites. A conexão com o MyID original é uma operação separada, disponível somente ao administrador da prévia. O visitante convidado visualiza o mesmo conjunto acadêmico e não recebe a sessão original.

## Estado da implementação

O adaptador foi implementado a partir dos dois documentos de mapeamento recebidos em 01/11/2026 e do formulário público anteriormente capturado. Os parsers e o fluxo de importação foram testados com **fixtures construídas para teste**, não com respostas autenticadas reais. Nenhuma consulta ou autenticação contra o host bloqueado pelo Opera foi executada para esta implementação. Nenhum PDF real foi importado neste trabalho.

A conexão externa permanece desativada. O endereço observado usa HTTP e ainda não há endereço HTTPS verificado nem confirmação do HTML autenticado. A aplicação não solicita credenciais enquanto a configuração estiver pendente. Não usar este adaptador como relay para contornar restrições de acesso das ferramentas.

## Configuração do servidor

Configurar pela ferramenta de ambiente do Sites, nunca no código ou no navegador:

- `MYID_ORIGIN`: origem HTTPS validada do portal, sem caminho ou barra final. A implementação atual aceita somente o host `my.id-idiomas.com.br`.
- `MYID_SESSION_KEY`: chave aleatória de 32 bytes em base64. Tratar como segredo. A rotação invalida as conexões armazenadas.
- `MYID_CONNECTION_VERIFIED`: somente definir como `true` após confirmar acesso permitido, transporte HTTPS, resposta de autenticação e compatibilidade dos parsers com HTML real.

A chave `MYID_SESSION_KEY` foi configurada no ambiente de produção como segredo. `MYID_ORIGIN` e `MYID_CONNECTION_VERIFIED` permanecem sem ativação: a chave prepara a criptografia e não habilita o envio de credenciais. A configuração não utiliza o cookie exposto anteriormente no chat.

## Rotas novas

`GET /api/myid/connection` retorna disponibilidade e progresso, sem cookies ou credenciais.

`POST /api/myid/connection` aceita JSON e exige Origin da própria aplicação:

- `connect`, com `username` e `password`: lê o formulário original, preserva campos ocultos, envia o POST e valida a página de matrículas. Cookie ou status 302 isolado não confirmam login.
- `start`: relê o perfil autorizado, prepara a fila e atualiza as matrículas encontradas.
- `step`: processa um item da fila. Cursos descobrem aulas; aulas descobrem anexos; arquivos são validados pelo cabeçalho `%PDF-` antes de serem salvos no R2.
- `disconnect`: solicita `GET /logout/index` quando há sessão ativa e canal configurado; sempre remove a sessão local. Retorna `remoteLogout: requested`, `unconfirmed` ou `not_attempted`. Uma solicitação aceita não é apresentada como prova de invalidação da sessão no servidor original.

O importador não aceita URL, matrícula ou ID de arquivo fornecido pelo navegador. Os recursos são derivados exclusivamente dos links obtidos no perfil e nas aulas autenticadas. Cada etapa é idempotente. A interface faz consultas sequenciais com pausa de 650 ms e permite retomar a fila.

## Armazenamento

A migração `0001_futuristic_lizard.sql` adiciona `myid_legacy_session`. Sessão, cookies e fila são criptografados com AES-GCM e vínculo ao proprietário como dados autenticados. Senhas não são persistidas. Uma trava impede importações concorrentes. Há intervalo mínimo após falha de credenciais e limite local de duas horas para a sessão.

PDFs são guardados no binding R2 existente. Cada recurso físico tem um identificador determinístico; aulas que referenciam o mesmo arquivo mantêm vínculos de material distintos. Os downloads usam a rota protegida já existente. Registros acadêmicos preservam notas, aulas e materiais anteriores quando ocorre falha de interpretação.

## Boletins e documentos

`Grade` é preservada como nota oficial: nenhum peso é inferido. Report Cards são separados, incluindo estados indisponíveis e nota zero. O painel permite selecionar o boletim. Evaluation, contrato e financeiro são convertidos em blocos de texto seguros; scripts, formulários e interações do portal não são reproduzidos. Não há aceitação contratual, pagamento ou edição remota de perfil.

Links `/reportCard/print/{id}?u=0` são extraídos de cada bloco de boletim, sem derivar o ID da matrícula. A importação preserva a versão de impressão como texto estruturado ou PDF, conforme o Content-Type recebido. PDFs de Evaluation, boleto e contrato são associados a `course.documents[kind].materialIds` e abertos pelo visualizador existente.

A rota interna de Avaliações apresenta Evaluation, sem reutilizar o Report Card. Não houve reconstrução do layout. O painel também trata boletim com nota final oficial e critérios ainda indisponíveis.

## Evidências e diagnóstico

O teste lê `tests/fixtures/myid-login-public.html`, cópia do formulário público capturado. Ele confirma os nomes dos campos e a ação do formulário. O encoding utilizado pelo adaptador segue o formulário HTML padrão, sem afirmar que houve captura do POST autenticado no Network. Um enctype diferente é rejeitado para revisão. Campos ocultos repetidos são preservados.

O cliente reconhece redirecionamento de erro `/login/auth?login_error=1`, trata `302` e `JSESSIONID` como insuficientes para provar login e verifica o perfil autenticado. Se a página de chegada não contiver perfil, consulta a rota identificada `/perfil/home` antes de procurar o link de perfil.

Para repetir exclusivamente o diagnóstico de transporte: `node scripts/check-myid-tls.mjs`. O script valida o certificado e o hostname pelo mecanismo padrão do Node, usa SNI e não envia requisições HTTP, cookies ou senhas. Uma falha descreve somente esse teste, não prova ausência permanente de HTTPS.

As consultas de todas as rotas foram exercitadas com transporte simulado. Somente a estrutura do formulário público tem HTML capturado; os parsers autenticados continuam pendentes de confirmação com respostas reais.

## Entrada com usuário e senha

O diálogo de entrada do site agora usa os campos `username` e `password` para a ação `connect` do adaptador existente. O endpoint intermediário é consultado antes de habilitar os campos. Enquanto a configuração HTTPS não estiver validada, ambos os campos e o envio permanecem desativados, inclusive antes do carregamento do JavaScript.

O frontend não persiste a senha e a limpa após sucesso, erro e fechamento do diálogo. Um login bem-sucedido abre a conexão de importação, evitando apresentar os dados antigos como se já fossem dados recém-importados. A sessão original nunca é devolvida ao frontend. O acesso à prévia continua protegido pela autenticação da plataforma, com o visitante convidado limitado à visualização.

## Verificação observacional de 01/11/2026 — revisão 16

O frontend não foi alterado nesta revisão.

A leitura HTTPS da página institucional `https://id-idiomas.com.br/` retornou HTTP 200, título `ID Idiomas | Foco em conversação!`. O link do MyID não é um elemento `a`: é uma entrada JSON da configuração Divi `et_link_options_data`, com classe `et_pb_blurb_0_tb_header` e URL `http://my.id-idiomas.com.br/login/auth`. O cliente agora lê o formulário em `/login/auth` e usa esse endereço no Referer do POST. Não deriva uma rota alternativa por tentativa.

O comando `node scripts/inspect-myid-public-contract.mjs` reproduz essa inspeção pública, sem executar scripts da página e sem ler o portal MyID. Ele informa separadamente links seguros publicados. Não encontrar um link HTTPS nesse conjunto não prova que não exista outro canal da instituição.

No teste TLS de `2026-11-01T23:42:11.226Z`, a conexão ao endereço resolvido `66.228.32.18:443` retornou `ECONNREFUSED`, sem enviar HTTP, credenciais ou cookies. Esse é um resultado daquele ambiente e momento, não uma afirmação de indisponibilidade permanente.

A amostra pública de formulário confirma `username`, `password` e checkbox opcional `remember-me`. Não declara `enctype`, portanto o adaptador utiliza a codificação padrão de formulário `application/x-www-form-urlencoded`. A amostra tem zero campos ocultos e zero metadados CSRF; isso não confirma ausência de CSRF no tráfego real. Não há captura dos cabeçalhos do GET inicial nessa amostra, de modo que cookies iniciais permanecem **não verificados**.

`inspectLoginForm()` retorna apenas nomes e propriedades do contrato; nunca retorna valores de campos ocultos ou tokens. O envio real do POST, os cookies iniciais e as respostas autenticadas continuam sem validação externa. Todos os testes autenticados usam fixtures identificadas como sintéticas.

## Verificação pendente

Antes de ativar, validar os parsers com HTML real do perfil, lista de aulas, aula com PDF, Report Card e Evaluation. Validar o canal HTTPS e o fluxo de credenciais inválidas. Respostas de layouts desconhecidos devem permanecer como avisos, sem inventar dados.

Teste: `node test-myid-integration.cjs`. Todos os requests de origem nesse teste são interceptados por mocks; ele não usa contas reais. Tipagem: `npx tsc --noEmit`.
