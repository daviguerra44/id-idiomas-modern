# Alteração da foto no MyID — análise de 02/11/2026

## Evidências do portal e do erro

A captura mostra a imagem escolhida no navegador. Essa imagem vem de `FileReader`; ela não comprova a gravação no MyID.

Nos registros da aplicação, o envio de `/api/myid/avatar` encontrou duas respostas 409 e depois uma 502. As respostas 409 indicam disputa pelo bloqueio da sessão com outras operações. A mensagem final veio de um HTTP 404 recebido pelo adaptador. A versão anterior não guardava a sequência das requisições, portanto não é possível afirmar se o 404 veio do POST, de um redirecionamento ou da confirmação posterior.

A inspeção autenticada, somente de leitura, confirmou:

| Elemento | Contrato observado |
| --- | --- |
| Perfil e formulário de edição | GET 200 |
| Destino do formulário | `/perfil/update` |
| Método | POST |
| Codificação | `multipart/form-data` |
| Campos ocultos | `id`, `version` |
| Campo de arquivo | `imagemUpload` |
| Botão de envio | `type=submit`, valor `Alterar`, sem `name`, `formaction` ou `formmethod` |
| HEAD `/perfil/update` | 405 |
| OPTIONS `/perfil/update` | 200, lista genérica de métodos permitidos |

HEAD/OPTIONS não validam a gravação por POST. Tampouco sustentam a conclusão de que a rota não existe.

O JavaScript público carregado pelo formulário foi consultado e pesquisado. Não foi encontrado um manipulador específico de upload que substitua o formulário por outro endpoint. Isso não substitui uma captura de rede do envio real.

## Fluxo implementado

1. O navegador mostra a imagem com o aviso **Prévia — ainda não salva no MyID**.
2. Ao salvar, pausa a importação automática, coordena as abas por Web Locks/BroadcastChannel e aguarda a operação anterior. O bloqueio no backend continua protegendo a sessão contra chamadas concorrentes.
3. O backend carrega a sessão individual cifrada. Obtém o perfil e o formulário atualizado e verifica que o `id` oculto pertence ao perfil autenticado.
4. Reutiliza os campos ocultos recebidos, incluindo a versão atual, e acrescenta o arquivo em `imagemUpload`. Não aceita um identificador de perfil escolhido pelo frontend.
5. Serializa o multipart com boundary gerado pela plataforma, corpo de bytes de tamanho definido e CRLF final. O runtime calcula o Content-Length. Não fixa manualmente um tamanho que possa divergir do corpo.
6. Envia o POST uma vez. Segue redirecionamentos de leitura permitidos; não repete o POST em 307/308.
7. Busca novamente o perfil e a imagem original. Só confirma se os bytes correspondem à seleção ou, após uma resposta aceita, se a imagem mudou em relação à anterior. A segunda condição permite transformações feitas pelo servidor, mas não é uma comparação visual da imagem.
8. Se houver falha após o POST, faz apenas consultas de reconciliação. Só reconhece sucesso nesse caminho quando o original retorna exatamente os bytes escolhidos. Não reenvia automaticamente um POST de resultado incerto.
9. Só após a confirmação atualiza a imagem em cache. Grava a etapa, o código e a sequência de métodos, caminhos e status da última tentativa, sem cookies, corpo do formulário ou valores de tokens.
10. Libera o bloqueio também quando a operação falha. As respostas de erro diferenciam envio, confirmação e leitura da imagem.

## Compatibilidade do transporte

O envio direto de FormData foi substituído por multipart já serializado em bytes. A documentação do runtime explica que corpos de tamanho definido permitem o cálculo do Content-Length, enquanto streams genéricos usam transferência em blocos: [Cloudflare Workers — Request](https://developers.cloudflare.com/workers/runtime-apis/request/).

Essa é uma correção de compatibilidade para o servidor legado. **Não foi demonstrado que transferência em blocos causou o 404 anterior**, porque não há captura dos cabeçalhos daquela requisição.

## Validação e limites

Foram verificados no portal real o formulário, os campos, as páginas de leitura e os métodos HEAD/OPTIONS. Não foi enviada por esta análise uma imagem de teste à conta original.

Testes locais com transporte interceptado cobrem a serialização e integridade do multipart, os campos ocultos atuais, restrição ao próprio perfil, confirmação da foto, rejeição de imagem inalterada, erro 404 após redirecionamento, reconciliação sem repetir o POST, bloqueio de repetição em 307, liberação de sessão e isolamento de acesso. Esses testes não equivalem a uma gravação validada no servidor real.

A confirmação final exige salvar uma foto escolhida pelo titular na versão corrigida. Se falhar, a inspeção autenticada `/api/myid/connection?inspect=photo` mostra `lastAttempt`, permitindo identificar precisamente o salto e o status que falharam. Esse diagnóstico pertence apenas à sessão do usuário conectado e não contém JSESSIONID.
