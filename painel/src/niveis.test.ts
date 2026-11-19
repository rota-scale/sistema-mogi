import { describe, expect, it } from 'vitest'
import {
  contarAbertosPorNivel, contarPorAba, contraste, contarPorBairro, corDoNivel, duracao, equipeNaoEncontrou, juntarDetalhe, maisNovo, mesclar,
  mesclarRecarga, naAba, nomeDoNivel, nomeDoStatus, notaDoEvento, oQueFoiFeito, ordenarFila, perguntaDaConferencia, porQueEssaUrgencia,
  prazoEmPalavras, quandoEmPalavras, rotuloDoEvento, rotuloDoFiltro, situacaoDoPrazo, textoSobreNivel, triagemEmDuvida,
} from './niveis'
import type { Evento, Ocorrencia } from './tipos'

function oc(p: Partial<Ocorrencia>): Ocorrencia {
  return {
    id: 'x', protocolo: 'MOGI', categoria: 'agua', texto: null, lat: 0, lng: 0,
    precisao_m: null, h3: null, endereco: null, bairro: null, status: 'aberta',
    nivel: 1, triagem: null, prazo_ate: null, prazo_fonte: null, secretaria: null, nivel_ia: null, relatos: 1,
    revisado_por: null, revisado_em: null, despachado_por: null, despachado_em: null, resolvido_por: null,
    resolvido_em: null, custo_brl: 0, latencia_ms: null, demo: false,
    criado_em: '2026-11-02T10:00:00Z', atualizado_em: '2026-11-02T10:00:00Z', ...p,
  }
}

describe('fila de revisão', () => {
  it('põe a classificar no topo e ordena por nível', () => {
    const fila = ordenarFila([
      oc({ id: 'a', status: 'revisao', nivel: 4 }),
      oc({ id: 'b', status: 'aberta', nivel: 5 }),
      oc({ id: 'c', status: 'a_classificar', nivel: null }),
      oc({ id: 'd', status: 'revisao', nivel: 5 }),
    ])
    expect(fila.map((o) => o.id)).toEqual(['c', 'd', 'a'])
  })
})

describe('eventos ao vivo', () => {
  it('substitui a ocorrência atualizada sem duplicar', () => {
    const lista = [oc({ id: 'a', nivel: 4 }), oc({ id: 'b', criado_em: '2026-11-02T09:00:00Z' })]
    const nova = mesclar(lista, oc({ id: 'a', nivel: 5 }))
    expect(nova).toHaveLength(2)
    expect(nova.find((o) => o.id === 'a')?.nivel).toBe(5)
  })
  it('ignora a versão mais velha que a da lista', () => {
    const lista = [oc({ id: 'a', nivel: 5, atualizado_em: '2026-11-02T10:05:00Z' })]
    expect(mesclar(lista, oc({ id: 'a', nivel: 3, atualizado_em: '2026-11-02T10:01:00Z' }))).toBe(lista)
  })
  it('compara os instantes mesmo com os zeros cortados pelo servidor', () => {
    // Como texto, "08.7Z" viria depois de "08.715Z".
    expect(maisNovo('2026-11-02T10:00:08.715Z', '2026-11-02T10:00:08.7Z')).toBe(true)
    expect(maisNovo('2026-11-02T10:00:08.7Z', '2026-11-02T10:00:08.715Z')).toBe(false)
    expect(maisNovo('2026-11-02T10:00:08.715484Z', '2026-11-02T10:00:08.715Z')).toBe(true)
    expect(maisNovo('2026-11-02T10:00:09Z', '2026-11-02T10:00:08.999999Z')).toBe(true)
    expect(maisNovo('2026-11-02T10:00:08Z', '2026-11-02T10:00:08Z')).toBe(false)
  })
})

describe('recarga da lista', () => {
  const velho = '2026-11-02T10:00:00Z'
  const novo = '2026-11-02T10:09:00Z'
  it('fica com a versão mais nova de cada chamado', () => {
    const local = [oc({ id: 'a', status: 'em_atendimento', atualizado_em: novo }), oc({ id: 'b', nivel: 2, atualizado_em: velho })]
    const recebida = [oc({ id: 'a', status: 'aberta', atualizado_em: velho }), oc({ id: 'b', nivel: 4, atualizado_em: novo })]
    const r = mesclarRecarga(local, recebida)
    // "a" mudou ao vivo enquanto a recarga viajava; "b" estava velho aqui.
    expect(r.find((o) => o.id === 'a')?.status).toBe('em_atendimento')
    expect(r.find((o) => o.id === 'b')?.nivel).toBe(4)
  })
  it('guarda o chamado que chegou ao vivo durante a recarga e solta o que saiu do servidor', () => {
    const local = [oc({ id: 'chegou' }), oc({ id: 'sumiu' }), oc({ id: 'a' })]
    const r = mesclarRecarga(local, [oc({ id: 'a' })], new Set(['chegou']))
    expect(r.map((o) => o.id).sort()).toEqual(['a', 'chegou'])
  })
  it('devolve mais recente primeiro', () => {
    const r = mesclarRecarga([], [oc({ id: 'a', criado_em: '2026-11-01T10:00:00Z' }), oc({ id: 'b', criado_em: '2026-11-02T10:00:00Z' })])
    expect(r.map((o) => o.id)).toEqual(['b', 'a'])
  })
})

describe('cores e contadores', () => {
  it('usa cinza quando não há nível', () => {
    expect(corDoNivel(null)).toBe('#716B60')
    expect(corDoNivel(5)).toBe('#B3261E')
    // Amarelo e laranja pedem texto escuro; os demais, branco.
    expect(textoSobreNivel(3)).toBe('#2B1A10')
    expect(textoSobreNivel(5)).toBe('#FFFFFF')
  })
  it('conta por bairro e ignora resolvidas', () => {
    const r = contarPorBairro([
      oc({ bairro: 'Centro' }), oc({ bairro: 'Centro' }), oc({ bairro: null }),
      oc({ bairro: 'Centro', status: 'resolvida' }),
    ])
    expect(r).toEqual([['Centro', 2], ['Sem bairro', 1]])
  })
  it('põe "Sem bairro" no fim mesmo quando tem mais chamados', () => {
    const r = contarPorBairro([oc({ bairro: null }), oc({ bairro: null }), oc({ bairro: 'Centro' })])
    expect(r).toEqual([['Centro', 1], ['Sem bairro', 2]])
  })
})

describe('contraste dos selos', () => {
  it('calcula o contraste como a WCAG', () => {
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contraste('#777777', '#777777')).toBe(1)
  })
  it('deixa o texto de todo selo legível (4,5:1 ou mais)', () => {
    for (const nivel of [null, 1, 2, 3, 4, 5]) {
      expect(contraste(corDoNivel(nivel), textoSobreNivel(nivel))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('abas da fila', () => {
  it('separa por situação e ordena resolvidas pela mais recente', () => {
    const lista = [
      oc({ id: 'a', status: 'aberta' }),
      oc({ id: 'b', status: 'em_atendimento' }),
      oc({ id: 'c', status: 'resolvida', resolvido_em: '2026-11-03T10:00:00Z' }),
      oc({ id: 'd', status: 'resolvida', resolvido_em: '2026-11-04T10:00:00Z' }),
    ]
    expect(ordenarFila(lista, 'abertas').map((o) => o.id)).toEqual(['a'])
    expect(ordenarFila(lista, 'atendimento').map((o) => o.id)).toEqual(['b'])
    expect(ordenarFila(lista, 'resolvidas').map((o) => o.id)).toEqual(['d', 'c'])
    expect(naAba(lista[0], 'revisao')).toBe(false)
  })
  it('ordena pelo prazo mais perto, com o sem prazo no fim', () => {
    const lista = [
      oc({ id: 'sem', nivel: 5, prazo_ate: null }),
      oc({ id: 'longe', nivel: 4, prazo_ate: '2026-11-05T10:00:00Z' }),
      oc({ id: 'vencido', nivel: 2, prazo_ate: '2026-11-01T10:00:00Z' }),
      oc({ id: 'perto', nivel: 3, prazo_ate: '2026-11-03T10:00:00Z' }),
    ]
    expect(ordenarFila(lista, 'abertas', 'prazo').map((o) => o.id)).toEqual(['vencido', 'perto', 'longe', 'sem'])
    expect(ordenarFila(lista, 'abertas').map((o) => o.id)).toEqual(['sem', 'longe', 'perto', 'vencido'])
  })
  it('dá à situação um nome que se explica', () => {
    expect(nomeDoStatus('revisao')).toBe('Para conferir')
    expect(nomeDoStatus('a_classificar')).toBe('Para conferir')
    expect(nomeDoStatus('aberta')).toBe('Aguardando equipe')
    expect(nomeDoStatus('em_atendimento')).toBe('Equipe a caminho')
    expect(nomeDoStatus('resolvida')).toBe('Resolvido')
  })
  it('conta cada chamado em uma aba só', () => {
    const lista = [
      oc({ status: 'revisao' }), oc({ status: 'a_classificar', nivel: null }), oc({ status: 'aberta' }),
      oc({ status: 'em_atendimento' }), oc({ status: 'resolvida' }), oc({ status: 'resolvida' }),
    ]
    expect(contarPorAba(lista)).toEqual({ revisao: 2, abertas: 1, atendimento: 1, resolvidas: 2 })
    expect(contarPorAba([])).toEqual({ revisao: 0, abertas: 0, atendimento: 0, resolvidas: 0 })
  })
})

describe('detalhe do chamado', () => {
  const evento: Evento = { tipo: 'criada', autor: null, dados: {}, criado_em: '2026-11-02T10:00:00Z' }
  it('fica com a mídia recém-assinada do detalhe e o resto do resumo', () => {
    const resumo = oc({ id: 'a', status: 'em_atendimento', midia_url: '/midia/velha', relatos: 2 })
    const midias = [{
      id: 'm1', relato_id: 'r1', tipo: 'foto' as const, mime: 'image/jpeg', ordem: 0, largura: null, altura: null,
      duracao_ms: null, criado_em: '2026-11-02T10:00:00Z', url: '/midia/m1-nova', disponivel: true,
    }]
    const completo = oc({
      id: 'a', status: 'aberta', midia_url: '/midia/nova', relatos: 1, eventos: [evento], midias,
      relatos_lista: [{ id: 'r1', texto: null, lat: 0, lng: 0, criado_em: '2026-11-02T10:00:00Z', midia_url: '/midia/r1-nova' }],
    })
    const o = juntarDetalhe(resumo, completo)
    expect(o.midia_url).toBe('/midia/nova')
    expect(o.relatos_lista?.[0].midia_url).toBe('/midia/r1-nova')
    expect(o.midias).toBe(midias)
    expect(o.eventos).toEqual([evento])
    // O tempo real mantém o resumo mais fresco que o detalhe.
    expect(o.status).toBe('em_atendimento')
    expect(o.relatos).toBe(2)
  })
  it('usa o resumo enquanto o detalhe não chega ou é de outro chamado', () => {
    const resumo = oc({ id: 'a', midia_url: '/midia/lista' })
    expect(juntarDetalhe(resumo, null)).toBe(resumo)
    expect(juntarDetalhe(resumo, oc({ id: 'b', midia_url: '/midia/outro' }))).toBe(resumo)
    expect(juntarDetalhe(resumo, oc({ id: 'a' })).midia_url).toBe('/midia/lista')
  })
})

describe('histórico', () => {
  const ev = (tipo: string, dados: Record<string, unknown> = {}): Evento => ({ tipo, autor: 'ana', dados, criado_em: '2026-11-02T10:00:00Z' })
  it('escreve o rótulo em português comum, sem número de nível nem nome do banco', () => {
    expect(rotuloDoEvento(ev('criada'))).toBe('Chamado criado')
    expect(rotuloDoEvento(ev('revisada', { nivel: 4 }))).toBe('Urgência conferida: Muito urgente')
    expect(rotuloDoEvento(ev('reaberta'))).toBe('Reaberto')
    expect(rotuloDoEvento(ev('video_visto', { midia: 'm1' }))).toBe('Vídeo aberto')
    expect(rotuloDoEvento(ev('relato'))).toBe('Novo relato do mesmo problema')
    expect(rotuloDoEvento(ev('tambem_vi'))).toBe('Mais uma pessoa confirmou')
    expect(rotuloDoEvento(ev('nao_encontrada'))).toBe('A equipe não encontrou o problema')
    expect(rotuloDoEvento(ev('despachada'))).toBe('Equipe enviada')
    expect(rotuloDoEvento(ev('despachada', { secretaria: 'Trânsito' }))).toBe('Equipe enviada: Trânsito')
    expect(rotuloDoEvento(ev('tipo_novo'))).toBe('Atualização do chamado')
  })
  it('mostra recado, motivo e a divergência da triagem', () => {
    expect(notaDoEvento(ev('despachada', { observacao: ' levar escada ' }), null)).toBe('levar escada')
    expect(notaDoEvento(ev('despachada'), null)).toBeNull()
    expect(notaDoEvento(ev('resolvida', { motivo: 'tampa trocada' }), null)).toBe('tampa trocada')
    expect(notaDoEvento(ev('reaberta', { motivo: 'resolvido por engano' }), null)).toBe('resolvido por engano')
    expect(notaDoEvento(ev('nao_encontrada', { motivo: 'rua errada' }), null)).toBe('rua errada')
    expect(notaDoEvento(ev('revisada', { nivel: 4 }), 5)).toBe('a triagem tinha sugerido Crítico')
    expect(notaDoEvento(ev('revisada', { nivel: 4 }), 4)).toBeNull()
    expect(notaDoEvento(ev('criada', { motivo: 'x' }), null)).toBeNull()
  })
  it('acha o que foi feito na última resolução', () => {
    expect(oQueFoiFeito([ev('resolvida', { motivo: 'registro trocado' }), ev('reaberta', { motivo: 'voltou' }), ev('resolvida', { motivo: 'cano novo' })])).toBe('cano novo')
    expect(oQueFoiFeito([ev('resolvida', { motivo: 'registro trocado' }), ev('reaberta'), ev('resolvida')])).toBeNull()
    expect(oQueFoiFeito(undefined)).toBeNull()
  })
})

describe('filtro de urgência', () => {
  it('descreve nome e quantidade para o leitor de tela, sem o número do nível', () => {
    expect(rotuloDoFiltro(5, 3)).toBe('Crítico: 3 chamados em aberto')
    expect(rotuloDoFiltro(1, 1)).toBe('Não urgente: 1 chamado em aberto')
    expect(rotuloDoFiltro(0, 0)).toBe('Sem avaliação: 0 chamados em aberto')
    expect(nomeDoNivel(null)).toBe('Sem avaliação')
  })
  it('conta os chamados em aberto de cada urgência', () => {
    const m = contarAbertosPorNivel([oc({ nivel: 5 }), oc({ nivel: 5 }), oc({ nivel: null }), oc({ nivel: 5, status: 'resolvida' })])
    expect([...m]).toEqual([[5, 2], [0, 1]])
  })
})

// Datas montadas na hora local, para o teste valer em qualquer fuso.
const local = (dia: number, hora: number, minuto = 0) => new Date(2026, 10, dia, hora, minuto)
const iso = (dia: number, hora: number, minuto = 0) => local(dia, hora, minuto).toISOString()

describe('prazo em palavras', () => {
  const agora = local(15, 10)
  it('fala o dia como gente: hoje, amanhã ou a data', () => {
    expect(prazoEmPalavras(iso(15, 18), agora)).toEqual({ curto: 'até hoje às 18h', longo: 'resolver até hoje às 18h', atrasado: false })
    expect(prazoEmPalavras(iso(16, 9), agora).longo).toBe('resolver até amanhã às 9h')
    expect(prazoEmPalavras(iso(15, 18, 30), agora).curto).toBe('até hoje às 18h30')
    expect(prazoEmPalavras(iso(20, 9), agora).longo).toBe('resolver até 20/11')
    // 23h59 de hoje e 0h05 de amanhã estão a minutos de distância, mas em dias diferentes.
    expect(prazoEmPalavras(iso(16, 0, 5), local(15, 23, 59)).curto).toBe('até amanhã às 0h05')
  })
  it('diz há quanto tempo está atrasado', () => {
    expect(prazoEmPalavras(iso(15, 8), agora)).toEqual({ curto: 'atrasado há 2 h', longo: 'atrasado há 2 h', atrasado: true })
    expect(prazoEmPalavras(iso(15, 9, 40), agora).curto).toBe('atrasado há 20 min')
    expect(prazoEmPalavras(iso(15, 9, 59, ), local(15, 9, 59)).atrasado).toBe(false)
    expect(prazoEmPalavras(iso(12, 10), agora).curto).toBe('atrasado há 3 dias')
    expect(prazoEmPalavras(iso(14, 9), agora).curto).toBe('atrasado há 1 dia')
  })
  it('explica o chamado sem prazo', () => {
    expect(prazoEmPalavras(null, agora)).toEqual({ curto: 'sem prazo', longo: 'sem prazo: entra na rotina da equipe', atrasado: false })
    expect(prazoEmPalavras('data errada', agora).curto).toBe('sem prazo')
  })
  it('conta quando algo aconteceu', () => {
    expect(quandoEmPalavras(iso(15, 14, 32), agora)).toBe('hoje às 14h32')
    expect(quandoEmPalavras(iso(14, 9), agora)).toBe('ontem às 9h')
    expect(quandoEmPalavras(iso(3, 9, 5), agora)).toBe('03/11 às 9h05')
    expect(quandoEmPalavras(null, agora)).toBe('')
  })
})

describe('por que essa urgência', () => {
  const triagem = (sinais: Record<string, number>, mais: { confianca?: number; foto_util?: boolean; problema_urbano?: number } = {}) => ({
    classificacao: {
      categoria: 'vias', secretaria: 'Obras e vias', sinais, g: [0, 0, 0, 0, 1] as [number, number, number, number, number],
      u: [0, 0, 0, 0, 1] as [number, number, number, number, number], t: [0, 0, 0, 0, 1] as [number, number, number, number, number],
      confianca: mais.confianca ?? 0.9, provedor: 'x', ...(mais.problema_urbano == null ? {} : { problema_urbano: mais.problema_urbano }),
    },
    ...(mais.foto_util == null ? {} : { descricao: { categoria: 'vias', resumo: '', sinais_visiveis: null, foto_util: mais.foto_util, provedor: 'x' } }),
    gut_esperada: 100, gut_p90: 125, motivo: 'GUT esperada 100, faixa do nível 4', revisao: false, latencia_ms: 1,
  })
  it('vira os sinais certos em palavras, sem porcentagem', () => {
    const o = oc({ relatos: 3, triagem: triagem({ bloqueio_calcada: 0.93, risco_moto: 0.7, alagamento: 0.69 }) })
    expect(porQueEssaUrgencia(o)).toBe('Calçada bloqueada · risco para moto · 3 pessoas relataram')
    expect(porQueEssaUrgencia(o)).not.toMatch(/%|\d,\d|GUT|confiança/i)
  })
  it('acrescenta relatos e escola', () => {
    expect(porQueEssaUrgencia(oc({ relatos: 2, triagem: triagem({ agua_jorrando: 0.8, perto_de_escola: 0.9 }) }))).toBe('Água jorrando · 2 pessoas relataram · perto de escola')
    expect(porQueEssaUrgencia(oc({ relatos: 4 }))).toBe('4 pessoas relataram')
    expect(porQueEssaUrgencia(oc({ triagem: triagem({ sinal_que_o_painel_nao_conhece: 0.9 }) }))).toBe('Sinal que o painel nao conhece')
  })
  it('sem sinal nenhum, diz que foi pelo tipo', () => {
    expect(porQueEssaUrgencia(oc({}))).toBe('Avaliado pelo tipo do problema.')
    expect(porQueEssaUrgencia(oc({ triagem: triagem({ alagamento: 0.2 }) }))).toBe('Avaliado pelo tipo do problema.')
  })
  it('avisa quando a triagem ficou em dúvida', () => {
    const duvida = 'A triagem ficou em dúvida: confira a foto.'
    expect(porQueEssaUrgencia(oc({ status: 'revisao', triagem: triagem({ via_bloqueada: 0.9 }, { confianca: 0.4 }) }))).toBe(duvida)
    expect(porQueEssaUrgencia(oc({ status: 'revisao', triagem: triagem({}, { foto_util: false }) }))).toBe(duvida)
    expect(porQueEssaUrgencia(oc({ status: 'revisao', triagem: triagem({}, { problema_urbano: 0.1 }) }))).toBe(duvida)
    // Para conferir só por ser urgente não é dúvida.
    const urgente = oc({ status: 'revisao', nivel: 5, triagem: triagem({ via_bloqueada: 0.9 }) })
    expect(triagemEmDuvida(urgente)).toBe(false)
    expect(porQueEssaUrgencia(urgente)).toBe('Via bloqueada')
    // Depois de conferido, a dúvida da triagem não importa mais.
    expect(triagemEmDuvida(oc({ status: 'aberta', triagem: triagem({}, { confianca: 0.4 }) }))).toBe(false)
  })
  it('diz quem conferiu a urgência', () => {
    expect(porQueEssaUrgencia(oc({ revisado_por: 'ana' }))).toBe('Urgência conferida por ana')
    expect(porQueEssaUrgencia(oc({ revisado_por: 'ana', relatos: 2, triagem: triagem({ fio_exposto: 0.9 }) }))).toBe('Fio exposto · 2 pessoas relataram · urgência conferida por ana')
  })
  it('explica o chamado sem avaliação e o que a equipe não encontrou', () => {
    expect(porQueEssaUrgencia(oc({ status: 'a_classificar', nivel: null }))).toBe('A triagem não conseguiu avaliar: veja a foto e escolha a urgência.')
    const ev = (tipo: string): Evento => ({ tipo, autor: 'ze', dados: {}, criado_em: '2026-11-02T10:00:00Z' })
    const voltou = oc({ status: 'revisao', nivel: 4, revisado_por: 'ana', eventos: [ev('revisada'), ev('despachada'), ev('nao_encontrada')] })
    expect(equipeNaoEncontrou(voltou)).toBe(true)
    expect(porQueEssaUrgencia(voltou)).toBe('A equipe não encontrou o problema no local: confira antes de mandar de novo.')
    expect(equipeNaoEncontrou(oc({ status: 'aberta', eventos: [ev('nao_encontrada'), ev('revisada')] }))).toBe(false)
  })
  it('faz a pergunta certa na conferência', () => {
    expect(perguntaDaConferencia(oc({ status: 'revisao', nivel: 5 }))).toBe('A triagem sugere: Crítico. Está certo?')
    expect(perguntaDaConferencia(oc({ status: 'a_classificar', nivel: null }))).toBe('A triagem não conseguiu avaliar. Qual a urgência?')
    expect(perguntaDaConferencia(oc({ status: 'revisao', nivel: 3, revisado_por: 'ana' }))).toBe('A urgência está como Urgente. Está certo?')
  })
})

describe('prazo e duração', () => {
  const base = { criado_em: '2026-11-02T10:00:00Z', prazo_ate: '2026-11-02T14:00:00Z' }
  it('avisa quando falta menos de um quarto do prazo e quando venceu', () => {
    expect(situacaoDoPrazo(oc(base), new Date('2026-11-02T11:00:00Z'))).toBe('no_prazo')
    expect(situacaoDoPrazo(oc(base), new Date('2026-11-02T13:30:00Z'))).toBe('perto')
    expect(situacaoDoPrazo(oc(base), new Date('2026-11-02T15:00:00Z'))).toBe('vencido')
    expect(situacaoDoPrazo(oc({ ...base, status: 'resolvida' }), new Date('2026-11-02T15:00:00Z'))).toBe('sem')
    expect(situacaoDoPrazo(oc({}), new Date())).toBe('sem')
  })
  it('escreve a duração na unidade que cabe', () => {
    expect(duracao(42)).toBe('42 min')
    expect(duracao(150)).toBe('2,5 h')
    expect(duracao(4320)).toBe('3,0 dias')
    expect(duracao(null)).toBe('sem dados')
  })
})

describe('resumoDoContexto', () => {
  it('conta cada fonte no singular e no plural', async () => {
    const { resumoDoContexto } = await import('./niveis')
    expect(resumoDoContexto(undefined)).toBe('')
    expect(resumoDoContexto({})).toBe('')
    expect(resumoDoContexto({ orientacoes: [1], casos: [1, 2, 3], ferramentas: [1] })).toBe(
      '1 orientação · 3 casos parecidos · 1 consulta da IA',
    )
    expect(resumoDoContexto({ orientacoes: [1, 2], ferramentas: [1, 2] })).toBe('2 orientações · 2 consultas da IA')
  })
})
