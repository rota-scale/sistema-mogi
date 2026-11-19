# Checklist AKCIT Camp Sul 2026 (21/11, Florianópolis)

Revisado em 15/11/2026 contra as exigências do material oficial do hackathon e contra o código. Versão anterior, de 02/11, no histórico do Git.

## Entregas do dia
| # | O hackathon pede | Onde está | Status | O que falta |
|---|---|---|---|---|
| 1 | Protótipo funcional do agente de IA, demo ao vivo ou gravada | sistema inteiro com `make subir` e `make tunel`; Jev ao vivo; [roteiro da demo](../pitch/README.md) e [SOP 05](sops/05-rodar-demo.md) | atende | gravar o vídeo do plano B |
| 2 | BMC do negócio ou do impacto social atualizado | [bmc/README.md](../bmc/README.md) com as 9 caixas e o bloco de impacto | atende | preços são hipótese a confirmar |
| 3 | Pitch de 3 minutos | [pitch/README.md](../pitch/README.md), cronometrado, com perguntas e plano B | atende no papel | ensaiar e cronometrar |
| 4 | Documentação do fluxo do agente (inputs, lógica, outputs) no README | [README, seção do agente](../README.md#como-o-agente-de-ia-funciona) e [fluxo-do-agente.md](fluxo-do-agente.md) | atende | |

## Condições para participar
| # | O hackathon pede | Onde está | Status | O que falta |
|---|---|---|---|---|
| 5 | Chegar com a solução em andamento | build de teste rodando desde 12/11, CI, 300 testes no painel e 31 no app | atende | teste de campo real |
| 6 | Papéis do time definidos (no mínimo produto ou negócio e tecnologia) | [time.md](time.md) | atende | João Russo (tecnologia) e Renan (produto e negócio), presenciais em 21/11 |
| 7 | Aplicar LLMs | LLM com visão e saída estruturada (`triagem/ia.go`) | atende | |
| 8 | Aplicar RAG | agente de contexto: base de orientações da prefeitura e histórico da cidade antes de classificar ([ADR 0023](adr/0023-agente-de-contexto-rag-e-function-calling.md), `backend/internal/conhecimento`) | atende | prefeitura validar a base de orientações |
| 9 | Aplicar function calling | IA de visão chama `chamados_abertos_perto`, `buscar_casos_parecidos` e `consultar_orientacao`, até 3 voltas, com trilha no chamado (`triagem/ia.go`) | atende | ligar `IA_CHAVE` na demo para mostrar ao vivo |
| 10 | Aplicar orquestração | cadeia com fallback e orçamento de tempo (`triagem/servico.go`) | atende | |
| 11 | Aplicar multiagentes | agentes especializados (visão, contexto, Jev, IA de reserva, classificador local, regra da cidade, agrupamento) coordenados pelo serviço; a IA consulta o agente de contexto por funções | atende | |

## Logística e evidências
| # | Item | Status | O que falta |
|---|---|---|---|
| 12 | Todos no AVA | a confirmar | prints dos módulos |
| 13 | Presencial, 1 dia | a confirmar | passagem e hospedagem |
| 14 | Acesso da banca ao repositório | em preparação | repo público novo, só com evidências reais, separado do repositório privado de trabalho |
| 15 | Relatório único até 26/11 | depois do evento | preencher |
| 16 | Problema real e piloto | parcial | o prefeito avaliou o protótipo em 18/11; o consentimento formal do piloto e o teste com moradores ainda faltam |
| 17 | LGPD | parcial | cadastro com CPF cifrado, mascarado, com acesso auditado e exclusão ([ADR 0024](adr/0024-cadastro-do-morador-com-cpf.md)); falta validar o borrão com fotos reais e indicar o encarregado ([SOP 06](sops/06-checklist-lgpd.md)) |
| 18 | Imagens geradas por IA rotuladas | atende | manter o rótulo no slide e no vídeo |
