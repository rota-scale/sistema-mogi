---
id: eixo-06-horizonte-hype
title: "Horizonte (world models / SSM) e hype descartado"
tier: P2-Horizonte
rank_score: 58
status: Horizonte
tags:
  - world-model
  - ssm-vision
  - descartado-hype
  - nao-llm
related:
  - ../P1-evidencias-ia-govtech-2026.md
  - 02-modelos-decisao-encoders-nao-llm.md
---

# 06 — Horizonte e hype descartado

#world-model #ssm-vision #descartado-hype #nao-llm

Hub: [README](../README.md) · Consolidado: [P1](../P1-evidencias-ia-govtech-2026.md) · Grafo: [knowledge-graph.json](../knowledge-graph.json)

Relacionados: [[02-modelos-decisao-encoders-nao-llm]]

Este eixo existe para duas coisas: registrar famílias promissoras que **não** são o plano do piloto 2027, e deixar explícito o que **não** deve ser citado como solução do MOGI na banca.

## Horizonte — world models não-generativos (família JEPA)

Não geram tokens nem pixels. Aprendem representações e, em alguns casos, planejamento no espaço latente. Podem virar encoder ou world model no futuro; a decisão 1–5 continuaria numa cabeça classificadora e nas regras Lua.

| Fonte | URL | Ano | Origem verificada | Score | Rank |
|---|---|---|---|---:|---:|
| I-JEPA | [arXiv:2301.08243](https://arxiv.org/abs/2301.08243) | 2023 | Meta FAIR, CVPR 2023 | 50 | 35 |
| V-JEPA | [arXiv:2404.08471](https://arxiv.org/abs/2404.08471) | 2024 | Meta FAIR / Inria | 54 | 34 |
| V-JEPA 2 | [arXiv:2506.09985](https://arxiv.org/abs/2506.09985) | 2025 | Meta FAIR | 58 | 33 |
| M3-JEPA | [arXiv:2409.05929](https://arxiv.org/abs/2409.05929) | 2024 | extensão multimodal latente | 48 | 36 |
| TI-JEPA | [arXiv:2503.06380](https://arxiv.org/abs/2503.06380) | 2025 | extensão texto+imagem latente | 46 | 37 |

**Quando (e só então) isso entra no MOGI:** se o produto passar a usar vídeo ou a evolução temporal da ocorrência (por exemplo, o mesmo buraco ao longo de semanas). V-JEPA 2 é o marco mais recente dessa linha. Não é item do piloto 2027 e não deve aparecer no pitch de 3 minutos, a menos que a banca pergunte explicitamente sobre vídeo ou “e depois do classificador estático?”.

Não atribuir JEPA à mentoria do Állan.

## Horizonte — backbones State Space (visão)

Candidatos a encoder mais barato em alta resolução, se no médio prazo o MOGI rodar inferência local ou em DC nacional com imagens grandes.

| Fonte | URL | Ano | Origem verificada | Score | Rank |
|---|---|---|---|---:|---:|
| VMamba | [arXiv:2401.10166](https://arxiv.org/abs/2401.10166) | 2024 | — | 44 | 38 |
| MambaVision | [arXiv:2407.08083](https://arxiv.org/abs/2407.08083) | 2024 | NVIDIA | 42 | 39 |

No piloto, SigLIP 2 / DINOv3 / MobileCLIP2 são o caminho preferido (eixo [02](02-modelos-decisao-encoders-nao-llm.md) e [03](03-edge-privacidade-dados-br.md)).

## Descartado (hype) — não citar como solução do MOGI

Estes papers existem e estão citados com URL correta. O descarte é de **uso no MOGI**, não um juízo de qualidade acadêmica.

### Liquid Neural Networks

- [arXiv:2006.04439](https://arxiv.org/abs/2006.04439) · 2020 · Score 8 · Rank 43
- Família voltada a **séries temporais**, não a classificação de imagem urbana com saída GUT 1–5.
- Por que caiu: não resolve foto + prioridade + regra municipal.

### UrbanCLIP

- [arXiv:2310.18340](https://arxiv.org/abs/2310.18340) · 2023 · Score 12 · Rank 41
- Foco em **satélite + LLM em megacidades**.
- Por que caiu: fora do recorte de cidade pequena, foto de rua tirada pelo morador, e decisão não-LLM.

### GeoCLIP

- [arXiv:2309.16020](https://arxiv.org/abs/2309.16020) · 2023 · Score 10 · Rank 42
- Localiza a foto **sem GPS**.
- Por que caiu: o MOGI já recebe GPS do aparelho. Não resolve priorização, equidade nem LGPD.

### Grounding DINO em tempo real sem GPU

- [arXiv:2303.05499](https://arxiv.org/abs/2303.05499) · IDEA Research, 2023 · Score 18 · Rank 40
- Detector open-set, útil como referência de literatura (por isso também aparece no [eixo 02](02-modelos-decisao-encoders-nao-llm.md)).
- Por que o **uso** está descartado: tempo real sem GPU não é realista no servidor enxuto do piloto. Se houver detector, a linha a avaliar é RT-DETRv2 / YOLO-World / YOLOE, ainda assim com o aviso de que os FPS dos papers são em GPU.

## O que não afirmar

- Que world models ou Mamba já fazem parte da arquitetura da demo.
- Que “descartado” significa paper ruim.
- Qualquer um destes nomes como resposta à pergunta “qual o modelo do MOGI?”. A resposta da demo é Jev + Lua; a do piloto é encoder leve + cabeça tabular + Lua.
