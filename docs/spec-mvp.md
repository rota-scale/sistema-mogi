# SPEC do MVP do Sistema MOGI (Monitoramento e Ocorrências com Gestão Inteligente)

Princípio: MVP enxuto para Itamogi-MG, open source, custo mínimo, um servidor só (ADR 0013). Entrega utilizável até 14/11/2026; hackathon em 21/11/2026.

## Telas
| # | Tela | Quem usa | Onde |
|---|---|---|---|
| 1 | Captura "falar e mostrar": câmera, botão de falar, GPS | Cidadão ou servidor | App Expo |
| 2 | Formulário pré-preenchido para confirmar com um toque | Cidadão | App Expo |
| 3 | Confirmação com protocolo, nível e prazo | Cidadão | App Expo |
| 4 | Mapa 3D com pins vivos, heatmap, filtros e contador por bairro | Operador | Painel web |
| 5 | Fila de triagem por prioridade, com revisão humana dos níveis 4 e 5 | Operador | Painel web |
| 6 | Detalhe do chamado: mídia borrada, endereço, barras G, U e T, relatos agrupados, status | Operador | Painel web |
| 7 | Admin: regras Lua, limiares e secretarias da prefeitura | Gestor | Painel web |
| 8 | Indicadores: tempo de resposta, acerto da IA, custo e latência | Gestor | Painel web |

## Requisitos funcionais
- RF01 Registrar ocorrência com foto (vídeo desejável), voz transcrita em pt-BR e GPS, sem digitar.
- RF02 Converter GPS em endereço e bairro (Nominatim com cache) e quadrante H3.
- RF03 Borrar rostos e placas antes de qualquer exibição ou envio externo.
- RF04 Etapa 1: modelo de visão gera campos estruturados da mídia.
- RF05 Etapa 2: Jev retorna categoria, secretaria, sinais de risco e distribuições G, U e T com probabilidades.
- RF06 Etapa 3: script Lua da prefeitura aplica sinais, limiares e pesos e define o nível de 1 a 5 (Triagem Urbana).
- RF07 Confiança alta e nível 1 a 3: despacho automático. Nível 4 e 5: revisão humana sempre. Confiança baixa: pedir nova foto ou revisão.
- RF08 Agrupar relatos próximos do mesmo problema e recalcular a tendência.
- RF09 Atualizar mapa e fila em tempo real por WebSocket.
- RF10 Login de operador e gestor com JWT.
- RF11 Log de custo e latência por ocorrência.
- RF12 Fallback: se o Jev falhar, LLM com saída estruturada; se falhar, "a classificar".

## Requisitos não funcionais
- RNF01 Triagem completa em até 10 s por ocorrência (a calibrar); Jev de 70 a 500 ms segundo a TypeSafe.
- RNF02 Mapa fluido com até 5 mil pins no notebook do operador (a confirmar em teste).
- RNF03 LGPD: áudio descartado, mídia borrada, dados pessoais nunca vão ao Jev, retenção definida (ADR 0008).
- RNF04 Tudo roda em um servidor (Go, Postgres, SeaweedFS) com Docker Compose.
- RNF05 Open source por padrão; Jev é a única exceção declarada (ADR 0012).
- RNF06 Interface em português, botões grandes, uso com uma mão.
- RNF07 Regras Lua executam em sandbox com timeout de 50 ms.

## Escopo
**Dentro:** telas 1 a 8, mapa 3D simples (prédios extrudados, câmera inclinada), pins vivos, heatmap, revisão humana, agrupamento, log de custo.
**Fora:** estilo Pokémon GO com avatar, gamificação estilo Duolingo, terreno 3D, integração Open311 e Waze for Cities, notificações push, multi-cidade, alta disponibilidade.

## Critérios de aceite
1. Um relato por voz e foto vira chamado em menos de 30 s, sem teclado.
2. O exemplo do cano estourado sai nível 5 vermelho e vai para revisão humana.
3. O pin aparece no painel em até 2 s após a triagem, sem recarregar a página.
4. Dois relatos do mesmo problema a menos de 50 m viram um chamado com 2 relatos.
5. Alterar um limiar no script Lua muda o nível do próximo chamado sem novo deploy.
6. Nenhum rosto ou placa visível no painel; nenhum dado pessoal no payload do Jev.
7. Derrubar o Jev aciona o fallback e o chamado continua.

## Métricas
| Métrica | Meta do piloto (a calibrar) |
|---|---|
| Tempo do relato ao chamado | menos de 30 s |
| Acerto de categoria (amostra revisada) | 85% ou mais |
| Acerto de nível nos casos 4 e 5 | 90% ou mais |
| Calibração (Brier e ECE) | medida e reportada |
| Custo de IA por ocorrência | menos de R$ 0,05 |
| Tempo até despacho, nível 5 | conforme prazo da cor |

Na SPEC v2 ([texto](sops/sistema-mogi-spec-adrs-sops-v2.txt)) entram mais dois:
- RF13 RAG na base da prefeitura devolve o prazo e a regra local da secretaria, com a fonte citada; sem resultado, vale o prazo padrão do nível com a marca "sem regra local".
- RF14 Toda ação do agente é uma função tipada (function calling) validada por schema e executada pelo Go.

## Situação dos requisitos em 16/11/2026
Conferida no código da `main` em `a247175` (v0.2.1). Números com fonte e amostra no [registro de evidências](evidencias.md). Feito: existe e tem teste ou foi visto rodando. Parcial: existe em parte. Falta: não existe.

| Requisito | Situação | Evidência |
|---|---|---|
| RF01 foto, vídeo, voz e GPS sem digitar | feito | até 4 fotos e 1 vídeo sem som (`ocorrencias/handlers.go`, `Criar`); fala pelo navegador no web; GPS ou ponto no mapa. No Expo a voz é o ditado do teclado |
| RF02 endereço, bairro e H3 | feito | `geo/geo.go` com cache em `geocache`; coluna `h3_r9` |
| RF03 borrar rostos e placas | parcial | `midia/seletivo.go` com reserva de borrão total; falta validar com fotos reais de Itamogi |
| RF04 visão com campos estruturados | feito | `triagem/ia.go` (JSON Schema) e `triagem/jev.go` com `JEV_FOTO=true` |
| RF05 Jev com categoria, sinais e G, U e T | feito | `triagem/jev.go` e `jev_perguntas.go`; teste ao vivo de 15/11 |
| RF06 regra Lua decide o nível | feito | `triagem/lua.go`, `backend/regras/itamogi/` |
| RF07 revisão humana em 4 e 5 e na dúvida | feito | `triagem/servico.go`, `Triar`; "pedir nova foto" vira aviso ao operador, não pedido automático ao morador |
| RF08 agrupar e recalcular a tendência | feito | `ocorrencias/repositorio.go`, `agrupar` e `somarRelato`; "Também vi" em `morador.go` |
| RF09 tempo real | feito | `temporeal/` com `LISTEN/NOTIFY`; filtro por secretaria para a equipe |
| RF10 login com JWT | feito | `auth/`, papéis gestor, operador e campo; morador com cadastro por CPF ou CNPJ, código de recuperação e sessão por aparelho (`morador/`, ADR 0024) |
| RF11 custo e latência por ocorrência | feito | tabela `triagem_etapas`, Indicadores e aba Operação |
| RF12 fallback | feito | cadeia Jev, IA, local e "a classificar", com teste |
| RF13 RAG de prazo e regra local | feito, a validar | agente de contexto com busca BM25 nas orientações (`backend/internal/conhecimento`) e nos casos parecidos da cidade (ADR 0023); a base ainda é escrita pelo time e precisa do texto oficial da prefeitura |
| RF14 ações por function calling | feito, com IA_CHAVE | a IA de reserva chama `chamados_abertos_perto`, `buscar_casos_parecidos` e `consultar_orientacao` (ADR 0023); sem a chave, a triagem segue sem as funções |
| RNF01 triagem em até 10 s | parcial | Jev com mediana de 160 ms (15/11); latência média e p95 nos Indicadores; a soma dos tetos por etapa passa de 10 s |
| RNF02 5 mil pins fluidos | a confirmar | não medido |
| RNF03 LGPD | parcial | áudio não chega ao servidor, borrão, texto limpo, retenção de 90 dias, CPF cifrado e mascarado com acesso auditado, exclusão da conta; falta validar o borrão, o login gov.br e a base legal com a prefeitura (issues #26 e #28) |
| RNF04 um servidor com Docker Compose | feito | `docker-compose.yml`, `make subir` |
| RNF05 open source por padrão | feito | Jev é a exceção; LLM de reserva é opcional |
| RNF06 português, botões grandes, uma mão | feito | princípios 6 e 7 do [ADR 0017](adr/0017-principios-de-produto.md) |
| RNF07 sandbox Lua de 50 ms | feito | `triagem/lua.go`, `TempoMaximoRegra` |

Critérios de aceite: 2, 4, 5, 6 (parte do Jev) e 7 são cobertos por teste Go ou pelo `make fumaca`; 1 e 3 se medem no teste de campo (a confirmar); a parte do borrão no 6 depende da validação com fotos reais.
