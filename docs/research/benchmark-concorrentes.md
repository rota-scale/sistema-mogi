# Benchmark de concorrentes do Sistema MOGI

Conferido em 28/11/2026. São 30 soluções: 18 no Brasil, cobrindo as cinco regiões, e 12 em outros países. As colunas são as 12 do slide de comparação do pitch. O objetivo é trocar os n/d do slide por resposta com fonte, e mostrar onde o MOGI se diferencia e onde não.

## Como ler

- **sim:** uma página aberta em 28/11/2026 afirma. A célula é um link para essa página, e o trecho literal está no anexo.
- **não:** uma página aberta afirma a ausência, ou traz uma lista oficial fechada que exclui o item. Exemplo: uma lista de canais de atendimento sem WhatsApp. A célula é link, e o trecho está no anexo.
- **n/d:** nenhuma página aberta diz. **n/d não prova que a solução não faz**; quer dizer que não há evidência pública nas fontes abertas. No slide, escreva sem evidência pública, e não ninguém faz.
- **\*** marca célula que vem de imprensa. **†** marca ressalva na linha do MOGI (seção 4).

O que cada coluna exige:
- **Foto no relato:** o cidadão anexa foto ao abrir o relato.
- **WhatsApp:** canal oficial que abre relato pelo WhatsApp.
- **Foto do conserto ao morador:** o cidadão recebe foto do serviço feito.
- **IA lê foto e texto:** IA interpreta a foto e o texto para classificar, encaminhar ou priorizar. IA só na foto ou só no texto fica n/d.
- **Prioridade automática:** prioridade calculada a cada relato. Prazo fixo por tipo de serviço não conta.
- **Regra auditável:** o critério de prioridade ou encaminhamento é publicado, configurável pelo órgão de forma visível, ou está em código aberto.
- **Duplicados agrupados:** relatos repetidos se juntam, ou o sistema mostra os já abertos por perto.
- **Pessoa confere os graves:** revisão humana específica dos casos graves ou duvidosos. Atendimento humano genérico não conta.
- **Rosto e placa borrados:** automaticamente ou por moderação.
- **Custo de IA público:** o custo da IA está publicado.
- **Nova cidade sem reprogramar:** a plataforma atende vários municípios, e uma cidade nova entra por configuração.
- **Código aberto:** código publicado sob licença aberta.

**Como foi conferido.** Dois levantamentos, um do Brasil e um de fora, preencheram as células só com páginas abertas. Depois, um script baixou a página de cada célula com sim ou não e procurou o trecho citado. As páginas que bloqueiam acesso automático foram conferidas no navegador ou numa cópia do Wayback Machine. Curitiba devolveu 403 e foi lida assim, e a FAQ do FixMyStreet também. Nenhuma célula com sim ou não ficou sem o trecho achado na página.

## 1. A matriz

| Solução | Onde | Foto no relato | WhatsApp | Foto do conserto ao morador | IA lê foto e texto | Prioridade automática | Regra auditável | Duplicados agrupados | Pessoa confere os graves | Rosto e placa borrados | Custo de IA público | Nova cidade sem reprogramar | Código aberto | Conferido |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **MOGI** | Itamogi-MG, proposta | [sim](../../backend/internal/ocorrencias/handlers.go) | [não](../../README.md#próximos-passos) | [sim](../../backend/internal/ocorrencias/handlers.go)† | [sim](../../backend/internal/triagem/ia.go) | [sim](../../backend/regras/itamogi/_comum.lua) | [sim](../../backend/internal/admin/admin.go) | [sim](../../backend/internal/ocorrencias/repositorio.go) | [sim](../../backend/internal/triagem/servico.go) | [sim](../../backend/internal/midia/seletivo.go)† | [sim](../evidencias.md)† | [sim](../adr/0021-cidade-como-dado-e-escala.md) | [sim](../../LICENSE) | 28/11/2026, main `1b91bba` |
| **Colab** | nacional, várias prefeituras | [sim](https://www.colab.com.br/sou-cidadao/) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Fala.BR (CGU)** | federal | [sim](https://www.gov.br/pt-br/servicos/registrar-manifestacao-no-sistema-de-ouvidorias-do-poder-executivo-federal) | [não](https://www.gov.br/pt-br/servicos/registrar-manifestacao-no-sistema-de-ouvidorias-do-poder-executivo-federal) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **1Doc** | nacional, várias prefeituras | [sim](https://apps.apple.com/br/app/1doc-atendimento/id1494746128) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **IPM Atende.Net** | nacional, várias prefeituras | [sim](https://apps.apple.com/br/app/atende-net/id1330201742) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **SP156** | São Paulo-SP | [sim](https://prefeitura.sp.gov.br/w/noticia/populacao-pode-solicitar-os-servicos-ofertados-na-central-156-via-aplicativo-no-celular) | [sim](https://prefeitura.sp.gov.br/web/inovacao/w/atendimento_ao_cidadao/246617) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **1746** | Rio de Janeiro-RJ | [sim](https://www.rio.rj.gov.br/dlstatic/10112/13263059/4334016/CLFCartadeServicos.pdf) | [sim](https://carioca.rio/servicos/reparo-de-asfalto-com-deformacao-e-afundamento) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **PBH APP** | Belo Horizonte-MG | [sim](https://prefeitura.pbh.gov.br/noticias/com-pbh-app-cidadao-tem-opcao-mais-rapida-e-facil-para-solicitar-servicos) | [não](https://prefeitura.pbh.gov.br/noticias/bh-realiza-mais-de-44-mil-operacoes-de-tapa-buracos-em-2026) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Fala Vitória 156** | Vitória-ES | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Central 156** | Curitiba-PR | [sim](https://www.curitiba.pr.gov.br/noticias/aplicativo-do-156-cresce-em-numero-de-registros-e-torna-se-o-principal-canal-de-comunicacao-com-a-prefeitura/77393) | [não](https://www.curitiba.pr.gov.br/noticias/balanco-central-156-registra-18-milhoes-de-atendimentos-e-95-de-aprovacao/81526) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **156 Porto Alegre** | Porto Alegre-RS | [sim](https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao) | [sim](https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Ouvidoria pelo Fala.BR** | Florianópolis-SC | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Conecta Recife** | Recife-PE | [sim](https://conecta.recife.pe.gov.br/servico/871) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Fala Salvador 156** | Salvador-BA | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Central 156** | Fortaleza-CE | n/d | [não](https://apps.apple.com/br/app/central-156/id1637689004) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Ouvidoria pelo Fala.BR** | Manaus-AM | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Ouvidoria e canais de zeladoria** | Belém-PA | n/d | [sim](https://ouvidoria.belem.pa.gov.br/) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Goiânia 24H e Seinfra** | Goiânia-GO | [sim](https://www.goiania.go.gov.br/sit/politica-de-privacidade-e-termos-de-uso-do-aplicativo-prefeitura-24-horas/) | [sim](https://www.goiania.go.gov.br/sing_servicos/via-publica-tapa-buracos/) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Participa DF e 162** | Distrito Federal | [sim](https://www.participa.df.gov.br/static/orientacao-manifestacao) | [não](https://www.participa.df.gov.br/faq) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **OneService** | Singapura | [sim](https://www.mddi.gov.sg/newsroom/new-ai-powered-oneservice/) | [sim](https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/) | n/d | [sim](https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **NYC311** | Nova York, EUA | [sim](https://www.nyc.gov/assets/home/html/311/311_mobile_faq.shtml) | [não](https://portal.311.nyc.gov/about-nyc-311/) | n/d | [sim](https://apps.apple.com/us/app/nyc311/id324897619) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **FixMyStreet** | Reino Unido | [sim](https://www.mysociety.org/2026/01/22/faster-reporting-on-fixmystreet-start-your-report-with-a-photo/) | n/d | n/d | n/d | n/d | [sim](https://www.fixmystreet.com/faq) | [sim](https://www.fixmystreet.com/faq) | n/d | [sim](https://www.societyworks.org/2021/06/21/image-redaction-on-fixmystreet-pro/) | n/d | [sim](https://www.fixmystreet.com/faq) | [sim](https://raw.githubusercontent.com/mysociety/fixmystreet/master/LICENSE.txt) | 28/11/2026 |
| **SeeClickFix** | EUA | [sim](https://www.civicplus.help/seeclickfix/docs/report-an-issue-to-my-city) | [não](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/) | n/d | n/d | n/d | [sim](https://www.civicplus.help/seeclickfix/docs/automations-overview) | [sim](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/) | n/d | n/d | n/d | [sim](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/) | n/d | 28/11/2026 |
| **BA Colaborativa e Boti** | Buenos Aires, Argentina | [sim](https://buenosaires.gob.ar/ba-147) | [sim](https://static.buenosaires.gob.ar/sites/default/files/2025-07/Caso_Boti.pdf) | n/d | [sim](https://static.buenosaires.gob.ar/sites/default/files/2025-07/Caso_Boti.pdf) | n/d | n/d | [sim](https://buenosaires.gob.ar/ba-147) | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **My City Report** | Japão | [sim](https://www.mycityreport.jp/faq/citizens) | n/d | [sim](https://www.mycityreport.jp/documents/MCR参加案内.pdf) | n/d | n/d | n/d | n/d | n/d | [sim](https://www.mycityreport.jp/faq/governments) | n/d | [sim](https://www.mycityreport.jp/faq/citizens) | n/d | 28/11/2026 |
| **BOS:311** | Boston, EUA | [sim](https://www.boston.gov/node/16671021) | n/d | [sim](https://www.boston.gov/civic-engagement/bos311-app) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **311 Toronto** | Toronto, Canadá | [sim](https://www.toronto.ca/home/311-toronto-at-your-service/311-mobile-apps) | n/d | n/d | n/d | n/d | n/d | [sim](https://www.toronto.ca/home/311-toronto-at-your-service/311-mobile-apps) | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Snap Send Solve** | Austrália e Nova Zelândia | [sim](https://snapsendsolve.com/solvers/local-government-councils) | n/d | [sim](https://snapsendsolve.com/features/solve-app-field-teams) | [sim](https://snapsendsolve.com/partners/how-city-of-glen-eira-expects-to-save-88k-per-year-with-duplicate-detection) | n/d | n/d | [sim](https://snapsendsolve.com/partners/how-city-of-glen-eira-expects-to-save-88k-per-year-with-duplicate-detection) | n/d | n/d | n/d | [sim](https://snapsendsolve.com/how-it-works) | n/d | 28/11/2026 |
| **Seoul Smart Complaint Report** | Seul, Coreia do Sul | [sim](https://apps.apple.com/kr/app/id547521233) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Na Minha Rua LX** | Lisboa, Portugal | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |
| **Locatel e Bachetel** | Cidade do México, México | [sim](https://www.unotv.com/estados/ciudad-de-mexico/asi-puedes-reportar-baches-y-socavones-via-whatsapp-en-cdmx/)* | [sim](https://www.unotv.com/estados/ciudad-de-mexico/asi-puedes-reportar-baches-y-socavones-via-whatsapp-en-cdmx/)* | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | 28/11/2026 |

## 2. O que a matriz mostra

Contagem de sim entre as 30 soluções, sem o MOGI:

| Coluna | Soluções com sim |
|---|---:|
| Foto no relato | 23 |
| WhatsApp | 8 |
| Foto do conserto ao morador | 3 |
| IA lê foto e texto | 4 |
| Prioridade automática | 0 |
| Regra auditável | 2 |
| Duplicados agrupados | 5 |
| Pessoa confere os graves | 0 |
| Rosto e placa borrados | 2 |
| Custo de IA público | 0 |
| Nova cidade sem reprogramar | 4 |
| Código aberto | 1 |

1. **Prioridade automática, conferência humana dos graves e custo de IA publicado não aparecem em nenhuma das 30.** É o espaço do MOGI, com a ressalva do n/d. O que as fontes mostram é prazo fixo por tipo de serviço. Exemplo: a [carta de serviços de Porto Alegre](https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao) diz que a realização do serviço pode levar "entre 1 (um) e 365 (trezentos e sessenta e cinco) dias".
2. **Foto no relato não diferencia:** 23 das 30 aceitam.
3. **WhatsApp que abre relato existe em 8 soluções, quase sempre com escopo estreito.**
   - No Brasil: SP156, 1746, Porto Alegre, Goiânia (número da Seinfra só para tapa-buraco) e Belém (só coleta de entulho).
   - Fora: OneService, Buenos Aires (Boti) e Cidade do México, este por fonte de imprensa.
   - Listas oficiais fechadas, sem WhatsApp: Fala.BR, PBH, Fortaleza, Curitiba, DF, NYC311 e SeeClickFix.
4. **No Brasil, a IA que aparece lê só uma coisa.**
   - Só a foto: no [SP156](https://prefeitura.sp.gov.br/web/inovacao/w/sp156-utiliza-intelig%C3%AAncia-artificial-para-facilitar-o-atendimento-aos-cidad%C3%A3os), a Solicitação Inteligente, de 16/05/2025, sugere o serviço pela foto, com "seis serviços mapeados". Em [Curitiba](https://www.curitiba.pr.gov.br/noticias/evolucao-tecnologica-garante-modernidade-e-qualidade-do-atendimento-na-central-156-de-curitiba/72215), o app reconhece a imagem e oferece o serviço correspondente; lido em cópia do Wayback.
   - Só o texto: em [Porto Alegre](https://prefeitura.poa.br/gp/noticias/prefeitura-lanca-atendimento-com-inteligencia-artificial-no-whatsapp-do-156), a Sol entende texto e áudio no WhatsApp e oferece iniciar o serviço.
   - Fora do Brasil, OneService, NYC311, Buenos Aires e Snap Send Solve leem foto e texto, mas para sugerir o formulário, escolher o órgão ou achar duplicata. Nenhuma página diz que a IA dá prioridade.
5. **O Colab declara o contrário da proposta do MOGI.** A [política de privacidade](https://www.colab.com.br/politica-de-privacidade/) diz: "O COLAB não utiliza nenhum tipo de decisão automatizada que impacte o USUÁRIO." No MOGI, a prioridade é automática, por uma regra da prefeitura que qualquer um lê, e uma pessoa confere os graves.
6. **Duplicados agrupados e foto do conserto só aparecem fora do Brasil.**
   - Duplicados: FixMyStreet, SeeClickFix, Buenos Aires, Toronto e Snap Send Solve.
   - Foto do conserto: Boston (em parte dos casos), My City Report e Snap Send Solve.
   - Nenhuma fonte brasileira aberta mostra uma das duas.
7. **Borrão de rosto e placa:**
   - My City Report declara o borrão automático.
   - O FixMyStreet Pro permite que a equipe do council cubra áreas da imagem à mão; a página cita placa, não rosto.
8. **Código aberto:** entre os concorrentes, só o FixMyStreet, sob AGPL v3.

## 3. Para o slide de comparação

Linhas do slide atual com a resposta conferida. Os links e os trechos estão na matriz e no anexo.

| Solução | Foto | WhatsApp | Foto do conserto | IA foto e texto | Prioridade automática | Regra auditável | Duplicados | Pessoa confere graves | Rosto e placa | Custo de IA | Nova cidade | Código aberto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **MOGI** | sim | não, no roadmap | sim | sim | sim | sim | sim | sim | sim, a validar | sim, medido pelo time | sim | sim |
| Colab | sim | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d |
| SP156 | sim | sim | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d |
| 1746 | sim | sim | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d |
| Conecta Recife | sim | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d |
| Fala.BR | sim | não | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d |
| OneService | sim | sim | n/d | sim | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d |
| NYC311 | sim | não | n/d | sim | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d |
| FixMyStreet | sim | n/d | n/d | n/d | n/d | sim | sim | n/d | sim, manual | n/d | sim | sim |
| SeeClickFix | sim | não | n/d | n/d | n/d | sim | sim | n/d | n/d | n/d | sim | n/d |

Rodapé sugerido para o slide: "n/d: sem evidência pública nas páginas oficiais abertas em 28/11/2026. Fontes em docs/research/benchmark-concorrentes.md."

## 4. Ressalvas e decisões de critério

**Linha do MOGI**, conferida no código da `main` em `1b91bba`:
- Foto do conserto †: existe, mas é opcional para a equipe ao resolver (`Resolver`). O levantamento de requisitos (PR #14) propõe exigir.
- Rosto e placa †: o borrão roda no servidor e ainda precisa de validação com fotos reais de Itamogi.
- Custo de IA †: R$ 0,0003 por relato de texto, medido pelo time em 11 casos fictícios. A natureza está no [registro de evidências](../evidencias.md).
- Nova cidade: uma instalação por cidade, com uma linha na tabela de cidades e uma pasta de regras Lua ([ADR 0021](../adr/0021-cidade-como-dado-e-escala.md), em Proposta).
- WhatsApp: não existe na `main`; é o próximo passo 2 do [README](../../README.md#próximos-passos).

**Concorrentes:**
- **Fala.BR, nova cidade:** n/d. A notícia da CGU de 08/04/2020 oferece o módulo de acesso à informação a estados e municípios, por termo de adesão. Ela não trata da ouvidoria.
- **SeeClickFix:**
  - Regra auditável: sim. As regras de encaminhamento são configuradas pelo órgão e aparecem na tela Automations; a documentação não cita histórico de mudanças.
  - Nova cidade: sim. Cada cliente configura tipos de pedido e fluxos; a página não diz literalmente sem código.
- **Buenos Aires, IA:** sim. O reconhecimento de imagem está documentado só na denúncia viária; o texto passa pelo motor de entendimento do Boti.
- **Snap Send Solve, IA:** sim, com base num estudo de caso da própria empresa sobre duplicatas.
- **NYC311, IA:** sim. Foto e texto sugerem o formulário do pedido; a página não fala em prioridade.
- **FixMyStreet:**
  - Regra auditável: sim, pelo código aberto, que encaminha por local e categoria.
  - Nova cidade: sim no Reino Unido, onde qualquer council recebe por e-mail. Em outro país, é preciso instalar a plataforma.
  - Borrão: manual, só no FixMyStreet Pro.
- **Cidade do México:** os dois sim vêm de imprensa (UnoTV, 18/09/2025). Os sites oficiais recusaram a conexão.
- **1746, foto:** a fonte é a carta de serviços de 2018.
- **Curitiba:** lida em cópias do Wayback Machine, porque o site oficial devolveu 403.
- **Linhas só com n/d:** Salvador, Manaus, Florianópolis, Vitória e Lisboa. As fontes oficiais não abriram (só JavaScript, erro ou 403) ou não dizem nada sobre as colunas.

## 5. Fora da matriz

- **São José dos Campos-SP.** Usa IA em câmeras de caminhões para zeladoria, num teste pela Lei de Inovação, "sem custos para o poder público" ([notícia da prefeitura, 22/09/2025](https://www.sjc.sp.gov.br/noticias/2025/setembro/22/tecnologia-com-ia-reforca-cuidados-e-zeladoria-em-sao-jose/)). Não recebe relato de morador, então não entra na comparação de canais. Mostra que prefeituras brasileiras já testam IA em zeladoria.
- **Edital de Xexéu-PE e Auto311.** O edital está no levantamento de requisitos (PR #14), e o Auto311, que é estudo acadêmico, na pesquisa do PR #12.

## 6. O que falta

- [FALTA: fontes oficiais de Salvador, Manaus, Florianópolis, Vitória e Lisboa que abram sem JavaScript ou sem bloqueio.]
- [FALTA: custo de IA de qualquer concorrente em contrato ou edital. Nenhuma página aberta publica.]
- [FALTA: o deck v2 não está no repositório. As colunas seguem a lista do slide passada pelo FS1.]

## Anexo: trecho de cada célula com sim ou não

### Brasil

<details><summary><b>Colab</b>, nacional, várias prefeituras: 1 célula(s) com sim ou não</summary>

Página principal: https://www.colab.com.br/

- **Foto no relato: sim**. [https://www.colab.com.br/sou-cidadao/](https://www.colab.com.br/sou-cidadao/): "tire uma foto, descreva o ocorrido e envie sua demanda pelo aplicativo do Colab"

Fontes que não abriram na conferência: 4.

</details>

<details><summary><b>Fala.BR (CGU)</b>, federal: 2 célula(s) com sim ou não</summary>

Página principal: https://falabr.cgu.gov.br/

- **Foto no relato: sim**. [https://www.gov.br/pt-br/servicos/registrar-manifestacao-no-sistema-de-ouvidorias-do-poder-executivo-federal](https://www.gov.br/pt-br/servicos/registrar-manifestacao-no-sistema-de-ouvidorias-do-poder-executivo-federal): "Você pode anexar documentos, imagens ou arquivos PDF para fundamentar sua manifestação"
- **WhatsApp: não**. [https://www.gov.br/pt-br/servicos/registrar-manifestacao-no-sistema-de-ouvidorias-do-poder-executivo-federal](https://www.gov.br/pt-br/servicos/registrar-manifestacao-no-sistema-de-ouvidorias-do-poder-executivo-federal): "Web : Fala.BR - Plataforma Integrada de Ouvidoria e Acesso à Informação"

Fontes que não abriram na conferência: 3.

</details>

<details><summary><b>1Doc</b>, nacional, várias prefeituras: 1 célula(s) com sim ou não</summary>

Página principal: https://1doc.com.br/

- **Foto no relato: sim**. [https://apps.apple.com/br/app/1doc-atendimento/id1494746128](https://apps.apple.com/br/app/1doc-atendimento/id1494746128): "anexe fotos e outros documentos"

Fontes que não abriram na conferência: 2.

</details>

<details><summary><b>IPM Atende.Net</b>, nacional, várias prefeituras: 1 célula(s) com sim ou não</summary>

Página principal: https://www.ipm.com.br/

- **Foto no relato: sim**. [https://apps.apple.com/br/app/atende-net/id1330201742](https://apps.apple.com/br/app/atende-net/id1330201742): "Permite o envio de fotos com localização por GPS e consulta de registros anteriores"

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>SP156</b>, São Paulo-SP: 2 célula(s) com sim ou não</summary>

Página principal: https://sp156.prefeitura.sp.gov.br

- **Foto no relato: sim**. [https://prefeitura.sp.gov.br/w/noticia/populacao-pode-solicitar-os-servicos-ofertados-na-central-156-via-aplicativo-no-celular](https://prefeitura.sp.gov.br/w/noticia/populacao-pode-solicitar-os-servicos-ofertados-na-central-156-via-aplicativo-no-celular): "a ferramenta permite o envio de fotos"
- **WhatsApp: sim**. [https://prefeitura.sp.gov.br/web/inovacao/w/atendimento_ao_cidadao/246617](https://prefeitura.sp.gov.br/web/inovacao/w/atendimento_ao_cidadao/246617): "Canal de solicitação via WhatsApp, por meio do número 11 3230-5156"

Fontes que não abriram na conferência: 2.

</details>

<details><summary><b>1746</b>, Rio de Janeiro-RJ: 2 célula(s) com sim ou não</summary>

Página principal: https://www.1746.rio

- **Foto no relato: sim**. [https://www.rio.rj.gov.br/dlstatic/10112/13263059/4334016/CLFCartadeServicos.pdf](https://www.rio.rj.gov.br/dlstatic/10112/13263059/4334016/CLFCartadeServicos.pdf): "Através da plataforma, o usuário pode registrar sua solicitação ou denúncia, postando fotos, além de realizar o acompanhamento de seu chamado"
- **WhatsApp: sim**. [https://carioca.rio/servicos/reparo-de-asfalto-com-deformacao-e-afundamento](https://carioca.rio/servicos/reparo-de-asfalto-com-deformacao-e-afundamento): "Para solicitações via WhatsApp:"

Fontes que não abriram na conferência: 3.

</details>

<details><summary><b>PBH APP</b>, Belo Horizonte-MG: 2 célula(s) com sim ou não</summary>

Página principal: https://prefeitura.pbh.gov.br

- **Foto no relato: sim**. [https://prefeitura.pbh.gov.br/noticias/com-pbh-app-cidadao-tem-opcao-mais-rapida-e-facil-para-solicitar-servicos](https://prefeitura.pbh.gov.br/noticias/com-pbh-app-cidadao-tem-opcao-mais-rapida-e-facil-para-solicitar-servicos): "o cidadão tem a opção de tirar uma foto relacionada à sua demanda"
- **WhatsApp: não**. [https://prefeitura.pbh.gov.br/noticias/bh-realiza-mais-de-44-mil-operacoes-de-tapa-buracos-em-2026](https://prefeitura.pbh.gov.br/noticias/bh-realiza-mais-de-44-mil-operacoes-de-tapa-buracos-em-2026): "Os serviços devem ser solicitados pelos canais oficiais da PBH de atendimento ao cidadão [...] o aplicativo PBH APP ou o site www.pbh.gov.br"

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>Fala Vitória 156</b>, Vitória-ES: 0 célula(s) com sim ou não</summary>

Página principal: https://www.vitoria.es.gov.br/cidadao/156-online

- Nenhuma célula com sim ou não: as páginas abertas não dizem.

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>Central 156</b>, Curitiba-PR: 2 célula(s) com sim ou não</summary>

Página principal: https://www.curitiba.pr.gov.br/servicos/aplicativo-curitiba-156/667

- **Foto no relato: sim**. [https://www.curitiba.pr.gov.br/noticias/aplicativo-do-156-cresce-em-numero-de-registros-e-torna-se-o-principal-canal-de-comunicacao-com-a-prefeitura/77393](https://www.curitiba.pr.gov.br/noticias/aplicativo-do-156-cresce-em-numero-de-registros-e-torna-se-o-principal-canal-de-comunicacao-com-a-prefeitura/77393): "Através do app, o cidadão consegue abrir um pedido, inclusive com o envio de foto, acompanhar suas solicitações e consultar informações"
- **WhatsApp: não**. [https://www.curitiba.pr.gov.br/noticias/balanco-central-156-registra-18-milhoes-de-atendimentos-e-95-de-aprovacao/81526](https://www.curitiba.pr.gov.br/noticias/balanco-central-156-registra-18-milhoes-de-atendimentos-e-95-de-aprovacao/81526): "de forma ininterrupta, em quatro canais de atendimento: app, chat, telefone e internet."

Fontes que não abriram na conferência: 3.

</details>

<details><summary><b>156 Porto Alegre</b>, Porto Alegre-RS: 2 célula(s) com sim ou não</summary>

Página principal: https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao

- **Foto no relato: sim**. [https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao](https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao): "basta incluir o endereço da ocorrência, uma breve descrição da situação e, se desejar, anexar uma foto."
- **WhatsApp: sim**. [https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao](https://prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao): "pelo 156 WhatsApp (51) 3433-0156 e pelo e-mail 156poa@portoalegre.rs.gov.br"

</details>

<details><summary><b>Ouvidoria pelo Fala.BR</b>, Florianópolis-SC: 0 célula(s) com sim ou não</summary>

Página principal: https://www.pmf.sc.gov.br/ouvidoria/

- Nenhuma célula com sim ou não: as páginas abertas não dizem.

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>Conecta Recife</b>, Recife-PE: 1 célula(s) com sim ou não</summary>

Página principal: https://conecta.recife.pe.gov.br/

- **Foto no relato: sim**. [https://conecta.recife.pe.gov.br/servico/871](https://conecta.recife.pe.gov.br/servico/871): "Adicione até 03 fotos do local, caso ache necessário (opcional);"

Fontes que não abriram na conferência: 2.

</details>

<details><summary><b>Fala Salvador 156</b>, Salvador-BA: 0 célula(s) com sim ou não</summary>

Página principal: https://ouvidoria.salvador.ba.gov.br/

- Nenhuma célula com sim ou não: as páginas abertas não dizem.

Fontes que não abriram na conferência: 2.

</details>

<details><summary><b>Central 156</b>, Fortaleza-CE: 1 célula(s) com sim ou não</summary>

Página principal: https://apps.apple.com/br/app/central-156/id1637689004

- **WhatsApp: não**. [https://apps.apple.com/br/app/central-156/id1637689004](https://apps.apple.com/br/app/central-156/id1637689004): "Além do aplicativo móvel é possível fazer as mesmas solicitações através do telefone (ligue 156) ou ainda pelo Portal de atendimento"

Fontes que não abriram na conferência: 2.

</details>

<details><summary><b>Ouvidoria pelo Fala.BR</b>, Manaus-AM: 0 célula(s) com sim ou não</summary>

Página principal: https://www.manaus.am.gov.br/cgm/ouvidoria/

- Nenhuma célula com sim ou não: as páginas abertas não dizem.

Fontes que não abriram na conferência: 2.

</details>

<details><summary><b>Ouvidoria e canais de zeladoria</b>, Belém-PA: 1 célula(s) com sim ou não</summary>

Página principal: https://ouvidoria.belem.pa.gov.br/

- **WhatsApp: sim**. [https://ouvidoria.belem.pa.gov.br/](https://ouvidoria.belem.pa.gov.br/): "Coleta de Entulho - 91 98405-3100"

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>Goiânia 24H e Seinfra</b>, Goiânia-GO: 2 célula(s) com sim ou não</summary>

Página principal: https://play.google.com/store/apps/details?id=br.gov.go.goiania.outprod01.novoprefeitura24horas

- **Foto no relato: sim**. [https://www.goiania.go.gov.br/sit/politica-de-privacidade-e-termos-de-uso-do-aplicativo-prefeitura-24-horas/](https://www.goiania.go.gov.br/sit/politica-de-privacidade-e-termos-de-uso-do-aplicativo-prefeitura-24-horas/): "Opcionalmente, o usuário poderá inserir uma foto e localização da solicitação"
- **WhatsApp: sim**. [https://www.goiania.go.gov.br/sing_servicos/via-publica-tapa-buracos/](https://www.goiania.go.gov.br/sing_servicos/via-publica-tapa-buracos/): "O serviço pode ser solicitado pelos telefones (62) 35248363, (62) 35248373 ou pelo WhatsApp (62) 8493-7229."

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>Participa DF e 162</b>, Distrito Federal: 2 célula(s) com sim ou não</summary>

Página principal: https://www.participa.df.gov.br/

- **Foto no relato: sim**. [https://www.participa.df.gov.br/static/orientacao-manifestacao](https://www.participa.df.gov.br/static/orientacao-manifestacao): "Você tem fotos, vídeos ou algum documento que queira enviar? Clique em anexar e marque o documento"
- **WhatsApp: não**. [https://www.participa.df.gov.br/faq](https://www.participa.df.gov.br/faq): "Você pode acessar o serviço de Ouvidoria do GDF por três canais: Participa DF"

</details>

### Outros países

<details><summary><b>OneService</b>, Singapura: 3 célula(s) com sim ou não</summary>

Página principal: https://www.oneservice.gov.sg/

- **Foto no relato: sim**. [https://www.mddi.gov.sg/newsroom/new-ai-powered-oneservice/](https://www.mddi.gov.sg/newsroom/new-ai-powered-oneservice/): "The feedback will be automatically routed to the agency-in-charge of the issue based on text, geo-location and images submitted by the resident."
- **WhatsApp: sim**. [https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/](https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/): "MSO worked with GovTech to develop the OneService chatbot for WhatsApp and Telegram."
- **IA lê foto e texto: sim**. [https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/](https://www.tech.gov.sg/technews/developing-the-one-service-chatbot/): "As for images submitted by users, we used an objection detection model to look for cigarette butts, lampposts, ceiling lights"

Fontes que não abriram na conferência: 9.

</details>

<details><summary><b>NYC311</b>, Nova York, EUA: 3 célula(s) com sim ou não</summary>

Página principal: https://portal.311.nyc.gov/

- **Foto no relato: sim**. [https://www.nyc.gov/assets/home/html/311/311_mobile_faq.shtml](https://www.nyc.gov/assets/home/html/311/311_mobile_faq.shtml): "If the agency can accept media there will be an option to add the photo within the specific request."
- **WhatsApp: não**. [https://portal.311.nyc.gov/about-nyc-311/](https://portal.311.nyc.gov/about-nyc-311/): "Send a text to 311-692 24 hours a day, 7 days a week, 365 days a year."
- **IA lê foto e texto: sim**. [https://apps.apple.com/us/app/nyc311/id324897619](https://apps.apple.com/us/app/nyc311/id324897619): "AI Smart Select: Now you can just snap a photo of a problem, and AI can suggest a relevant service request form."

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>FixMyStreet</b>, Reino Unido: 6 célula(s) com sim ou não</summary>

Página principal: https://www.fixmystreet.com/

- **Foto no relato: sim**. [https://www.mysociety.org/2026/01/22/faster-reporting-on-fixmystreet-start-your-report-with-a-photo/](https://www.mysociety.org/2026/01/22/faster-reporting-on-fixmystreet-start-your-report-with-a-photo/): "giving users the option to start their reports with a photo"
- **Regra auditável: sim**. [https://www.fixmystreet.com/faq](https://www.fixmystreet.com/faq): "FixMyStreet code is open source, so you are more than welcome to have a play around with it."
- **Duplicados agrupados: sim**. [https://www.fixmystreet.com/faq](https://www.fixmystreet.com/faq): "Others can quickly see what has already been reported, so it prevents the council from having to deal with duplicates."
- **Rosto e placa borrados: sim**. [https://www.societyworks.org/2021/06/21/image-redaction-on-fixmystreet-pro/](https://www.societyworks.org/2021/06/21/image-redaction-on-fixmystreet-pro/): "Councils using FixMyStreet Pro can now redact particular areas of images uploaded by a citizen"
- **Nova cidade sem reprogramar: sim**. [https://www.fixmystreet.com/faq](https://www.fixmystreet.com/faq): "Reports sent through FixMyStreet go into the same council email inboxes as reports sent through by any other means."
- **Código aberto: sim**. [https://raw.githubusercontent.com/mysociety/fixmystreet/master/LICENSE.txt](https://raw.githubusercontent.com/mysociety/fixmystreet/master/LICENSE.txt): "Most of the software here is Copyright (c) UK Citizens Online Democracy."

Fontes que não abriram na conferência: 4.

</details>

<details><summary><b>SeeClickFix</b>, EUA: 5 célula(s) com sim ou não</summary>

Página principal: https://seeclickfix.com/

- **Foto no relato: sim**. [https://www.civicplus.help/seeclickfix/docs/report-an-issue-to-my-city](https://www.civicplus.help/seeclickfix/docs/report-an-issue-to-my-city): "Add an appropriate image, if available"
- **WhatsApp: não**. [https://www.civicplus.com/seeclickfix-311-crm/unified-platform/](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/): "Manage all service requests from the mobile app, web portal, SMS text, Agent, and call taker interface."
- **Regra auditável: sim**. [https://www.civicplus.help/seeclickfix/docs/automations-overview](https://www.civicplus.help/seeclickfix/docs/automations-overview): "Within each Request Category, Organization Owners can set users to be the automatic assignee."
- **Duplicados agrupados: sim**. [https://www.civicplus.com/seeclickfix-311-crm/unified-platform/](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/): "Automatically detect duplicate requests before they are submitted."
- **Nova cidade sem reprogramar: sim**. [https://www.civicplus.com/seeclickfix-311-crm/unified-platform/](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/): "Create request types and workflows to meet the city's needs."

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>BA Colaborativa e Boti</b>, Buenos Aires, Argentina: 4 célula(s) com sim ou não</summary>

Página principal: https://buenosaires.gob.ar/ba-147

- **Foto no relato: sim**. [https://buenosaires.gob.ar/ba-147](https://buenosaires.gob.ar/ba-147): "elegí aquello que querés que se repare, cargá la dirección, una foto y tu comentario."
- **WhatsApp: sim**. [https://static.buenosaires.gob.ar/sites/default/files/2025-07/Caso_Boti.pdf](https://static.buenosaires.gob.ar/sites/default/files/2025-07/Caso_Boti.pdf): "Ya está disponible en Boti la posibilidad de solicitar la reparación de baches o de una fachada en mal estado."
- **IA lê foto e texto: sim**. [https://static.buenosaires.gob.ar/sites/default/files/2025-07/Caso_Boti.pdf](https://static.buenosaires.gob.ar/sites/default/files/2025-07/Caso_Boti.pdf): "para identificar de forma correcta las imágenes que envíen los vecinos al realizar una denuncia vial."
- **Duplicados agrupados: sim**. [https://buenosaires.gob.ar/ba-147](https://buenosaires.gob.ar/ba-147): "podés consultar en el mapa todas las solicitudes activas, reforzar las realizadas por tus vecinos para aumentar su prioridad"

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>My City Report</b>, Japão: 4 célula(s) com sim ou não</summary>

Página principal: https://www.mycityreport.jp/

- **Foto no relato: sim**. [https://www.mycityreport.jp/faq/citizens](https://www.mycityreport.jp/faq/citizens): "できるだけ正確な情報のやりとりを行うために、写真と位置情報は必須となっています。"
- **Foto do conserto ao morador: sim**. [https://www.mycityreport.jp/documents/MCR参加案内.pdf](https://www.mycityreport.jp/documents/MCR参加案内.pdf): "対応後写真 ＋コメント"
- **Rosto e placa borrados: sim**. [https://www.mycityreport.jp/faq/governments](https://www.mycityreport.jp/faq/governments): "人物と車両のナンバープレートについてはAI自動判定により自動的にぼかしが掛かるようになっています。"
- **Nova cidade sem reprogramar: sim**. [https://www.mycityreport.jp/faq/citizens](https://www.mycityreport.jp/faq/citizens): "MCR参加自治体であれば同じアプリでどの自治体でも使えます。"

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>BOS:311</b>, Boston, EUA: 2 célula(s) com sim ou não</summary>

Página principal: https://311.boston.gov/

- **Foto no relato: sim**. [https://www.boston.gov/node/16671021](https://www.boston.gov/node/16671021): "From a single screen, you can describe the issue, add photos, and share the location."
- **Foto do conserto ao morador: sim**. [https://www.boston.gov/civic-engagement/bos311-app](https://www.boston.gov/civic-engagement/bos311-app): "In a limited number of cases, they can even see a photo of the completed work, like a filled in pothole."

</details>

<details><summary><b>311 Toronto</b>, Toronto, Canadá: 2 célula(s) com sim ou não</summary>

Página principal: https://www.toronto.ca/home/311-toronto-at-your-service/

- **Foto no relato: sim**. [https://www.toronto.ca/home/311-toronto-at-your-service/311-mobile-apps](https://www.toronto.ca/home/311-toronto-at-your-service/311-mobile-apps): "Give City crews more context with your service request by taking a picture with your mobile device and attaching it to your service request."
- **Duplicados agrupados: sim**. [https://www.toronto.ca/home/311-toronto-at-your-service/311-mobile-apps](https://www.toronto.ca/home/311-toronto-at-your-service/311-mobile-apps): "Find out if a pothole has already been reported"

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>Snap Send Solve</b>, Austrália e Nova Zelândia: 5 célula(s) com sim ou não</summary>

Página principal: https://snapsendsolve.com/

- **Foto no relato: sim**. [https://snapsendsolve.com/solvers/local-government-councils](https://snapsendsolve.com/solvers/local-government-councils): "Our reports come with up to five photos and exact GPS coordinates"
- **Foto do conserto ao morador: sim**. [https://snapsendsolve.com/features/solve-app-field-teams](https://snapsendsolve.com/features/solve-app-field-teams): "That photo goes straight back to the resident who reported it via the Snap Send Solve app"
- **IA lê foto e texto: sim**. [https://snapsendsolve.com/partners/how-city-of-glen-eira-expects-to-save-88k-per-year-with-duplicate-detection](https://snapsendsolve.com/partners/how-city-of-glen-eira-expects-to-save-88k-per-year-with-duplicate-detection): "The AI model compares reports by: Photo similarity Location proximity Incident category Timestamp Issue description"
- **Duplicados agrupados: sim**. [https://snapsendsolve.com/partners/how-city-of-glen-eira-expects-to-save-88k-per-year-with-duplicate-detection](https://snapsendsolve.com/partners/how-city-of-glen-eira-expects-to-save-88k-per-year-with-duplicate-detection): "The solution identifies potential duplicate reports in real time and prompts residents to confirm if the issue has already been reported"
- **Nova cidade sem reprogramar: sim**. [https://snapsendsolve.com/how-it-works](https://snapsendsolve.com/how-it-works): "Snap Send Solve allows you to send reports to all councils in Australia and New Zealand"

Fontes que não abriram na conferência: 1.

</details>

<details><summary><b>Seoul Smart Complaint Report</b>, Seul, Coreia do Sul: 1 célula(s) com sim ou não</summary>

Página principal: https://news.seoul.go.kr/gov/archives/528201

- **Foto no relato: sim**. [https://apps.apple.com/kr/app/id547521233](https://apps.apple.com/kr/app/id547521233): "현장사진 및 동영상 첨부 기능"

</details>

<details><summary><b>Na Minha Rua LX</b>, Lisboa, Portugal: 0 célula(s) com sim ou não</summary>

Página principal: https://naminharualx.cm-lisboa.pt/

- Nenhuma célula com sim ou não: as páginas abertas não dizem.

Fontes que não abriram na conferência: 5.

</details>

<details><summary><b>Locatel e Bachetel</b>, Cidade do México, México: 2 célula(s) com sim ou não</summary>

Página principal: https://311locatel.cdmx.gob.mx/

- **Foto no relato: sim** (fonte de imprensa). [https://www.unotv.com/estados/ciudad-de-mexico/asi-puedes-reportar-baches-y-socavones-via-whatsapp-en-cdmx/](https://www.unotv.com/estados/ciudad-de-mexico/asi-puedes-reportar-baches-y-socavones-via-whatsapp-en-cdmx/): "Una vez enviado el reporte de bache con ubicación y fotografías"
- **WhatsApp: sim** (fonte de imprensa). [https://www.unotv.com/estados/ciudad-de-mexico/asi-puedes-reportar-baches-y-socavones-via-whatsapp-en-cdmx/](https://www.unotv.com/estados/ciudad-de-mexico/asi-puedes-reportar-baches-y-socavones-via-whatsapp-en-cdmx/): "el 55 5658 1111"

Fontes que não abriram na conferência: 5.

</details>

