# SOP 02: Fluxo de branch e PR
1. Atualize a main: `git switch main && git pull`.
2. Crie a branch: `tipo/assunto-curto`, com tipo `feat`, `fix`, `docs`, `regra` ou `chore` (ex.: `feat/pins-vivos`).
3. Commits pequenos, mensagem em português no imperativo ("adiciona fila de triagem").
4. Antes do PR: `go test ./...`, `npm run lint` e `npm test` no painel e no app; sem segredos no diff.
5. Abra o PR para a main com: o que muda, como testar, print se for tela, ADR relacionado.
6. Pelo menos uma revisão de outro membro. Regras Lua e ADRs exigem revisão do Russo ou do Renan.
7. Merge por squash; apague a branch.
8. Na véspera do hackathon, a main fica congelada a partir de 20/11 salvo correção.
