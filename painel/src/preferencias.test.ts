import { describe, expect, it } from 'vitest'
import { atalho, atributos, CHAVE_PREFERENCIAS, guardarPreferencias, lerPreferencias, PADRAO } from './preferencias'

describe('preferências do painel', () => {
  it('lê o padrão quando não há nada ou o guardado está quebrado', () => {
    expect(lerPreferencias(() => null)).toEqual(PADRAO)
    expect(lerPreferencias(() => '{quebrado')).toEqual(PADRAO)
    expect(lerPreferencias(() => '"texto"')).toEqual(PADRAO)
    expect(
      lerPreferencias(() => {
        throw new Error('sem armazenamento')
      }),
    ).toEqual(PADRAO)
  })

  it('guarda e lê de volta, ignorando campo desconhecido', () => {
    const caixa = new Map<string, string>()
    guardarPreferencias({ ...PADRAO, textoGrande: true, soMapa: true }, (k, v) => caixa.set(k, v))
    expect(lerPreferencias((k) => caixa.get(k) ?? null)).toEqual({ ...PADRAO, textoGrande: true, soMapa: true })
    caixa.set(CHAVE_PREFERENCIAS, JSON.stringify({ altoContraste: 'sim', outro: true }))
    expect(lerPreferencias((k) => caixa.get(k) ?? null)).toEqual(PADRAO)
  })

  it('vira atributo de html só o que está ligado', () => {
    expect(atributos(PADRAO)).toEqual({ 'data-texto': null, 'data-contraste': null, 'data-movimento': null })
    expect(atributos({ ...PADRAO, altoContraste: true, poucoMovimento: true })).toEqual({
      'data-texto': null,
      'data-contraste': 'alto',
      'data-movimento': 'reduzido',
    })
  })

  it('atalhos: ? abre a ajuda, M alterna só o mapa, e tecla com Ctrl ou Cmd não conta', () => {
    expect(atalho('?', false)).toBe('ajuda')
    expect(atalho('m', false)).toBe('soMapa')
    expect(atalho('M', false)).toBe('soMapa')
    expect(atalho('m', true)).toBeNull()
    expect(atalho('a', false)).toBeNull()
  })
})
