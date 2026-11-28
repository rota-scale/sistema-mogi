# Levantamento de requisitos do Sistema MOGI

Conferido em 28/11/2026 no código da `main` em `1b91bba` (v0.3.3). Duas fontes de requisitos:

1. **Edital de Xexéu-PE.** Desafio Plataforma Inteligente de Zeladoria Urbana, da Prefeitura Municipal de Xexéu, datado de 31/07/2026 ([documento 337 em desafios.pe.gov.br](https://desafios.pe.gov.br/portal/home/getchallengedocument/337), 5 páginas). É um edital público com escopo muito próximo ao do MOGI. Serve aqui como lista de requisitos de mercado. O MOGI não se inscreveu nesse desafio.
2. **SPEC do MVP.** [docs/spec-mvp.md](spec-mvp.md), com RF01 a RF14, RNF01 a RNF07 e os critérios de aceite. A SPEC tem uma tabela de situação de 16/11 na v0.2.1; esta página confere de novo na v0.3.3 e corrige o que mudou.

**Status:**
- **Existe:** está no código da `main`. A coluna Onde aponta o arquivo e, quando ajuda, a função ou o teste.
- **Parcial:** existe uma parte. A coluna O que falta diz qual.
- **Roadmap:** não existe no código. A linha aponta a fonte do requisito e o que está planejado.

## Resumo

| Fonte | Existe | Parcial | Roadmap | Total |
|---|---:|---:|---:|---:|
| Edital de Xexéu | 12 | 9 | 2 | 23 |
| SPEC do MVP | 20 | 8 | 0 | 28 |

O que mais pesa para um piloto com moradores:
- A foto do depois ainda é opcional para resolver (E07).
- O cidadão não recebe aviso quando o status muda (E05).
- O tempo em aberto não entra na prioridade (E14).
- A cerca do município depende de configuração (E11).
- O prazo ainda não vem da regra local da secretaria (RF13).

A seção 3 junta tudo o que é roadmap, inclusive o que veio da pesquisa acadêmica e do benchmark.

## 1. Edital de Xexéu-PE contra o MOGI

| # | Requisito do edital | Seção | Status | Onde está no MOGI | O que falta |
|---|---|---|---|---|---|
| E01 | Registrar a ocorrência com localização num mapa integrado, pedindo a localização do aparelho | 3, 4.1 | Parcial | GPS do aparelho ou ponto marcado no mapa: `painel/src/relatar/localizacao.ts`, `painel/src/relatar/MapaVivo.tsx` e `app/src/estado/localizacao.tsx`. A API exige latitude e longitude válidas (`backend/internal/ocorrencias/handlers.go`, `Criar`, erro `local_invalido`) | O edital pede Google Maps. O app web e a central usam MapLibre, pela preferência por código aberto ([ADR 0012](adr/0012-preferencia-por-open-source-no-mvp.md), [ADR 0013](adr/0013-stack-do-mvp.md)). No app Expo o mapa nativo é Apple Maps no iPhone e Google Maps no Android (`app/src/componentes/mapas.tsx`) |
| E02 | Foto ou vídeo obrigatórios para protocolar; sem eles, não aceitar | 3, 4.5, 7 | Existe | `backend/internal/ocorrencias/handlers.go`, `Criar`: sem foto o envio é recusado (`foto_ausente`); até 4 fotos e 1 vídeo de até 15 s ([ADR 0015](adr/0015-midia-v2-varias-fotos-e-video.md)) | Nada. O MOGI é mais estrito que o edital: o vídeo complementa a foto, mas não a substitui |
| E03 | Protocolo automático para cada solicitação | 3 | Existe | protocolo gerado pelo banco em cada chamado (`backend/internal/banco/migracoes/0001_inicial.sql`, `protocolo_seq`) | |
| E04 | Status Recebido, Em análise, Em execução e Concluído | 3, 4.6 | Existe | passos do acompanhamento do morador: recebido, conferido, a caminho e resolvido (`backend/internal/ocorrencias/morador.go`, tipo `Passo`). Status internos `a_classificar`, `revisao`, `aberta`, `em_atendimento` e `resolvida` (`backend/internal/banco/migracoes/0002_producao.sql`; [ADR 0016](adr/0016-ciclo-de-vida-papeis-e-equipe-de-campo.md)) | Os nomes mudam; os quatro momentos são os mesmos |
| E05 | Avisar o cidadão a cada mudança de status, por push, e-mail ou WhatsApp | 3, 4.6 | Roadmap | hoje o morador consulta o andamento pelo protocolo (`backend/internal/ocorrencias/morador.go`, `Acompanhar`) | Notificação push e SMS estão fora do escopo do MVP ([SPEC](spec-mvp.md), Escopo). O WhatsApp é o próximo passo 2 do [README](../README.md#próximos-passos) |
| E06 | Agrupar relatos repetidos no mesmo raio e categoria e usar o volume na prioridade | 3, 4.3 | Existe | `backend/internal/ocorrencias/repositorio.go`, `Registrar`: mesma categoria, raio e janela como parâmetros da cidade, com padrão de 50 m e 30 dias. A tendência sobe e a regra roda de novo (`backend/internal/triagem/servico.go`, `Reavaliar`). Prova no `scripts/fumaca.sh`, passo 7 | Raio e janela a calibrar no piloto |
| E07 | Foto ou vídeo do serviço concluído obrigatórios para encerrar; sem eles, não encerrar | 3, 4.5, 7 | Parcial | a equipe anexa até 3 fotos do depois, borradas como as do morador (`backend/internal/ocorrencias/handlers.go`, `Resolver`), e o morador as vê no acompanhamento (`backend/internal/ocorrencias/morador.go`, `FotosDoDepois`) | A foto do depois é opcional: `Resolver` também aceita só o motivo. Falta exigir a foto para resolver, de preferência como parâmetro da cidade |
| E08 | Painel administrativo para acompanhar, categorizar e priorizar | 3 | Existe | central e gestor no painel web: `painel/src/Painel.tsx`, `painel/src/Admin.tsx`, `painel/src/Parametros.tsx` e `painel/src/Usuarios.tsx`. Revisão, despacho e reabertura em `backend/internal/ocorrencias/handlers.go` (`Revisar`, `Despachar`, `Reabrir`) | |
| E09 | Cidadão acompanha a solicitação pelo protocolo | 3 | Existe | `backend/internal/ocorrencias/morador.go`, `Acompanhar`; telas em `painel/src/relatar/` e `app/src/app/acompanhar/[protocolo].tsx` | |
| E10 | Barrar spam e protocolos falsos em massa, com validação de IP e limite de envios por aparelho | 3, 5 | Existe | limite por aparelho (12 em 10 minutos) e por IP (120 em 10 minutos), ajustáveis pelo gestor (`backend/cmd/api/main.go`; `backend/internal/cidade/cidade.go`, `EnviosPorAparelho` e `EnviosPorIP`). Chave de envio contra protocolo repetido ([ADR 0020](adr/0020-envio-anonimo-e-idempotente.md)). Cadastro com CPF ligado por padrão ([ADR 0024](adr/0024-cadastro-do-morador-com-cpf.md)) | |
| E11 | Confirmar que o ponto informado é real; não aceitar chamado sem localização validada | 4.2, 7 | Parcial | o relato guarda latitude, longitude e precisão em metros. A cerca do município recusa ponto de fora (`backend/internal/ocorrencias/handlers.go`, erro `fora_da_cidade`) | A cerca só vale com `CIDADE_CAIXA` configurada; sem ela, o relato é aceito de qualquer lugar. O valor de Itamogi está a confirmar ([decisões e pendências](decisoes-e-pendencias.md), item 10) |
| E12 | Usuário anônimo, rápido, com rastreio de segurança contra trote | 4.4 | Parcial | o envio sem cadastro existe como módulo: com o módulo cadastro desligado, a API aceita o relato com os limites por aparelho e IP (`backend/internal/ocorrencias/handlers.go`, `moradorDoPedido`; [ADR 0020](adr/0020-envio-anonimo-e-idempotente.md)) | O padrão é cadastro obrigatório desde 16/11 ([ADR 0024](adr/0024-cadastro-do-morador-com-cpf.md)). Ligar o anônimo é decisão da prefeitura |
| E13 | Usuário cadastrado, com CPF, nome, rua e bairro | 4.4 | Parcial | cadastro com nome, CPF ou CNPJ, bairro e profissão opcional. O documento fica cifrado e mascarado, e só o gestor o abre, com registro (`backend/internal/morador/morador.go`, `Cadastrar`; `backend/internal/morador/cifra.go`) | A rua não é pedida, por minimização de dados. Pedir ou não é decisão da prefeitura com o encarregado de dados |
| E14 | Prioridade automática por tipo, risco à segurança, volume de relatos e tempo em aberto | 4.7 | Parcial | categoria, sinais de risco com probabilidade, GUT e número de relatos entram na regra Lua da prefeitura (`backend/regras/itamogi/_comum.lua`, entrada `t`; `backend/internal/triagem/lua.go`) | O tempo em aberto não entra na regra. O prazo sai só do nível (`backend/internal/triagem/servico.go`, `Prazo`) |
| E15 | WhatsApp como canal de registro | 4.8, 6 | Roadmap | não existe na `main` | Próximo passo 2 do [README](../README.md#próximos-passos) |
| E16 | Consentimento explícito no cadastro | 3, 5 | Existe | aceite obrigatório do termo, gravado com data (`backend/internal/morador/morador.go`, `Cadastrar`, erro `aceite_obrigatorio`, coluna `aceite_em`) | O texto final do termo depende da prefeitura ([SOP 06](sops/06-checklist-lgpd.md)) |
| E17 | Prazo definido de retenção dos dados | 3, 5 | Parcial | a original da mídia é apagada em 90 dias, prazo ajustável (`backend/internal/cidade/cidade.go`, `RetencaoDias`; `backend/cmd/api/main.go`, `apagarOriginaisVencidas`). A telemetria é apagada em 30 dias ([SOP 06](sops/06-checklist-lgpd.md)) | Nome e documento do cadastro ficam enquanto a conta existir, sem prazo fixo ([ADR 0024](adr/0024-cadastro-do-morador-com-cpf.md), Exclusão) |
| E18 | Tratamento de privacidade das fotos com placa ou rosto | 3, 5 | Parcial | rostos e placas são borrados no servidor antes de qualquer pessoa ou IA ver; se o detector falha, a foto inteira é borrada (`backend/internal/midia/seletivo.go`, `backend/internal/midia/borrador.go`) | Validar com fotos reais de Itamogi antes de abrir aos moradores ([SOP 06](sops/06-checklist-lgpd.md)) |
| E19 | Exclusão dos dados a pedido do cidadão | 3, 5 | Existe | Apagar conta (`backend/internal/morador/morador.go`, `Apagar`); o gestor apaga cadastro indevido (`ApagarPeloGestor`) | |
| E20 | Indicadores, relatórios e mapas para o planejamento | 3 | Existe | indicadores (`backend/internal/ocorrencias/indicadores.go`, `painel/src/Indicadores.tsx`), relatório CSV do gestor (`backend/internal/observa/handlers.go`, `Relatorio`), mapa com camada de calor (`painel/src/Mapa.tsx`) e relatório do teste de campo (`scripts/relatorio.sh`) | |
| E21 | Interface simples e leve para internet fraca e quem tem pouca familiaridade digital | 1.2, 6 | Parcial | princípios de produto ([ADR 0017](adr/0017-principios-de-produto.md)); boas-vindas, tour e Ajuda (`painel/src/relatar/BoasVindas.tsx`, `painel/src/relatar/Tour.tsx`, `painel/src/relatar/Ajuda.tsx`); fala no app web (`painel/src/relatar/voz.ts`); fila sem rede no app Expo, até 5 relatos (`app/src/logica/fila.ts`) | O app web não guarda relato sem rede ([decisões e pendências](decisoes-e-pendencias.md), backlog). O WhatsApp está no roadmap (E15) |
| E22 | Painel público sem CPF, telefone ou nome de quem relatou | 7 | Existe | não há mapa público. Perto de você devolve referência, categoria, distância, data, relatos e status; Meu bairro devolve categoria, data, foto do depois e distância (`backend/internal/ocorrencias/morador.go`, `Perto` e `Comunidade`). O texto do relato perde CPF, telefone, e-mail e placa (`backend/internal/triagem/tipos.go`, `SemDadosPessoais`) | |
| E23 | Atender as secretarias e as equipes de campo | 1.2 | Existe | a equipe vê e resolve só os chamados da própria secretaria (`painel/src/campo/`; papéis em `backend/internal/auth/auth.go`; [ADR 0016](adr/0016-ciclo-de-vida-papeis-e-equipe-de-campo.md)) | |

## 2. SPEC do MVP contra a main

| # | Requisito | Status | Onde está no MOGI | O que falta |
|---|---|---|---|---|
| RF01 | Foto, vídeo, voz em pt-BR e GPS, sem digitar | Existe | `backend/internal/ocorrencias/handlers.go`, `Criar`; fala no app web (`painel/src/relatar/voz.ts`); GPS ou ponto no mapa (E01) | No app Expo a voz é o ditado do teclado |
| RF02 | GPS vira endereço, bairro e quadrante H3 | Existe | `backend/internal/geo/geo.go`, com cache em `geocache`; coluna `h3_r9` (`backend/internal/banco/migracoes/0001_inicial.sql`) | Bairros oficiais de Itamogi; hoje vêm do Nominatim |
| RF03 | Borrar rostos e placas antes de exibir ou enviar | Parcial | `backend/internal/midia/seletivo.go` e `backend/internal/midia/borrador.go` | Validar com fotos reais (E18) |
| RF04 | Visão gera campos estruturados da mídia | Existe | `backend/internal/triagem/ia.go`, saída em JSON Schema; `backend/internal/triagem/jev.go` com `JEV_FOTO=true` | |
| RF05 | Jev devolve categoria, secretaria, sinais e G, U e T com probabilidade | Existe | `backend/internal/triagem/jev.go` e `backend/internal/triagem/jev_perguntas.go`; teste opcional ao vivo em `backend/internal/triagem/jev_vivo_test.go` | |
| RF06 | A regra Lua da prefeitura define o nível de 1 a 5 | Existe | `backend/internal/triagem/lua.go` e `backend/regras/itamogi/` | |
| RF07 | Revisão humana nos níveis 4 e 5 e na dúvida | Existe | `backend/internal/triagem/servico.go`, `Triar`: nível 4 ou 5, confiança abaixo de 0,6, foto ruim, provável não problema ou local privado vão para revisão | Pedir nova foto é aviso ao operador, não pedido automático ao morador |
| RF08 | Agrupar relatos próximos e recalcular a tendência | Existe | `backend/internal/ocorrencias/repositorio.go`, `Registrar`; `backend/internal/triagem/servico.go`, `Reavaliar`; Também vi em `backend/internal/ocorrencias/morador.go`, `TambemVi` | |
| RF09 | Mapa e fila em tempo real por WebSocket | Existe | `backend/internal/temporeal/temporeal.go`, alimentado por `LISTEN/NOTIFY` (`backend/internal/banco/migracoes/0001_inicial.sql`) | |
| RF10 | Login de operador e gestor com JWT | Existe | `backend/internal/auth/auth.go`; papéis gestor, operador, campo e prefeito (`backend/internal/banco/migracoes/0011_prefeito.sql`); morador com cadastro próprio (`backend/internal/morador/`) | |
| RF11 | Custo e latência por ocorrência | Existe | tabela `triagem_etapas` (`backend/internal/banco/migracoes/0002_producao.sql`); `painel/src/Indicadores.tsx` e `painel/src/Operacao.tsx` | |
| RF12 | Se o Jev falhar, IA de reserva; se falhar, a classificar | Existe | `backend/internal/triagem/servico.go`; testes `TestFallbackQuandoClassificadorFalha` (`triagem_test.go`) e `TestJevForaDoArAcionaFallback` (`jev_test.go`) | |
| RF13 | RAG devolve o prazo e a regra local da secretaria, com a fonte | Parcial | a busca na base da prefeitura e nos casos parecidos existe e alimenta a classificação (`backend/internal/conhecimento/`; [ADR 0023](adr/0023-agente-de-contexto-rag-e-function-calling.md)) | O prazo ainda sai só do nível, com a marca sem regra local (`backend/internal/triagem/servico.go`, `FontePadrao` e `Prazo`). A base é escrita pelo time e precisa do texto oficial da prefeitura. O ADR 0023 está em Proposta |
| RF14 | Toda ação do agente é função tipada, validada e executada pelo Go | Existe | `backend/internal/triagem/ia.go`: a IA chama `chamados_abertos_perto`, `buscar_casos_parecidos` e `consultar_orientacao`, só leitura, em até 3 voltas; teste com provedor simulado em `backend/internal/triagem/contexto_test.go` | Só com `IA_CHAVE`; sem ela, a triagem segue sem as funções |
| RNF01 | Triagem completa em até 10 s | Parcial | latência por etapa em `triagem_etapas`; Jev com mediana de 160 ms em 11 casos fictícios ([registro de evidências](evidencias.md)) | Triagem completa não medida em campo. A soma dos tetos por etapa passa de 10 s |
| RNF02 | Mapa fluido com até 5 mil pinos | Parcial | mapa da central em MapLibre (`painel/src/Mapa.tsx`) | Desempenho com 5 mil pinos não medido |
| RNF03 | LGPD: áudio descartado, mídia borrada, nada pessoal ao Jev, retenção definida | Parcial | áudio não chega ao servidor, borrão, texto limpo, retenção de 90 dias da original, CPF cifrado e mascarado com acesso auditado, exclusão da conta ([SOP 06](sops/06-checklist-lgpd.md)) | Validar o borrão, provar que o CPF é de quem cadastra e fechar a base legal com a prefeitura (seção 3) |
| RNF04 | Tudo roda em um servidor com Docker Compose | Existe | `docker-compose.yml` e `Makefile` (`make subir`) | |
| RNF05 | Código aberto por padrão; Jev como exceção | Existe | `LICENSE` (Apache-2.0); [ADR 0012](adr/0012-preferencia-por-open-source-no-mvp.md) | |
| RNF06 | Português, botões grandes e uso com uma mão | Existe | princípio 6 do [ADR 0017](adr/0017-principios-de-produto.md), com alvos de toque de 44 px ou mais; botões de 56 px de altura no app web (`painel/src/relatar/relatar.css`) | |
| RNF07 | Regras Lua em sandbox com teto de 50 ms | Existe | `backend/internal/triagem/lua.go`, `TempoMaximoRegra`; testes `TestSandboxCortaLaçoInfinito` e `TestSandboxSemBibliotecasPerigosas` (`triagem_test.go`) | |
| C1 | Relato por voz e foto vira chamado em menos de 30 s, sem teclado | Parcial | o fluxo existe (RF01) | Tempo a medir no [teste de campo](teste-de-campo-itamogi.md) |
| C2 | Cano estourado sai nível 5 e vai para revisão humana | Existe | `scripts/fumaca.sh`, passo 3; `TestGUTDoExemploDoCanoEstourado` (`triagem_test.go`) | |
| C3 | Pino no painel em até 2 s após a triagem, sem recarregar | Parcial | tempo real existe (RF09) | 2 s a medir no teste de campo |
| C4 | Dois relatos a menos de 50 m viram um chamado com 2 relatos | Existe | `scripts/fumaca.sh`, passo 7 | |
| C5 | Mudar um limiar no Lua muda o próximo chamado sem novo deploy | Existe | `TestLimiarAlteradoValeNoProximoChamado` (`triagem_test.go`); editor e teste de regras em `backend/internal/admin/admin.go` (`Testar` e `Salvar`) | |
| C6 | Nenhum rosto ou placa no painel; nenhum dado pessoal no pedido ao Jev | Parcial | pedido sem dado pessoal coberto por `TestJevPedidoSoTextoSemDadosPessoais` (`jev_test.go`) e `TestSemDadosPessoais` (`producao_test.go`); borrão em `backend/internal/midia/seletivo.go` | Borrão a validar com fotos reais |
| C7 | Derrubar o Jev aciona o fallback e o chamado continua | Existe | `TestJevForaDoArAcionaFallback` (`jev_test.go`) e `TestVisaoEDecisaoCaemEChamadoContinua` (`producao_test.go`) | |

Mudança em relação à tabela de 16/11 da SPEC: o RF13 passa de feito, a validar, para parcial. A busca existe, mas o prazo da regra local ainda não sai dela. Os testes citados estão em `backend/internal/triagem/`.

## 3. Roadmap: o que não existe hoje

Requisitos com fonte e sem código na `main`. A ordem segue o custo de ficar sem eles num piloto com moradores.

| # | Requisito | Fonte | Situação hoje |
|---|---|---|---|
| R01 | Exigir a foto do depois para resolver, como parâmetro da cidade | edital, 4.5 e 7 | a foto é opcional em `Resolver` (E07) |
| R02 | Provar que o CPF é de quem cadastra (gov.br ou passkey) | [ADR 0024](adr/0024-cadastro-do-morador-com-cpf.md), risco que continua; issue P0 #26 do repositório anterior | qualquer pessoa pode cadastrar o CPF de outra |
| R03 | Avisar o morador a cada mudança de status | edital, 4.6 | o morador consulta pelo protocolo (E05) |
| R04 | Canal de WhatsApp com a mesma triagem e a mesma revisão humana | edital, 4.8; [README](../README.md#próximos-passos), próximo passo 2 | não existe na `main` (E15) |
| R05 | Cerca de Itamogi configurada e validada | edital, 4.2 e 7; [decisões e pendências](decisoes-e-pendencias.md), item 10 | a cerca existe no código, mas depende de `CIDADE_CAIXA` (E11) |
| R06 | Tempo em aberto como critério da regra | edital, 4.7 | a regra recebe categoria, sinais, GUT, confiança e relatos (E14) |
| R07 | Prazo e regra local vindos da base da prefeitura, com a fonte | SPEC, RF13 | prazo padrão do nível, marcado sem regra local |
| R08 | Prazo de retenção para o cadastro do morador | edital, 5 | o cadastro fica enquanto a conta existir (E17) |
| R09 | Fila sem rede no app web | edital, 6; backlog | só o app Expo guarda relatos sem rede (E21) |
| R10 | Compensação de equidade territorial por H3: bairro que relata menos não pode perder prioridade | pesquisa acadêmica do PR #12, eixo 04 (Cornell Tech, Nature Computational Science; Berkeley, MIT e Cornell, 2025) | só a célula `h3_r9` é guardada (`backend/internal/ocorrencias/repositorio.go`); nada a usa na prioridade |
| R11 | Revisão humana por incerteza calibrada, com predição conformal | pesquisa acadêmica do PR #12, eixo 01 | a revisão usa nível 4 ou 5 e limiar fixo de confiança de 0,6 (`backend/regras/itamogi/_comum.lua`, `backend/internal/triagem/servico.go`) |
| R12 | Filtro e borrão no aparelho, antes do envio | pesquisa acadêmica do PR #12, eixo 03 | o borrão é no servidor (`backend/internal/midia/seletivo.go`); o aparelho só tira quadros do vídeo (`app/src/aparelho/midia.ts`) |
| R13 | Integração Open311 com endpoint GeoReport v2 | [ADR 0003](adr/0003-padrao-open311.md); fora do escopo do MVP pela [SPEC](spec-mvp.md) | o modelo de dados segue o GeoReport v2 com extensões (`backend/internal/ocorrencias/repositorio.go`), sem endpoint público |

Decisões que não são roadmap, mas pedem resposta da prefeitura:
- Google Maps no lugar do MapLibre (E01).
- Envio anônimo ligado ou não (E12).
- Rua no cadastro (E13).

O benchmark de concorrentes, com as mesmas colunas do slide de comparação, fica em `docs/research/benchmark-concorrentes.md`, em revisão.
