# Evidências P1 — IA não-LLM, GovTech e diferenciação do Sistema MOGI

**Grau:** P1 (consulta permanente)  
**Pesquisas:** RTLG-9 e RTLG-10  
**Data:** 27/11/2026 (America/Sao_Paulo)  
**Hub, ranking, hashtags e grafo:** [README.md](README.md) · [knowledge-graph.json](knowledge-graph.json)

Este documento é o mapa consolidado para a banca, o BMC e as próximas releases. Ele **não** altera a arquitetura que roda na demo e **não** substitui o [ADR 0007](../adr/0007-agente-de-triagem.md).

#nao-llm #modelo-decisao #neuro-simbolico #lua-regras #conformal-prediction #revisao-humana-4-5 #geoai-h3 #equidade-territorial #edge-vision #lgpd-borda #dataset-br #few-shot-tabular #govtech-b2g #edital-pe #piloto-2027 #banca-akcit

## 1. O que está em cada status

### Em produção na demo

Pipeline documentado hoje:

1. O morador captura foto/vídeo e o ponto no [App Morador](../../app).
2. Há um descritor de mídia (visão) e o **Jev (TypeSafe System One)** classifica no modo **texto**, com saída tipada (nível, categoria, sinais, distribuições G, U e T).
3. As **regras determinísticas da prefeitura em Lua** (gopher-lua) aplicam a política pública e fecham a prioridade.
4. **Revisão humana obrigatória nos níveis 4 e 5.**
5. Mídia recebe proteção de PII no fluxo já documentado (borrão, texto limpo). Coordenada e identidade não vão para o classificador como dado de treino ou de prompt identificável — ver [ADR 0007](../adr/0007-agente-de-triagem.md), [ADR 0008](../adr/0008-midia-e-privacidade-lgpd.md) e [fluxo do agente](../fluxo-do-agente.md).

Limites oficiais do Jev, que a banca precisa ouvir com precisão:

- Docs: [System One](https://docs.typesafe.ai/concepts/system-one), [Jev 1.14](https://typesafe.ai/blog/jev-1-14), [models/pricing](https://docs.typesafe.ai/models), [images](https://docs.typesafe.ai/images).
- Preço verificado: entrada US$ 0,042 / milhão de tokens, saída grátis.
- Suporte a PNG/JPEG existe, mas está documentado como **experimental** (header `TypeSafe-Danger-Zone-Images`). A própria TypeSafe alerta que os modelos ainda performam pior em multimodalidade do que em texto puro.
- Não há oferta documentada de **fine-tune com dados do cliente**. “Treinar um modelo próprio” no roadmap significa treinar um classificador aberto do time, não afinar o Jev.

### Roadmap Piloto 2027

Com relatos reais rotulados pela prefeitura de Itamogi (centenas a poucos milhares):

- Substituir o passo de captioning externo por um **encoder visual leve aberto** (SigLIP 2 ViT-B 86M ou DINOv3 destilado).
- Cabeça de decisão estruturada: **LightGBM / XGBoost ou TabPFN v2 / TabPFN-2.5 / TabICL**, em fusão tardia com H3, histórico e texto do relato.
- Manter as **mesmas regras Lua** como decisão final auditável.
- Calibrar a saída 1–5 com **Conformal Ordinal** (~500 relatos) e rotear casos ambíguos ou críticos (4–5) para o servidor.
- Na borda: filtro indoor (MobileCLIP2 + Places365) e borrão de rostos/placas (EgoBlur **somente após checagem de licença**).
- Rotulagem inicial acelerada com Snorkel + datasets [BR-AsPavDam](https://doi.org/10.5281/zenodo.16291115) e [RDD2022](https://arxiv.org/abs/2209.08538).
- Tendência H3 com regra de **equidade territorial** auditável em Lua, à luz dos estudos de 311 da Cornell e de Berkeley/MIT/Cornell.

### Benchmark externo

Não são features do MOGI. São provas de que a dor e o recorte existem:

- [Desafio da Prefeitura de Xexéu/PE](https://desafios.pe.gov.br/portal/home/getchallengedocument/337) (31/07/2026).
- [Novo Conecta (Recife / Emprel)](https://solucoes.emprel.gov.br/recife-lanca-novo-conecta-com-ia-servicos-personalizados-e-foco-em-inclusao/).
- [OneService (GovTech Singapura)](https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/).
- [Auto311 (Vanderbilt / Nashville)](https://arxiv.org/abs/2312.14185).
- [Cornell Tech, Nature Computational Science 2023](https://www.nature.com/articles/s43588-023-00572-6) e [Berkeley/MIT/Cornell 2025](https://arxiv.org/abs/2506.08740).

### Horizonte

Família JEPA (I-JEPA, V-JEPA, V-JEPA 2, M3-JEPA, TI-JEPA) e backbones SSM (VMamba, MambaVision). Só entram se o produto evoluir para vídeo, dinâmica temporal ou inferência local de alta resolução. Ver [eixo 06](eixos/06-horizonte-e-hype-descartado.md).

### Descartado (hype)

Não citar como solução do MOGI: Liquid Neural Networks, UrbanCLIP, GeoCLIP e Grounding DINO em tempo real sem GPU. Justificativas no [eixo 06](eixos/06-horizonte-e-hype-descartado.md).

## 2. Cinco inovações que diferenciam o MOGI

Estas cinco linhas são a matriz de diferenciação frente às tecnologias de alto impacto e aos pontos cegos encontrados. Servem ao BMC (proposta de valor, recursos-chave, custos) e às falas da banca.

### 1. Arquitetura neuro-simbólica auditável em Lua — “IA sugere, a prefeitura decide”

**O que o mercado e a literatura fazem.** Capitais e LLMs de propósito geral ou classificam texto, ou geram resposta livre, ou escondem a política numa caixa-preta. Portais rígidos de 311 priorizam por categoria, fila ou votos.

**A alternativa do MOGI.** A percepção é neural (hoje o Jev em texto; no piloto, um encoder visual leve + cabeça tabular). Quem fecha a prioridade é a **regra determinística da prefeitura em Lua**, versionada, testável e trocável sem deploy. Cada município audita e ajusta a própria política.

**Por que isso não é slogan.** [LogiCity](https://arxiv.org/abs/2411.00773) documenta ganho de arranjos neuro-simbólicos em raciocínio urbano com regras lógicas. No [estudo de triagem multimodal da CMU / DARPA](https://arxiv.org/abs/2512.18908), modelos visuais alimentando regras de especialistas elevaram a acurácia de 14% (só visão) para 53%, e a cobertura diagnóstica de 31% para 95%.

**Status:** o desenho Lua + GUT **já roda na demo**. Trocar o descritor/captioner por encoder próprio é **Roadmap Piloto 2027**.

### 2. Equidade territorial nativa sobre H3

**O ponto cego.** Sistemas 311 usam relatos repetidos para medir urgência. Os estudos da [Cornell Tech (Nature Computational Science, 2023)](https://www.nature.com/articles/s43588-023-00572-6) e de [Berkeley/MIT/Cornell (2025)](https://arxiv.org/abs/2506.08740) mostram que isso favorece bairros de renda mais alta, que reportam mais.

**A alternativa do MOGI.** O agrupamento já vive em hexágonos H3. No piloto, a nota de Tendência ganha uma **compensação de equidade auditável em Lua**, de modo que bairro periférico com menor volume de relatos não perca prioridade por subnotificação. [Hex2Vec](https://arxiv.org/abs/2111.00970) (biblioteca `srai`) oferece embeddings de cada hexágono a partir do OpenStreetMap, se o time quiser contexto territorial além da contagem bruta.

**Status:** H3 e agrupamento **já existem na demo**. A regra de equidade é **Roadmap Piloto 2027**, informada por **benchmark externo**.

### 3. Revisão humana calibrada por risco, não por chute

**O ponto cego.** Automação cega, ou um limiar de probabilidade escolhido no olho, ou “o humano olha tudo”.

**A alternativa do MOGI.** Os níveis 4 e 5 **já sobem para o servidor** na demo. No piloto, a saída 1–5 é calibrada com [Conformal Ordinal](https://arxiv.org/abs/2404.16610) e [Conformal Risk Control](https://arxiv.org/abs/2208.02814) (cerca de 500 relatos rotulados). O sistema devolve um conjunto de notas (por exemplo `{3, 4}`) com garantia estatística e pode pesar mais o erro no nível 5. [Estudo controlado de human-in-the-loop](https://arxiv.org/abs/2401.13744) mostra que pessoas decidem melhor quando recebem esses conjuntos; o [roteamento seletivo](https://arxiv.org/abs/2509.12573) envia só o caso ambíguo ao revisor certo.

**Status:** revisão 4–5 **já roda na demo**. Calibração conformal é **Roadmap Piloto 2027**.

### 4. Engenharia Small-City First, sem lock-in de LLM ou GPU de treino

**O que capitais fazem.** Recife e Singapura operam zeladoria com IA em escala de metrópole, times próprios e orçamento correspondente. O [Novo Conecta](https://solucoes.emprel.gov.br/recife-lanca-novo-conecta-com-ia-servicos-personalizados-e-foco-em-inclusao/) tem mais de 2 milhões de downloads. O [OneService](https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/) tratou 160 mil casos.

**A alternativa do MOGI.** Piloto em 1 máquina (on-prem em comodato ou nuvem de entrada com backup offsite nacional). Evolução para encoder visual aberto (SigLIP 2 86M ou DINOv3 destilado) + classificador tabular few-shot ([TabPFN v2](https://www.nature.com/articles/s41586-024-08328-6), [TabPFN-2.5](https://arxiv.org/abs/2511.08667), feitos para até cerca de 10 mil linhas — porte de Itamogi). Sem GPU de treino de LLM e sem mandar foto para um captioner externo no desenho-alvo.

**Status:** custo baixo da demo **já é medido** (ver [evidencias.md](../evidencias.md)). O encoder + TabPFN é **Roadmap Piloto 2027**. Recife e Singapura são **benchmark externo**, não competidores no mesmo porte.

### 5. Privacidade na borda, antes do upload (LGPD desde a origem)

**O que editais já pedem.** O [desafio de Xexéu/PE](https://desafios.pe.gov.br/portal/home/getchallengedocument/337) exige borrão de rostos e placas, retenção com prazo e painel público sem CPF/nome.

**A alternativa do MOGI.** Além do borrão já documentado no fluxo atual, o piloto leva o filtro para o aparelho: [MobileCLIP2](https://arxiv.org/abs/2508.20691) (cerca de 2× menor que SigLIP-SO400M; 3 a 15 ms em iPhone, no paper) + [Places365](https://github.com/CSAILVision/places365) para recusar foto indoor antes do upload; [EgoBlur](https://arxiv.org/abs/2308.13093) (mais de 90% de acerto em rostos no estudo) só depois da **checagem de licença**.

**Status:** proteção de PII no servidor **já roda na demo**. Filtro e borrão na borda são **Roadmap Piloto 2027**.

## 3. Mapa para a banca (28/11) e para o BMC

### Três falas prontas

1. **“A dor já está em edital público oficial.”** Em 31/07/2026 o Governo de Pernambuco publicou o desafio da Prefeitura de Xexéu pedindo foto ou vídeo obrigatórios, agrupamento de relatos, prioridade automática, WhatsApp e LGPD. Recife e Singapura provam o modelo em metrópole; o MOGI leva isso ao custo de cidade pequena.
2. **“Revisão humana nos níveis 4 e 5 com base estatística, não no chute.”** Hoje o grave já sobe para o servidor. No piloto, conformal ordinal calibra a escala 1–5 e manda o caso ambíguo para quem tem de olhar.
3. **“H3 com regra de equidade auditável.”** Relato repetido ajuda a medir urgência, mas a literatura de 311 mostra viés de renda. A ponderação da Tendência fica visível em Lua, e o filtro de foto doméstica nasce na borda.

### O que não dizer

- Não afirmar que o Jev multimodal já está em produção, nem que a TypeSafe faz fine-tune.
- Não atribuir a JEPA, SigLIP, DINOv3, TabPFN ou Conformal à mentoria do Állan (27/11/2026). Ele falou da **classe** de modelos de decisão multimodais, na linha do Jev.
- Não citar Liquid Neural Networks, UrbanCLIP, GeoCLIP ou Grounding DINO em tempo real sem GPU como caminho do MOGI.
- Não comparar FPS de detectores chineses (publicados em GPU) com o servidor enxuto do piloto.
- Não usar números do [registro de evidências](../evidencias.md) fora da natureza declarada (medido pelo time, estimativa ou campo).

### Encaixe no BMC

| Bloco do BMC | Como este pacote entra |
|---|---|
| Proposta de valor | Decisão auditável (Lua), revisão humana calibrada, equidade territorial, LGPD na origem, custo de município pequeno |
| Recursos-chave | Regras Lua; no piloto, encoder aberto + cabeça tabular; dados rotulados de Itamogi; H3 |
| Estrutura de custos | Jev hoje (centavos); no piloto, inferência local ou DC nacional sem GPU de treino de LLM e sem captioner externo |
| Parcerias-chave | TypeSafe permanece no presente; prefeitura de Itamogi para rotulagem; datasets abertos BR-AsPavDam (CC-BY 4.0) |
| Diferencial competitivo | Não somos “mais um app com ChatGPT”, nem um Conecta de capital. Somos decisão estruturada + política pública editável para cidade pequena |

Canvas vigente: [bmc/README.md](../../bmc/README.md). Roteiro de pitch: [pitch/README.md](../../pitch/README.md).

## 4. Índice dos eixos

- [01 — Incerteza e revisão humana (Conformal Prediction)](eixos/01-incerteza-conformal.md)
- [02 — Modelos de decisão e encoders não-LLM](eixos/02-modelos-decisao-encoders-nao-llm.md)
- [03 — Visão na borda, privacidade e dados brasileiros](eixos/03-edge-privacidade-dados-br.md)
- [04 — Neuro-simbólico, GeoAI H3 e equidade](eixos/04-neuro-simbolico-geoai-equidade.md)
- [05 — Benchmarks GovTech e B2G](eixos/05-benchmarks-govtech-b2g.md)
- [06 — Horizonte e hype descartado](eixos/06-horizonte-e-hype-descartado.md)

## 5. Mentoria do Állan (27/11/2026) — o que foi e o que não foi dito

O Állan não citou paper ou arquitetura pelo nome. Falou da classe de **modelos de decisão multimodais** (na linha do Jev): recebem imagem e regras/labels, devolvem a classificação na GUT com menos parâmetros, mais rápidos e mais baratos que um LLM, e no futuro o time pode treinar um modelo próprio de decisão.

Este pacote traduz essa diretriz em fontes verificadas, com limites oficiais do Jev e um caminho aberto (encoder + cabeça tabular + Lua) que não depende de fine-tune da TypeSafe.
