-- Iluminação e energia: poste apagado, fio caído.
function avaliar(t)
  return avaliar_padrao(t, {
    { sinal = "fio_exposto", nivel = 5 },
  })
end
