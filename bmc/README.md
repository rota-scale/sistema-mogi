# Business Model Canvas e impacto social: Sistema MOGI

Versão 2, de 15/11/2026, para o hackathon AKCIT de 21/11. Substitui o rascunho v1. Modelo B2G (empresa para governo): quem paga é a prefeitura ou o consórcio de municípios; o morador usa de graça. **Todos os valores de preço são hipótese, a confirmar** com prefeituras e com as regras de contratação pública.

## Canvas
| Bloco | Conteúdo |
|---|---|
| **1. Segmentos de clientes** | Prefeituras pequenas (até cerca de 50 mil habitantes, a confirmar), começando por Itamogi-MG; consórcios intermunicipais que dividem equipe e servidor; secretarias de obras, água, iluminação e limpeza. Usuários: moradores (sem custo), central de atendimento, equipes de rua e gestor. |
| **2. Proposta de valor** | Para a prefeitura: saber o que atender primeiro, com foto, ponto exato e prazo, e provar o que fez. Para o morador: relatar em segundos, com um cadastro feito uma vez só, e ver o problema resolvido com a foto do conserto. Diferenciais: triagem com IA que não decide sozinha (perguntas tipadas e regra em Lua editável pela própria prefeitura, com histórico); revisão humana nos níveis 4 e 5; relatos repetidos viram um chamado com mais força; privacidade desde a captura (borrão, texto limpo, vídeo auditado, retenção); custo de IA de centavos por mês. |
| **3. Canais** | Apresentação direta ao prefeito e às secretarias com a demo; piloto sem custo em Itamogi; associações de municípios e consórcios regionais; eventos como o AKCIT; indicação de uma prefeitura para a vizinha. O morador chega por um link (QR em praça, posto, escola e rede social da prefeitura). |
| **4. Relacionamento** | Implantação assistida (cadastro de categorias, secretarias, prazos e regras Lua com a prefeitura); treinamento curto da central e das equipes; relatório mensal com os indicadores do próprio sistema; suporte por canal combinado. |
| **5. Fontes de receita** | Hipóteses a confirmar: assinatura anual por município por faixa de população; taxa de implantação; plano para consórcio com um servidor dividido. Valores ainda não definidos; a referência a validar é ficar abaixo do custo de uma ligação perdida ou de uma saída de equipe à toa por mês. |
| **6. Recursos-chave** | O agente de triagem (perguntas ao Jev, cadeia com reserva, GUT); as **regras em Lua**, que a prefeitura lê e edita sem programador e que são reaproveitadas de uma cidade para outra; o painel com mapa ao vivo e os apps; os dados do piloto para calibrar; o time técnico. |
| **7. Atividades-chave** | Implantar e configurar cada cidade (uma linha de cadastro, uma pasta de regras Lua, revisão de categorias); calibrar faixas e limiares com relatos reais; manter o sistema e a segurança; treinar servidores; medir e reportar o impacto. |
| **8. Parcerias-chave** | Prefeitura de Itamogi (piloto); AKCIT; TypeSafe (Jev) e um provedor de LLM de reserva; comunidade OpenStreetMap; concessionárias de água e energia, para encaminhar o que não é da prefeitura (a negociar); consórcios intermunicipais. |
| **9. Estrutura de custos** | Um servidor por cidade (VPS pequena, 2 vCPU e 4 GB, valor mensal a confirmar) ou o servidor da própria prefeitura; IA a cerca de R$ 0,0003 por relato só com texto e R$ 0,0007 com foto (medido em 12 e 15/11; mil relatos por mês dariam menos de R$ 1, a confirmar com volume real); domínio e certificado; tempo do time em implantação e suporte; deslocamento para treinar. Software quase todo open source, sem licença por usuário. |

## Impacto social
**O problema na cidade pequena.** A prefeitura tem poucas equipes e pouco dinheiro, e quase nenhum dado: o pedido chega por telefone ou WhatsApp, sem foto e sem endereço exato, o mesmo buraco é relatado várias vezes e um cano estourado entra na mesma fila de um lixo parado. O morador não sabe se foi ouvido e para de relatar. Quem mais sofre é quem anda a pé, de moto ou de bicicleta, o idoso, a pessoa com deficiência e a criança perto da escola.

**Quem se beneficia.**
- Moradores: resposta mais rápida no que é perigoso e devolutiva com prova.
- Equipes de rua: saem para o que importa, com foto e rota, e menos viagem perdida.
- Gestão: prioridade defensável, prestação de contas e dados por bairro para planejar manutenção.
- Outras cidades pequenas: o mesmo sistema, com as regras de cada uma, a custo baixo.

**Indicadores que o próprio sistema mede.** Todos saem dos Indicadores, da aba Operação ou do `make relatorio`, só com relatos reais (os simulados ficam de fora).

| Indicador | Como o MOGI mede | Linha de base | Meta do piloto |
|---|---|---|---|
| Tempo até o despacho, por nível | `min_ate_despacho` nos Indicadores | a medir no piloto | nível 5 dentro de 2 horas (a confirmar com a prefeitura) |
| Tempo até a resolução e resolvidos no prazo | `min_ate_resolucao`, `no_prazo` e `com_prazo` por nível | a medir | a definir com a prefeitura |
| Acerto da triagem | nível da IA contra o nível do operador: exatos, até 1 nível, subiu e baixou | 10 de 11 casos fictícios em 15/11 | 90% ou mais nos níveis 4 e 5 (SPEC) |
| Relatos agrupados | chamados com mais de um relato e "Também vi" | a medir | menos chamados duplicados na central |
| Custo de IA por relato | `custo_medio_brl` e linhas de `triagem_etapas` | cerca de R$ 0,0003 a R$ 0,0007 (12 e 15/11) | abaixo de R$ 0,05 (SPEC) |
| Latência da triagem | média e p95 da triagem | mediana de 160 ms do Jev (15/11) | até 10 s (SPEC) |
| Participação | relatos por dia e por bairro, moradores que acompanham o protocolo | a medir | a definir |
| Confiabilidade | chamados que caíram em "a classificar", falhas por etapa | a medir | perto de zero |

Os números de linha de base de 15/11 vêm de casos escritos pelo time; os reais virão do teste de campo em Itamogi. Fonte, data e amostra de cada número: [registro de evidências](../docs/evidencias.md).
