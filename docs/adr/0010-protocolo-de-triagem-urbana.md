# ADR 0010: Protocolo de triagem urbana (Manchester + GUT calibrada)
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
Concorrentes priorizam por categoria, ordem de chegada ou votos. O Russo pediu triagem de 1 a 5 como a hospitalar, usando o Jev da TypeSafe ("GEV" na conversa), que devolve decisões tipadas com probabilidades calibradas.

## Decisão
- Cinco níveis com cores e tempo máximo, estilo Manchester.
- O Jev preenche um esquema fixo: sinais de risco sim/não com probabilidade e distribuições de G, U e T sobre 1 a 5.
- GUT esperada ordena a fila; GUT pessimista (p90) define o nível sob incerteza alta; sinal crítico acima do limiar trava o nível mínimo.
- Tendência recalculada a cada relato próximo.
- Confiança e entropia decidem despacho automático, revisão humana (sempre em 4 e 5) ou pedido de nova foto.
- **Aceito (01/11/2026):** sinais por categoria, limiares e pesos GUT ficam em scripts Lua por prefeitura (ADR 0013), editáveis no Admin sem deploy; o Jev calcula as probabilidades e o Lua aplica a regra; calibração medida com Brier e ECE.
- Detalhes e exemplo em [inovacao-e-diferenciais.md](../inovacao-e-diferenciais.md). Fórmulas e limiares são proposta a calibrar no piloto.

## Alternativas consideradas
- Prioridade fixa por categoria: ignora o contexto.
- GUT com nota única: esconde a incerteza.
- LLM gerando a nota em texto: mais lento, caro e sujeito a erro de formato.

## Consequências
Triagem auditável, explicável e barata a ponto de rodar a cada evento. Depende de um fornecedor em acesso antecipado (ver ADR 0007) e exige manter os sinais por categoria.

Atualização em 15/11/2026: como está no código, a regra Lua devolve `{ nivel, motivo }`, a tendência sobe 35% da massa por relato extra, a dúvida vai para a revisão humana (não há pedido automático de nova foto) e a calibração por Brier e ECE ainda não foi implementada. Ver [docs/fluxo-do-agente.md](../fluxo-do-agente.md).
