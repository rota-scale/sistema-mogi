---
id: eixo-05-benchmarks-govtech
title: "Benchmarks GovTech e B2G"
tier: P1-Critico
rank_score: 100
status: "Benchmark externo"
tags:
  - govtech-b2g
  - edital-pe
  - banca-akcit
related:
  - ../P1-evidencias-ia-govtech-2026.md
  - 03-edge-privacidade-dados-br.md
  - 04-neuro-simbolico-geoai-equidade.md
  - ../../../bmc/README.md
  - ../../../pitch/README.md
---

# 05 — Benchmarks GovTech e B2G

#govtech-b2g #edital-pe #banca-akcit #lgpd-borda

Hub: [README](../README.md) · Consolidado: [P1](../P1-evidencias-ia-govtech-2026.md) · Grafo: [knowledge-graph.json](../knowledge-graph.json)

Relacionados: [[03-edge-privacidade-dados-br]] · [[04-neuro-simbolico-geoai-equidade]] · BMC: [bmc/README.md](../../../bmc/README.md) · Pitch: [pitch/README.md](../../../pitch/README.md)

## Status no MOGI

Tudo neste eixo é **Benchmark externo**. Nenhuma destas plataformas é o MOGI, e o MOGI não declara tê-las implantado. Elas validam a dor, o escopo e o canal, e posicionam o produto como a versão enxuta para **cidade pequena**.

## Desafio Xexéu/PE (31/07/2026) — a evidência nº 1 para a banca

- Governo de Pernambuco / Prefeitura de Xexéu, desafio “Plataforma Inteligente de Zeladoria Urbana”
- [desafios.pe.gov.br — documento 337](https://desafios.pe.gov.br/portal/home/getchallengedocument/337)
- Score 100 · Rank 1 · P1-Crítico · tags `#edital-pe` `#govtech-b2g` `#banca-akcit` `#lgpd-borda`

O edital pede, quase item por item, o recorte do MOGI:

- foto ou vídeo obrigatórios na abertura e no fechamento;
- agrupamento de relatos repetidos elevando a prioridade;
- prioridade automática;
- WhatsApp como canal;
- LGPD com borrão de rostos e placas, e retenção com prazo;
- painel público sem expor CPF/nome.

Fala pronta: *“nossa dor já está em edital público oficial.”* Não dizer que o MOGI venceu ou se inscreveu nesse desafio, a menos que isso passe a ser fato documentado em outro lugar do repositório.

## Novo Conecta (Recife / Emprel)

- [solucoes.emprel.gov.br — lançamento do Novo Conecta](https://solucoes.emprel.gov.br/recife-lanca-novo-conecta-com-ia-servicos-personalizados-e-foco-em-inclusao/)
- Score 97 · Rank 2
- Capital, app de zeladoria com foto e IA para buraco. Evidência pública verificada: **mais de 2 milhões de downloads** e **mais de 500 mil no Conecta Zap**.

Posicionamento: prova que o modelo existe no Brasil, em metrópole, com time e orçamento de capital. O MOGI não compete nesse porte; entrega o equivalente acessível para município pequeno (Itamogi e consórcios).

## OneService (GovTech Singapura)

- [tech.gov.sg — Developing the One Service chatbot](https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/)
- Score 92 · Rank 6
- Canal WhatsApp/Telegram, **160 mil casos**, **80%** de acerto no tipo de caso e **85%** no órgão responsável.
- Lição prática verificada: a **foto ajudou mais no roteamento do que no tipo de caso**.

Tradução: o WhatsApp do MOGI (quando for além de demonstração rotulada) deve reutilizar o mesmo pipeline de decisão, e a visão deve ser julgada também pelo ganho de roteamento, não só pela categoria.

## Auto311 (Vanderbilt / Nashville)

- [arXiv:2312.14185](https://arxiv.org/abs/2312.14185) · Score 77 · Rank 21
- Roteamento de chamados não emergenciais por confiança, com **F1 de 92,54%** no estudo.

Cruza com o [eixo 01](01-incerteza-conformal.md): Auto311 demonstra roteamento por confiança; o MOGI planeja ir além do corte pontual, com conformal e revisão obrigatória nos níveis 4 e 5.

## Como usar no BMC e no pitch

| Bloco | Uso honesto da evidência |
|---|---|
| Proposta de valor | Edital de Xexéu mostra demanda pública explícita; Recife e Singapura mostram adoção em escala maior |
| Canais | WhatsApp/Telegram validados pelo OneService e pelo Conecta Zap; no MOGI, não chamar de “WhatsApp em produção” o que ainda for sandbox ou mock |
| Segmento | Cidade pequena e consórcio — o contrário do orçamento de Recife ou de Singapura |
| Diferencial | Neuro-simbólico + Lua + equidade H3 + custo de 1 servidor, ver [P1 §2](../P1-evidencias-ia-govtech-2026.md) |

## O que não afirmar

- Que o MOGI é o Conecta, o OneService ou o Auto311.
- Que os 2 milhões de downloads, os 160 mil casos ou o F1 92,54% são métricas do MOGI.
- Que o WhatsApp da demo já é canal oficial da prefeitura.
