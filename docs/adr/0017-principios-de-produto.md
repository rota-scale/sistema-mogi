# ADR 0017: Princípios de produto, com a funcionalidade na frente
**Status:** Proposta · **Data:** 14/11/2026

## Contexto
A build de teste está de pé e vai a campo. A auditoria de 14/11 ([auditoria](../auditoria-2026-11-14.md)) mostrou que os problemas mais graves não eram de visual: eram pontos em que a pessoa ficava sem saída (GPS negado, foto recusada, sessão vencida, resolver sem volta). O Russo pediu que a funcionalidade fosse a premissa das decisões, com o Waze como modelo de facilidade ([benchmark](../benchmark-waze.md)).

## Decisão
Toda tela e toda rota nova é revisada contra estes princípios, nesta ordem de prioridade:

1. **Sem beco sem saída.** Toda falha diz o que fazer e deixa tentar de novo sem perder o que já foi feito. Se um recurso do aparelho falha (GPS, câmera, rede), existe um caminho manual.
2. **Dois toques para o morador.** O caminho feliz do relato tem no máximo 2 toques além da câmera. Campo novo só entra como opcional.
3. **O mapa nunca some.** No celular, lista e detalhe abrem por cima do mapa, em folha deslizante.
4. **O que é de outra pessoa não aparece.** O morador recebe um recibo com o que é dele; nada do chamado alheio, mesmo quando o relato é agrupado.
5. **Toda ação da prefeitura fica registrada e tem volta.** Revisar, despachar, resolver e reabrir gravam quem fez e quando, na tabela `eventos`.
6. **Celular primeiro.** Alvos de toque de 44 px ou mais, texto de 15 px ou mais, e a tela é conferida em 390 x 844 antes de ir para revisão.
7. **Tela de quem opera fala a língua de quem opera.** Operador, equipe de campo e gestor são servidores com pouco tempo e pouco treinamento. Cada tela responde, em português comum, a quatro perguntas: o que é, onde é, quão urgente e o que fazer agora. Um botão principal por vez, conforme a situação do chamado; o resto fica em "Mais opções". Termo interno do sistema (GUT, confiança, provedor, etapa, custo por relato) não aparece na operação: fica num bloco fechado de detalhes da triagem, só para o gestor. Pedido do Russo em 14/11, ao ver a primeira versão do detalhe do chamado.
8. **Estética a serviço da leitura.** Cor comunica o nível (Protocolo de Manchester, ADR 0010) e sempre vem com número ou rótulo; a marca MOGI segue `brand/`.

## Alternativas consideradas
- Seguir só o guia visual da marca: não cobre comportamento em falha, que foi onde a build mais errou.
- Adotar um sistema de design pronto: custo de migração alto a uma semana do hackathon.

## Consequências
A revisão de PR ganha uma lista objetiva. Alguns recursos ficam mais lentos de entregar porque precisam do caminho de falha junto. Os princípios 4 e 5 já estão no código desde 14/11; os demais guiam as próximas ondas.
