import { describe, expect, it } from 'vitest'
import { comJitter, ErroDaApi, fraseDoLogin, NaoAutorizado, opcional } from './api'

describe('reconexão', () => {
  it('varia a espera em até 30% para cima ou para baixo', () => {
    expect(comJitter(1000, 0)).toBe(700)
    expect(comJitter(1000, 0.5)).toBe(1000)
    expect(comJitter(1000, 1)).toBe(1300)
    for (let i = 0; i < 50; i++) {
      const ms = comJitter(15000)
      expect(ms).toBeGreaterThanOrEqual(10500)
      expect(ms).toBeLessThanOrEqual(19500)
    }
  })
})

describe('corpo das ações', () => {
  it('só manda o campo opcional quando foi preenchido', () => {
    expect(opcional('motivo', ' tampa trocada ')).toEqual({ motivo: 'tampa trocada' })
    expect(opcional('observacao', '   ')).toBeUndefined()
    expect(opcional('observacao')).toBeUndefined()
  })
})

describe('fraseDoLogin', () => {
  it('fala em português comum, sem a mensagem técnica do navegador', () => {
    expect(fraseDoLogin(new NaoAutorizado('login ou senha incorretos'))).toBe('Login ou senha não conferem. Confira e tente de novo.')
    expect(fraseDoLogin(new TypeError('Failed to fetch'))).toBe('Sem conexão com o servidor. Confira a internet e tente de novo.')
    expect(fraseDoLogin(new ErroDaApi('x', {}, 429))).toMatch(/Espere um minuto/)
    expect(fraseDoLogin(new ErroDaApi('x', {}, 502))).toMatch(/não respondeu/)
  })
  it('começa com maiúscula e termina com ponto', () => {
    expect(fraseDoLogin(new Error('o navegador bloqueou o armazenamento da sessão'))).toBe('O navegador bloqueou o armazenamento da sessão.')
    expect(fraseDoLogin(null)).toBe('Não deu para entrar.')
  })
})
