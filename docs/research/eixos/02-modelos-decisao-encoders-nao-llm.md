---
id: eixo-02-modelos-decisao
title: "Modelos de decisão e encoders não-LLM"
tier: P1-Critico
rank_score: 90
status: "Em produção na demo"
tags:
  - nao-llm
  - modelo-decisao
  - few-shot-tabular
  - edge-vision
  - piloto-2027
related:
  - ../P1-evidencias-ia-govtech-2026.md
  - 01-incerteza-conformal.md
  - 03-edge-privacidade-dados-br.md
  - 06-horizonte-e-hype-descartado.md
---

# 02 — Modelos de decisão e encoders não-LLM

#nao-llm #modelo-decisao #few-shot-tabular #edge-vision #piloto-2027 #banca-akcit

Hub: [README](../README.md) · Consolidado: [P1](../P1-evidencias-ia-govtech-2026.md) · Grafo: [knowledge-graph.json](../knowledge-graph.json)

Relacionados: [[01-incerteza-conformal]] · [[03-edge-privacidade-dados-br]] · [[06-horizonte-e-hype-descartado]]

## Status no MOGI

| Camada | Status | O que isso quer dizer |
|---|---|---|
| Jev (TypeSafe System One) classificando **texto** com saída tipada | **Em produção na demo** | Motor atual, barato e sem geração de texto livre. |
| Imagem no Jev (PNG/JPEG) | **Experimental** (docs oficiais) | Não afirmar que está em produção. Ver [docs de imagens](https://docs.typesafe.ai/images). |
| Encoder visual aberto + cabeça tabular (SigLIP 2 / DINOv3 + TabPFN ou GBDT) | **Roadmap Piloto 2027** | Caminho para modelo próprio, sem fine-tune da TypeSafe. |
| Detectores RT-DETRv2, YOLO-World, YOLOE | **Roadmap** (avaliação) | Só visão de anomalia; FPS publicado é em GPU. |
| Grounding DINO em tempo real sem GPU | **Descartado (hype)** | Documentado aqui só como referência; justificativa no [eixo 06](06-horizonte-e-hype-descartado.md). |

## TypeSafe Jev — fatos oficiais e limites

Fontes oficiais (não usar postagens secundárias no lugar destas):

- [System One](https://docs.typesafe.ai/concepts/system-one)
- [Jev 1.14](https://typesafe.ai/blog/jev-1-14)
- [Models e pricing](https://docs.typesafe.ai/models)
- [Images](https://docs.typesafe.ai/images)

Fatos verificados:

- É um modelo de **decisão tipada** (System One), não um LLM gerador de texto.
- Preço: entrada US$ 0,042 / milhão de tokens, saída grátis.
- Não há oferta documentada de fine-tune com dados do cliente.
- Imagem: suporte documentado como experimental (`TypeSafe-Danger-Zone-Images`). A TypeSafe alerta que os modelos ainda performam pior em multimodalidade do que em texto puro.
- Arquitetura interna não é aberta.

A decisão vigente no repositório continua sendo o [ADR 0007](../../adr/0007-agente-de-triagem.md). Este eixo não a revoga. Ele registra os limites oficiais e o plano B de modelo próprio.

## Encoders visuais e texto (piloto 2027)

### SigLIP 2 (Google DeepMind, 2025)

- [arXiv:2502.14786](https://arxiv.org/abs/2502.14786) · Score 83 · Rank 15
- Checkpoints abertos multilíngues a partir de **ViT-B 86M**, cabe em inferência local enxuta.
- Candidato principal a embedding da foto no lugar do captioner externo.

### DINOv3 (Meta FAIR, 2025)

- [arXiv:2508.10104](https://arxiv.org/abs/2508.10104) · Score 82 · Rank 16
- Backbone auto-supervisionado, forte em features densas e cenas urbanas/aéreas, com variantes destiladas leves.
- Alternativa ou complemento ao SigLIP 2 quando o que importa é a geometria da cena, não o alinhamento texto-imagem.

### ModernBERT (Answer.AI / LightOn, 2024)

- [arXiv:2412.13663](https://arxiv.org/abs/2412.13663) · Score 70 · Rank 28
- Encoder-only para o texto e os metadados do relato, sem decoder generativo.

## Cabeças tabulares few-shot

Feitas para o regime do piloto (centenas a poucos milhares de linhas; a família TabPFN é referida para até cerca de 10 mil linhas).

| Fonte | URL | Ano | Score | Nota verificada |
|---|---|---|---:|---|
| TabPFN v2 (Nature, jan 2025) | [s41586-024-08328-6](https://www.nature.com/articles/s41586-024-08328-6) | 2025 | 79 | Artigo na Nature. Classificador tabular few-shot. |
| TabICL (Inria) | [arXiv:2502.05564](https://arxiv.org/abs/2502.05564) | 2025 | 75 | In-context tabular, complementar ao TabPFN. |
| TabPFN-2.5 (Prior Labs) | [arXiv:2511.08667](https://arxiv.org/abs/2511.08667) | 2025/2026 | 80 | Evolução da família, mesmo recorte de poucos dados. |

Padrão de engenharia (late fusion), ainda no papel: embeddings de SigLIP 2 ou DINOv3 + features H3/GPS + histórico urbano + texto (ModernBERT ou equivalente) → LightGBM / XGBoost **ou** TabPFN → urgência 1–5 → regras Lua por cima.

## Detectores visuais não-LLM (China)

Úteis se o time quiser localizar o dano na imagem (buraco, vazamento), não só embutir a foto inteira.

| Fonte | URL | Ano | Score | Cuidado |
|---|---|---|---:|---|
| RT-DETRv2 (Baidu) | [arXiv:2407.17140](https://arxiv.org/abs/2407.17140) | 2024 | 68 | FPS publicado é em GPU, não em CPU. |
| YOLO-World (Tencent, CVPR 2024) | [arXiv:2401.17270](https://arxiv.org/abs/2401.17270) | 2024 | 66 | Idem. Open-vocabulary. |
| YOLOE (Tsinghua, ICCV 2025) | [arXiv:2503.07465](https://arxiv.org/abs/2503.07465) | 2025 | 64 | Idem. |
| Grounding DINO (IDEA Research) | [arXiv:2303.05499](https://arxiv.org/abs/2303.05499) | 2023 | 18 | **Descartado** como solução em tempo real sem GPU. Ver [eixo 06](06-horizonte-e-hype-descartado.md). |

## O que não afirmar

- Que o Jev multimodal já é production-ready.
- Que a TypeSafe treina ou afina o modelo com dados de Itamogi.
- Que JEPA, SigLIP ou DINOv3 foram citados pelo Állan.
- Que detectores chineses já cabem no servidor de 2 vCPU do piloto, com os FPS do paper.
