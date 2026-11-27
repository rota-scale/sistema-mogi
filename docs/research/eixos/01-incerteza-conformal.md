---
id: eixo-01-incerteza-conformal
title: "Incerteza e revisão humana (Conformal Prediction)"
tier: P1-Critico
rank_score: 91
status: "Roadmap Piloto 2027"
tags:
  - conformal-prediction
  - revisao-humana-4-5
  - piloto-2027
  - banca-akcit
related:
  - ../P1-evidencias-ia-govtech-2026.md
  - 02-modelos-decisao-encoders-nao-llm.md
  - 04-neuro-simbolico-geoai-equidade.md
  - 05-benchmarks-govtech-b2g.md
---

# 01 — Incerteza e revisão humana (Conformal Prediction)

#conformal-prediction #revisao-humana-4-5 #piloto-2027 #banca-akcit #lua-regras

Hub: [README](../README.md) · Consolidado: [P1](../P1-evidencias-ia-govtech-2026.md) · Grafo: [knowledge-graph.json](../knowledge-graph.json)

Relacionados: [[02-modelos-decisao-encoders-nao-llm]] · [[04-neuro-simbolico-geoai-equidade]] · [[05-benchmarks-govtech-b2g]]

## Status no MOGI

| Camada | Status | O que isso quer dizer |
|---|---|---|
| Revisão humana obrigatória nos níveis 4 e 5 | **Em produção na demo** | Já é regra de produto. Não depende deste eixo para a banca de amanhã. |
| Calibração conformal da escala GUT 1–5, conjuntos de notas e roteamento seletivo | **Roadmap Piloto 2027** | Entra quando houver cerca de 500 relatos rotulados pela prefeitura. |
| Papers abaixo | **Benchmark / método** | Informam o desenho; nenhum está plugado no código hoje. |

## Por que este eixo existe

A demo já manda o grave para o servidor. O risco, no piloto, é automatizar o restante com um corte de probabilidade escolhido no olho. A família conformal permite calibrar **qualquer** classificador (Jev hoje, encoder + TabPFN depois) e devolver um conjunto de notas com garantia estatística, em vez de um único número frágil.

## Fontes verificadas

### Conformal Prediction — texto de referência

- Angelopoulos & Bates, [arXiv:2107.07511](https://arxiv.org/abs/2107.07511)
- **Status:** Roadmap Piloto 2027 · **Score MOGI:** 84 · **Rank:** 14
- Apresenta o método. Com um conjunto de calibração rotulado, o classificador passa a oferecer cobertura estatística (por exemplo, o valor verdadeiro cai no conjunto predito com frequência pelo menos 1 − α).

### Conformal Risk Control (ICLR 2024)

- [arXiv:2208.02814](https://arxiv.org/abs/2208.02814)
- **Status:** Roadmap Piloto 2027 · **Score MOGI:** 86 · **Rank:** 12
- Controla um risco esperado, não só a cobertura. No MOGI, isso permite penalizar mais o erro quando o nível verdadeiro é 5 (cano estourado classificado como 2 é pior do que o inverso).

### Conformal Ordinal

- [arXiv:2404.16610](https://arxiv.org/abs/2404.16610)
- **Status:** Roadmap Piloto 2027 · **Score MOGI:** 91 · **Rank:** 7 · P1-Crítico
- Feito para escalas ordinais — encaixa na GUT 1–5. A saída típica é um conjunto como `{3, 4}`, não um rótulo único. A pesquisa verificada indica que a calibração é viável com cerca de 500 relatos rotulados.

### Human-in-the-loop

- [arXiv:2401.13744](https://arxiv.org/abs/2401.13744)
- **Status:** Roadmap Piloto 2027 · **Score MOGI:** 88 · **Rank:** 10
- Experimento controlado: pessoas decidem melhor quando recebem o conjunto conformal, e não apenas um rótulo pontual. Sustenta a interface do operador (“a IA oscila entre 3 e 4; confira”).

### Roteamento seletivo

- [arXiv:2509.12573](https://arxiv.org/abs/2509.12573)
- **Status:** Roadmap Piloto 2027 · **Score MOGI:** 87 · **Rank:** 11
- Casos ambíguos podem ir automaticamente para o revisor certo, em vez de parar todos ou não parar nenhum.

## Como isso entra no MOGI

1. **Demo (não mudar):** níveis 4 e 5 sempre sobem; confiança baixa já pode pedir revisão (ver inovação GUT em [inovacao-e-diferenciais.md](../../inovacao-e-diferenciais.md)).
2. **Piloto 2027:** reservar um conjunto de calibração (~500 relatos com nível confirmado pelo operador). Aplicar Conformal Ordinal + Risk Control sobre a cabeça de decisão. Se o conjunto for unitário e o nível for 1–3, despacho automático; se o conjunto cruzar 4–5 ou for amplo, sobe para o servidor.
3. **Lua continua soberana:** conformal calibra e roteia; a política (faixas, travas de sinal, equidade) permanece nos scripts da prefeitura.

Cruza com [Auto311](https://arxiv.org/abs/2312.14185) (eixo [05](05-benchmarks-govtech-b2g.md)), que roteia por confiança com F1 92,54%. O MOGI não copia o corte pontual: soma garantia conformal à revisão 4–5 já existente.

## O que não afirmar

- Que a calibração conformal já roda na demo.
- Que 500 relatos são uma garantia universal; é a ordem de grandeza verificada na pesquisa para este desenho, a confirmar no piloto.
- Que conformal substitui a regra Lua.
