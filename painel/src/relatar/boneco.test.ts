import { describe, expect, it } from 'vitest'
import { corDaPele, ehCrianca, ehFeminino, ehIdoso, estiloPorPerfil, ESTILOS, FAIXAS, gravarAparencia, lerAparencia, PADRAO, SEXOS, TONS } from './boneco'

describe('boneco', () => {
  it('seis estilos e três tons, todos com nome', () => {
    expect(ESTILOS.map((e) => e.id)).toEqual(['homem', 'mulher', 'menino', 'menina', 'senhor', 'senhora'])
    expect(TONS).toHaveLength(3)
    for (const x of [...ESTILOS, ...TONS]) expect(x.nome.length).toBeGreaterThan(0)
  })

  it('classifica idade e gênero do desenho', () => {
    expect(ehCrianca('menina')).toBe(true)
    expect(ehCrianca('mulher')).toBe(false)
    expect(ehIdoso('senhor')).toBe(true)
    expect(ehFeminino('senhora')).toBe(true)
    expect(ehFeminino('menino')).toBe(false)
  })

  it('guarda e lê a escolha; lixo volta ao padrão', () => {
    const a = { estilo: 'senhora', tom: 'escuro' } as const
    expect(lerAparencia(gravarAparencia(a))).toEqual(a)
    expect(lerAparencia(null)).toEqual(PADRAO)
    expect(lerAparencia('nao é json')).toEqual(PADRAO)
    expect(lerAparencia('{"estilo":"robo","tom":"verde"}')).toEqual(PADRAO)
    expect(lerAparencia('{"estilo":"menina"}')).toEqual({ estilo: 'menina', tom: 'claro' })
  })

  it('cada tom tem a sua cor', () => {
    expect(new Set(TONS.map((t) => corDaPele(t.id))).size).toBe(3)
  })
})

describe('boneco pelo cadastro', () => {
  it('sexo e idade escolhem o boneco', () => {
    expect(estiloPorPerfil('feminino', 'adulto')).toBe('mulher')
    expect(estiloPorPerfil('feminino', 'ate17')).toBe('menina')
    expect(estiloPorPerfil('feminino', '60mais')).toBe('senhora')
    expect(estiloPorPerfil('masculino', 'adulto')).toBe('homem')
    expect(estiloPorPerfil('masculino', 'ate17')).toBe('menino')
    expect(estiloPorPerfil('masculino', '60mais')).toBe('senhor')
  })

  it('sem idade vale adulto; sem sexo não muda o boneco', () => {
    expect(estiloPorPerfil('feminino', null)).toBe('mulher')
    expect(estiloPorPerfil(null, '60mais')).toBeNull()
    expect(SEXOS.at(-1)?.id).toBeNull()
    expect(FAIXAS).toHaveLength(3)
  })
})
