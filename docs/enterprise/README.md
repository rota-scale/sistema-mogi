# Sistema MOGI: visão enterprise

Como o MOGI funciona hoje, o que muda para virar sistema de prefeitura de verdade e quanto custa. Escrito contra o código de 15/11/2026 e conferido com a `main` da v0.2.1 em 16/11/2026. Quando um documento de intenção diverge do código, **o código prevalece**. Tudo marcado como **proposta** ainda não foi implantado.

1. [Arquitetura C4 e fluxos por usuário](01-arquitetura-e-fluxos.md)
2. [Casos de uso e rotas da API](02-casos-de-uso-api.md)
3. [Mapa das ADRs](03-mapa-adrs.md)
4. [Dados e LGPD](04-dados-lgpd.md)
5. [Implantação e operação na prefeitura](05-implantacao-operacao.md)
6. [Os três pilares: observabilidade, manutenção e escala](06-qualidades.md)
7. [AWS em São Paulo: proposta e cotação](07-aws.md)
8. [Viabilidade para o pitch](08-viabilidade.md)

**Base:** [README](../../README.md), [fluxo do agente](../fluxo-do-agente.md), [arquitetura](../arquitetura.md), [ADRs](../adr/), [migrações](../../backend/internal/banco/migracoes/), [rotas da API](../../backend/cmd/api/main.go), [Compose](../../docker-compose.yml) e [configuração de exemplo](../../.env.example).

**Lua, tecnologia brasileira.** Lua foi criada na PUC-Rio e é a linguagem da política de prioridade do município. A IA sugere sinais e notas; a regra em Lua decide o nível e explica o motivo. O motor Go (gopher-lua) relê as regras a cada triagem, roda numa caixa fechada (sem `io`, `os` nem carregamento de código, com 50 ms de limite) e o gestor simula e salva a regra pelo painel, sem novo deploy. Veja o [ADR 0013](../adr/0013-stack-do-mvp.md) e o [motor](../../backend/internal/triagem/lua.go).

**Crédito.** Escrito a quatro mãos com o GitHub Copilot. A [PR 15](https://github.com/rota-scale/cidade-inteligente-akcit/pull/15) do Copilot foi fechada sem merge; o texto dela entrou na `main` pela branch do Claude. As páginas de API, dados e LGPD, implantação, pilares e AWS são a versão refeita pelo Copilot sobre esta branch, a mais precisa; arquitetura, fluxos por usuário, mapa das ADRs e viabilidade foram escritas para a banca, no tom do pitch.
