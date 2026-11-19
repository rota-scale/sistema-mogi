import { describe, expect, it } from 'vitest'
import { resumirGabinete, saudacao, tratamento } from './resumoDoGabinete'
import type { Ocorrencia } from './tipos'

const AGORA = new Date('2026-11-18T12:00:00Z')

function chamado(p: Partial<Ocorrencia>): Ocorrencia {
  return {
    id: p.protocolo ?? 'x',
    protocolo: 'MOGI-2026-000001',
    categoria: 'vias',
    secretaria: 'Obras e vias',
    status: 'aberta',
    nivel: 3,
    bairro: 'Centro',
    prazo_ate: null,
    resolvido_em: null,
    demo: false,
    criado_em: '2026-11-17T12:00:00Z',
    ...p,
  } as Ocorrencia
}

describe('gabinete do prefeito', () => {
  it('conta o que está em aberto, crítico e atrasado', () => {
    const r = resumirGabinete(
      [
        chamado({ protocolo: 'a', nivel: 5 }),
        chamado({ protocolo: 'b', nivel: 4, prazo_ate: '2026-11-18T08:00:00Z' }),
        chamado({ protocolo: 'c', nivel: 2, bairro: null, secretaria: null }),
        chamado({ protocolo: 'd', status: 'resolvida', nivel: 5, resolvido_em: '2026-11-17T10:00:00Z', prazo_ate: '2026-11-17T12:00:00Z' }),
      ],
      AGORA,
    )
    expect(r.emAberto).toBe(3)
    expect(r.criticos).toBe(1)
    expect(r.atrasados).toBe(1)
    expect(r.resolvidosNaSemana).toBe(1)
    expect(r.noPrazoPct).toBe(100)
  })

  it('na atenção entram só os graves em aberto, o crítico antes e o atrasado na frente', () => {
    const r = resumirGabinete(
      [
        chamado({ protocolo: 'urgente', nivel: 3 }),
        chamado({ protocolo: 'grave', nivel: 4 }),
        chamado({ protocolo: 'grave-atrasado', nivel: 4, prazo_ate: '2026-11-18T08:00:00Z' }),
        chamado({ protocolo: 'critico', nivel: 5 }),
        chamado({ protocolo: 'resolvido', nivel: 5, status: 'resolvida', resolvido_em: '2026-11-18T10:00:00Z' }),
      ],
      AGORA,
    )
    expect(r.atencao.map((o) => o.id)).toEqual(['critico', 'grave-atrasado', 'grave'])
  })

  it('bairro e secretaria sem nome vão para o fim', () => {
    const r = resumirGabinete([chamado({ protocolo: 'a', bairro: null }), chamado({ protocolo: 'b', bairro: null }), chamado({ protocolo: 'c' })], AGORA)
    expect(r.porBairro).toEqual([
      { nome: 'Centro', n: 1 },
      { nome: 'Sem bairro', n: 2 },
    ])
  })

  it('sem resolvido com prazo não inventa percentual, e conta os simulados', () => {
    const r = resumirGabinete([chamado({ protocolo: 'a', demo: true }), chamado({ protocolo: 'b', status: 'resolvida', resolvido_em: '2026-11-01T10:00:00Z' })], AGORA)
    expect(r.noPrazoPct).toBeNull()
    expect(r.resolvidosNaSemana).toBe(0)
    expect(r.simulados).toBe(1)
  })

  it('saúda pela hora e chama pelo nome cadastrado', () => {
    expect(saudacao(new Date(2026, 10, 18, 8))).toBe('Bom dia')
    expect(saudacao(new Date(2026, 10, 18, 15))).toBe('Boa tarde')
    expect(saudacao(new Date(2026, 10, 18, 22))).toBe('Boa noite')
    expect(tratamento('Prefeito Rogério', 'Prefeito')).toBe('Prefeito Rogério')
    expect(tratamento('  ', 'Prefeito')).toBe('Prefeito')
    expect(tratamento(undefined, 'Prefeito')).toBe('Prefeito')
  })
})
