# Cultura Rota Scale

Como o time Rota Scale pensa e trabalha. Vale para o MOGI e para os próximos produtos.

## Os três pilares
| Pilar | O que quer dizer | Como aparece no MOGI |
|---|---|---|
| **Manutenibilidade** (*maintainability*) | o sistema é fácil de entender, mudar e consertar | regra de prioridade em Lua, editável no painel; módulos e parâmetros mudam sem reiniciar; testes e CI em toda mudança; decisões registradas em ADR |
| **Observabilidade** (*observability*) | dá para saber o que está acontecendo sem adivinhar | aba Operação, custo e tempo de cada triagem, telemetria dos aparelhos, `/saude` |
| **Escalabilidade** (*scalability*) | crescer não exige reescrever | cidade nova é uma linha no banco e uma pasta de regras; caminho de escala com gatilhos medidos (ADR 0021) |

Escreve-se **manutenibilidade**: manu-te-ni-bi-li-da-de, de "manutenção" + "-ibilidade".

## Enxuto de propósito
- **Linha de código é custo, não valor.** Cada linha é algo que alguém vai ler, testar e manter. Quanto menos código para o mesmo resultado, melhor.
- **Não reinventar peça pesada.** Usamos peças prontas e testadas (MapLibre, PostGIS, SeaweedFS, Jev) e escrevemos só o que é nosso.
- **O núcleo fica pequeno.** Na v0.2.0, o MOGI tinha cerca de 39 mil linhas de código. A regra que decide a prioridade da cidade inteira tem 90 linhas em Lua e cabe numa tela, para um técnico da prefeitura ler.
- **Teste faz parte do código.** Cerca de 16% das linhas do MOGI são testes automáticos. É o que deixa mudar sem quebrar.
- **Crescer onde o uso pede.** O protótipo nasce pequeno. O que cresce em produção (app nativo completo, gov.br, várias cidades, integrações) entra quando o uso real mostra a necessidade, sem inchar o núcleo.

## Como trabalhamos
- **Funcionalidade na frente:** cada tela tem uma ação principal e só o texto essencial, para pessoas simples e sem treinamento (ADR 0017).
- **Decisão importante vira ADR**; conversa que decide algo vai para `docs/conversas/`.
- **Toda mudança passa por PR**, com o CI verde antes do merge: testes do servidor, do painel e do app, mais o sistema de pé com teste de fumaça.
- **Português simples em tudo, sem travessão.**
- **Privacidade desde o começo:** nada de segredo, chave ou dado pessoal no Git; dado pessoal só com motivo, protegido e com acesso registrado.
- **Honestidade nos números:** o que é medido aparece como medido, o que é estimativa aparece como hipótese, e imagem gerada por IA sempre leva o rótulo.
- **A IA ajuda, a pessoa decide:** nos casos graves, um servidor confere.

## Versões e releases
- **Formato `MAIOR.MENOR.CORREÇÃO`**, com o maior em 0 enquanto o produto estiver em piloto.
- **Toda versão tem a sua seção no `CHANGELOG.md`**, com o que mudou e os limites conhecidos, ditos com franqueza.
- **Versão publicada não se reescreve.** Se o número já existe, usamos o próximo. Foi assim que a primeira versão funcional virou a v0.2.0, porque a v0.1.0 já era a spec.
- **Para publicar uma release**, no `main` atualizado e com o `gh` logado:
```bash
git tag -a vX.Y.Z <commit> -m "vX.Y.Z: título"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z: título" --notes-file notas.md --latest
```
  As notas são a seção da versão no `CHANGELOG.md`. Anexe o vídeo ou os materiais da versão, quando houver.

## Práticas e skills
Cada conceito vira uma prática concreta e, quando existe, uma skill do Claude Code que a ajuda. Skill é um pacote de instruções que o agente carrega na hora da tarefa: ela deixa o jeito Rota Scale de trabalhar repetível, em vez de depender da memória de quem pediu.

### Arquitetura
| Conceito | Na prática | No MOGI | Skill que ajuda |
|---|---|---|---|
| **Modularidade** | cada parte tem uma tarefa e uma fronteira clara | pacotes Go por assunto (`triagem`, `morador`, `midia`); módulos ligados e desligados no painel (ADR 0018) | `engineering:architecture` |
| **Camadas** (*layering*) | quem está em cima só conversa com a camada de baixo | tela, API, serviço, banco; a regra da cidade em Lua fica acima da IA e tem a palavra final | `engineering:system-design` |
| **Autocontido** (*self contained*) | sobe com um comando, sem depender de nada escondido | `make subir`: uma imagem Docker com servidor e telas | `run` |
| **Interoperabilidade** | conversar com outros sistemas por padrões abertos | API JSON, S3, Postgres com PostGIS, exportação CSV; gov.br e o sistema de protocolo da prefeitura são os próximos | `mcp-builder` |
| **Escalabilidade** | crescer por dado e por gatilho medido, não por reescrita | cidade como dado (ADR 0021) | `operations:capacity-plan` |
| **Manutenibilidade** | ler, mudar e testar sem medo | 16% do código é teste; CI em toda PR | `simplify`, `engineering:tech-debt` |
| **Observabilidade** | saber o que acontece sem adivinhar | aba Operação, custo por triagem, `/saude` | `engineering:incident-response` |

### Especificação e decisão
| Conceito | Na prática | Skill que ajuda |
|---|---|---|
| **Spec driven** | a spec vem antes do código e diz o que é "pronto"; o código é conferido contra ela | `product-management:write-spec` |
| **ADR** (registro de decisão de arquitetura) | toda escolha importante, com as alternativas e o preço pago | `engineering:architecture` |
| **SDR** (registro de desenho da solução) | o par do ADR: como a peça funciona por dentro, com diagrama e fluxo, como o `fluxo-do-agente.md` | `artifact-diagramming`, `engineering:documentation` |
| **Revisão antes do merge** | todo PR passa por revisão de correção e de segurança | `code-review`, `security-review` |
| **Release com notas honestas** | versão publicada não se reescreve; limites ditos com franqueza | `engineering:deploy-checklist` |

### Ritmo do time
- **Scrum macro:** marcos de duas semanas com uma meta que o prefeito ou a banca consegue ver (v0.1.0 spec, v0.2.0 funcional, piloto). Skill: `product-management:sprint-planning`, `product-management:roadmap-update`.
- **Scrum micro:** cada sessão de trabalho tem começo, meio e fim: plano curto, entrega, teste, PR. Skill: `engineering:standup`, `operations:status-report`.
- **Síncrono** para decidir: conversa curta, a decisão vai para `docs/conversas/` ou vira ADR.
- **Assíncrono** para executar: PR, issue e CI falam pelo time. Quem chega depois entende sem perguntar.

### Agentes de IA no time
| Conceito | Como usamos |
|---|---|
| **Agent-on** | o agente fica ligado na tarefa até o fim: implementa, testa, abre PR, acompanha o CI e responde a revisão. A pessoa decide o que entra e o que vai para a rua. |
| **Fábrica de software agêntica** | uma linha de montagem: spec, agente que implementa, agente que revisa, CI que confere, pessoa que aprova. Cada estação tem a sua checagem. |
| **Sandbox isolada** | cada agente trabalha num contêiner ou numa *worktree* própria, com rede restrita e sem segredo de produção. Se errar, o estrago fica lá dentro. |
| **Multissessão** | várias sessões em paralelo, cada uma numa branch: uma no servidor, outra no app, outra nos documentos. Regra: duas sessões nunca mexem na mesma branch ao mesmo tempo. |
| **Multiplayer** | pessoas e agentes no mesmo repositório (Claude Code na nuvem e no Windows, Copilot, Antigravity). O PR é o ponto de encontro; ninguém faz merge do trabalho de outro sem combinar. |
| **Consciência de enxame** | cada agente sabe o que os outros estão fazendo: lê as PRs abertas, as issues e o `CHANGELOG` antes de começar, e deixa rastro claro do que fez. |
| **Sessão composta** (*compound session*) | cada sessão deixa o terreno melhor para a próxima: testes novos, ADR, skill ou memória. O ganho se acumula. |
| **Auto-recursividade** | o agente revisa o próprio trabalho e melhora o próprio processo: roda os testes, relê o diff, e quando um erro se repete, vira regra, teste ou skill. |
| **Pessoa no circuito** | a IA propõe, a pessoa decide nos casos graves, igual à triagem do MOGI nos níveis 4 e 5. |

### Conhecimento e memória
- **RAG do usuário:** a pessoa traz o contexto (cola um documento, aponta um arquivo). Rápido, mas depende de lembrar o que trazer.
- **RAG agêntico:** o agente decide o que buscar, busca e confere antes de responder. É o que o agente de contexto do MOGI faz com as orientações e os casos parecidos (ADR 0023).
- **Memória do time:** o que foi aprendido não fica só na conversa. Vai para ADR, `docs/conversas/`, `CLAUDE.md` ou para a memória do agente. Skill: `productivity:memory-management`.

### Skills que o time já usa
As favoritas do Russo, que entram em todo projeto: **task-observer**, **ai-memory** e **ponytail**. A linha de cada uma, com o que faz e quando usar, entra aqui quando o time padronizar o uso.

### Skills que vale ter
Prontas, para usar já:
- `engineering:testing-strategy`: plano de teste antes de uma funcionalidade grande.
- `operations:runbook`: o passo a passo de operar o MOGI na prefeitura (subir, fazer backup, trocar a chave).
- `operations:risk-assessment` e `operations:compliance-tracking`: o registro de riscos e a LGPD do piloto.
- `design:accessibility-review` e `design:ux-copy`: acessibilidade e texto simples nas telas.
- `skill-creator`: para criar as skills próprias da Rota Scale.

Para criar, com o jeito Rota Scale embutido:
1. **rota-adr:** escreve o ADR no nosso formato, em português simples e sem travessão.
2. **rota-release:** confere CI, `CHANGELOG`, versão nos três `package.json` e no servidor, e gera os comandos da tag e da release.
3. **rota-conferir:** sobe o sistema numa sandbox e roda o teste de fumaça e a conferência da API.
4. **rota-auditoria:** lê uma auditoria externa (do Copilot, por exemplo), confere cada ponto no código e separa o que é real do que já está resolvido.
5. **rota-enxame:** antes de começar, lista PRs abertas, branches em uso e quem está mexendo em quê, para nenhuma sessão atropelar a outra.
