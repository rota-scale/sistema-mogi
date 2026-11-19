# ADR 0020: Envio anônimo, repetível e com limite por aparelho
**Status:** Substituída pelo [0024](0024-cadastro-do-morador-com-cpf.md) · **Data:** 14/11/2026

> Em 16/11/2026 o envio passou a exigir o cadastro do morador com CPF ou CNPJ (ADR 0024). A idempotência, os dois limites, o recibo e os códigos de erro descritos aqui continuam valendo; só o "sem conta" deixou de valer, e volta se o gestor desligar o módulo `cadastro`.

## Contexto
O relato do morador é aberto, sem conta (decisão do sprint de 11/11, sem ADR até aqui). A auditoria de 14/11 achou quatro problemas nesse envio: tentar de novo depois de um tempo esgotado duplicava o relato e subia a prioridade sozinho; o limite de 12 envios por IP punia vizinhos na mesma operadora móvel e era burlável trocando um cabeçalho; e a resposta devolvia o chamado inteiro, vazando o relato de outra pessoa quando havia agrupamento.

## Decisão
- **Sem conta e sem dado pessoal.** O morador não se identifica. O texto do relato é gravado já sem e-mail, CPF, telefone e placa.
- **Chave de idempotência.** O app gera um UUID por relato e manda em `Idempotency-Key`. A mesma chave devolve o mesmo recibo, com `repetido: true`, sem novo relato nem nova triagem. A chave fica em `relatos.id_cliente`, com índice único; envios simultâneos da mesma chave esperam o primeiro terminar.
- **Dois limites.** 12 envios a cada 10 minutos por aparelho (UUID aleatório em `X-Mogi-Aparelho`, guardado no navegador) e um teto de 120 por IP. Os cabeçalhos de proxy só valem com `PROXY_CONFIAVEL=true`, que o `make tunel` liga.
- **Recibo, não o chamado.** A resposta traz protocolo, chave de acompanhamento, nível, status, prazo e o endereço do próprio ponto. Nada que pertença ao chamado de outro morador.
- **Erros com código estável** (`foto_formato`, `fora_da_cidade`, `muitos_envios` e outros), para o app mostrar uma frase própria.
- **Cerca da cidade opcional** (`CIDADE_CAIXA`), desligada por padrão para permitir teste fora de Itamogi.
- **Trava no agrupamento.** O registro toma uma trava por categoria dentro da transação, para dois primeiros relatos simultâneos não virarem dois chamados.

## Alternativas consideradas
- Exigir login ou telefone do morador: mais atrito e mais dado pessoal guardado; contraria o MVP.
- CAPTCHA: atrito para idoso e dependência de terceiro.
- Limite só por IP: injusto na rede móvel.

## Consequências
Rede ruim deixa de gerar duplicata, o que também prepara a fila de envio sem rede. O identificador do aparelho é escolhido pelo cliente, então quem quiser abusar troca o identificador e cai no teto por IP; por isso os dois limites existem juntos. Os limites vivem na memória de cada instância: com mais de uma réplica, passam a valer por réplica (a rever no ADR de escala).
