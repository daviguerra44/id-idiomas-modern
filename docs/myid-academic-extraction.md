# Extração acadêmica — correção com respostas reais

O HTML autenticado foi obtido pela própria sessão MyID já vinculada ao usuário do Site. Cookies permaneceram no backend. As capturas locais sanitizadas ficam em `source-import/`, ignorado pelo Git; não alimentam a aplicação e não são novos mocks.

## Perfil

Estrutura confirmada: cada matrícula usa `.mdl-card`; o título completo fica em `.mdl-card__title` sem a classe `.caixa-texto`. A primeira caixa contém o idioma. Os pares de dados usam `.mdl-list__item-primary-content` e `.mdl-list__item-secondary-action` no mesmo `.mdl-list__item`.

Foram extraídas 18 matrículas independentes com título, código, nível, professor e situação preenchidos. Oito títulos trazem horário. A string original, o horário e a abreviação de dias são preservados separadamente. O significado de T/Q não foi convertido em dias da semana; nenhum horário de término foi criado. Matrículas de material sem horário permanecem sem horário, mesmo quando possuem o mesmo nível de uma turma presencial.

Dados persistidos com o parser anterior são atualizados pela leitura do próprio perfil quando o painel é carregado. Não há aluno, matrícula ou professor fixo na implementação.

## Cursos, aulas e PDFs

O curso observado apresenta cartões `.mdl-card` com o título completo em um segundo bloco de título, e o botão “Visualizar” contém a URL real da aula. Uma matrícula de material retornou 23 aulas distintas. Links repetidos da mesma aula são removidos; aulas diferentes com nomes iguais continuam distintas.

Número da aula e rótulo de unidade são preservados da caixa original, inclusive aula 0. A unidade escrita no título também é mantida. A fonte pode trazer “Unidade 1” no rótulo e “UNIT 2” no título; ambos são preservados, sem corrigir silenciosamente o conteúdo da instituição.

A página da aula observada usa `iframe#pdfFrame` com `https://docs.google.com/viewer?embedded=true&url=<PDF original>`. O parser lê o parâmetro `url` e consulta somente o arquivo original autorizado, sem acessar o Google Viewer. Também aceita PDFs diretos do mesmo backend e anexos em outros subdiretórios de storage efetivamente encontrados no HTML. Não constrói IDs de anexos nem oferece proxy arbitrário.

O importador valida a assinatura `%PDF-`, guarda os bytes no R2 do próprio usuário e vincula o material à matrícula e à aula. Nomes opacos de arquivo não substituem o título acadêmico. Aulas e anexos são carregados ao abrir o curso; a leitura pausa ao sair da página e aproveita PDFs já importados. Contratos e impressões continuam na seção de documentos e não contam como PDFs de estudo do curso.

O fluxo existente de contratos e Report Cards foi preservado. Nenhum contrato é aceito automaticamente.

## Verificação

`scripts/check-myid-observed.cjs` recebe capturas autenticadas reais para verificar os campos e a correspondência dos links, sem fazer login ou gerar HTML simulado. Foram conferidos o perfil completo, o curso e o atributo original do iframe da aula. As suítes anteriores de importação, permissões, documentos e componentes continuam como regressão, sem serem apresentadas como respostas reais.

Verificar na produção: abrir o material didático, aguardar a leitura das aulas, abrir um PDF pelo visualizador interno e conferir se os documentos anteriores continuam acessíveis. A existência do link de PDF no HTML não é apresentada como prova do download de todas as aulas ou de todos os cursos.
