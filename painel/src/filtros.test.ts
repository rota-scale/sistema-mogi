import { describe, expect, it } from 'vitest'
import { alternar, combinaComBusca, estadoDaListaVazia, fichasAtivas, filtrar, opcoesDeFiltro, passaNosFiltros, SEM_FILTROS, semAcento, temFiltro } from './filtros'
import type { Ocorrencia } from './tipos'

function oc(p: Partial<Ocorrencia>): Ocorrencia {
  return {
    id: 'x', protocolo: 'MOGI-2026-000001', categoria: 'agua', texto: null, lat: 0, lng: 0,
    precisao_m: null, h3: null, endereco: null, bairro: null, status: 'aberta',
    nivel: 1, triagem: null, prazo_ate: null, prazo_fonte: null, secretaria: null, nivel_ia: null, relatos: 1,
    revisado_por: null, revisado_em: null, despachado_por: null, despachado_em: null, resolvido_por: null,
    resolvido_em: null, custo_brl: 0, latencia_ms: null, demo: false,
    criado_em: '2026-11-02T10:00:00Z', atualizado_em: '2026-11-02T10:00:00Z', ...p,
  }
}

describe('busca da fila', () => {
  const o = oc({ protocolo: 'MOGI-2026-000097', endereco: 'Rua São João, 120', bairro: 'Centro', texto: 'Cano estourado jorrando ÁGUA', categoria: 'agua' })
  it('ignora acento e maiúscula', () => {
    expect(semAcento('São João da ÁGUA')).toBe('sao joao da agua')
    expect(combinaComBusca(o, 'sao joao')).toBe(true)
    expect(combinaComBusca(o, 'AGUA')).toBe(true)
    expect(combinaComBusca(o, 'centro')).toBe(true)
  })
  it('procura no protocolo, no texto e no nome do tipo', () => {
    expect(combinaComBusca(o, '000097')).toBe(true)
    expect(combinaComBusca(o, 'estourado')).toBe(true)
    // "esgoto" só aparece no nome da categoria: Água e esgoto.
    expect(combinaComBusca(o, 'esgoto')).toBe(true)
    expect(combinaComBusca(o, 'buraco')).toBe(false)
  })
  it('exige todas as palavras, em qualquer ordem', () => {
    expect(combinaComBusca(o, 'centro cano')).toBe(true)
    expect(combinaComBusca(o, 'centro buraco')).toBe(false)
    expect(combinaComBusca(o, '   ')).toBe(true)
    expect(combinaComBusca(oc({}), 'rua')).toBe(false)
  })
})

describe('filtros da fila e do mapa', () => {
  const lista = [
    oc({ id: 'a', nivel: 5, categoria: 'agua', secretaria: 'Água e esgoto', bairro: 'Centro' }),
    oc({ id: 'b', nivel: 3, categoria: 'vias', secretaria: 'Obras e vias', bairro: 'Setor Norte' }),
    oc({ id: 'c', nivel: null, categoria: 'vias', secretaria: null, bairro: null, status: 'a_classificar' }),
    oc({ id: 'd', nivel: 3, categoria: 'limpeza', secretaria: 'Limpeza urbana', bairro: 'Centro', texto: 'entulho na calçada' }),
  ]
  const ids = (f: Partial<typeof SEM_FILTROS>) => filtrar(lista, { ...SEM_FILTROS, ...f }).map((o) => o.id)
  it('sem filtro devolve a mesma lista', () => {
    expect(filtrar(lista, SEM_FILTROS)).toBe(lista)
  })
  it('filtra por urgência, com 0 para o chamado sem avaliação', () => {
    expect(ids({ niveis: [5] })).toEqual(['a'])
    expect(ids({ niveis: [3, 0] })).toEqual(['b', 'c', 'd'])
  })
  it('filtra por tipo, secretaria e bairro, e junta os grupos com "e"', () => {
    expect(ids({ categorias: ['vias'] })).toEqual(['b', 'c'])
    expect(ids({ secretarias: ['Obras e vias', 'Limpeza urbana'] })).toEqual(['b', 'd'])
    expect(ids({ bairros: ['Centro'] })).toEqual(['a', 'd'])
    expect(ids({ bairros: ['Centro'], niveis: [3] })).toEqual(['d'])
    expect(ids({ bairros: ['Centro'], busca: 'entulho' })).toEqual(['d'])
  })
  it('acha o chamado sem bairro e sem secretaria pela chave vazia', () => {
    expect(ids({ bairros: [''] })).toEqual(['c'])
    expect(ids({ secretarias: [''] })).toEqual(['c'])
    expect(passaNosFiltros(lista[2], { ...SEM_FILTROS, bairros: ['Centro'] })).toBe(false)
  })
  it('conta as fichas marcadas e sabe quando há algo escondendo chamados', () => {
    expect(fichasAtivas(SEM_FILTROS)).toBe(0)
    expect(temFiltro(SEM_FILTROS)).toBe(false)
    expect(fichasAtivas({ ...SEM_FILTROS, categorias: ['vias', 'agua'], bairros: ['Centro'] })).toBe(3)
    // Busca e urgência não entram no contador do botão "Filtrar", mas escondem chamados.
    expect(fichasAtivas({ ...SEM_FILTROS, busca: 'rua', niveis: [5] })).toBe(0)
    expect(temFiltro({ ...SEM_FILTROS, busca: 'rua' })).toBe(true)
    expect(temFiltro({ ...SEM_FILTROS, niveis: [5] })).toBe(true)
    expect(temFiltro({ ...SEM_FILTROS, busca: '  ' })).toBe(false)
  })
  it('liga e desliga uma ficha', () => {
    expect(alternar(['a'], 'b')).toEqual(['a', 'b'])
    expect(alternar(['a', 'b'], 'a')).toEqual(['b'])
  })
  it('monta as fichas só com o que existe, em ordem e com "sem" no fim', () => {
    const op = opcoesDeFiltro(lista)
    expect(op.categorias).toEqual([
      { valor: 'agua', nome: 'Água e esgoto' }, { valor: 'limpeza', nome: 'Limpeza urbana' }, { valor: 'vias', nome: 'Vias e buracos' },
    ])
    expect(op.bairros.map((b) => b.nome)).toEqual(['Centro', 'Setor Norte', 'Sem bairro'])
    expect(op.secretarias.map((s) => s.nome)).toEqual(['Água e esgoto', 'Limpeza urbana', 'Obras e vias', 'Sem secretaria'])
  })
})

describe('estadoDaListaVazia', () => {
  it('diz que está carregando ou sem conexão antes de dizer que está vazio', () => {
    expect(estadoDaListaVazia('carregando', 'revisao', 0).tipo).toBe('carregando')
    const e = estadoDaListaVazia('falhou', 'revisao', 3)
    expect(e.tipo).toBe('erro')
    expect(e.texto).toMatch(/tenta de novo sozinho/)
  })

  it('oferece limpar os filtros quando eles escondem tudo', () => {
    const e = estadoDaListaVazia('pronta', 'abertas', 4)
    expect(e.limpar).toBe(true)
    expect(e.texto).toBe('Limpe os filtros para ver os 4 chamados desta lista.')
    expect(estadoDaListaVazia('pronta', 'abertas', 1).texto).toBe('Limpe os filtros para ver o chamado desta lista.')
  })

  it('usa a frase da situação quando a lista está vazia de verdade', () => {
    expect(estadoDaListaVazia('pronta', 'revisao', 0)).toEqual({
      tipo: 'calmo', titulo: 'Nada para conferir agora', texto: 'Chamado novo aparece aqui sozinho.', limpar: false,
    })
    expect(estadoDaListaVazia('pronta', 'outra', 0).titulo).toBe('Nenhum chamado aqui')
  })
})
