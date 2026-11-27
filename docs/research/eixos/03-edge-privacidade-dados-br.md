---
id: eixo-03-edge-privacidade
title: "Visão na borda, privacidade e dados brasileiros"
tier: P1-Alto
rank_score: 81
status: "Roadmap Piloto 2027"
tags:
  - edge-vision
  - lgpd-borda
  - dataset-br
  - piloto-2027
related:
  - ../P1-evidencias-ia-govtech-2026.md
  - 02-modelos-decisao-encoders-nao-llm.md
  - 05-benchmarks-govtech-b2g.md
---

# 03 — Visão na borda, privacidade e dados brasileiros

#edge-vision #lgpd-borda #dataset-br #piloto-2027 #few-shot-tabular

Hub: [README](../README.md) · Consolidado: [P1](../P1-evidencias-ia-govtech-2026.md) · Grafo: [knowledge-graph.json](../knowledge-graph.json)

Relacionados: [[02-modelos-decisao-encoders-nao-llm]] · [[05-benchmarks-govtech-b2g]]

## Status no MOGI

| Camada | Status | O que isso quer dizer |
|---|---|---|
| Borrão de rostos/placas e limpeza de PII no fluxo do servidor | **Em produção na demo** | Documentado no [ADR 0008](../../adr/0008-midia-e-privacidade-lgpd.md) e no fluxo do agente. O borrão ainda precisa de validação com fotos reais de campo. |
| Filtro indoor e borrão **no aparelho, antes do upload** | **Roadmap Piloto 2027** | Reduz tráfego, custo e exposição. |
| EgoBlur | **Roadmap**, licença **pendente** | Não usar em produção antes da checagem jurídica da licença. |
| BR-AsPavDam, RDD2022, Snorkel | **Roadmap Piloto 2027** | Preparação do dataset de Itamogi, não dado de produção. |

## Visão no aparelho

### MobileCLIP (Apple, CVPR 2024)

- [arXiv:2311.17049](https://arxiv.org/abs/2311.17049) · Score 74 · Rank 24
- Antecessor do MobileCLIP2. Encoder multimodal eficiente para dispositivo móvel.

### MobileCLIP2 (Apple, 2025)

- [arXiv:2508.20691](https://arxiv.org/abs/2508.20691) · Score 81 · Rank 17
- No paper, empata com SigLIP-SO400M sendo cerca de **2× menor**, com latência publicada de **3 a 15 ms em iPhone**.
- Candidato a rodar no celular do morador para um julgamento leve (cena indoor vs. rua) **antes** da foto sair do aparelho.

### Places365 (MIT CSAIL)

- [github.com/CSAILVision/places365](https://github.com/CSAILVision/places365) · Score 78 · Rank 20
- Taxonomia e modelos de cenas, inclusive indoor/outdoor. Combinado ao MobileCLIP2, permite recusar foto doméstica ou de interior que não é zeladoria urbana.

## Privacidade: EgoBlur e o aviso de licença

- EgoBlur (Meta), [arXiv:2308.13093](https://arxiv.org/abs/2308.13093) · Score 72 · Rank 26
- Borrão de rostos e placas. No estudo, mais de 90% de acerto em rostos.
- **Licença pendente de checagem antes de qualquer uso em produção.** Até lá, o MOGI permanece no borrão já documentado no próprio fluxo, a validar com fotos reais de Itamogi.

Este eixo também dialoga com o [desafio de Xexéu/PE](https://desafios.pe.gov.br/portal/home/getchallengedocument/337) (eixo [05](05-benchmarks-govtech-b2g.md)), que já pede borrão de rostos/placas e retenção com prazo em edital público.

## Dados e rotulagem

### BR-AsPavDam (Cascavel-PR)

- [doi:10.5281/zenodo.16291115](https://doi.org/10.5281/zenodo.16291115) · Score 76 · Rank 22
- Dataset **brasileiro** aberto de dano viário: **2.167 imagens**, classes do **DNIT**, licença **CC-BY 4.0**.
- Ponto de partida honesto para adaptar um encoder ao padrão de pavimento brasileiro, antes dos dados reais de Itamogi.

### RDD2022

- [arXiv:2209.08538](https://arxiv.org/abs/2209.08538) · Score 73 · Rank 25
- **47.420 imagens** de dano viário em **6 países**. Complementar, não substituto do BR-AsPavDam (que traz classes DNIT e contexto nacional).

### Snorkel (Stanford)

- [arXiv:1711.10160](https://arxiv.org/abs/1711.10160) · Score 71 · Rank 27
- Rotulagem programática: funções de rotulagem (regras da prefeitura, palavras do relato, sinais visuais grosseiros) geram rótulos-candidato que o servidor revisa. Acelera o conjunto inicial do piloto sem fingir que já existe um dataset grande.

## Como isso entra no MOGI

1. **Demo:** manter o borrão e a limpeza de PII atuais; não trocar de biblioteca na véspera da banca.
2. **Piloto:** filtro indoor no App Morador (MobileCLIP2 + Places365) → upload só do que passou → borrão (biblioteca atual ou EgoBlur se a licença deixar) → encoder/classificador.
3. **Dados:** começar pelo BR-AsPavDam (CC-BY 4.0) + amostra do RDD2022; usar Snorkel + revisão humana para rotular os relatos reais de Itamogi.

## O que não afirmar

- Que o filtro indoor já roda no app da demo.
- Que o EgoBlur já foi liberado juridicamente para o piloto.
- Que 2.167 imagens do BR-AsPavDam substituem o dataset rotulado da própria cidade.
