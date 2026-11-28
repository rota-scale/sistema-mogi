import { describe, expect, it } from 'vitest'
import { criticoParaConferir, lerVistos, marcarVistos, pendentesDoAlerta, semAviso, textoDoAlerta, tituloDaAba } from './regrasDoAlerta'
import type { Ocorrencia } from './tipos'

function oc(p: Partial<Ocorrencia>): Ocorrencia {
  return {
    id: 'x', protocolo: 'MOGI', categoria: 'agua', texto: null, lat: 0, lng: 0,
    precisao_m: null, h3: null, endereco: null, bairro: null, status: 'revisao',
    nivel: 5, triagem: null, prazo_ate: null, prazo_fonte: null, secretaria: null, nivel_ia: null, relatos: 1,
    revisado_por: null, revisado_em: null, despachado_por: null, despachado_em: null, resolvido_por: null,
    resolvido_em: null, custo_brl: 0, latencia_ms: null, demo: false,
    criado_em: '2026-11-02T10:00:00Z', atualizado_em: '2026-11-02T10:00:00Z', ...p,
  }
}

describe('alerta de chamado crítico', () => {
  it('só entra o crítico que ainda está para conferir', () => {
    expect(criticoParaConferir(oc({}))).toBe(true)
    expect(criticoParaConferir(oc({ nivel: 4 }))).toBe(false)
    expect(criticoParaConferir(oc({ status: 'aberta' }))).toBe(false)
    expect(criticoParaConferir(oc({ status: 'a_classificar', nivel: null }))).toBe(false)
  })
  it('lista os que o painel ainda não viu, do mais antigo para o mais novo', () => {
    const lista = [
      oc({ id: 'novo', criado_em: '2026-11-02T12:00:00Z' }),
      oc({ id: 'visto', criado_em: '2026-11-02T09:00:00Z' }),
      oc({ id: 'antigo', criado_em: '2026-11-02T10:00:00Z' }),
      oc({ id: 'aberto', status: 'aberta' }),
    ]
    expect(pendentesDoAlerta(lista, new Set(['visto'])).map((o) => o.id)).toEqual(['antigo', 'novo'])
    expect(pendentesDoAlerta(lista, new Set(['visto', 'antigo', 'novo']))).toEqual([])
  })
  it('sai da faixa quando alguém confere, sem precisar marcar como visto', () => {
    const antes = [oc({ id: 'a' })]
    const depois = [oc({ id: 'a', status: 'aberta' })]
    expect(pendentesDoAlerta(antes, new Set())).toHaveLength(1)
    expect(pendentesDoAlerta(depois, new Set())).toHaveLength(0)
  })
  it('avisa com som só uma vez por chamado', () => {
    const pendentes = [oc({ id: 'a' }), oc({ id: 'b' })]
    expect(semAviso(pendentes, new Set(['a'])).map((o) => o.id)).toEqual(['b'])
    expect(semAviso(pendentes, new Set(['a', 'b']))).toEqual([])
  })
  it('lembra os vistos sem crescer para sempre', () => {
    const v = marcarVistos(new Set(['a', 'b', 'c']), ['d', 'a'], 3)
    // "a" foi visto de novo e fica; "b", o mais velho, sai.
    expect([...v]).toEqual(['c', 'd', 'a'])
    expect([...marcarVistos(new Set(), ['x'])]).toEqual(['x'])
  })
  it('lê os vistos guardados e aguenta lixo no armazenamento', () => {
    expect([...lerVistos('["a","b"]')]).toEqual(['a', 'b'])
    expect(lerVistos(null).size).toBe(0)
    expect(lerVistos('{quebrado').size).toBe(0)
    expect([...lerVistos('["a",3,null]')]).toEqual(['a'])
  })
  it('escreve a faixa e o título da aba', () => {
    expect(textoDoAlerta([oc({ categoria: 'agua', endereco: 'Rua X' })])).toBe('Chamado crítico: Água e esgoto, Rua X')
    expect(textoDoAlerta([oc({ categoria: 'vias', bairro: 'Centro' })])).toBe('Chamado crítico: Vias e buracos, Centro')
    expect(textoDoAlerta([oc({ categoria: 'vias' })])).toBe('Chamado crítico: Vias e buracos')
    expect(textoDoAlerta([oc({ id: 'a' }), oc({ id: 'b' }), oc({ id: 'c' })])).toBe('3 chamados críticos')
    expect(textoDoAlerta([])).toBe('')
    expect(tituloDaAba(2, 'Sistema MOGI · Painel')).toBe('(2) MOGI · Painel')
    expect(tituloDaAba(0, 'Sistema MOGI · Painel')).toBe('Sistema MOGI · Painel')
  })
})
