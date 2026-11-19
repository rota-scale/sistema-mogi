import { describe, expect, it } from 'vitest'
import { NIVEIS as NIVEIS_DO_PAINEL, textoSobreNivel as textoDoPainel } from '../niveis'
import { COR_SEM_NIVEL, NIVEIS, TEXTO_SEM_NIVEL } from './logica'
import { formaDoNivel as formaDoPainel } from '../formas'
import { caminhoDaForma, confete, contraste, diferencaDeCor, formaDoNivel, simularDaltonismo } from './marca'
import type { Daltonismo } from './marca'

// Os mesmos valores de relatar.css e campo.css.
const TOKENS = {
  creme: '#f5f1e8',
  creme2: '#ebe4d3',
  papel: '#fffdf7',
  cafezal: '#1f4d2b',
  cafezalFundo: '#12301a',
  folha: '#3e7b3a',
  ipe: '#e9b526',
  cereja: '#b3261e',
  cerejaFundo: '#7d1711',
  cafe: '#4a2c1d',
  ceu: '#3b6ea5',
  cinza: '#6b6054',
  traco: '#8a7f72',
}

describe('contraste', () => {
  it('confere os extremos e a simetria', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contraste('#777777', '#777777')).toBe(1)
    expect(contraste('#1f4d2b', '#f5f1e8')).toBeCloseTo(contraste('#f5f1e8', '#1f4d2b'), 6)
  })

  it('aceita cor curta e recusa cor inválida', () => {
    expect(contraste('#fff', '#000')).toBeCloseTo(21, 1)
    expect(() => contraste('verde', '#000')).toThrow()
  })

  it('todo texto dos selos de urgência passa de 4,5:1', () => {
    for (const n of NIVEIS) expect(contraste(n.texto, n.cor), n.nome).toBeGreaterThanOrEqual(4.5)
    expect(contraste(TEXTO_SEM_NIVEL, COR_SEM_NIVEL)).toBeGreaterThanOrEqual(4.5)
    // A equipe de campo usa a escala do painel.
    for (const n of NIVEIS_DO_PAINEL) expect(contraste(textoDoPainel(n.nivel), n.cor), n.nome).toBeGreaterThanOrEqual(4.5)
  })

  it('os pares de texto das telas de celular passam de 4,5:1', () => {
    const pares: [string, string][] = [
      [TOKENS.cafezal, TOKENS.creme],
      [TOKENS.cafezal, TOKENS.papel],
      [TOKENS.cafe, TOKENS.papel],
      [TOKENS.cinza, TOKENS.papel],
      [TOKENS.cinza, TOKENS.creme],
      [TOKENS.cinza, TOKENS.creme2],
      [TOKENS.creme, TOKENS.cafezal],
      [TOKENS.ipe, TOKENS.cafezal],
      [TOKENS.cafezalFundo, TOKENS.ipe],
      [TOKENS.cerejaFundo, TOKENS.papel],
      [TOKENS.cereja, TOKENS.papel],
      ['#ffffff', TOKENS.cereja],
    ]
    for (const [texto, fundo] of pares) expect(contraste(texto, fundo), `${texto} sobre ${fundo}`).toBeGreaterThanOrEqual(4.5)
  })

  it('bordas e marcas de estado passam de 3:1', () => {
    expect(contraste(TOKENS.traco, TOKENS.papel)).toBeGreaterThanOrEqual(3)
    expect(contraste(TOKENS.ceu, TOKENS.creme)).toBeGreaterThanOrEqual(3)
    expect(contraste(TOKENS.ipe, '#000000')).toBeGreaterThanOrEqual(3)
  })
})

describe('formaDoNivel', () => {
  it('dá uma forma diferente a cada nível e o traço a quem não tem', () => {
    const formas = [1, 2, 3, 4, 5].map(formaDoNivel)
    expect(new Set(formas).size).toBe(5)
    expect(formaDoNivel(null)).toBe('traco')
    expect(formaDoNivel(9)).toBe('traco')
    expect(formaDoNivel(0)).toBe('traco')
  })

  it('é a mesma forma do painel da central para cada nível', () => {
    for (const n of [null, 0, 1, 2, 3, 4, 5]) expect(formaDoNivel(n)).toBe(formaDoPainel(n))
  })

  it('cada forma tem caminho próprio', () => {
    const caminhos = (['traco', 'meio-circulo', 'circulo', 'quadrado', 'triangulo', 'losango'] as const).map(caminhoDaForma)
    expect(new Set(caminhos).size).toBe(6)
    for (const c of caminhos) expect(c.startsWith('M')).toBe(true)
  })
})

describe('simularDaltonismo', () => {
  it('mantém cinza como cinza', () => {
    expect(simularDaltonismo('#808080', 'deuteranopia')).toBe('#808080')
    expect(simularDaltonismo('#ffffff', 'protanopia')).toBe('#ffffff')
  })

  it('aproxima verde e vermelho, como o olho daltônico', () => {
    const antes = diferencaDeCor('#3E7B3A', '#B3261E')
    const depois = diferencaDeCor(simularDaltonismo('#3E7B3A', 'deuteranopia'), simularDaltonismo('#B3261E', 'deuteranopia'))
    expect(depois).toBeLessThan(antes)
  })

  // A garantia do MOGI: se dois níveis ficam parecidos para quem é daltônico,
  // a forma e o nome deles são diferentes.
  it('níveis que se confundem na cor nunca se confundem na forma', () => {
    for (const tipo of ['deuteranopia', 'protanopia'] as Daltonismo[]) {
      for (const a of NIVEIS) {
        for (const b of NIVEIS) {
          if (a.nivel >= b.nivel) continue
          const parecidas = diferencaDeCor(simularDaltonismo(a.cor, tipo), simularDaltonismo(b.cor, tipo)) < 20
          if (parecidas) {
            expect(formaDoNivel(a.nivel)).not.toBe(formaDoNivel(b.nivel))
            expect(a.nome).not.toBe(b.nome)
          }
        }
      }
    }
  })

  it('acha pelo menos um par confuso na paleta atual (por isso a forma existe)', () => {
    const confusos = NIVEIS.flatMap((a) =>
      NIVEIS.filter((b) => a.nivel < b.nivel && diferencaDeCor(simularDaltonismo(a.cor, 'deuteranopia'), simularDaltonismo(b.cor, 'deuteranopia')) < 20),
    )
    expect(confusos.length).toBeGreaterThan(0)
  })
})

describe('confete', () => {
  it('é o mesmo para a mesma semente', () => {
    expect(confete(7)).toEqual(confete(7))
    expect(confete(7)).not.toEqual(confete(8))
  })

  it('respeita a quantidade, com teto, e espalha as peças pela largura', () => {
    expect(confete(1, 0)).toEqual([])
    expect(confete(1, 500)).toHaveLength(40)
    const pecas = confete(3, 12)
    expect(pecas).toHaveLength(12)
    for (const p of pecas) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(100)
      expect(p.queda).toBeGreaterThanOrEqual(45)
      expect(p.queda).toBeLessThanOrEqual(90)
      expect(p.atrasoMs).toBeLessThanOrEqual(260)
    }
    const metadeEsquerda = pecas.filter((p) => p.x < 50).length
    expect(metadeEsquerda).toBeGreaterThanOrEqual(4)
    expect(metadeEsquerda).toBeLessThanOrEqual(8)
  })

  it('usa só as formas e as cores da marca', () => {
    const pecas = confete(42)
    expect(new Set(pecas.map((p) => p.forma))).toEqual(new Set(['losango', 'circulo', 'meia-lua', 'triangulo']))
    for (const p of pecas) expect(['#1F4D2B', '#3E7B3A', '#E9B526', '#B3261E', '#3B6EA5']).toContain(p.cor)
  })

  it('aceita semente negativa ou quebrada sem travar', () => {
    expect(confete(-5, 4)).toHaveLength(4)
    expect(confete(2.7, 4)).toEqual(confete(2, 4))
  })
})
