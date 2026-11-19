# Sistema MOGI: resumo executivo

**Triagem urbana com IA para Itamogi-MG.** O morador fotografa o problema, o MOGI dá a urgência de 1 a 5 com o motivo, e a prefeitura acompanha tudo ao vivo no mapa até a foto do conserto.

## O problema
Buraco, cano estourado, poste apagado e lixo chegam por telefone, WhatsApp e balcão, sem foto, sem endereço exato e sem ordem de urgência. O urgente se perde no meio do comum, a equipe sai para olhar antes de consertar e o morador não sabe o que aconteceu.

## A solução
| Quem | O que ganha |
|---|---|
| Morador | relata em segundos pelo celular, com um cadastro feito uma vez, e acompanha pelo protocolo e pelo perfil |
| Central | recebe o chamado já triado: foto com rostos e placas protegidos, ponto no mapa, urgência, motivo e prazo |
| Equipe de campo | vê só os chamados da própria secretaria, com rota e foto, e resolve com a foto do depois |
| Gestor | indicadores ao vivo, custo de cada triagem e a regra de prioridade editável sem programador |

## Como a IA decide
A IA vê a foto e consulta o histórico da cidade e as orientações da prefeitura. O Jev responde perguntas fechadas com probabilidade. A regra da prefeitura, escrita em Lua (linguagem criada na PUC-Rio), fixa o nível, o motivo e o prazo. Uma pessoa confere todo caso grave.

## Números
| | |
|---|---|
| Tempo de decisão da IA | 160 ms (mediana em 11 casos do time, 15/11/2026) |
| Acerto no teste | 10 de 11 casos fictícios, escritos pelo time, no nível esperado (15/11); falta medir com relatos reais |
| Custo da IA | cerca de R$ 0,0003 por relato só com texto e R$ 0,0007 com foto |
| Servidor do piloto | estimativa de cerca de R$ 360 por mês na AWS em São Paulo (subtotal da cotação), ou o servidor da própria prefeitura |
| Tempo devolvido | cerca de 230 horas de servidor por mês com 400 pedidos (estimativa a validar) |

Nenhum número acima vem de campo ainda: são medições do time e estimativas. Fonte, data e amostra: [registro de evidências](evidencias.md).

## Privacidade
Rostos e placas protegidos antes de qualquer pessoa ou IA ver a foto; CPF do morador cifrado, sempre mascarado e aberto só pelo gestor, com registro; vídeo sem som e com registro de quem abriu; originais apagadas em 90 dias; a coordenada exata nunca sai do servidor.

## Modelo de negócio
B2G: a prefeitura ou o consórcio de municípios paga; o morador usa de graça. Hipóteses de receita: assinatura anual por município, taxa de implantação e plano para consórcio. Valores a definir com as prefeituras.

## Próximos passos
1. Visita e consentimento da Prefeitura de Itamogi.
2. Teste de campo com relatos reais e medição do fluxo atual.
3. Ajuste de prazos, secretarias e regras com a prefeitura.
4. Piloto de 90 dias e expansão para as cidades vizinhas.

**Time Rota Scale:** João Russo (tecnologia) e Renan (produto e negócio). AKCIT Camp Sul 2026.
