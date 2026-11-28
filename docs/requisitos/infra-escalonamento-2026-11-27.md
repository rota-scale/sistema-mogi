# Infraestrutura e escalonamento: levantamento de 27/11/2026

Três degraus discutidos depois da mentoria AKCIT com Állan Christoffer Pereira Silva e nas decisões do Russo na tarde e na noite de 27/11/2026. Companion de [levantamento-mvp-2026-11-27.md](levantamento-mvp-2026-11-27.md). Não é ordem de compra, cotação formal nem autorização de deploy.

## Origem

- Mentoria de 27/11/2026, 13h às 13h30 BRT. Notas e transcrição: [Wispr Flow](https://notes.wisprflow.ai/shared/K4OACv3Pb9DYkLbo7tXPP4O79CqyBRpsPCoFECjId5w).
- O Állan sugeriu começar com containers em serviço gerenciado (ECS na AWS ou Cloud Run no Google), mais baratos e menos específicos do que Kubernetes; mencionou o piloto com cerca de 1.000 relatos por mês em EC2 `t3.medium` e PostgreSQL, arquitetura modular; observou que on-premise pode compensar no orçamento de prefeitura e que AWS em São Paulo é caro frente a Ohio; citou um provedor nacional (na transcrição, "EVIL") com VPS, banco, storage e GPU, menor latência no Brasil; pediu pesquisa sobre regra jurídica de tráfego de dados para nuvem no exterior; e ficou de enviar o link do provedor.
- A pesquisa da tarde de 27/11 identificou o provedor como **EVEO** e leu páginas públicas da empresa e as normas abaixo. A preferência do Russo para o 1º semestre de 2027 em Itamogi é infra enxuta on-prem, com Mac Minis mantidos pela ROTA Scale via licitação.
- Números de AWS deste arquivo não foram recalculados em 27/11. Eles vêm da consulta já documentada em 15/11/2026 em [../enterprise/07-aws.md](../enterprise/07-aws.md), que foi relida no levantamento. Números da EVEO vêm só das páginas capturadas em 27/11, com URL. Onde não houve preço na captura, o item fica como pendência. Estimativas estão rotuladas como tal.

## Os três degraus

| Degrau | Quando | Desenho | Papel |
|---|---|---|---|
| 1. Piloto enxuto | 1º semestre de 2027, Itamogi | Preferência: Mac Minis on-prem, mantidos pela ROTA Scale via licitação. Alternativas de comparação: AWS EC2 `t3.medium` em `sa-east-1` (cenário A já cotado) ou servidor dedicado da EVEO em data center brasileiro. | Entrar em operação com custo baixo, um município, volume da ordem de 1.000 relatos/mês (hipótese da mentoria e do cenário A). |
| 2. Escala | Quando o volume ou o número de municípios exigir | AWS com RDS, S3 e ECS (ou equivalente no Cloud Run), conforme a proposta já escrita em [07-aws.md](../enterprise/07-aws.md); ou EVEO em dedicado / private cloud, se a cotação e a residência dos dados fecharem. | Tirar banco e mídia da máquina única; ganhar operação e escala sem pular para Kubernetes. |
| 3. GPU | Só se o produto passar a treinar modelo próprio | GPU dedicada. Na EVEO, as faixas públicas começam em R$ 1.690/mês (entrada com 2x NVIDIA T10). Na AWS, não há cotação de GPU neste levantamento. | Não faz parte do piloto enxuto. A decisão atual de triagem (descritor + Jev em texto + Lua) não exige GPU. |

Kubernetes ficou de fora dos três degraus. O Állan descreveu o serviço como caro e de conhecimento específico; ECS e Cloud Run cobrem o que a equipe precisaria no médio prazo.

## Degrau 1: piloto enxuto

### RQ-INF-01: Preferência: Mac Minis on-prem em Itamogi

- **Status:** Roadmap piloto 2027 (proposta do Russo em 27/11).
- **Enunciado:** no 1º semestre de 2027, o piloto em Itamogi parte de uma infra enxuta na própria prefeitura ou sob custódia operacional da ROTA Scale, com Mac Minis, mantidos pela ROTA Scale no âmbito de uma licitação (ou do contrato que vier a ser formalizado). O desenhista on-prem já tinha respaldo na mentoria: o Állan perguntou se a ideia era comprar servidor "on-premise mesmo" e observou que isso pode compensar no orçamento de prefeitura, além da latência menor no Brasil.
- **Critério de aceite (quando for contratar):** há inventário do hardware, responsável pela manutenção, rotina de backup e restauração, e o desenho não depende de região no exterior para dados pessoais do morador.
- **Preço:** não há cotação de Mac Mini, energia, link ou hours de manutenção neste levantamento. Não inventar mensalidade.

### RQ-INF-02: Alternativa AWS, cenário A (`t3.medium`)

- **Status:** proposta já documentada; não implantada. O sistema, em 27/11, seguia em Docker Compose local.
- **Fonte dos números:** [../enterprise/07-aws.md](../enterprise/07-aws.md), consulta de **15/11/2026** aos catálogos oficiais da AWS em `sa-east-1`, modalidade sob demanda, 730 h/mês, câmbio de simulação US$ 1 = R$ 5,50 (não é cotação de mercado). Catálogos: [EC2 e EBS](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/sa-east-1/index.csv), [RDS](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/sa-east-1/index.csv), [S3](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/sa-east-1/index.csv), [balanceador](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSELB/current/sa-east-1/index.csv) e [VPC e IPv4](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonVPC/current/sa-east-1/index.csv). Recálculo: [calculadora AWS](https://calculator.aws/).
- **Números (estimativa de lista, não fatura):**
  - Cenário A (uma EC2 Linux `t3.medium`, 2 vCPU e 4 GiB, Compose na própria máquina, EBS 60 GB, IPv4, snapshot; sem RDS, S3 ou ALB): subtotal AWS **US$ 65,906/mês**, ou **R$ 362,48/mês** no câmbio de simulação.
  - Com a hipótese de 1.000 relatos/mês e IA de teste com foto a R$ 0,0007 por relato (referência histórica do README, não é preço AWS): **R$ 363,18/mês**.
  - A mentoria usou o mesmo recorte de volume (1.000 relatos/mês) e a mesma família de instância (`t3.medium`).
- **Não incluídos no subtotal** (lista já fechada em 07-aws.md): tráfego de saída, NAT, DNS, logs, cofre, impostos, câmbio efetivo, operação humana e burst de CPU das instâncias T3.
- **Critério de aceite (se essa alternativa for a escolhida):** nova cotação na calculadora AWS com câmbio e premissas da data da contratação, região `sa-east-1` explícita, e conferência de que dados pessoais não saem dessa região sem base legal (ver regra legal abaixo).

O cenário B do mesmo documento (EC2 `t3.large` + RDS `db.t3.medium` + S3 + ALB) soma **R$ 1.518,76/mês** no mesmo câmbio, ou **R$ 1.532,76/mês** com a hipótese de 20.000 relatos/mês e a mesma IA de teste. Esse desenho pertence ao degrau 2, não ao piloto enxuto.

### RQ-INF-03: Alternativa EVEO (dedicado nacional)

- **Status:** proposta em estudo; cotação formal pendente.
- **O que as páginas capturadas em 27/11 sustentam:**
  - A EVEO se apresenta como empresa brasileira de servidores dedicados, private cloud e colocation, com fatura em reais e suporte 24/7 em português. Artigo "[EVEO: maior empresa de servidores dedicados do Brasil](https://www.eveo.com.br/blog/eveo-melhor-empresa-de-servidores-dedicados-e-private-cloud-no-brasil)", atualizado em 26/08/2026.
  - Cinco data centers anunciados como Tier III: Cotia/SP, Osasco/SP, Curitiba/PR, Fortaleza/CE e **Miami/FL**. Contratar "EVEO" não garante, por si só, que os dados fiquem no Brasil. Para o recorte LGPD e para o argumento de latência nacional, a instância precisa estar em um dos data centers brasileiros.
  - A empresa afirma, no mesmo artigo, que data centers no Brasil sob jurisdição brasileira simplificam conformidade com a LGPD. Isso é discurso comercial, não parecer jurídico.
  - O Állan descreveu o provedor como oferta de VPS, banco, storage e GPU. As páginas lidas em 27/11 confirmam dedicado, private cloud, colocation e GPU; não capturamos uma tabela pública de preço de servidor dedicado (sem GPU) nem de VPS.
- **Preço de dedicado (sem GPU):** não recuperado nas capturas de 27/11. Fica como **pendência de cotação**. Não usar um valor de entrada neste documento até haver página pública ou proposta formal com data e item.
- **Preço de GPU:** ver RQ-INF-05. Não misturar a faixa de GPU com o custo do piloto enxuto, que não prevê treino de modelo próprio.
- **Critério de aceite (se essa alternativa for a escolhida):** proposta comercial da EVEO com DC brasileiro explícito, itens (CPU, RAM, disco, backup, banco, tráfego) e mensalidade em reais; conferência de que não há replicação automática para Miami ou outro país sem base legal.

## Degrau 2: escala

### RQ-INF-04: Banco, mídia e containers gerenciados

- **Status:** Roadmap (quando o degrau 1 não bastar).
- **Enunciado:** sair da máquina única. Caminho AWS já desenhado: RDS PostgreSQL, S3 privado e API em ECS (sugestão do Állan) ou, no cenário B, EC2 maior + RDS + S3 + ALB, com os cuidados de 07-aws.md (PostGIS/H3, WebSocket, parâmetro de região do adaptador S3, que hoje menciona `us-east-1`). Caminho EVEO: dedicado ou private cloud no Brasil, com banco e storage cotados. Cloud Run permanece como alternativa citada pelo Állan, sem cotação neste arquivo.
- **Critério de aceite:** existe um desenho escolhido (AWS ou EVEO), cotado na data da decisão, com residência dos dados pessoais no Brasil e plano de backup e restauração conjunto (banco, mídia e regras Lua).

## Degrau 3: GPU só para treino próprio

### RQ-INF-05: GPU fora do piloto, só se houver modelo próprio

- **Status:** Roadmap condicionado (não é plano do piloto enxuto).
- **Enunciado:** GPU entra só se a ROTA Scale for treinar ou fazer fine-tune de modelo próprio (encoder visual ou cabeça tabular), o que hoje está no roadmap acadêmico de 2027, não na demo. Inferência da demo (Jev via API + Lua) não justifica esse degrau.
- **Números (página da EVEO capturada em 27/11, artigo atualizado em 22/09/2026):** "[Quanto custa um servidor com GPU no Brasil?](https://www.eveo.com.br/blog/quanto-custa-servidor-com-gpu-brasil)". A própria EVEO rotula as faixas como referência editorial, não como tabela fechada de contrato. Configurações publicadas "começam em R$ 1.690 por mês" (entrada: 2x NVIDIA T10, 16 GB por GPU) e sobem até valor sob consulta. Faixas do artigo: a partir de R$ 1.690; R$ 5 mil a R$ 10 mil (RTX PRO 4500 SE); R$ 10 mil a R$ 20 mil (RTX PRO 6000 SE); R$ 20 mil a R$ 30 mil (NVIDIA H200); acima de R$ 30 mil (NVIDIA HGX 8xB300). A composição final depende de avaliação técnica e comercial.
- **Critério de aceite (se um dia for o caso):** workload de treino descrito, faixa compatível com o orçamento, DC brasileiro, e decisão explícita de que o piloto não depende dessa máquina.

## Regra legal (o que a pesquisa de 27/11 permite afirmar)

O Állan pediu para pesquisar se, neste ramo, existe norma impedindo que dados (mesmo públicos) trafeguem para nuvem no exterior, e disse que o viés jurídico ("não mandar para servidores estrangeiros") só vira diferencial se essa regulamentação existir. Também apontou a vantagem de latência de um servidor no Brasil frente a um em Ohio.

A leitura das normas na tarde de 27/11, com o texto da Portaria SGD/MGI nº 5.950/2023 (página do Governo Digital, atualizada em 13/11/2026 09h09), leva a esta regra, que é mais estreita do que um "proibido usar nuvem fora"):

1. **LGPD (Lei nº 13.709, de 14 de agosto de 2018), art. 33.** Vale para o MOGI porque o sistema trata dados pessoais (foto de via pode ter rosto, e o fluxo do morador pode carregar identificadores). A transferência internacional de dados pessoais só é permitida nas hipóteses do art. 33 (país com grau de proteção adequado, cláusulas-tipo, consentimento específico e as demais alíneas da lei). Não é uma proibição absoluta de nuvem estrangeira, mas é um restrição legal: gravar ou processar dado pessoal em Ohio, em Miami ou em qualquer DC fora do Brasil é transferência internacional e precisa de uma das bases do artigo. Texto: [Planalto, Lei 13.709/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
2. **Portaria SGD/MGI nº 5.950, de 26 de outubro de 2023, item 5.4.5 do Anexo I.** "Os dados tratados em ambiente de nuvem devem ser armazenados em data centers localizados em território brasileiro, admitindo-se o tratamento de dados em data centers fora do território brasileiro somente nos casos em que haja cópia de segurança atualizada armazenada em data centers localizados em território brasileiro, respeitando-se os demais limites estabelecidos neste modelo." A Portaria também exige classificação prévia da informação (5.3), admite nuvem (pública, privada, híbrida, comunitária ou de governo) para cargas sem restrição de acesso, considerada a legislação de dados pessoais (5.4.2), e veda nuvem pública para informação classificada em grau de sigilo (5.4.4). Fonte: [Portaria SGD/MGI nº 5.950/2023](https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/modelo-de-contratacao-de-software-e-servicos-em-nuvem/vigentes/portaria-sgd-mgi-no-5-950-de-26-de-outubro-de-2023). **Alcance:** a Portaria é de utilização obrigatória para órgãos e entidades do **SISP do Poder Executivo Federal** (arts. 1º e 3º). Ela **não vincula automaticamente** a Prefeitura de Itamogi nem um fornecedor privado no piloto municipal. Serve como referência forte de mercado B2G e passaria a importar se o produto for contratado por órgão do SISP.
3. **IN GSI/PR nº 5, de 30 de agosto de 2021.** A própria Portaria a define (item m do Anexo I) como a norma que "dispõe sobre os requisitos mínimos de segurança da informação para utilização de soluções de computação em nuvem pelos órgãos e pelas entidades da administração pública federal". O item 6.3 da Portaria remete ao art. 11, inciso IV, dessa IN: sistemas estruturantes só em nuvem privada, comunitária ou de governo, restritas a infraestruturas de órgãos ou entidades. Lista de normas: [Principais normas (Governo Digital)](https://www.gov.br/governodigital/pt-br/estrategias-e-governanca-digital/estrategias-e-politicas-digitais/computacao-em-nuvem/principais-normas). **Alcance:** administração pública federal, não o município de Itamogi por transposição automática.

**Conclusão para o pitch e para o piloto.** Hospedar no Brasil (Mac Mini on-prem, EVEO em DC brasileiro ou AWS `sa-east-1`) reduz a exposição ao art. 33 da LGPD e se alinha ao modelo federal de armazenamento em território brasileiro. Latência nacional é vantagem real, como o Állan disse. O que não se deve afirmar na banca é que "a lei proíbe qualquer nuvem estrangeira" no piloto municipal, ou que contratar a EVEO basta (há DC em Miami). Região AWS fora do Brasil, ou réplica em Miami, exige análise da base legal do art. 33 antes de qualquer dado pessoal.

A Lei nº 14.133/2021 (licitações) também foi aberta no levantamento de 27/11, no contexto de modalidade de contratação, não como regra de residência de dados. Não misturar os dois assuntos.

## Pendências

- Cotação formal da EVEO para o degrau 1 (servidor dedicado ou VPS equivalente ao `t3.medium`, DC brasileiro, banco e storage, mensalidade em reais). As páginas públicas lidas em 27/11 não trouxeram preço de entrada de dedicado sem GPU.
- Link do provedor que o Állan ficou de enviar (na prática a pesquisa já identificou a EVEO; o link oficial do mentor ainda não entrou neste repositório).
- Preço de Mac Mini, energia, link e manutenção on-prem: sem fonte neste levantamento.
- Recálculo AWS na data da contratação (câmbio, catálogos `current` e premissas reais de disco e tráfego).
- Confirmação, no contrato, de região e de ausência de réplica internacional automática (AWS e EVEO).
- Se o produto for oferecido a órgão do SISP, aí sim a Portaria 5.950 e a IN GSI/PR 5 deixam de ser só referência e passam a requisito de contratação. Esse recorte não é o do piloto de Itamogi.

## Ver também

- Requisitos de MVP, pitch e B2G: [levantamento-mvp-2026-11-27.md](levantamento-mvp-2026-11-27.md)
- Proposta AWS já existente: [../enterprise/07-aws.md](../enterprise/07-aws.md)
- Implantação e operação: [../enterprise/05-implantacao-operacao.md](../enterprise/05-implantacao-operacao.md)
- Evidências acadêmicas (privacidade e borda): [../research/eixos/03-edge-privacidade-dados-br.md](../research/eixos/03-edge-privacidade-dados-br.md)
