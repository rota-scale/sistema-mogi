-- Árvores: queda na via, galhos sobre fios.
function avaliar(t)
  return avaliar_padrao(t, {
    { sinal = "via_bloqueada", nivel = 5 },
    { sinal = "sobre_fios",    nivel = 5 },
  })
end
