import { describe, expect, it } from 'vitest'
import { alturaAoSoltar, alturasDaFolha, proximaAltura } from './regrasDaFolha'

describe('folha deslizante', () => {
  it('calcula as três alturas no celular de 390 x 844', () => {
    // 844 de janela, 788 abaixo do topo de 56.
    expect(alturasDaFolha(844, 788)).toEqual({ recolhida: 88, meia: 422, cheia: 776 })
    // Com a faixa de alerta a área encolhe e a folha cheia não cobre a faixa.
    expect(alturasDaFolha(844, 700).cheia).toBe(692)
  })
  it('não passa do espaço em janela baixa', () => {
    const a = alturasDaFolha(360, 304)
    expect(a.cheia).toBe(296)
    expect(a.meia).toBe(180)
    expect(alturasDaFolha(120, 64)).toEqual({ recolhida: 88, meia: 88, cheia: 88 })
  })
  it('o toque na alça sobe um degrau e, da cheia, recolhe', () => {
    expect(proximaAltura('recolhida')).toBe('meia')
    expect(proximaAltura('meia')).toBe('cheia')
    expect(proximaAltura('cheia')).toBe('recolhida')
  })
  it('ao soltar devagar, para na altura mais perto', () => {
    const a = alturasDaFolha(844, 788)
    expect(alturaAoSoltar(120, 0, a)).toBe('recolhida')
    expect(alturaAoSoltar(380, 0.1, a)).toBe('meia')
    expect(alturaAoSoltar(700, -0.1, a)).toBe('cheia')
  })
  it('com um peteleco, vai para o degrau seguinte na direção do gesto', () => {
    const a = alturasDaFolha(844, 788)
    expect(alturaAoSoltar(440, 1.2, a)).toBe('cheia')
    expect(alturaAoSoltar(400, -1.2, a)).toBe('recolhida')
    expect(alturaAoSoltar(700, -0.8, a)).toBe('meia')
    // Já no fim do curso, o peteleco não tem para onde ir.
    expect(alturaAoSoltar(776, 2, a)).toBe('cheia')
  })
})
