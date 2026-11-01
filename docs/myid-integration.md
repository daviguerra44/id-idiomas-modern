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

Nenhum desses valores foi criado ou ativado na publicação desta implementação. A configuração não utiliza o cookie exposto anteriormente no chat.

## Rotas novas

`GET /api/myid/connection` retorna disponibilidade e progresso, sem cookies ou credenciais.

`POST /api/myid/connection` aceita JSON e exige Origin da própria aplicação:

- `connect`, com `username` e `password`: lê o formulário original, preserva campos ocultos, envia o POST e valida a página de matrículas. Cookie ou status 302 isolado não confirmam login.
- `start`: relê o perfil autorizado, prepara a fila e atualiza as matrículas encontradas.
- `step`: processa um item da fila. Cursos descobrem aulas; aulas descobrem anexos; arquivos são validados pelo cabeçalho `%PDF-` antes de serem salvos no R2.
- `disconnect`: remove a sessão local criptografada. Não realiza logout remoto não validado.

O importador não aceita URL, matrícula ou ID de arquivo fornecido pelo navegador. Os recursos são derivados exclusivamente dos links obtidos no perfil e nas aulas autenticadas. Cada etapa é idempotente. A interface faz consultas sequenciais com pausa de 650 ms e permite retomar a fila.

## Armazenamento

A migração `0001_futuristic_lizard.sql` adiciona `myid_legacy_session`. Sessão, cookies e fila são criptografados com AES-GCM e vínculo ao proprietário como dados autenticados. Senhas não são persistidas. Uma trava impede importações concorrentes. Há intervalo mínimo após falha de credenciais e limite local de duas horas para a sessão.

PDFs são guardados no binding R2 existente. Cada recurso físico tem um identificador determinístico; aulas que referenciam o mesmo arquivo mantêm vínculos de material distintos. Os downloads usam a rota protegida já existente. Registros acadêmicos preservam notas, aulas e materiais anteriores quando ocorre falha de interpretação.

## Boletins e documentos

`Grade` é preservada como nota oficial: nenhum peso é inferido. Report Cards são separados, incluindo estados indisponíveis e nota zero. O painel permite selecionar o boletim. Evaluation, contrato e financeiro são convertidos em blocos de texto seguros; scripts, formulários e interações do portal não são reproduzidos. Não há aceitação contratual, pagamento ou edição remota de perfil.

## Verificação pendente

Antes de ativar, validar os parsers com HTML real do perfil, lista de aulas, aula com PDF, Report Card e Evaluation. Validar o canal HTTPS e o fluxo de credenciais inválidas. Respostas de layouts desconhecidos devem permanecer como avisos, sem inventar dados.

Teste: `node test-myid-integration.cjs`. Todos os requests de origem nesse teste são interceptados por mocks; ele não usa contas reais. Tipagem: `npx tsc --noEmit`.
