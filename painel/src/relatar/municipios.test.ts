import { describe, expect, it } from 'vitest'
import bruto from './municipios.json'
import { acharMunicipio, buscarMunicipio, lerLista, normalizar, rotulo } from './municipios'

const lista = lerLista(bruto as string[])
const nomes = (t: string, pref: string[] = []) => buscarMunicipio(t, lista, pref).map(rotulo)

describe('municípios do IBGE', () => {
  it('lista completa e bem formada', () => {
    expect(lista).toHaveLength(5570)
    expect(lista.find((m) => m.ibge === '3132909')).toEqual({ nome: 'Itamogi', uf: 'MG', ibge: '3132909' })
  })

  it('normaliza acento e caixa', () => {
    expect(normalizar('  São JOSÉ  dos-Campos ')).toBe('sao jose dos campos')
  })

  it('acha pelo começo, sem acento', () => {
    expect(nomes('itam')).toContain('Itamogi - MG')
    expect(nomes('itam', ['3132909'])[0]).toBe('Itamogi - MG')
    expect(nomes('sao jose dos campos')[0]).toBe('São José dos Campos - SP')
  })

  it('tolera um erro de digitação', () => {
    expect(nomes('itamgi')).toContain('Itamogi - MG')
    expect(nomes('curitba')).toContain('Curitiba - PR')
  })

  it('filtra pelo estado no fim', () => {
    const r = nomes('santa rita sp')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => x.endsWith('- SP'))).toBe(true)
  })

  it('vazio ou 1 letra não sugere nada, nem com cidade preferida', () => {
    expect(nomes('', ['3132909'])).toEqual([])
    expect(nomes('s', ['3132909'])).toEqual([])
  })

  it('a cidade do GPS só desempata: quem combina melhor vem antes', () => {
    // "itam" combina igual com várias (Itambé, Itamaraju...): Itamogi sobe só no desempate.
    expect(nomes('itam', ['3132909'])[0]).toBe('Itamogi - MG')
    expect(nomes('itam')[0]).not.toBe('Itamogi - MG')
    // "ita" é o nome exato de Itá (SC): combina melhor e fica na frente.
    expect(nomes('ita', ['3132909'])[0]).not.toBe('Itamogi - MG')
    // "sao" não combina com Itamogi: ela não aparece.
    expect(nomes('sao', ['3132909'])).not.toContain('Itamogi - MG')
  })

  it('no máximo 6 e nada para lixo', () => {
    expect(nomes('sa')).toHaveLength(6)
    expect(nomes('xqzwv')).toEqual([])
  })

  it('acha pelo nome e UF do GPS ou do CEP', () => {
    expect(acharMunicipio('ITAMOGI', 'mg', lista)?.ibge).toBe('3132909')
    expect(acharMunicipio('Itamogi', 'SP', lista)).toBeNull()
  })
})
