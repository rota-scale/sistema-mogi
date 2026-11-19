-- Água e esgoto: cano estourado, vazamento, esgoto a céu aberto.
function avaliar(t)
  return avaliar_padrao(t, {
    { sinal = "agua_jorrando",   nivel = 5 },
    { sinal = "alagamento",      nivel = 5 },
    { sinal = "perto_de_escola", nivel = 4 },
  })
end
