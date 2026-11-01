# ID Idiomas / MyID

Interface pública e plataforma de estudos em Vinext, Cloudflare D1 e R2. A publicação deve permanecer privada: dados acadêmicos foram fornecidos e autorizados pelo usuário.

## MyID

Visão geral com matrícula, professora, próxima aula recorrente, desempenho por critério, média calculada, lembretes e biblioteca. Perfil e preferências persistentes. Materiais com pesquisa, formato, curso, favoritos, conclusão e anotações. PDFs com leitor e download.

Report Card: média aritmética dos critérios com pesos iguais. Abaixo de 7 vermelho; de 7 até 8 amarelo; acima de 8 e abaixo de 10 verde; 10 azul. A nota final registrada é preservada separadamente: a média dos seis critérios iniciais é 6,63 e a nota final fornecida é 7,24.

Administração: cadastro e edição de professores, cursos/matrículas e notas; upload de PDF de até 20 MB; vínculo de material por curso; arquivamento preservando registros.

## Dados

Acesso autenticado pelo Sites. Registros segregados pelo identificador autenticado em D1, arquivos em R2 sob o mesmo identificador. Escritas validam origem, notas e revisão para evitar conflitos entre dispositivos. O acesso administrativo existe dentro deste Site privado de um único proprietário; não oferece autorização institucional de uma escola externa.

A biblioteca inicial inclui quatro PDFs originais disponíveis publicamente e 116 vídeos oficiais. Não foram encontrados PDFs adicionais no catálogo público. Vídeos são incorporados do YouTube; seus arquivos não foram redistribuídos. Materiais restritos exigem fornecimento autorizado ou conexão com o sistema escolar. A plataforma armazena seus próprios dados e não sincroniza com o portal acadêmico anterior. Essa informação fica centralizada em Configurações.

## Código e verificação

HTML público em site/index.html; assets em public; API em app/api/myedi; esquema em db/schema.ts; migração em drizzle. Compilar pelo helper build-site.mjs do plugin Sites. Testes: test-dashboard-api.cjs (servidor local em 5173), test-dashboard-ui.cjs, npx tsc --noEmit.
