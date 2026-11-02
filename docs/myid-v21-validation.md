# Validação da ponte — versão 21

Frontend preservado, sem alterações. Origem legada configurada em ambiente, sem fixar host no cliente HTTP. Transporte HTTPS separado da origem lógica; nenhum POST ou cookie pode ser enviado diretamente por HTTP.

Implementadas consultas individuais autenticadas de perfil, home, matrículas, boletins, Evaluation, cursos, aulas, PDFs, boletos, contratos e revisão contratual. Links de aulas, anexos, edição e impressão são descobertos no HTML da própria sessão. Não há proxy arbitrário, aceite contratual ou escrita remota de perfil.

## Testes executados

TypeScript, testes do cliente HTTP e endpoints com transporte interceptado, importação, autorização, isolamento de contas, documentos, frontend existente e build. As respostas controladas existem somente nos testes, nunca no runtime.

Cobertura nova: GETs individuais sem relogar; JSON sem caminhos internos ou cookies; documento e aula não descobertos recusados; matrícula alheia recusada antes de buscar; PDF preservado; impressão HTML estruturada; origem HTTP lógica mapeada para relay HTTPS, inclusive Location absoluto; requisições HTTP externas impedidas.

## Integração real

O responsável esclareceu nesta revisão que não possui URL HTTPS de túnel nem binding seguro. MYID_ORIGIN foi configurada como http://my.id-idiomas.com.br. MYID_TRANSPORT_ORIGIN e MYID_CONNECTION_VERIFIED continuam ausentes por instrução explícita. MYID_SESSION_KEY permanece segredo no backend.

Para ativar, falta a origem HTTPS protegida (ou HTTPS direto), eventual contrato de autenticação do relay e a confirmação de ativação. Em seguida o titular poderá autenticar pela interface existente e validar as respostas autenticadas reais. Não houve autenticação real nem extração real de PDFs nesta revisão.
