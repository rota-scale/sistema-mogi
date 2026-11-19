import { describe, expect, it } from 'vitest'
import { avancar, concluiCom, contagem, etapaInicial, lerVistos, PASSOS, proximoVisivel, SLIDES, voltar } from './tour'
import type { Alvo } from './tour'

const todos = new Set<Alvo>(['mapa', 'centralizar', 'camera', 'perfil'])
const semCentralizar = new Set<Alvo>(['mapa', 'camera', 'perfil'])

describe('tour', () => {
  it('cada passo tem uma frase curta e um botão', () => {
    expect(PASSOS.length).toBe(5)
    for (const p of PASSOS) {
      expect(p.frase.length).toBeLessThanOrEqual(70)
      expect(p.botao.length).toBeGreaterThan(0)
    }
    expect(PASSOS.at(-1)?.botao).toBe('Entendi')
  })

  it('avança e volta pelos passos, até fechar', () => {
    expect(avancar(0, todos)).toBe(1)
    expect(avancar(3, todos)).toBe(4)
    expect(avancar(4, todos)).toBeNull()
    expect(voltar(2, todos)).toBe(1)
    expect(voltar(0, todos)).toBe(0)
  })

  it('pula o passo cujo botão não está na tela', () => {
    expect(avancar(1, semCentralizar)).toBe(3)
    expect(voltar(3, semCentralizar)).toBe(1)
    expect(proximoVisivel(2, semCentralizar)).toBe(3)
    expect(contagem(3, semCentralizar)).toEqual({ atual: 3, total: 4 })
    expect(contagem(3, todos)).toEqual({ atual: 4, total: 5 })
    // Antes de arrastar, o botão ainda não existe, mas a conta já o inclui.
    expect(contagem(0, semCentralizar)).toEqual({ atual: 1, total: 5 })
  })

  it('o gesto certo conclui o passo; o errado não', () => {
    expect(concluiCom(0, 'arrastar')).toBe(true)
    expect(concluiCom(0, 'zoom')).toBe(false)
    expect(concluiCom(1, 'zoom')).toBe(true)
    expect(concluiCom(1, 'girar')).toBe(true)
    expect(concluiCom(3, 'arrastar')).toBe(false)
    expect(concluiCom(99, 'arrastar')).toBe(false)
  })

  it('três slides, cada um com título e uma frase', () => {
    expect(SLIDES.map((s) => s.id)).toEqual(['problema', 'foto', 'resolvido'])
    for (const s of SLIDES) expect(s.frase.split('. ').length).toBeLessThanOrEqual(2)
  })
})

describe('primeiro contato', () => {
  it('ordem: slides, cadastro, tour', () => {
    const nada = { boasVindas: false, tour: false }
    expect(etapaInicial(nada, true, false, false)).toBe('boas_vindas')
    expect(etapaInicial({ boasVindas: true, tour: false }, true, false, false)).toBe('cadastro')
    expect(etapaInicial({ boasVindas: true, tour: false }, true, false, true)).toBe('tour')
    expect(etapaInicial({ boasVindas: true, tour: false }, true, true, false)).toBe('tour')
    expect(etapaInicial({ boasVindas: true, tour: false }, false, false, false)).toBe('tour')
    expect(etapaInicial({ boasVindas: true, tour: true }, true, true, false)).toBeNull()
  })

  it('quem já viu a Ajuda antiga não vê os slides, mas vê o tour', () => {
    const v = lerVistos((k) => (k === 'mogi.ajuda' ? 'vista' : null))
    expect(v).toEqual({ boasVindas: true, tour: false })
    expect(lerVistos(() => null)).toEqual({ boasVindas: false, tour: false })
    expect(
      lerVistos(() => {
        throw new Error('sem armazenamento')
      }),
    ).toEqual({ boasVindas: false, tour: false })
  })
})
