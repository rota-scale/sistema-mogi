# SOP 03: Mudar ou adicionar uma regra de triagem em Lua
As regras ficam em `backend/regras/<cidade>/`: `_comum.lua` (faixas da GUT, limiares e a função `avaliar_padrao`), um arquivo por categoria (`agua.lua`, `vias.lua`...) e `padrao.lua` para as categorias sem arquivo próprio. O Jev dá as probabilidades; o Lua decide o nível de forma auditável (ADR 0010 e 0013). Conferido em `backend/internal/triagem/lua.go` em 15/11/2026.

1. Pelo painel (caminho normal): entre como gestor, abra Regras, aba Regras da triagem, escolha o arquivo e edite. Antes de salvar, a regra roda na sandbox contra 13 cenários de referência e a tela mostra o nível de cada um. Se algum der erro, nada é salvo. Salvo, vale no próximo relato, sem reiniciar, e a versão fica em `regras_historico` com o seu login.
2. Pelo repositório: edite o arquivo em `backend/regras/itamogi/`. A função recebe a tabela `t` com `t.categoria`, `t.sinais` (probabilidade por sinal), `t.gut` (`esperado`, `p90`, `g`, `u`, `t`), `t.confianca` e `t.relatos`, e devolve `nivel` (inteiro de 1 a 5) e `motivo`:

```lua
-- Vias e buracos (backend/regras/itamogi/vias.lua).
function avaliar(t)
  return avaliar_padrao(t, {
    { sinal = "risco_moto", nivel = 4 },
  })
end
```

   Uma regra escrita à mão também vale, desde que devolva `{ nivel = ..., motivo = "..." }`:

```lua
function avaliar(t)
  if (t.sinais.agua_jorrando or 0) > 0.8 then
    return { nivel = 5, motivo = "água jorrando com P acima de 0,8" }
  end
  return avaliar_padrao(t, {})
end
```
3. Só há `base`, `table`, `string` e `math` (sem `string.rep`). Nada de `io`, `os`, `require`, `load` ou `print`. Tempo máximo de 50 ms; nível fora de 1 a 5 ou erro vira "a classificar".
4. Teste: os casos ficam em Go, em `backend/internal/triagem/triagem_test.go` (por exemplo `TestRoteiroDoTesteDeCampo`) e nos cenários de `triagem/simulacao.go`. Rode `make teste` ou `cd backend && go test ./internal/triagem/`.
5. Abra PR com branch `regra/...` (SOP 02); regras exigem revisão do Russo ou do Renan. A pasta de regras do contêiner é um volume: uma regra salva pelo painel fica no volume, e `make limpar` a apaga.
6. Registre a mudança de limiar em `docs/conversas/` se ela veio de uma decisão do time.
