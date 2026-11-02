# Demonstração restrita com dados confirmados

Entrada: `/#/my-id/demo/inicio`. O botão principal do diálogo de MyID abre essa demonstração, sem solicitar senha do portal original. A opção de conectar a conta permanece separada e identificada como integração em validação.

O endpoint `GET /api/myid/demo` exige a mesma identidade autorizada do painel. A audiência do Sites continua customizada para o proprietário e o visitante já autorizado; não houve publicação pública nem adição de visitantes. O endpoint é somente leitura, privado e não cacheável. O banco editável não é alterado ao navegar na demonstração.

## Dados capturados, não sincronizados ao vivo

Os dados de `site/seed.json` já confirmados pelas capturas fornecidas pelo titular são transformados no backend por `capturedMyIDDemo()`:

- Nome: Davi Guerra Estevez.
- Matrículas: 2026.2.08779, 2026.1.08778 e 2026.1.08228.
- Cursos e níveis: turma Advanced 2 e materiais Advanced 2/Advanced 1.
- Professoras: Clara Carvalho Monteiro e Carina Fernandes Espinosa.
- Situação da matrícula: preservada quando informada; Advanced 1 mantém `Não informado`.
- Report Card 1 da turma Advanced 2: critérios 8,2 / 6,0 / 8,2 / 6,4 / 7,0 / 4,0, nota oficial 7,24 e comentário completo já fornecido. A média oficial não é substituída por média simples.
- Report Card 2: indisponibilidade já descrita nas evidências fornecidas. Não há notas inventadas para outras matrículas.

Uma faixa persistente informa `Demonstração restrita · dados reais` e a ausência de sincronização ao vivo. A página `origem` discrimina a disponibilidade de cada recurso. Todos os links e seletores preservam o contexto de demonstração.

## Materiais reais disponíveis

Quatro e-books públicos originais da ID, já baixados no projeto, estão disponíveis no leitor e para download: Inglês nas férias, 7 estratégias para acelerar seu inglês, Entrevista de emprego e Como falar inglês: o segredo. Eles permanecem classificados como biblioteca geral, sem vínculo inventado com unidades ou aulas.

## Recursos não obtidos

Não foram obtidos o índice exato de aulas, os PDFs específicos por aula, a Evaluation, boletos, contratos ou histórico de presença por data. As páginas correspondentes apresentam essa disponibilidade sem fabricar documentos ou resultados. O calendário mostra apenas previsão a partir do horário conhecido da turma, com aviso e sem contagem fictícia de faltas/presenças.

O login original continua desativado na configuração do adaptador. A demonstração não usa o cookie exposto no chat, não cria uma sessão original falsa e não envia credenciais.

## Verificação

`node test-myid-demo.cjs` verifica proteção do endpoint para o proprietário e visitante autorizado, recusa de outras identidades, imutabilidade, fidelidade das notas/matrículas, assinatura `%PDF-` dos quatro arquivos reais e navegação completa dos componentes no modo de demonstração. Os testes de autenticação original continuam simulados e não constituem validação do portal ao vivo.
