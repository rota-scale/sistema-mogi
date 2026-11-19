import { describe, expect, it } from 'vitest'
import { caminhoDoIcone, desenhoDoPino, formaDoNivel, PINO, rotuloComForma } from './formas'

const numeros = (caminho: string) => (caminho.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

describe('formas dos níveis', () => {
  it('dá uma forma diferente para cada nível, de 0 a 5', () => {
    const formas = [0, 1, 2, 3, 4, 5].map(formaDoNivel)
    expect(new Set(formas).size).toBe(6)
    expect(formaDoNivel(5)).toBe('losango')
  })

  it('trata nível desconhecido ou nulo como sem avaliação', () => {
    expect(formaDoNivel(null)).toBe('traco')
    expect(formaDoNivel(9)).toBe('traco')
  })

  it('tem ícones fechados e distintos dentro do quadro de 24', () => {
    const icones = [0, 1, 2, 3, 4, 5].map(caminhoDoIcone)
    expect(new Set(icones).size).toBe(6)
    for (const c of icones) {
      expect(c.endsWith('Z')).toBe(true)
      for (const n of numeros(c)) {
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(24)
      }
    }
  })

  it('desenha todo pino com a ponta no mesmo lugar e o miolo dentro do quadro', () => {
    const cabecas = new Set<string>()
    for (const nivel of [1, 2, 3, 4, 5]) {
      const p = desenhoDoPino(nivel)
      cabecas.add(p.caminho)
      expect(p.caminho).toMatch(new RegExp(`${PINO.ponta.x} ${PINO.ponta.y}`))
      expect(p.miolo.x - p.miolo.r).toBeGreaterThan(0)
      expect(p.miolo.x + p.miolo.r).toBeLessThan(PINO.largura)
      expect(p.miolo.y - p.miolo.r).toBeGreaterThan(0)
      expect(p.miolo.y + p.miolo.r).toBeLessThan(PINO.ponta.y)
      expect(p.tracejado).toBe(false)
    }
    expect(cabecas.size).toBe(5)
  })

  it('marca o pino sem avaliação como tracejado', () => {
    expect(desenhoDoPino(null).tracejado).toBe(true)
  })

  it('diz a forma junto do nome', () => {
    expect(rotuloComForma('Crítico', 5)).toBe('Crítico (losango)')
    expect(rotuloComForma('Sem avaliação', null)).toBe('Sem avaliação (traço)')
  })
})
