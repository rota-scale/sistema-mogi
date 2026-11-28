---
id: eixo-04-neuro-simbolico-geoai
title: "Neuro-simbólico, GeoAI H3 e equidade territorial"
tier: P1-Critico
rank_score: 94
status: "Roadmap Piloto 2027"
tags:
  - neuro-simbolico
  - lua-regras
  - geoai-h3
  - equidade-territorial
  - banca-akcit
related:
  - ../P1-evidencias-ia-govtech-2026.md
  - 01-incerteza-conformal.md
  - 02-modelos-decisao-encoders-nao-llm.md
  - 05-benchmarks-govtech-b2g.md
---

# 04 — Neuro-simbólico, GeoAI H3 e equidade territorial

#neuro-simbolico #lua-regras #geoai-h3 #equidade-territorial #banca-akcit #piloto-2027

Hub: [README](../README.md) · Consolidado: [P1](../P1-evidencias-ia-govtech-2026.md) · Grafo: [knowledge-graph.json](../knowledge-graph.json)

Relacionados: [[01-incerteza-conformal]] · [[02-modelos-decisao-encoders-nao-llm]] · [[05-benchmarks-govtech-b2g]]

## Status no MOGI

| Camada | Status | O que isso quer dizer |
|---|---|---|
| Decisão final em regras Lua (gopher-lua) + matriz GUT 1–5 | **Em produção na demo** | “IA sugere, a prefeitura decide” já é o desenho do produto. |
| Agrupamento espacial de relatos em H3 / PostGIS | **Em produção na demo** | Relatos repetidos no mesmo hexágono reforçam o chamado. |
| Compensação de equidade na nota de Tendência | **Roadmap Piloto 2027** | Informada pelos papers de 311; ainda não é regra em produção. |
| Embeddings Hex2Vec por hexágono | **Roadmap Piloto 2027** | Contexto territorial além da contagem bruta. |
| LogiCity e CMU/DARPA | **Benchmark / método** | Sustentam o desenho neuro-simbólico; não estão no código. |

## Neuro-simbólico: percepção neural + motor de regras

### LogiCity (CMU / University of Toronto, 2024)

- [arXiv:2411.00773](https://arxiv.org/abs/2411.00773) · Score 94 · Rank 4 · P1-Crítico
- Documenta ganho de arquiteturas neuro-simbólicas em raciocínio urbano abstrato com regras lógicas.
- Tradução para o MOGI: o modelo pode sugerir sinais e níveis; a política pública (SLA, travas, pesos) permanece legível em Lua.

### Multimodal Bayesian Network for Autonomous Triage (CMU / AGH, DARPA Triage Challenge, 2025)

- [arXiv:2512.18908](https://arxiv.org/abs/2512.18908) · Score 95 · Rank 3 · P1-Crítico
- Modelos visuais alimentando regras de especialistas elevaram a **acurácia de triagem de 14% (só visão) para 53%**, e a **cobertura diagnóstica de 31% para 95%**.
- É a evidência quantitativa mais direta de que “visão + regras de domínio” supera visão isolada — o mesmo princípio da cadeia Jev/encoder + Lua.

Estes dois papers são o respaldo acadêmico da fala da banca: não somos um chatbot; somos um sistema de decisão com política auditável.

## GeoAI em H3

### Hex2Vec (Kraina AI, 2021)

- [arXiv:2111.00970](https://arxiv.org/abs/2111.00970) · Score 85 · Rank 13
- Gera embeddings de cada hexágono H3 a partir do OpenStreetMap. A biblioteca referida na pesquisa é `srai`.
- Uso possível no piloto: caracterizar o hexágono (escolar, via arterial, área residencial periférica) e alimentar a cabeça tabular ou a regra Lua com contexto, não só com a contagem de relatos.

O módulo correspondente no produto é **PostGIS + H3**, já usado para agrupamento. Hex2Vec é acréscimo, não substituição.

## O ponto cego da equidade territorial

### Cornell Tech, Nature Computational Science (2023)

- [s43588-023-00572-6](https://www.nature.com/articles/s43588-023-00572-6) · Score 93 · Rank 5 · P1-Crítico
- Usa relatos repetidos de 311 para medir demora e urgência.
- Documenta o risco crítico: **bairros de renda mais alta reportam mais**. Somar relatos crua favorece quem já tem voz.

### Berkeley / MIT / Cornell (2025)

- [arXiv:2506.08740](https://arxiv.org/abs/2506.08740) · Score 89 · Rank 9 · P1-Crítico
- Complementa a evidência sobre inspeção urbana e 311 (demora, urgência e viés territorial).

**Tradução para o MOGI.** A Tendência viva (recalcular T a cada relato no mesmo quadrante H3) é uma força do produto, mas herda esse viés se ficar só na contagem. A inovação é uma **regra de compensação de equidade em Lua**, auditável pelo gestor, para que bairro periférico com menor volume de relatos não perca prioridade por subnotificação. Os pesos e o critério exato saem de dado real do piloto, não deste documento.

## O que não afirmar

- Que a regra de equidade já está em produção.
- Que os papers de 311 estudaram Itamogi (estudaram sistemas 311; o risco é o mesmo tipo de sinal).
- Que Hex2Vec já está ligado ao PostGIS do MOGI.
