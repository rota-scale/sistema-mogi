# Como contribuir com o Sistema MOGI

Procedimentos completos em [docs/sops/](docs/sops/). Resumo:

1. Atualize a main e crie a branch `tipo/assunto-curto` (`feat`, `fix`, `docs`, `regra`, `chore`).
2. Commits pequenos, em português, no imperativo.
3. Antes do PR rode os testes e o lint e confira que não há segredos no diff.
4. Abra o PR para a main usando o modelo: o que muda, como testar, print de tela, ADR relacionado.
5. Uma revisão de outro membro; regras Lua e ADRs exigem revisão do Russo ou do Renan.
6. Merge por squash e apague a branch.

## Decisões e conversas
Toda conversa sobre a solução vira seção datada em `docs/conversas/`; decisão de arquitetura vira ADR em `docs/adr/` ([SOP 04](docs/sops/04-adr-e-conversa.md)).

## Regras de texto
Português do Brasil, sem travessão, sem senhas, chaves, CPFs ou e-mails, e números não conferidos marcados "a confirmar".
