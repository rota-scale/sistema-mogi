-- Sinalização: semáforo apagado, placa danificada.
function avaliar(t)
  return avaliar_padrao(t, {
    { sinal = "cruzamento_movimentado", nivel = 4 },
  })
end
