# ADR 0021: Cidade como dado e caminho de escala para outras regionais
**Status:** Proposta · **Data:** 14/11/2026

## Contexto
O MOGI nasceu para Itamogi e "Itamogi" estava escrito no código: nome exibido, centro do mapa da demo, textos enviados aos modelos de triagem. A variável `CIDADE` só escolhia a pasta de regras Lua. O Russo definiu a direção em 14/11: revolucionar Itamogi primeiro e depois escalar para outras regionais, com manutenibilidade, observabilidade e escalabilidade como pilares.

Escalar aqui tem dois sentidos: mais cidades e mais carga numa cidade. Este ADR registra o que já foi feito e o que fica para quando o segundo caso chegar, para ninguém construir antes da hora.

## Decisão
**Feito agora (custa pouco hoje e muito depois):**
- Tabela `cidades` (slug, nome, centro, cerca do município). Itamogi é a primeira linha. O servidor lê a cidade pelo slug de `CIDADE`; `CIDADE_NOME`, `CIDADE_CAIXA` e `CIDADE_CENTRO` configuram uma instalação nova sem SQL.
- Coluna `cidade` em `ocorrencias` e `usuarios`, preenchida em todo chamado novo.
- Parâmetros por cidade ([ADR 0018](0018-modulos-e-parametros-em-tempo-de-execucao.md)) e regras Lua por pasta de cidade (já existia).
- `GET /config` entrega nome e centro da cidade aos apps, que deixam de ter Itamogi fixo.
- Trava consultiva nas migrações, para mais de uma réplica subir junta.
- Servidor sem estado preso à instância no que importa: sessão é JWT conferido no banco, mídia fica no S3, tempo real vem do `LISTEN/NOTIFY` (cada réplica escuta).

**Modelo de implantação: uma cidade por instalação.** Cada prefeitura tem o seu contêiner, o seu banco e o seu armazenamento. É o que a LGPD e a soberania de cada município pedem, simplifica o suporte e isola falhas. Uma regional nova é: uma linha em `cidades` (ou um `.env`), uma pasta `backend/regras/<cidade>/` e a revisão das categorias e secretarias.

**Fica para depois, com gatilho claro:**
| O que | Quando fazer |
|---|---|
| Várias cidades na mesma base (filtrar tudo por `cidade`, login por cidade, protocolo com prefixo da cidade) | Quando houver um consórcio de municípios pequenos que queira dividir servidor |
| Triagem fora da requisição, com fila em Postgres (`SKIP LOCKED`) e orçamento de tempo | Quando o p95 do envio na aba Operação passar de 8 s, ou quando o vídeo precisar de borrão |
| Limites de envio compartilhados entre réplicas | Quando houver mais de uma réplica atrás de um balanceador |
| Métricas no formato do Prometheus ([ADR 0019](0019-observabilidade-minima.md)) | Idem |
| Categorias e secretarias 100% no banco, com tabela de secretarias | Na primeira cidade cujas categorias diferirem das de Itamogi |
| Prazos por nível como parâmetro | Depois de validar os prazos com a prefeitura |
| Bairros oficiais como polígonos (ADR 0006) | Quando a prefeitura fornecer o cadastro |

Ainda fixo e conhecido: o prefixo `MOGI-` do protocolo (padrão da coluna no banco), a lista de categorias em quatro arquivos de `triagem/` e o texto "cidade pequena do interior de Minas Gerais" enviado aos modelos.

## Alternativas consideradas
- **Multi-inquilino desde já:** toda consulta ganharia um filtro por cidade e todo teste, um caso a mais, sem nenhuma segunda cidade para validar. Risco alto às vésperas do piloto.
- **Não registrar a cidade no dado:** obrigaria a migrar todos os chamados no dia em que duas cidades dividissem uma base.

## Consequências
Levar o MOGI a outra cidade deixa de exigir mudança no Go para o que é cadastro e ajuste; o que ainda exige está listado acima. O dado já nasce marcado com a cidade. A fila de triagem prometida no ADR 0013 continua não implementada, agora com o gatilho que a justifica e com a aba Operação medindo esse gatilho.
