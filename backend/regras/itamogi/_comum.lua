-- Regras comuns da Triagem Urbana em Itamogi-MG (ADR 0010 e 0013, SOP 03).
-- Carregado antes do script da categoria. Valores são proposta a calibrar
-- no piloto (docs/escala-de-prioridade.md).
--
-- Entrada t:
--   t.categoria   nome da categoria
--   t.sinais      probabilidade por sinal de risco, ex.: t.sinais.agua_jorrando
--   t.gut         esperado, p90 e médias g, u e t
--   t.confianca   confiança do classificador, de 0 a 1
--   t.relatos     quantos relatos do mesmo problema o chamado já recebeu
-- Saída: { nivel = 1 a 5, motivo = "texto curto" }

-- Faixas de GUT para nível, da maior para a menor.
FAIXAS = {
  { minimo = 100, nivel = 5 },
  { minimo = 60,  nivel = 4 },
  { minimo = 28,  nivel = 3 },
  { minimo = 9,   nivel = 2 },
  { minimo = 1,   nivel = 1 },
}

-- Sinal crítico com probabilidade acima disto trava o nível mínimo.
LIMIAR_SINAL = 0.8

-- Abaixo desta confiança, vale a GUT pessimista (na dúvida, sobe).
LIMIAR_CONFIANCA = 0.6

function nivel_por_gut(gut)
  for _, f in ipairs(FAIXAS) do
    if gut >= f.minimo then return f.nivel end
  end
  return 1
end

-- criticos: lista de { sinal = "nome", nivel = mínimo que o sinal trava }.
function avaliar_padrao(t, criticos)
  local gut, base = t.gut.esperado, "GUT esperada"
  if t.confianca < LIMIAR_CONFIANCA then
    gut, base = t.gut.p90, "GUT pessimista (p90) por confiança baixa"
  end
  local nivel = nivel_por_gut(gut)
  local motivo = string.format("%s %.0f, faixa do nível %d", base, gut, nivel)

  for _, c in ipairs(criticos or {}) do
    local p = t.sinais[c.sinal] or 0
    if p > LIMIAR_SINAL and c.nivel > nivel then
      nivel = c.nivel
      motivo = string.format("sinal %s com P %.2f acima de %.1f trava o nível %d",
        c.sinal, p, LIMIAR_SINAL, c.nivel)
    end
  end
  return { nivel = nivel, motivo = motivo }
end
