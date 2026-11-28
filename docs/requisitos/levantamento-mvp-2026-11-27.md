# Levantamento de requisitos do MVP: 27/11/2026

Registro do que saiu da mentoria AKCIT Camp Sul e das decisões do Russo na tarde e na noite do mesmo dia. Não altera código, deploy nem a demo em produção. Itens abaixo continuam no status indicado até haver implementação revisada e aprovada.

## Origem

- Mentoria de 30 minutos em 27/11/2026, das 13h às 13h30 BRT, com Állan Christoffer Pereira Silva. Participaram também Russo (João Gabriel Russo Souto) e Carlosjoymax (organizador do convite). Transcrição e notas no Wispr Flow: [AKCIT Camp - Team Mentoring (Sul)](https://notes.wisprflow.ai/shared/K4OACv3Pb9DYkLbo7tXPP4O79CqyBRpsPCoFECjId5w).
- Na transcrição, o município aparece como "Tamoji". O município piloto é Itamogi-MG; usamos este nome daqui para frente.
- Depois da call, na tarde e na noite de 27/11, o Russo pediu WhatsApp demonstrável no MVP e acabamento da interface da demo, e consolidou a diretriz para o FS1 em três frentes: (A) WhatsApp demonstrável, (B) polish da UI da demo e (C) landing com QR, política de LGPD e arquitetura enxuta. A infra (três degraus) está no documento irmão [infra-escalonamento-2026-11-27.md](infra-escalonamento-2026-11-27.md).
- Já estava no repositório, desde o [PR #8](https://github.com/rota-scale/sistema-mogi/pull/8) mesclado em 21/11/2026 (`1b91bba`), que o próximo canal do morador é o WhatsApp, ainda fora do protótipo. Em 25/11 o Russo confirmou que o próximo passo é testar nesse canal.

Números de impacto citados na mentoria (por exemplo as 240 horas/mês) vieram de teste simulado com bots, não de campo com moradores. Não repetir isso na banca como resultado medido em Itamogi.

## Como ler o status

| Status | Significado |
|---|---|
| **Em produção na demo** | Já está no fluxo documentado da demo atual. |
| **Proposto** | Combinado em 27/11, ainda não implementado no repositório. |
| **Roadmap piloto 2027** | Entra no piloto de Itamogi (1º semestre de 2027) ou depois, não é entrega imediata da demo. |

## Diretriz consolidada para o FS1

Três frentes, nesta ordem de leitura. Nenhuma delas autoriza merge, deploy ou publicação.

- **(A)** WhatsApp demonstrável, com um handler único que reusa o pipeline já existente, por sandbox da Meta ou por mock claramente rotulado como demonstração.
- **(B)** Acabamento das telas da demo (design kit e estados reais, sem placeholder).
- **(C)** Landing com QR code, política de privacidade/LGPD e arquitetura enxuta, mais um slide de backup só para perguntas.

O Állan disse, na própria call, que áudio e acessibilidade no WhatsApp não dariam para o dia seguinte e deveriam entrar como próximas etapas no pitch. O pedido posterior do Russo de um WhatsApp demonstrável no MVP é mais restrito: mostrar o canal funcionando em sandbox ou em mock rotulado, sem homologar WABA nem precificar conversa.

## (A) WhatsApp demonstrável

### RQ-WA-01: Canal demonstrável no MVP

- **Prioridade:** alta.
- **Status:** Proposto.
- **Origem:** decisão do Russo em 27/11, depois da mentoria; o canal como próximo passo já estava no README desde 21/11.
- **Enunciado:** o morador consegue registrar um relato por um fluxo de WhatsApp demonstrável, sem instalar o app. A demonstração usa a [sandbox da Cloud API da Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) ou um mock de conversa claramente rotulado como demonstração (não como conta oficial da prefeitura).
- **Critério de aceite:** um jurado ou operador percorre o fluxo (abrir conversa, enviar foto e texto, receber protocolo) em ambiente de demonstração. Se for mock, o rótulo de demonstração aparece na própria interface ou na conversa. Não se apresenta o canal como WhatsApp Business homologado.
- **Fora de escopo deste item:** conta WABA homologada, templates oficiais, janela de 24 horas, custo por conversa da Business API e operação em número da prefeitura. O README já registra que o custo por conversa ainda precisa ser medido e somado ao BMC; isso permanece fora desta entrega.

### RQ-WA-02: Handler único reusando o pipeline

- **Prioridade:** alta.
- **Status:** Proposto.
- **Origem:** diretriz de 27/11; alinhado ao que o README já descreve como próximo passo (as mesmas perguntas do app, a mesma triagem).
- **Enunciado:** o canal de WhatsApp não ganha um segundo classificador. Um handler único recebe a mensagem, reusa o pipeline já documentado (mídia e privacidade, descritor, Jev em texto, regras Lua, revisão humana nos níveis 4 e 5) e devolve o protocolo na conversa.
- **Critério de aceite:** um relato aberto pelo fluxo demonstrável aparece no painel com o mesmo ciclo de vida de um relato do app, sem regra de negócio paralela. Não há um "modo WhatsApp" com prioridade ou categoria diferentes.

### RQ-WA-03: Foto e texto no canal; áudio como evolução

- **Prioridade:** média (foto e texto no demonstrável); áudio no roadmap.
- **Status:** foto e texto, Proposto; áudio, Roadmap piloto 2027.
- **Origem:** Russo relatou na mentoria o conselho de um mentor anterior de integrar o WhatsApp, porque em cidade pequena a população já se acostumou com esse canal. O Állan reforçou duas vantagens: menor barreira do que baixar um app, inclusive para quem tem pouco letramento digital; e a praticidade de anexar foto ou mandar áudio. Ele pediu que áudio e acessibilidade entrem no pitch como próximas etapas, não como entrega do dia seguinte.
- **Enunciado:** o demonstrável aceita foto e texto. Áudio (acessibilidade, observação falada) fica registrado como evolução, sem compromisso de data na demo.
- **Critério de aceite (foto e texto):** o fluxo demonstrável conclui um relato com foto e texto e gera protocolo. Áudio não é exigido para fechar este item.

## (B) Polish da UI da demo

### RQ-UI-01: Design kit nas telas da demo

- **Prioridade:** alta.
- **Status:** Proposto.
- **Origem:** decisão do Russo em 27/11 (a interface da demo ainda estava inacabada).
- **Enunciado:** as telas usadas na demonstração (app do morador e painel) seguem o design kit do produto, sem tela "pela metade" no caminho feliz da demo.
- **Critério de aceite:** o caminho feliz da demo (abrir relato, acompanhar, ver o chamado no painel) não exibe componente órfão, layout quebrado ou identidade visual divergente do kit. Telas fora desse caminho podem permanecer como estiverem, desde que não sejam mostradas na apresentação.

### RQ-UI-02: Estados de loading, vazio, erro e sucesso, sem placeholder

- **Prioridade:** alta.
- **Status:** Proposto.
- **Origem:** mesma decisão de 27/11.
- **Enunciado:** no caminho da demo, cada tela crítica tem estado de carregamento, vazio, erro e sucesso. Não restam textos ou imagens de placeholder ("lorem", cinza de reserva, botão que não faz nada) visíveis nesse caminho.
- **Critério de aceite:** percorrer o caminho feliz e os desvios previsíveis (falha de rede, lista vazia, envio recusado) mostra só estados desenhados para o produto. Uma lista de placeholders encontrados no caminho da demo é zero.

Já estão em produção na demo, e não são substituídos por estes itens, o blur de rostos e a recusa de foto indoor (contexto doméstico), que o Russo descreveu na mentoria e que já estão no [ADR 0008](../adr/0008-midia-e-privacidade-lgpd.md).

## (C) Landing, slide de backup e pitch

### RQ-LP-01: Landing com QR, política de LGPD e arquitetura enxuta

- **Prioridade:** alta.
- **Status:** Proposto.
- **Origem:** sugestão do Állan na mentoria (QR no canto dos slides para jurado ou plateia abrir depois, com política de privacidade e um pouco da arquitetura). Pedido do Russo na consolidação da noite.
- **Enunciado:** existe uma landing acessível por QR, com política de privacidade à luz da LGPD e uma descrição enxuta da arquitetura (o bastante para um jurado técnico, sem o diagrama pesado no pitch falado).
- **Critério de aceite:** o QR abre a landing em um telefone; a política está visível; a arquitetura cabe em uma leitura curta e não contradiz o que está em [arquitetura.md](../arquitetura.md) e no [ADR 0007](../adr/0007-agente-de-triagem.md).

### RQ-LP-02: Slide de backup de arquitetura

- **Prioridade:** média.
- **Status:** Proposto (material de apresentação, não é código).
- **Origem:** o Állan recomendou não colocar arquitetura no pitch falado (fica pesado explicar servidor, banco, serverless e custo). Levar como backup para perguntas (servidor, banco, eventualmente ECS ou Cloud Run).
- **Enunciado:** um slide ou material de apoio descreve servidor, banco e o desenho modular, para uso só se a banca perguntar.
- **Critério de aceite:** o roteiro falado não depende desse slide; o material de apoio existe e pode ser projetado em menos de um minuto se pedido.

### RQ-PI-01: Estrutura sugerida do pitch

- **Prioridade:** alta para a apresentação; não é requisito de software.
- **Status:** Proposto (orientação de 27/11).
- **Origem:** mentoria. O Állan gravou um material no AVA do workshop sobre a estrutura do pitch e ficou de enviar o link (pendência; ver abaixo).
- **Enunciado (sugestão, não roteiro fechado):**
  - não montar pitch de investidor (tese e ROI não são o foco da banca);
  - evoluir o pitch da etapa regional;
  - abrir com a dor real e números de impacto, com a ressalva de origem de cada número;
  - reservar cerca de 2 minutos para demonstração ao vivo;
  - a duração oficial ficou em aberto na call (o Állan falou em uns 5 minutos; o Russo disse que o Carlosjoymax havia colocado 3);
  - destacar o diferencial técnico já em produção na demo (Jev em texto + regras Lua auditáveis, LGPD com blur e recusa de foto indoor), e que a solução não depende de LLM na decisão;
  - fechar com WhatsApp e o início do piloto em Itamogi, admitindo que não houve teste de campo com moradores, por falta de tempo;
  - licitação tradicional e consórcio público entram só como caminhos, sem cravar contrato.
- **Critério de aceite:** o roteiro usado na banca segue essa estrutura ou registra, por escrito, o desvio consciente. Este item não se "fecha" no GitHub.

## B2G

### RQ-B2G-01: Licitação e consórcio, sem cravar

- **Prioridade:** média.
- **Status:** Roadmap piloto 2027 (conversa comercial ainda não validada com a prefeitura).
- **Origem:** mentoria. O Russo disse que a venda ainda seria por licitação. O contrato com Itamogi não estava validado na call. O Állan descreveu o caminho tradicional: licitação, em geral menor preço, contrato de 1 a 2 anos cobrindo operação (IA, servidor, banco) e margem; mais seguro no longo prazo, porém mais complexo (concorrentes e lógica de menor preço). Consórcio foi citado como alternativa; o próprio Állan disse que nunca participou de um processo desses e não conhece o funcionamento a fundo. A orientação foi levar as duas possibilidades no dia, sem fechar agora. Critérios classificatórios e eliminatórios do edital da final deveriam ser confirmados com o Carlosjoymax no grupo.
- **Enunciado:** materiais de banca e BMC podem citar licitação tradicional e consórcio público como caminhos. Não afirmar contrato assinado, modalidade escolhida ou preço de adjudicação.
- **Critério de aceite:** nenhum material oficial do repositório crava modalidade, prazo ou valor de contrato com Itamogi. Se a conversa comercial avançar, isso vira ADR ou anexo novo, com data e fonte.

## Pendências deste documento

- Link do vídeo de estrutura de pitch no AVA, que o Állan ficou de enviar.
- Confirmação da duração oficial do pitch (3 ou 5 minutos, ou outro tempo definido pela organização).
- Critérios classificatórios e eliminatórios do edital da final, a confirmar com a organização.
- Implementação das frentes (A), (B) e (C): em 27/11 o FS1 não chegou a abrir branch nem PR com esse recorte. Este arquivo só documenta o levantamento.

## Ver também

- Infra e regra legal: [infra-escalonamento-2026-11-27.md](infra-escalonamento-2026-11-27.md)
- Evidências acadêmicas e GovTech (PR #12, parte já existente): [../research/README.md](../research/README.md)
- Canal WhatsApp no README público: [../../README.md](../../README.md)
