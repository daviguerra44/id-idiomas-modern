# Adaptador MyID

O frontend mantém a autenticação da plataforma Sites. A conexão com o MyID original é individual: cada usuário autorizado pela política de acesso do Site vincula sua própria conta. O identificador estável da plataforma separa as sessões. O perfil descoberto após o login separa os dados acadêmicos e arquivos, inclusive quando a mesma pessoa troca de conta MyID. Não existe perfil de aluno predefinido ou fallback compartilhado.

## Estado da implementação

O adaptador foi implementado a partir dos dois documentos de mapeamento recebidos em 01/11/2026 e do formulário público anteriormente capturado. Os parsers e o fluxo de importação foram testados com **fixtures construídas para teste**, não com respostas autenticadas reais. Nenhuma consulta ou autenticação contra o host bloqueado pelo Opera foi executada para esta implementação. Nenhum PDF real foi importado neste trabalho.

A conexão externa permanece desativada por orientação expressa do responsável, que informou não ter URL HTTPS de túnel ou binding seguro disponível. A aplicação não envia credenciais enquanto a configuração estiver pendente. Não usar este adaptador como relay para contornar restrições de acesso das ferramentas.

## Configuração do servidor

Configurar pela ferramenta de ambiente do Sites, nunca no código ou no navegador:

- `MYID_ORIGIN`: origem lógica do backend legado, sem caminho, parâmetros ou barra final. Configurada como `http://my.id-idiomas.com.br` por orientação do responsável. Nenhuma requisição é enviada diretamente a uma origem HTTP.
- `MYID_TRANSPORT_ORIGIN`: origem HTTPS do relay seguro, sem caminho ou credenciais na URL. Obrigatória quando MYID_ORIGIN usa HTTP. Todas as requisições, incluindo POST e redirecionamentos, passam por essa origem. O relay deve preservar caminhos, corpos, Content-Type, Location e Set-Cookie do backend. Links absolutos do host legado são interpretados como caminhos e não provocam requisições HTTP. Para acesso HTTPS direto, esta variável é opcional.
- `MYID_SESSION_KEY`: chave aleatória de 32 bytes em base64. Tratar como segredo. A rotação invalida as conexões armazenadas.
- `MYID_CONNECTION_VERIFIED`: somente definir como `true` após confirmar acesso permitido, transporte HTTPS, resposta de autenticação e compatibilidade dos parsers com HTML real.

A chave `MYID_SESSION_KEY` foi configurada no ambiente de produção como segredo. `MYID_ORIGIN` está configurada. `MYID_TRANSPORT_ORIGIN` e `MYID_CONNECTION_VERIFIED` permanecem sem ativação: o endereço legado e a chave não habilitam o envio de credenciais. A configuração não utiliza o cookie exposto anteriormente no chat.

## Consultas individuais (versão 21)

Estas rotas são internas da ponte, não APIs JSON presumidas no legado. Exigem identidade autenticada do Sites e sessão MyID individual. Executam as requisições originais e devolvem JSON ou PDF original; não consultam fixtures. Nenhuma rota aceita URL de destino.

- `GET /api/myid/profile`: consulta o perfil descoberto no login e atualiza suas matrículas.
- `GET /api/myid/profile/fields`: lê os campos cadastrais somente se houver link de edição no próprio perfil, sem salvar alterações.
- `GET /api/myid/home`: conteúdo de leitura da página inicial.
- `GET /api/myid/enrollments`: matrículas descobertas, com recursos disponíveis.
- `GET /api/myid/enrollments/{id}/report-cards`: boletins separados, critérios, nota oficial, comentários, professor e vínculos de impressão.
- `GET /api/myid/enrollments/{id}/evaluation`: avaliação e documentos retornados pelo legado.
- `GET /api/myid/enrollments/{id}/course`: aulas, títulos, unidades e links internos.
- `GET /api/myid/enrollments/{id}/lessons/{aulaId}`: conteúdo e anexos da aula previamente descoberta no curso.
- `GET /api/myid/enrollments/{id}/boletos`, `/contract`, `/contract-review`: documento HTML convertido em blocos ou PDF original. Revisão contratual é somente leitura.
- `GET /api/myid/documents/{resourceId}`: PDF ou impressão previamente descoberta na sessão. O identificador é derivado do usuário, perfil, matrícula, tipo e caminho e não permite selecionar outra URL.

Cookies atualizados são novamente selados após cada consulta. O mesmo cliente e cookie são usados durante redirecionamentos; cada leitura reutiliza a sessão sem novo login. Expiração invalida o acesso local e exige reconexão. A API recusa matrícula de outra sessão, aula não descoberta, documento desconhecido e consulta cross-site. O fluxo de importação existente continua alimentando o frontend sem mudanças visuais.

## Rotas de conexão

`GET /api/myid/connection` retorna disponibilidade e progresso, sem cookies ou credenciais.

`POST /api/myid/connection` aceita JSON e exige Origin da própria aplicação:

- `connect`, com `username` e `password`: lê o formulário original, preserva campos ocultos, envia o POST e valida a página de matrículas. Cookie ou status 302 isolado não confirmam login.
- `start`: relê o perfil autorizado, prepara a fila e atualiza as matrículas encontradas.
- `step`: processa um item da fila. Cursos descobrem aulas; aulas descobrem anexos; arquivos são validados pelo cabeçalho `%PDF-` antes de serem salvos no R2.
- `disconnect`: solicita `GET /logout/index` quando há sessão ativa e canal configurado; sempre remove a sessão local. Retorna `remoteLogout: requested`, `unconfirmed` ou `not_attempted`. Uma solicitação aceita não é apresentada como prova de invalidação da sessão no servidor original.

O importador não aceita URL, matrícula ou ID de arquivo fornecido pelo navegador. Os recursos são derivados exclusivamente dos links obtidos no perfil e nas aulas autenticadas. Cada etapa é idempotente. A interface faz consultas sequenciais com pausa de 650 ms e permite retomar a fila.

## Isolamento multiusuário

Sessão selada por `live:<Sites userId>`, com AES-GCM e esse identificador como dado autenticado. Dados e arquivos usam uma chave derivada desse escopo e do hash do caminho do perfil descoberto. O frontend nunca recebe essa chave, cookies ou credenciais. Matrículas, aulas, PDFs e impressões vêm apenas de links do perfil autenticado. O cliente não escolhe IDs de matrícula ou URLs no importador.

`GET /api/myedi/data` retorna estado vazio sem conexão ativa. Preferências, tarefas, anotações e presenças pessoais podem ser salvas somente no escopo conectado; alterações em notas, cursos e cadastros são recusadas. PDFs exigem sessão própria ativa e vínculo no catálogo dessa conta. Logout remove a sessão e limpa o estado da interface. A antiga rota `/api/myid/demo` retorna 410. Os dados capturados antigos não alimentam mais a aplicação.

O importador lê a edição de perfil e a revisão contratual somente quando seus links são encontrados no perfil. Não grava cadastro e não aceita contratos. O endpoint de gravação do perfil não foi confirmado.

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

O diálogo de entrada do site usa os campos `username` e `password` para a ação `connect` do adaptador existente. Os campos e o botão de confirmar ficam disponíveis. Confirmar primeiro consulta a disponibilidade do canal sem enviar credenciais; se a configuração segura estiver pendente, exibe erro visível e não executa o POST com a senha. Quando o canal está configurado, segue com a autenticação. Controles são bloqueados temporariamente durante a operação para impedir duplicidade. O formulário usa `method="dialog"` para impedir uma submissão HTTP nativa caso o JavaScript não carregue.

O frontend não persiste a senha e a limpa após sucesso, erro e fechamento do diálogo. Um login bem-sucedido abre a conexão de importação, evitando apresentar os dados antigos como se já fossem dados recém-importados. A sessão original nunca é devolvida ao frontend. O acesso à prévia continua protegido pela autenticação da plataforma, e cada visitante autorizado pode vincular sua própria conta MyID.

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

## Ativação operacional

1. Provisionar uma URL HTTPS de relay protegido que encaminhe para o MYID_ORIGIN já configurado (ou substituir MYID_ORIGIN por HTTPS direto funcional).
2. Configurar MYID_TRANSPORT_ORIGIN no ambiente de produção, quando houver relay. Não colocar senha ou token na URL. Se o canal exigir um mecanismo adicional de autenticação, confirmar o contrato desse canal para configurar o cliente.
3. Confirmar o formulário real e o canal; configurar MYID_CONNECTION_VERIFIED=true e publicar a mesma versão para aplicar o ambiente.
4. O titular faz login pela interface existente. Conferir perfil/matrículas, sincronização e respostas reais de cada recurso para validar seletores e métodos.

Não foram usados cookies expostos no histórico. Nenhum login ou documento autenticado real foi validado nesta revisão. O endereço informado foi configurado sem ativar o envio de credenciais.
