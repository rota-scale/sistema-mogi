import { describe, expect, it } from 'vitest'
import { capaDoVideo, direcaoDoGesto, formatarDuracao, legendaDoRelato, montarGaleria, rotuloDoItem, vizinho } from './galeria'
import type { Midia, Relato } from './tipos'

// Hora local, para a legenda não depender do fuso de quem roda o teste.
const em = (dia: number, hora: number, minuto: number) => new Date(2026, 10, dia, hora, minuto).toISOString()

function midia(id: string, tipo: Midia['tipo'], relato: string | null, p: Partial<Midia> = {}): Midia {
  return {
    id, tipo, relato_id: relato, mime: tipo === 'video' ? 'video/mp4' : 'image/jpeg', ordem: 0,
    largura: null, altura: null, duracao_ms: null, criado_em: em(12, 14, 30), disponivel: true,
    ...(tipo === 'video' ? {} : { url: `/api/midia?c=${id}` }), ...p,
  }
}

const relato = (id: string, criado_em: string, midia_url?: string): Relato => ({ id, texto: null, lat: 0, lng: 0, criado_em, midia_url })

describe('duração do vídeo', () => {
  it('escreve minutos e segundos', () => {
    expect(formatarDuracao(5000)).toBe('0:05')
    expect(formatarDuracao(15000)).toBe('0:15')
    expect(formatarDuracao(65400)).toBe('1:05')
    expect(formatarDuracao(300)).toBe('0:01')
  })
  it('fica sem selo quando a duração não veio', () => {
    expect(formatarDuracao(null)).toBeNull()
    expect(formatarDuracao(undefined)).toBeNull()
    expect(formatarDuracao(0)).toBeNull()
  })
})

describe('legenda do relato', () => {
  it('diz a posição, o total, o dia e a hora', () => {
    expect(legendaDoRelato(2, 5, em(12, 14, 30))).toBe('Relato 2 de 5, 12/11 às 14:30')
    expect(legendaDoRelato(1, 2, em(3, 9, 5))).toBe('Relato 1 de 2, 03/11 às 09:05')
  })
  it('omite a hora que não veio ou veio quebrada', () => {
    expect(legendaDoRelato(2, 5)).toBe('Relato 2 de 5')
    expect(legendaDoRelato(2, 5, 'ontem')).toBe('Relato 2 de 5')
  })
})

describe('chamado antigo, sem a lista de mídias', () => {
  it('mostra só a capa', () => {
    expect(montarGaleria({ midia_url: '/midia/capa' })).toEqual([
      { id: 'capa', tipo: 'foto', url: '/midia/capa', duracao: null, disponivel: true, relatoId: null, legenda: null },
    ])
    expect(montarGaleria({ midia_url: '/midia/capa', midias: [] })).toHaveLength(1)
  })
  it('fica vazia sem foto nenhuma', () => {
    expect(montarGaleria({})).toEqual([])
    expect(montarGaleria({ midias: [], relatos_lista: [relato('r1', em(12, 14, 30))] })).toEqual([])
  })
  it('usa a foto de cada relato agrupado no lugar das miniaturas', () => {
    const itens = montarGaleria({
      midia_url: '/midia/capa',
      relatos_lista: [relato('r1', em(12, 14, 30), '/midia/r1'), relato('r2', em(12, 15, 0)), relato('r3', em(12, 16, 10), '/midia/r3')],
    })
    expect(itens.map((i) => i.url)).toEqual(['/midia/r1', '/midia/r3'])
    expect(itens.map((i) => i.legenda)).toEqual(['Relato 1 de 3, 12/11 às 14:30', 'Relato 3 de 3, 12/11 às 16:10'])
  })
  it('não põe legenda quando o chamado tem um relato só', () => {
    const itens = montarGaleria({ midia_url: '/midia/capa', relatos_lista: [relato('r1', em(12, 14, 30), '/midia/r1')] })
    expect(itens).toHaveLength(1)
    expect(itens[0].url).toBe('/midia/r1')
    expect(itens[0].legenda).toBeNull()
  })
})

describe('galeria do chamado', () => {
  it('mostra a foto única sem legenda', () => {
    const itens = montarGaleria({ midia_url: '/midia/capa', midias: [midia('f1', 'foto', 'r1')], relatos_lista: [relato('r1', em(12, 14, 30))] })
    expect(itens).toEqual([
      { id: 'f1', tipo: 'foto', url: '/api/midia?c=f1', duracao: null, disponivel: true, relatoId: 'r1', legenda: null },
    ])
  })

  it('junta três fotos e o vídeo, com o quadro de capa em vez de item', () => {
    const midias = [
      midia('f1', 'foto', 'r1', { ordem: 0 }),
      midia('f2', 'foto', 'r1', { ordem: 1 }),
      midia('f3', 'foto', 'r1', { ordem: 2 }),
      midia('v1', 'video', 'r1', { ordem: 3, duracao_ms: 5000 }),
      midia('q1', 'quadro', 'r1', { ordem: 4 }),
    ]
    const itens = montarGaleria({ midias })
    expect(itens.map((i) => i.id)).toEqual(['f1', 'f2', 'f3', 'v1'])
    expect(itens[3]).toEqual({
      id: 'v1', tipo: 'video', url: '/api/midia?c=q1', duracao: '0:05', disponivel: true, relatoId: 'r1', legenda: null,
    })
  })

  it('usa a primeira foto do relato como capa do vídeo sem quadro', () => {
    const midias = [
      midia('fa', 'foto', 'r1'),
      midia('f2', 'foto', 'r2', { ordem: 1 }),
      midia('f1', 'foto', 'r2', { ordem: 0 }),
      midia('v', 'video', 'r2', { ordem: 2 }),
    ]
    expect(capaDoVideo(midias[3], midias)).toBe('/api/midia?c=f1')
    expect(montarGaleria({ midias }).find((i) => i.id === 'v')?.duracao).toBeNull()
  })

  it('deixa o vídeo sem capa quando o relato não tem quadro nem foto', () => {
    const midias = [midia('fa', 'foto', 'r1'), midia('q', 'quadro', 'r1'), midia('v', 'video', 'r2')]
    expect(capaDoVideo(midias[2], midias)).toBeUndefined()
    const itens = montarGaleria({ midias })
    expect(itens.map((i) => i.id)).toEqual(['fa', 'v'])
    expect(itens[1].url).toBeUndefined()
  })

  it('prefere o primeiro quadro, mesmo depois das fotos', () => {
    const midias = [
      midia('f1', 'foto', 'r1', { ordem: 0 }),
      midia('v', 'video', 'r1', { ordem: 1 }),
      midia('q2', 'quadro', 'r1', { ordem: 3 }),
      midia('q1', 'quadro', 'r1', { ordem: 2 }),
      midia('qx', 'quadro', 'r2', { ordem: 0 }),
    ]
    expect(capaDoVideo(midias[1], midias)).toBe('/api/midia?c=q1')
  })

  it('agrupa por relato as mídias que chegaram intercaladas', () => {
    const cedo = em(12, 14, 30)
    const tarde = em(13, 8, 5)
    const midias = [
      midia('a1', 'foto', 'ra', { ordem: 0, criado_em: cedo }),
      midia('b1', 'foto', 'rb', { ordem: 0, criado_em: tarde }),
      midia('a2', 'foto', 'ra', { ordem: 1, criado_em: cedo }),
      midia('bv', 'video', 'rb', { ordem: 2, criado_em: tarde, duracao_ms: 12000 }),
      midia('bq', 'quadro', 'rb', { ordem: 3, criado_em: tarde }),
      midia('b2', 'foto', 'rb', { ordem: 1, criado_em: tarde }),
    ]
    const itens = montarGaleria({ midias, relatos_lista: [relato('ra', cedo), relato('rb', tarde)] })
    expect(itens.map((i) => i.id)).toEqual(['a1', 'a2', 'b1', 'b2', 'bv'])
    expect(itens.map((i) => i.legenda)).toEqual([
      'Relato 1 de 2, 12/11 às 14:30', 'Relato 1 de 2, 12/11 às 14:30',
      'Relato 2 de 2, 13/11 às 08:05', 'Relato 2 de 2, 13/11 às 08:05', 'Relato 2 de 2, 13/11 às 08:05',
    ])
    expect(itens[4].url).toBe('/api/midia?c=bq')
  })

  it('numera pela ordem de chegada quando a lista de relatos não veio', () => {
    const midias = [
      midia('b1', 'foto', 'rb', { criado_em: em(13, 8, 5) }),
      midia('a1', 'foto', 'ra', { criado_em: em(12, 14, 30) }),
    ]
    const itens = montarGaleria({ midias })
    expect(itens.map((i) => i.id)).toEqual(['a1', 'b1'])
    expect(itens.map((i) => i.legenda)).toEqual(['Relato 1 de 2, 12/11 às 14:30', 'Relato 2 de 2, 13/11 às 08:05'])
  })

  it('conta os relatos sem mídia no total da legenda', () => {
    const itens = montarGaleria({
      midias: [midia('c1', 'foto', 'rc', { criado_em: em(12, 16, 0) })],
      relatos_lista: [relato('ra', em(12, 14, 30)), relato('rb', em(12, 15, 0)), relato('rc', em(12, 16, 0))],
    })
    expect(itens[0].legenda).toBe('Relato 3 de 3, 12/11 às 16:00')
  })

  it('mantém o vídeo apagado pela retenção, marcado como indisponível', () => {
    const itens = montarGaleria({
      midias: [midia('f1', 'foto', 'r1'), midia('v1', 'video', 'r1', { ordem: 1, duracao_ms: 9000, disponivel: false })],
    })
    expect(itens[1]).toMatchObject({ id: 'v1', tipo: 'video', disponivel: false, duracao: '0:09', url: '/api/midia?c=f1' })
  })

  it('põe a foto do depois por último, sem legenda de relato', () => {
    const midias = [
      midia('d1', 'depois', null, { criado_em: em(14, 10, 0) }),
      midia('a1', 'foto', 'ra', { criado_em: em(12, 14, 30) }),
      midia('b1', 'foto', 'rb', { criado_em: em(13, 8, 5) }),
    ]
    const itens = montarGaleria({ midias })
    expect(itens.map((i) => i.id)).toEqual(['a1', 'b1', 'd1'])
    expect(itens[2]).toMatchObject({ tipo: 'depois', url: '/api/midia?c=d1', relatoId: null, legenda: null })
    // A foto da equipe não entra na conta dos relatos.
    expect(itens[0].legenda).toBe('Relato 1 de 2, 12/11 às 14:30')
  })
})

describe('rótulos e navegação', () => {
  const [foto, video, depois] = montarGaleria({
    midias: [midia('f', 'foto', 'r1'), midia('v', 'video', 'r1', { ordem: 1, duracao_ms: 5000 }), midia('d', 'depois', null)],
  })
  it('nomeia cada item para o leitor de tela', () => {
    expect(rotuloDoItem(foto, 1, 3)).toBe('Foto, 1 de 3')
    expect(rotuloDoItem(video, 2, 3)).toBe('Vídeo de 0:05, 2 de 3')
    expect(rotuloDoItem({ ...video, duracao: null }, 2, 3)).toBe('Vídeo, 2 de 3')
    expect(rotuloDoItem(depois, 3, 3)).toBe('Foto do depois, 3 de 3')
    expect(rotuloDoItem(foto, 1, 1)).toBe('Foto')
  })
  it('dá a volta nas pontas', () => {
    expect(vizinho(0, 1, 3)).toBe(1)
    expect(vizinho(2, 1, 3)).toBe(0)
    expect(vizinho(0, -1, 3)).toBe(2)
    expect(vizinho(0, 1, 1)).toBe(0)
    expect(vizinho(0, 1, 0)).toBe(0)
  })
  it('só troca de mídia no deslize longo e horizontal', () => {
    expect(direcaoDoGesto(-80, 10)).toBe(1)
    expect(direcaoDoGesto(80, -10)).toBe(-1)
    expect(direcaoDoGesto(-20, 0)).toBe(0)
    expect(direcaoDoGesto(-80, 70)).toBe(0)
  })
})
