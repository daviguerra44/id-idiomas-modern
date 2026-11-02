# Versão 22 — HTTP autorizado

Habilitado HTTP direto no adaptador existente mediante variável explícita de servidor. Origem obtida do ambiente, sem valor fixo no cliente HTTP. Sessões por usuário, AES-GCM, senha não persistida, redirects restritos à origem e os recursos descobertos permanecem. Nenhum dado estático foi adicionado.

Produção: MYID_ORIGIN=http://my.id-idiomas.com.br, MYID_ALLOW_INSECURE_HTTP=true, MYID_CONNECTION_VERIFIED=true, chave de sessão preservada como segredo. MYID_TRANSPORT_ORIGIN opcional permanece ausente.

Verificado no servidor original em 01/11/2026 (horário de São Paulo): formulário público HTTP 200; POST urlencoded com username/password; remember-me opcional; nenhum campo oculto ou metadado CSRF observado nessa resposta; uma tentativa de credencial sintética inexistente corretamente rejeitada com LOGIN_FAILED pelo adaptador. Não foi feita autenticação de conta válida.

Testes locais abrangem o opt-in somente no servidor, cookie reutilizado sem relogar, proxy HTTPS preservado, isolamento, consultas e PDFs com respostas controladas. Os testes controlados não equivalem a documentos reais.

O titular pode entrar pela interface existente. O GET protegido /api/myid/connection?probe=1 permite verificar o formulário público pelo Worker sem senha. Importação de dados acadêmicos reais depende de um login válido feito pelo titular.
