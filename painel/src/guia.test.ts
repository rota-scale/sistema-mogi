import { describe, expect, it } from 'vitest'
import { chaveDoGuia, guiaVisto, papelDoGuia, passosDoGuia } from './guia'

describe('guia da prefeitura', () => {
  it('operador vê a central sem a parte de gestão', () => {
    const p = passosDoGuia('operador', false)
    expect(p[0].alvo).toBeNull()
    expect(p.some((x) => x.alvo === 'nav.telas')).toBe(false)
    expect(p.at(-1)?.frase).toContain('Mandar equipe')
  })

  it('gestor vê também Indicadores e Administração, só no computador', () => {
    expect(passosDoGuia('gestor', false).some((x) => x.alvo === 'nav.telas')).toBe(true)
    expect(passosDoGuia('gestor', true).some((x) => x.alvo === 'nav.telas')).toBe(false)
  })

  it('equipe de campo tem o próprio guia', () => {
    const p = passosDoGuia('campo', true)
    expect(p.map((x) => x.titulo)).toContain('Resolver')
    expect(p.some((x) => x.alvo === '.fila .abas')).toBe(false)
  })

  it('frases curtas, sem jargão de tecnologia', () => {
    for (const papel of ['operador', 'gestor', 'campo'] as const) {
      for (const x of passosDoGuia(papel, false)) {
        expect(x.frase.length).toBeLessThanOrEqual(120)
        expect(x.frase).not.toMatch(/\bIA\b|algoritmo|sistema/i)
      }
    }
  })

  it('lembra por papel, neste aparelho', () => {
    expect(chaveDoGuia('gestor')).toBe('mogi.guia.gestor')
    expect(guiaVisto('gestor', (k) => (k === 'mogi.guia.gestor' ? 'visto' : null))).toBe(true)
    expect(guiaVisto('operador', () => null)).toBe(false)
    expect(papelDoGuia('campo')).toBe('campo')
    expect(papelDoGuia('morador')).toBeNull()
  })
})
