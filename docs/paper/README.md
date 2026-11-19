# Paper técnico v0.2

**Gravidade com probabilidade: triagem urbana calibrada para zeladoria em cidades pequenas.** Equipe ROTA Scale, AKCIT Camp Sul 2026, 02/11/2026. Estado: proposta para revisão, sem dado de campo.

- PDF: `sistema-mogi-triagem-urbana-v0_2.pdf` (a anexar, ver nota)
- Texto extraído: [sistema-mogi-triagem-urbana-v0_2.txt](sistema-mogi-triagem-urbana-v0_2.txt)

## Resumo
Formaliza a triagem do MOGI: visão descreve a mídia, o Jev devolve distribuições de G, U e T e sinais de risco, e uma regra Lua da prefeitura decide o nível de 1 a 5 no estilo Manchester. Três quantidades: GUT esperada (ordena), GUT pessimista p90 (decide sob incerteza) e piso por sinal crítico. No cano estourado, a esperada é 90,2 (nível 4), mas P(X>=100)=0,52 e p90=125 (nível 5). Propõe regra por probabilidade de excedência e seis hipóteses (H1 a H6) com protocolo para o piloto em Itamogi.

## O que mudou na v0.2
- Fluxo completo na Figura 1: visão, Jev, RAG de prazo e regra local, Lua e function calling, com um dono por decisão.
- RAG não escolhe mais a secretaria, só consulta prazo e regra local.
- Nova hipótese H7: triagem completa em até 10 s, medida por etapa no teste alpha.
- Primeira medida passa a ser o teste de campo alpha em Itamogi até 14/11.
- Números da Seção 4 não mudaram.
