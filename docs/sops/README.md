# SOPs do Sistema MOGI (procedimentos operacionais)
1. [Setup do ambiente local](01-setup-local.md)
2. [Fluxo de branch e PR](02-branch-e-pr.md)
3. [Adicionar uma regra de triagem em Lua](03-regra-lua.md)
4. [Registrar decisão em ADR e conversa](04-adr-e-conversa.md)
5. [Rodar a demo](05-rodar-demo.md)
6. [Checklist de LGPD](06-checklist-lgpd.md)
7. [Deploy do MVP](07-deploy-mvp.md)

Revisados em 15/11/2026 contra o `Makefile` e o código. O teste das regras Lua roda como teste Go em `backend/internal/triagem` (`make teste`), não em arquivos `*_test.lua`.
