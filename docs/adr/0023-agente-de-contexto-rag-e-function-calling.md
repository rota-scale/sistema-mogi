# ADR 0023: Agente de contexto, com RAG e function calling na triagem
**Status:** Proposta · **Data:** 15/11/2026

## Contexto
O AKCIT Camp pede para aplicar RAG, function calling, orquestração e multiagentes. A triagem já orquestrava uma cadeia (Jev, IA de reserva, classificador local, regra Lua), mas cada relato era julgado sozinho: a IA não sabia o que a prefeitura considera grave em cada categoria nem como casos iguais foram tratados, e não tinha como perguntar se o problema já tinha sido relatado ali. O checklist marcava RAG e function calling como "falta".

## Decisão
- **Agente de contexto** (`backend/internal/conhecimento`), uma etapa nova da triagem, depois da visão e antes da classificação, com limite de 800 ms.
- **RAG em duas fontes, sem serviço externo:**
  - **Base da prefeitura:** um arquivo Markdown por categoria (`conhecimento/base/*.md`) com quando é grave, primeiro atendimento, quem atende e sinais que ajudam. Um técnico edita sem programar. A busca é BM25 sobre termos sem acento, com peso para a categoria do relato. É proposta a validar com a prefeitura.
  - **Histórico da cidade:** busca de texto em português no próprio Postgres (`to_tsvector`), no último ano e só da cidade da instalação, com peso para a mesma categoria e para o que está perto. Volta o protocolo, a urgência, o status e um resumo já sem dado pessoal; a distância vai arredondada a 10 m.
  - Até 2 orientações e 3 casos entram no pedido ao Jev e à IA, como referência e não como ordem.
- **Function calling** na IA com visão: três funções só de leitura, `chamados_abertos_perto`, `buscar_casos_parecidos` e `consultar_orientacao`. No máximo 3 voltas; na última, a IA tem de responder. A coordenada do relato fica no servidor: a função usa o ponto, o modelo nunca o vê.
- **Trilha:** o contexto e cada chamada de função (nome, argumentos, tempo, erro) ficam em `ocorrencias.triagem.contexto`; o painel do gestor mostra "O que a IA consultou".
- **Nunca derruba:** falha ou demora do contexto, ou erro de uma função, seguem a triagem sem ele e ficam no log de etapas.

## Como isso fecha os requisitos
| Requisito | Onde |
|---|---|
| RAG | base da prefeitura e histórico da cidade, recuperados antes de classificar |
| Function calling | as três funções da IA de visão, com laço de até 3 voltas |
| Orquestração | o serviço de triagem coordena visão, contexto, cadeia de classificadores com fallback e regra Lua, com orçamento de tempo por etapa |
| Multiagentes | agentes especializados com papéis distintos: visão, contexto, classificador (Jev), classificador de reserva (IA), classificador local, regra da cidade e agrupamento; a IA consulta o agente de contexto pelas funções |

## Alternativas consideradas
- **Embeddings com pgvector:** busca semântica melhor, mas pede extensão nova no Postgres e um modelo de embeddings (custo e dado saindo). Com poucas centenas de chamados, a busca de texto em português basta. Gatilho para trocar: histórico acima de 10 mil chamados ou acerto de categoria abaixo de 85% no piloto.
- **Function calling no Jev:** a API do Jev responde perguntas tipadas e não chama funções; ele recebe o contexto já recuperado.
- **Deixar como próximo passo:** o hackathon pede aplicar, e a banca olha isso.

## Consequências
- Um pedido à IA fica um pouco maior (contexto de até 1.500 caracteres) e, quando a IA chama funções, há uma ou duas idas a mais ao modelo; o custo e o tempo de cada ida entram no log.
- A função de chamados perto só roda com a IA de visão configurada (`IA_CHAVE`). Sem ela, o RAG continua alimentando o Jev e o classificador local, e a trilha mostra as orientações e os casos.
- A base de orientações vira um artefato da prefeitura: precisa de dono e de revisão como as regras Lua.
