# ID Idiomas — Experiência integrada

Site estático com navegação interna por hash, interface carmesim e painéis de vidro.

## Conteúdo migrado

Cursos e detalhes completos, história, metodologia, ID Connector, três galerias Star Event, vídeos de alunos, quatro e-books PDF originais com leitor e download locais. Blog sem artigos editoriais no site de origem; não foram criados posts fictícios. Vídeos permanecem hospedados no YouTube e são reproduzidos dentro do site.

## My ID

Perfil editável com foto, nome, e-mail e telefone salvos no navegador. Três matrículas e Report Card 1 transcritos das capturas fornecidas pelo usuário. Consulta, impressão e exportação CSV do boletim. Áreas internas para curso, materiais, Evaluation, boletos e contrato.

Não há autenticação acadêmica ativa. Matrículas e notas não são sincronizadas. Nenhum boleto, contrato ou material privado foi disponibilizado. Não há pagamento ou aceite jurídico. A conexão real exige a API ou código do portal acadêmico. O portal informado exige sessão de login. Nenhuma senha foi coletada.

O site deve permanecer privado: contém os dados acadêmicos fornecidos pelo usuário.

## Desenvolvimento

Servir a pasta dist em um servidor estático. Importações públicas brutas ficam em source-import, ignorada pelo Git. content.js contém somente conteúdo público estruturado.
