# Registro de evidências: de onde vem cada número

Todo número que aparece no README, no pitch, no BMC, no resumo executivo ou no vídeo tem uma linha aqui. Quem apresenta o MOGI usa só o que está nesta tabela, e com a natureza que ela diz.

**Natureza do número:**
- **Medido pelo time:** rodou de verdade, com o sistema e os provedores reais, mas com casos escritos pelo time. Não é prova de acerto em Itamogi.
- **Contagem:** contado no código, no CI ou no fluxo desenhado.
- **Estimativa:** conta feita sobre hipóteses; muda quando os dados reais chegarem.
- **Campo:** observado com moradores e servidores de Itamogi. **Ainda não há nenhum número de campo**: ele vem do teste de campo e do piloto.

## Triagem com IA
| Número | Natureza | Fonte | Data | Ambiente | Amostra |
|---|---|---|---|---|---|
| **10 de 11** casos no nível esperado | medido pelo time | teste ao vivo com o Jev ([fluxo do agente](fluxo-do-agente.md#custo-e-latência-por-etapa)) | 15/11/2026 | sandbox do time, Jev 1.14 da TypeSafe, regra Lua de Itamogi | 11 casos fictícios, escritos pelo time, só texto |
| **160 ms** de mediana e 227 ms no pior caso, na decisão do Jev | medido pelo time | o mesmo teste | 15/11/2026 | o mesmo | 11 casos; mede só a chamada ao Jev, não a triagem inteira |
| **R$ 0,0003** por relato só com texto | medido pelo time | o mesmo teste: R$ 0,00339 no total | 15/11/2026 | preço do Jev de US$ 0,042 por milhão de tokens e câmbio de 5,5, ambos a confirmar | 11 casos |
| **R$ 0,0007** por relato com foto | medido pelo time | conversa de 11/11, cerca de 2.900 tokens | 12/11/2026 | foto borrada enviada ao Jev | poucos casos de teste |
| Confiança de 0,98 no cano estourado e 0,99 no buraco | medido pelo time | teste do Jev com foto borrada | 15/11/2026 | imagens geradas por IA | poucas imagens; não são fotos de Itamogi |

## Custo e tempo para a prefeitura
| Número | Natureza | Fonte | Data | Observação |
|---|---|---|---|---|
| **~R$ 360 por mês** de servidor na AWS | estimativa | [cotação AWS](enterprise/07-aws.md), cenário A | 15/11/2026 | **subtotal** da calculadora, sem os itens não cotados (backup testado, proteção e restauração) |
| R$ 0,36 por relato no piloto e R$ 0,08 em escala | estimativa | a mesma cotação | 15/11/2026 | 1 mil e 20 mil relatos por mês são hipóteses |
| **~230 horas** de servidor por mês com 400 pedidos (1,4 pessoa) | estimativa | [economia de tempo](economia-de-tempo.md) | 16/11/2026 | todas as entradas são hipóteses; viram dado na visita a Itamogi |
| R$ 25 por hora de servidor com encargos | estimativa | a mesma página | 16/11/2026 | hipótese |

## Comparação com o atendimento legado
| Número | Natureza | Fonte | Observação |
|---|---|---|---|
| 0, 3 e 7 itens prontos para a secretaria (legado, app comum, MOGI) | contagem | [legado vs MOGI](legado-vs-mogi.md) | contados na tabela do fluxo desenhado de cada um, não em prefeituras reais |
| 5 toques humanos no legado e 1 no MOGI | contagem | a mesma página | fluxo desenhado; o fluxo real de Itamogi se confirma na visita |

## Qualidade do código
| Número | Natureza | Fonte | Data |
|---|---|---|---|
| 362 testes no painel, 31 no app Expo, 87 funções de teste em Go | contagem | CI da [PR 33](https://github.com/rota-scale/cidade-inteligente-akcit/pull/33) | 16/11/2026 |
| 97 conferências da API contra Postgres e SeaweedFS reais, sem falha | contagem | `scripts/conferir-api.py` | 16/11/2026 |
| cerca de 39 mil linhas de código, 16% em testes | contagem | [cultura Rota Scale](cultura-rota-scale.md) | 16/11/2026 (v0.2.0) |

## Campo, 18/11/2026

O que já aconteceu: reunião com o prefeito de Itamogi, que avaliou o protótipo, e gravação de um vídeo dele falando sobre o sistema. O vídeo está com o time e ainda não foi publicado aqui, à espera do consentimento para divulgação. Não houve teste prático com morador nesse dia. As fichas da [rua](teste-de-campo-itamogi.md) permanecem em branco.

| Número | Natureza | Fonte | Amostra | Valor |
|---|---|---|---|---|
| Avaliação do prefeito sobre o protótipo | campo (qualitativo) | reunião de 18/11/2026 | 1 reunião | ocorreu; o vídeo aguarda consentimento para publicação |
| Acerto da triagem em avisos reais de morador | medido no campo | ficha da rua | ainda sem amostra | não há |
| Segundos do envio até o pino na central | medido no campo | ficha da rua | ainda sem amostra | não há |
| Pedidos de zeladoria por mês | informado pela prefeitura, se surgir | conversa | | a preencher |

## Metas (não são resultado)
| Meta | Fonte |
|---|---|
| triagem em até 10 s e custo abaixo de R$ 0,05 por relato | [SPEC](spec-mvp.md) |
| 90% de acerto nos níveis 4 e 5 | [SPEC](spec-mvp.md) e [BMC](../bmc/README.md) |
| nível 5 despachado em até 2 horas | a confirmar com a prefeitura |

## O que não dizemos
- **Que a prefeitura de Itamogi aprovou, apoia ou homologou o MOGI.** O piloto é uma proposta; o consentimento formal está a confirmar ([issue #27](https://github.com/rota-scale/cidade-inteligente-akcit/issues/27)).
- **Que o MOGI cumpre a LGPD.** Há medidas no código ([SOP 06](sops/06-checklist-lgpd.md)); base legal, encarregado e termo final dependem da prefeitura ([issue #28](https://github.com/rota-scale/cidade-inteligente-akcit/issues/28)).
- **Que a triagem acerta 91% em Itamogi.** O 10 de 11 é de casos escritos pelo time.
- **Preço para a prefeitura.** Ainda é hipótese ([BMC](../bmc/README.md)).
- **Que um teste alpha é homologação.** Teste feito pelo time é teste da equipe.

## Imagens geradas por IA

- Os desenhos da apresentação do app (`painel/public/slides/`) foram gerados com o Nano Banana 2.1 e passaram por veredito do Russo em 16/11/2026. O app avisa isso na Ajuda. Não são fotos de Itamogi.
- **Regra:** a expressão do personagem acompanha a gravidade do assunto. Em Itamogi há falta de água e racionamento, então cano vazando pede um rosto sério ou preocupado, nunca sorriso. Alívio aparece só no desfecho, e contido. A primeira leva, com o menino sorrindo diante do vazamento, foi reprovada por isso.

## Como atualizar
Número novo entra aqui antes de entrar no pitch, com natureza, fonte, data, ambiente e amostra. Quando o teste de campo acontecer, os números de campo ganham uma seção própria, e os de teste do time continuam aqui, com o rótulo.
