# Carregamento automático por conta

O login abre a visão geral. O usuário não precisa entrar na tela de conexão nem acionar sincronização para carregar o catálogo.

Os dados acadêmicos e PDFs já importados permanecem no D1 e R2 por usuário da plataforma e perfil MyID autenticado. Entrar novamente no mesmo perfil reutiliza esse catálogo. Outro perfil possui outra chave de armazenamento; não recebe cursos, arquivos ou anotações da conta anterior. A troca explícita de conta autentica de fato o novo usuário e limpa o estado das abas abertas.

Na primeira entrada, a descoberta acontece automaticamente: perfil e matrículas, listas de aulas, boletins, páginas de aula, demais documentos e download dos PDFs. As listas têm prioridade sobre arquivos grandes. Um PDF cujo link já foi encontrado pode ser aberto pelo proxy autenticado enquanto sua cópia privada é preparada. Não são criados títulos, aulas ou anexos fictícios.

O navegador processa a fila em segundo plano enquanto o site está aberto, inclusive fora da página do curso. A fila é persistida no backend e retomada na visita seguinte quando a sessão ainda está válida. Fechar todas as abas pausa esse processamento; não foi criado um serviço de atualização com o navegador fechado.

PDFs com a mesma URL de origem e conta usam a cópia existente no R2. Não são baixados novamente a cada acesso ou login. O catálogo completo é reconsultado automaticamente após seis horas de uma carga concluída; mudanças nas matrículas invalidam a marca de atualização. A opção secundária “Atualizar agora” força a conferência das páginas, preservando as cópias de PDF já obtidas.

Uma única aba coordena a atualização via Web Locks. As demais recebem avisos de alteração sem dados acadêmicos pelo BroadcastChannel. Os formulários de anotações e preferências não são reconstruídos durante a atualização. Conflitos de operação são tratados com espera curta e nova tentativa.

A expiração da sessão original ainda pode exigir novo login. A senha não é guardada para renovação automática. Reautenticar no mesmo perfil não exige uma nova importação completa quando o catálogo está atualizado.

O isolamento de dois usuários e de dois perfis no mesmo usuário é testado com transporte controlado. A autenticação real de uma segunda conta não foi executada sem o seu titular. O acesso ao Site continua sujeito à política de visitantes autorizados da prévia; isso é separado das credenciais MyID.
