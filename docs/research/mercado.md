# Mercado do Sistema MOGI: números com fonte

Conferido em 28/11/2026. Cada número abaixo foi aberto na fonte nesta data e traz natureza, fonte e data. O documento serve ao BMC, ao pitch e ao [registro de evidências](../evidencias.md); a seção 5 já traz as linhas no formato do registro.

Não há aqui valor de mercado em reais nem estimativa de receita. Esses números ainda não têm fonte (seção 6).

**Natureza do número**, nas palavras do registro de evidências e mais estas:
- **Dado oficial de censo:** publicado pelo IBGE a partir do Censo 2022.
- **Estimativa oficial:** estimativa de população do IBGE para ano sem censo.
- **Contagem do time sobre tabela oficial:** o time contou ou somou valores de uma tabela oficial, e a linha diz como.
- **Levantamento de entidade:** painel de associação, como a CNM. Não é estatística oficial.
- **Estudo de instituto sobre base oficial:** cálculo de instituto privado sobre dado oficial.
- **Dado oficial autodeclarado:** sistema oficial alimentado pelos próprios prestadores, como o SINISA.

## 1. Municípios por porte: o segmento do MOGI

| Número | Valor | Natureza | Fonte e onde | Data da fonte |
|---|---|---|---|---|
| Municípios do Brasil | **5.570** unidades: 5.568 municípios, mais o Distrito Federal e o Distrito Estadual de Fernando de Noronha | dado oficial de censo | [IBGE, Censo 2022, população e domicílios, primeiros resultados](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102011.pdf), p. 25 do PDF | 2023 |
| Municípios com até 10 mil habitantes | **2.495**, ou **44,8%** | dado oficial de censo, 1ª apuração | [IBGE Agência de Notícias, release do Censo 2022](https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/37237-de-2010-a-2022-populacao-brasileira-cresce-6-5-e-chega-a-203-1-milhoes), seção Quase metade dos municípios do país tem até 10 mil habitantes | 28/06/2023, atualizado em 27/10/2023 |
| Idem, na tabela vigente | 2.494, ou 44,78% | contagem do time sobre tabela oficial | [SIDRA, tabela 4709](https://sidra.ibge.gov.br/tabela/4709), variável 93: municípios com até 10.000 habitantes | 2ª apuração, 27/10/2023 |
| Municípios com menos de 20 mil habitantes | **3.860**, ou **69,3%** | contagem do time sobre tabela oficial | IBGE, mesma publicação, Gráfico 4, p. 41 do PDF: 1.324 com menos de 5 mil, 1.171 de 5 mil a 10 mil e 1.365 de 10 mil a 20 mil | 2023 |
| Idem, na tabela vigente | 3.860 abaixo de 20.000, ou 3.861 contando Turmalina (MG), que tem exatamente 20.000 habitantes | contagem do time sobre tabela oficial | SIDRA, tabela 4709, variável 93 | 27/10/2023 |
| Municípios com menos de 50 mil habitantes, o foco do pitch | **4.914**, ou **88,2%** | contagem do time sobre tabela oficial | IBGE, Gráfico 4: as três faixas acima mais 1.054 de 20 mil a 50 mil | 2023 |
| Idem, na tabela vigente | 4.913, ou 88,20% | contagem do time sobre tabela oficial | SIDRA, tabela 4709, variável 93 | 27/10/2023 |
| Municípios com menos de 25 mil habitantes | 4.218, onde viviam cerca de 19,7% da população | dado oficial de censo | release do IBGE acima, seção Cerca de 124 milhões vivem em concentrações urbanas | 28/06/2023 |
| População de Itamogi-MG | **10.770** pessoas | dado oficial de censo | [SIDRA, tabela 4709](https://sidra.ibge.gov.br/tabela/4709), município 3132909; também no [IBGE Cidades](https://cidades.ibge.gov.br/brasil/mg/itamogi/panorama) | Censo 2022 |
| População estimada de Itamogi-MG | 11.120 em 2026 (11.062 em 2024 e 11.092 em 2025) | estimativa oficial | [SIDRA, tabela 6579](https://sidra.ibge.gov.br/tabela/6579), município 3132909 | 2026 |

Como ler:
- O Gráfico 4 é da 1ª apuração do Censo 2022. A tabela 4709 do SIDRA é da 2ª apuração, de 27/10/2023, e por isso difere em um município nas faixas de 10 mil e de 50 mil. Cite um ou outro, sempre com a data.
- Itamogi passou de 10 mil habitantes no Censo 2022. Fica fora da faixa até 10 mil e dentro das faixas até 20 mil e até 50 mil.
- Para refazer as contagens, leia a tabela 4709 pela API oficial (`https://apisidra.ibge.gov.br/values/t/4709/n6/all/v/93/p/all`) e conte os municípios com valor até o limite.

## 2. Consórcios públicos: o canal de venda

| Número | Valor | Natureza | Fonte e onde | Data |
|---|---|---|---|---|
| Consórcios públicos | **729**: Norte 26, Nordeste 164, Centro-Oeste 69, Sudeste 277, Sul 193 | levantamento de entidade | [CNM, Observatório Municipalista de Consórcios Públicos](https://consorcios.cnm.org.br/), aba Consórcios Públicos, sem filtro | consultado em 28/11/2026 |
| Municípios consorciados | **4.817**: Norte 239, Nordeste 1.363, Centro-Oeste 403, Sudeste 1.641, Sul 1.171 | levantamento de entidade | mesmo painel, aba Municípios Consorciados | consultado em 28/11/2026 |
| Consórcios com área de atuação Municípios Inteligentes | 25: Norte 0, Nordeste 5, Centro-Oeste 4, Sudeste 12, Sul 4 | levantamento de entidade | mesmo painel, filtro Áreas de Atuação | consultado em 28/11/2026 |
| Consórcios com área de atuação Tecnologia (Soluções Informatizadas) | 48: Norte 1, Nordeste 11, Centro-Oeste 3, Sudeste 20, Sul 13 | levantamento de entidade | mesmo painel, filtro Áreas de Atuação | consultado em 28/11/2026 |

Cuidados:
- O painel não mostra data de referência. Vale a data da consulta.
- O painel chama todos de consórcios públicos e, nos totais, não separa os formados só por municípios dos que têm estado ou União.
- 4.817 é uma contagem da CNM e não se compara direto com os 5.570 do IBGE.
- O número de 2021 usado até aqui, mais de 600 consórcios, fica superado.

## 3. Perdas de água: o contexto da categoria água e esgoto

| Número | Valor | Natureza | Fonte e onde | Data |
|---|---|---|---|---|
| Perdas totais de água na distribuição, Brasil | **39,53%** em 2024 | estudo de instituto sobre base oficial | [Instituto Trata Brasil e GO Associados, Estudo de Perdas de Água 2026, release](https://tratabrasil.org.br/wp-content/uploads/2026/06/Release-Perdas-de-Agua-2026_final-revGO.pdf), p. 1 | junho de 2026 |
| O mesmo índice na fonte oficial | **39,5%** do volume produzido, indicador IAG2013, ano de referência 2024 | dado oficial autodeclarado | [Ministério das Cidades, SINISA 2025, relatório dos serviços de abastecimento de água](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/008_RELATORIO_SINISA_ABASTECIMENTO_AGUA_2025_defeso.pdf), seção Perdas de água em sistemas de distribuição, p. 27 do PDF | edição SINISA 2025 |

Cuidado com o nome: o Trata Brasil escreve SINISA 2024 referindo-se ao ano-base. A edição oficial com esses dados se chama SINISA 2025, ano de referência 2024. O índice é nacional e não mede Itamogi nem o MOGI.

## 4. O que estes números sustentam

**Sustentam:**
- Cidade pequena é a maioria dos municípios: 88,2% têm menos de 50 mil habitantes.
- O consórcio é canal real: 729 consórcios e 4.817 municípios consorciados, com 25 consórcios na área Municípios Inteligentes.
- Água é dor nacional: quase 40% da água produzida se perde na distribuição.

**Não sustentam:** tamanho de mercado em reais, preço, receita, quantas prefeituras comprariam, ou que consórcios já compram sistemas de zeladoria.

**Não dizer:**
- 5.570 prefeituras sem dizer que a conta inclui o Distrito Federal e Fernando de Noronha.
- 729 consórcios intermunicipais. O painel não separa a natureza nos totais.
- 2.495 e 2.494 lado a lado sem a data de cada um.
- A estimativa de Itamogi no lugar do censo.
- Projeção em reais de estudo de saneamento como se fosse mercado do MOGI.

## 5. Linhas para o registro de evidências

| Número | Natureza | Fonte | Data | Observação |
|---|---|---|---|---|
| **5.570** municípios | dado oficial de censo | [IBGE, Censo 2022, primeiros resultados](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102011.pdf) | 2023 | 5.568 municípios mais o Distrito Federal e Fernando de Noronha |
| **4.914** municípios com menos de 50 mil habitantes, 88,2% | contagem do time sobre tabela oficial | mesma publicação, Gráfico 4 | 2023 | 4.913 na tabela 4709 do SIDRA, 2ª apuração |
| **3.860** municípios com menos de 20 mil habitantes, 69,3% | contagem do time sobre tabela oficial | mesma publicação, Gráfico 4 | 2023 | o IBGE não publica esse total em texto |
| **2.495** municípios com até 10 mil habitantes, 44,8% | dado oficial de censo | [release do IBGE](https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/37237-de-2010-a-2022-populacao-brasileira-cresce-6-5-e-chega-a-203-1-milhoes) | 28/06/2023 | 2.494 na tabela vigente |
| **10.770** habitantes em Itamogi | dado oficial de censo | [SIDRA, tabela 4709](https://sidra.ibge.gov.br/tabela/4709) | Censo 2022 | estimativa de 2026: 11.120 ([tabela 6579](https://sidra.ibge.gov.br/tabela/6579)) |
| **729** consórcios públicos e **4.817** municípios consorciados | levantamento de entidade | [CNM, Observatório de Consórcios Públicos](https://consorcios.cnm.org.br/) | consultado em 28/11/2026 | painel sem data de referência; natureza jurídica não filtrada |
| **39,5%** da água produzida perdida na distribuição | dado oficial autodeclarado | [SINISA 2025, ano de referência 2024](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/008_RELATORIO_SINISA_ABASTECIMENTO_AGUA_2025_defeso.pdf) | edição 2025 | 39,53% no estudo do Trata Brasil de 2026 |

## 6. O que falta

- [FALTA: total publicado pelo IBGE em texto para menos de 20 mil e menos de 50 mil habitantes. Os valores acima são soma das faixas do Gráfico 4 ou contagem na tabela 4709.]
- [FALTA: quantos dos 729 consórcios são formados só por municípios, pelo filtro Natureza Jurídica do painel ou por consulta à CNM.]
- [FALTA: data de referência do painel da CNM.]
- [FALTA: quanto as prefeituras pagam hoje por sistemas de ouvidoria e zeladoria, levantado em contratos públicos, antes de qualquer tamanho de mercado em reais.]
- [FALTA: pedidos de zeladoria por mês em Itamogi, ainda a preencher no registro de evidências, seção Campo.]
