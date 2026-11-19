import { describe, expect, it } from 'vitest'
import type { Evento, EventoAoVivo, Midia, Ocorrencia } from '../tipos'
import {
  aplicarEvento,
  codigoDaFalha,
  comResposta,
  contagemParaAtender,
  distanciaAte,
  distanciaM,
  esperaDeReconexao,
  feitosHoje,
  formatarDistancia,
  fotosDoChamado,
  horaFalada,
  juntar,
  lerAppDeRota,
  lerRota,
  linksDeRota,
  mensagemDaFalha,
  MOTIVOS_NAO_ENCONTREI,
  mudouDeLugar,
  NA_LISTA,
  nomeDaCategoria,
  ondeFica,
  oQueFoiFeito,
  ordenar,
  ordenarPorDistancia,
  ordenarPorUrgencia,
  prazoEmPalavras,
  quantasPessoas,
  recadoDaCentral,
  respostasRapidas,
  rotaAcima,
  rotuloDeConcluir,
  rotuloDeFotos,
  simboloDaCategoria,
  urgenciaEmPalavras,
} from './logica'

function chamado(parcial: Partial<Ocorrencia> = {}): Ocorrencia {
  return {
    id: 'a',
    protocolo: 'MOGI-2026-000001',
    categoria: 'vias',
    secretaria: 'Obras e vias',
    texto: null,
    lat: -21.0756,
    lng: -47.0486,
    precisao_m: null,
    h3: null,
    endereco: null,
    bairro: null,
    status: 'em_atendimento',
    nivel: 3,
    nivel_ia: 3,
    relatos: 1,
    triagem: null,
    prazo_ate: null,
    prazo_fonte: null,
    revisado_por: null,
    revisado_em: null,
    despachado_por: null,
    despachado_em: null,
    resolvido_por: null,
    resolvido_em: null,
    custo_brl: 0,
    latencia_ms: null,
    demo: false,
    criado_em: '2026-11-15T10:00:00Z',
    atualizado_em: '2026-11-15T10:00:00Z',
    ...parcial,
  }
}

// Datas montadas no fuso do aparelho, para o teste valer em qualquer fuso.
const em = (dia: number, hora: number, minuto = 0) => new Date(2026, 10, dia, hora, minuto)
const iso = (dia: number, hora: number, minuto = 0) => em(dia, hora, minuto).toISOString()

const PRACA = { lat: -21.0756, lng: -47.0486 }

describe('distância', () => {
  it('é zero no mesmo ponto', () => {
    expect(distanciaM(PRACA, PRACA)).toBe(0)
  })

  it('um grau de latitude dá perto de 111 km', () => {
    const d = distanciaM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })

  it('é a mesma nos dois sentidos', () => {
    const b = { lat: -21.08, lng: -47.04 }
    expect(distanciaM(PRACA, b)).toBeCloseTo(distanciaM(b, PRACA), 6)
  })

  it('mede algumas quadras em Itamogi', () => {
    // 0,003 grau de latitude: cerca de 334 m.
    const d = distanciaM(PRACA, { lat: PRACA.lat + 0.003, lng: PRACA.lng })
    expect(Math.round(d)).toBe(334)
  })

  it('escreve metros de 10 em 10 e quilômetros com vírgula', () => {
    expect(formatarDistancia(352)).toBe('a 350 m')
    expect(formatarDistancia(4)).toBe('a 10 m')
    expect(formatarDistancia(994)).toBe('a 990 m')
    expect(formatarDistancia(997)).toBe('a 1,0 km')
    expect(formatarDistancia(2140)).toBe('a 2,1 km')
    expect(formatarDistancia(9960)).toBe('a 10 km')
    expect(formatarDistancia(12_400)).toBe('a 12 km')
  })

  it('não escreve nada para valor sem sentido', () => {
    expect(formatarDistancia(Number.NaN)).toBe('')
    expect(formatarDistancia(-5)).toBe('')
  })

  it('sem localização não há distância', () => {
    expect(distanciaAte(PRACA, null)).toBeNull()
    expect(distanciaAte({ lat: PRACA.lat + 0.003, lng: PRACA.lng }, PRACA)).toBe('a 330 m')
  })

  it('ignora a oscilação do GPS parado', () => {
    expect(mudouDeLugar(null, PRACA)).toBe(true)
    expect(mudouDeLugar(PRACA, { lat: PRACA.lat + 0.00005, lng: PRACA.lng })).toBe(false)
    expect(mudouDeLugar(PRACA, { lat: PRACA.lat + 0.0005, lng: PRACA.lng })).toBe(true)
  })
})

describe('prazo em palavras', () => {
  const agora = em(15, 14, 30)

  it('sem prazo', () => {
    expect(prazoEmPalavras(null, agora)).toEqual({ texto: 'sem prazo', atrasado: false })
    expect(prazoEmPalavras('data torta', agora)).toEqual({ texto: 'sem prazo', atrasado: false })
  })

  it('hoje, com e sem minutos', () => {
    expect(prazoEmPalavras(iso(15, 18), agora).texto).toBe('até hoje às 18h')
    expect(prazoEmPalavras(iso(15, 18, 30), agora).texto).toBe('até hoje às 18h30')
    expect(prazoEmPalavras(iso(15, 18, 5), agora).texto).toBe('até hoje às 18h05')
  })

  it('amanhã, mesmo faltando menos de 24 horas', () => {
    expect(prazoEmPalavras(iso(16, 9), agora).texto).toBe('até amanhã às 9h')
    expect(prazoEmPalavras(iso(16, 0, 10), em(15, 23, 50)).texto).toBe('até amanhã às 0h10')
  })

  it('mais longe vira data', () => {
    expect(prazoEmPalavras(iso(20, 9), agora).texto).toBe('até 20/11')
    expect(prazoEmPalavras(new Date(2027, 0, 5, 9).toISOString(), agora).texto).toBe('até 05/01')
  })

  it('atrasado em minutos, horas e dias', () => {
    expect(prazoEmPalavras(iso(15, 14, 29, ), agora)).toEqual({ texto: 'atrasado há 1 min', atrasado: true })
    expect(prazoEmPalavras(iso(15, 13, 50), agora).texto).toBe('atrasado há 40 min')
    expect(prazoEmPalavras(iso(15, 12, 0), agora).texto).toBe('atrasado há 2 h')
    expect(prazoEmPalavras(iso(14, 15, 0), agora).texto).toBe('atrasado há 23 h')
    expect(prazoEmPalavras(iso(14, 14, 0), agora).texto).toBe('atrasado há 1 dia')
    expect(prazoEmPalavras(iso(12, 10, 0), agora).texto).toBe('atrasado há 3 dias')
  })

  it('prazo que acabou de vencer conta como atrasado', () => {
    expect(prazoEmPalavras(new Date(agora.getTime() - 1000).toISOString(), agora).atrasado).toBe(true)
  })

  it('fala a hora como a gente fala', () => {
    expect(horaFalada(em(15, 9))).toBe('9h')
    expect(horaFalada(em(15, 9, 7))).toBe('9h07')
  })
})

describe('ordem da lista', () => {
  const a = chamado({ id: 'a', nivel: 3, prazo_ate: iso(16, 9), lat: PRACA.lat + 0.001 })
  const b = chamado({ id: 'b', nivel: 5, prazo_ate: iso(15, 18), lat: PRACA.lat + 0.02 })
  const c = chamado({ id: 'c', nivel: 3, prazo_ate: iso(15, 12), lat: PRACA.lat + 0.004 })
  const d = chamado({ id: 'd', nivel: 3, prazo_ate: null, lat: PRACA.lat + 0.0101, criado_em: '2026-11-10T10:00:00Z' })
  const e = chamado({ id: 'e', nivel: null, lat: PRACA.lat + 0.01 })
  const ids = (l: Ocorrencia[]) => l.map((o) => o.id).join('')

  it('por urgência: nível maior, depois prazo mais curto, sem prazo por último', () => {
    expect(ids(ordenarPorUrgencia([a, b, c, d, e]))).toBe('bcade')
  })

  it('no empate total vale o mais antigo', () => {
    const velho = chamado({ id: 'v', criado_em: '2026-11-01T10:00:00Z' })
    const novo = chamado({ id: 'n', criado_em: '2026-11-14T10:00:00Z' })
    expect(ids(ordenarPorUrgencia([novo, velho]))).toBe('vn')
  })

  it('por distância: o mais perto primeiro', () => {
    expect(ids(ordenarPorDistancia([a, b, c, d, e], PRACA))).toBe('acedb')
  })

  it('na mesma distância vale a urgência', () => {
    const calmo = chamado({ id: 'x', nivel: 2 })
    const grave = chamado({ id: 'y', nivel: 5 })
    expect(ids(ordenarPorDistancia([calmo, grave], PRACA))).toBe('yx')
  })

  it('não mexe na lista original', () => {
    const lista = [a, b, c]
    ordenarPorUrgencia(lista)
    ordenarPorDistancia(lista, PRACA)
    expect(ids(lista)).toBe('abc')
  })

  it('"mais perto" sem localização cai na urgência', () => {
    expect(ids(ordenar([a, b, c], 'perto', null))).toBe('bca')
    expect(ids(ordenar([a, b, c], 'perto', PRACA))).toBe('acb')
    expect(ids(ordenar([a, b, c], 'urgencia', PRACA))).toBe('bca')
  })
})

describe('o que aparece no cartão', () => {
  it('nome e símbolo da categoria, com reserva para a desconhecida', () => {
    expect(nomeDaCategoria('vias')).toBe('Vias e buracos')
    expect(simboloDaCategoria('iluminacao')).toBe('💡')
    expect(nomeDaCategoria('nova_categoria')).toBe('Outros')
    expect(simboloDaCategoria('nova_categoria')).toBe('❗')
  })

  it('urgência em palavras', () => {
    expect(urgenciaEmPalavras(4)).toBe('Muito urgente')
    expect(urgenciaEmPalavras(5)).toBe('Crítico')
    expect(urgenciaEmPalavras(null)).toBe('Sem urgência definida')
  })

  it('endereço, senão bairro, senão o mapa', () => {
    expect(ondeFica({ endereco: 'Rua Sete, 120', bairro: 'Centro' })).toBe('Rua Sete, 120')
    expect(ondeFica({ endereco: '  ', bairro: 'Centro' })).toBe('Centro')
    expect(ondeFica({ endereco: null, bairro: null })).toBe('Ver no mapa')
  })

  it('só fala de pessoas quando foi mais de uma', () => {
    expect(quantasPessoas(1)).toBeNull()
    expect(quantasPessoas(3)).toBe('3 pessoas relataram')
  })

  it('conta o que falta atender', () => {
    expect(contagemParaAtender(0)).toBe('Nada para atender')
    expect(contagemParaAtender(4)).toBe('4 para atender')
  })
})

describe('respostas rápidas', () => {
  it('mudam com a categoria e sempre trazem a genérica', () => {
    expect(respostasRapidas('vias')).toEqual(['Buraco tapado', 'Sinalizado, volta depois', 'Via liberada', 'Serviço feito'])
    expect(respostasRapidas('iluminacao')).toContain('Lâmpada trocada')
    expect(respostasRapidas('iluminacao')).toContain('Fiação refeita')
    expect(respostasRapidas('limpeza')).toEqual(expect.arrayContaining(['Lixo recolhido', 'Entulho removido']))
    expect(respostasRapidas('agua')).toContain('Vazamento consertado')
  })

  it('categoria sem lista própria fica só com a genérica', () => {
    expect(respostasRapidas('outros')).toEqual(['Serviço feito'])
    expect(respostasRapidas('nova_categoria')).toEqual(['Serviço feito'])
  })

  it('nenhuma categoria passa de 4 respostas', () => {
    for (const c of ['vias', 'calcadas', 'iluminacao', 'limpeza', 'agua', 'arvores', 'sinalizacao', 'animais', 'outros']) {
      expect(respostasRapidas(c).length).toBeLessThanOrEqual(4)
    }
  })

  it('preenche o texto vazio e troca uma resposta pronta por outra', () => {
    const prontas = respostasRapidas('vias')
    expect(comResposta('', 'Buraco tapado', prontas)).toBe('Buraco tapado')
    expect(comResposta('Buraco tapado', 'Via liberada', prontas)).toBe('Via liberada')
  })

  it('acrescenta ao que a pessoa escreveu, sem repetir', () => {
    const prontas = respostasRapidas('vias')
    expect(comResposta('Usamos 2 sacos de massa.', 'Buraco tapado', prontas)).toBe('Usamos 2 sacos de massa. Buraco tapado')
    expect(comResposta('buraco tapado com massa', 'Buraco tapado', prontas)).toBe('buraco tapado com massa')
  })

  it('não passa do limite do servidor', () => {
    expect(comResposta('x'.repeat(295), 'Buraco tapado', []).length).toBe(300)
  })

  it('motivos de quem não encontrou', () => {
    expect(MOTIVOS_NAO_ENCONTREI).toEqual(['Já estava consertado', 'Não achei o endereço', 'O problema é outro'])
  })
})

describe('rota', () => {
  it('monta os links do Waze e do Google Maps', () => {
    const l = linksDeRota({ lat: -21.0756, lng: -47.0486 })
    expect(l.waze).toBe('https://waze.com/ul?ll=-21.0756,-47.0486&navigate=yes')
    expect(l.google).toBe('https://www.google.com/maps/dir/?api=1&destination=-21.0756,-47.0486&travelmode=driving')
  })

  it('só aceita app conhecido como preferência', () => {
    expect(lerAppDeRota('waze')).toBe('waze')
    expect(lerAppDeRota('google')).toBe('google')
    expect(lerAppDeRota('outro')).toBeNull()
    expect(lerAppDeRota(null)).toBeNull()
  })
})

describe('feitos hoje', () => {
  const agora = em(15, 16)

  it('fica só com os resolvidos de hoje, o mais recente primeiro', () => {
    const lista = [
      chamado({ id: 'cedo', status: 'resolvida', resolvido_em: iso(15, 8) }),
      chamado({ id: 'ontem', status: 'resolvida', resolvido_em: iso(14, 23, 59) }),
      chamado({ id: 'tarde', status: 'resolvida', resolvido_em: iso(15, 15, 30) }),
      chamado({ id: 'aberto', status: 'em_atendimento', resolvido_em: null }),
      chamado({ id: 'sem-data', status: 'resolvida', resolvido_em: null }),
    ]
    expect(feitosHoje(lista, agora).map((o) => o.id)).toEqual(['tarde', 'cedo'])
  })

  it('a meia-noite separa os dias', () => {
    const lista = [chamado({ id: 'a', status: 'resolvida', resolvido_em: iso(15, 0, 0) })]
    expect(feitosHoje(lista, agora)).toHaveLength(1)
    expect(feitosHoje(lista, em(16, 0, 1))).toHaveLength(0)
  })
})

describe('eventos do chamado', () => {
  const evento = (tipo: string, dados: Record<string, unknown>, criado_em: string): Evento => ({ tipo, autor: 'operador', dados, criado_em })

  it('tira o recado da central do despacho', () => {
    const eventos = [
      evento('criada', {}, '2026-11-15T10:00:00Z'),
      evento('despachada', { observacao: ' levar massa asfáltica ' }, '2026-11-15T11:00:00Z'),
    ]
    expect(recadoDaCentral(eventos)).toBe('levar massa asfáltica')
  })

  it('sem observação, sem despacho ou sem eventos não há recado', () => {
    expect(recadoDaCentral([evento('despachada', {}, '2026-11-15T11:00:00Z')])).toBeNull()
    expect(recadoDaCentral([evento('despachada', { observacao: '   ' }, '2026-11-15T11:00:00Z')])).toBeNull()
    expect(recadoDaCentral([evento('despachada', { observacao: 7 }, '2026-11-15T11:00:00Z')])).toBeNull()
    expect(recadoDaCentral([evento('revisada', { observacao: 'não é recado' }, '2026-11-15T11:00:00Z')])).toBeNull()
    expect(recadoDaCentral([])).toBeNull()
    expect(recadoDaCentral(undefined)).toBeNull()
  })

  it('chamado despachado de novo vale o recado mais novo, em qualquer ordem da lista', () => {
    const velho = evento('despachada', { observacao: 'levar cone' }, '2026-11-14T09:00:00Z')
    const novo = evento('despachada', { observacao: 'levar massa' }, '2026-11-15T09:00:00Z')
    expect(recadoDaCentral([velho, novo])).toBe('levar massa')
    expect(recadoDaCentral([novo, velho])).toBe('levar massa')
  })

  it('despacho novo sem recado apaga o recado antigo', () => {
    const velho = evento('despachada', { observacao: 'levar cone' }, '2026-11-14T09:00:00Z')
    const novo = evento('despachada', {}, '2026-11-15T09:00:00Z')
    expect(recadoDaCentral([velho, novo])).toBeNull()
  })

  it('lê o que a equipe escreveu ao concluir', () => {
    expect(oQueFoiFeito([evento('resolvida', { motivo: 'Buraco tapado' }, '2026-11-15T12:00:00Z')])).toBe('Buraco tapado')
    expect(oQueFoiFeito([evento('resolvida', {}, '2026-11-15T12:00:00Z')])).toBeNull()
  })
})

describe('fotos do chamado', () => {
  const midia = (tipo: Midia['tipo'], ordem: number, url?: string): Midia => ({
    id: `${tipo}-${ordem}`,
    relato_id: tipo === 'depois' ? null : 'r1',
    tipo,
    mime: tipo === 'video' ? 'video/mp4' : 'image/jpeg',
    ordem,
    largura: null,
    altura: null,
    duracao_ms: null,
    criado_em: '2026-11-15T10:00:00Z',
    url,
    disponivel: true,
  })

  it('separa o antes do depois e avisa do vídeo, que não tem link', () => {
    const f = fotosDoChamado({
      midias: [midia('quadro', 2, '/q.jpg'), midia('foto', 0, '/a.jpg'), midia('video', 1), midia('depois', 0, '/d.jpg')],
      midia_url: '/a.jpg',
    })
    expect(f).toEqual({ antes: ['/a.jpg', '/q.jpg'], depois: ['/d.jpg'], temVideo: true })
  })

  it('sem o detalhe, vale a foto da lista', () => {
    expect(fotosDoChamado({ midia_url: '/capa.jpg' })).toEqual({ antes: ['/capa.jpg'], depois: [], temVideo: false })
    expect(fotosDoChamado({})).toEqual({ antes: [], depois: [], temVideo: false })
  })
})

describe('tempo real sobre a lista', () => {
  const atualizada = (o: Ocorrencia): EventoAoVivo => ({ tipo: 'OcorrenciaAtualizada', ocorrencia: o })
  const a = chamado({ id: 'a', midia_url: '/a.jpg' })
  const b = chamado({ id: 'b' })

  it('chamado despachado para a equipe entra', () => {
    const lista = aplicarEvento([a], atualizada(b))
    expect(lista.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('chamado que já estava é atualizado no lugar e guarda a foto', () => {
    const lista = aplicarEvento([a, b], atualizada(chamado({ id: 'a', nivel: 5 })))
    expect(lista.map((o) => o.id)).toEqual(['a', 'b'])
    expect(lista[0].nivel).toBe(5)
    expect(lista[0].midia_url).toBe('/a.jpg')
  })

  it('link novo da foto substitui o antigo', () => {
    const lista = aplicarEvento([a], atualizada(chamado({ id: 'a', midia_url: '/nova.jpg' })))
    expect(lista[0].midia_url).toBe('/nova.jpg')
  })

  it('chamado que mudou de situação sai', () => {
    expect(aplicarEvento([a, b], atualizada(chamado({ id: 'a', status: 'resolvida' }))).map((o) => o.id)).toEqual(['b'])
    expect(aplicarEvento([a, b], atualizada(chamado({ id: 'b', status: 'revisao' }))).map((o) => o.id)).toEqual(['a'])
  })

  it('o que não muda a lista devolve a mesma lista', () => {
    const lista = [a]
    expect(aplicarEvento(lista, { tipo: 'Conectado' })).toBe(lista)
    expect(aplicarEvento(lista, { tipo: 'Ressincronizar' })).toBe(lista)
    expect(aplicarEvento(lista, { tipo: 'OcorrenciaAtualizada' })).toBe(lista)
    expect(aplicarEvento(lista, atualizada(chamado({ id: 'z', status: 'aberta' })))).toBe(lista)
  })

  it('chamado criado só entra se já nasceu com a equipe', () => {
    expect(aplicarEvento([a], { tipo: 'OcorrenciaCriada', ocorrencia: chamado({ id: 'n', status: 'a_classificar' }) })).toHaveLength(1)
    expect(aplicarEvento([a], { tipo: 'OcorrenciaCriada', ocorrencia: chamado({ id: 'n' }) })).toHaveLength(2)
  })

  it('a lista de feitos usa a mesma regra com outro status', () => {
    const feito = chamado({ id: 'a', status: 'resolvida', resolvido_em: '2026-11-15T12:00:00Z' })
    expect(aplicarEvento([], atualizada(feito), 'resolvida')).toEqual([feito])
    // Reaberto e despachado de novo: sai dos feitos.
    expect(aplicarEvento([feito], atualizada(a), 'resolvida')).toEqual([])
  })

  it('não altera a lista recebida', () => {
    const lista = [a, b]
    aplicarEvento(lista, atualizada(chamado({ id: 'a', status: 'resolvida' })))
    expect(lista).toHaveLength(2)
  })
})

describe('resumo junto com o detalhe', () => {
  const eventos: Evento[] = [{ tipo: 'despachada', autor: 'operador', dados: { observacao: 'levar cone' }, criado_em: '2026-11-15T10:00:00Z' }]

  it('fica com as fotos e os eventos do detalhe', () => {
    const resumo = chamado({ midia_url: '/velha.jpg' })
    const detalhe = chamado({ midia_url: '/nova.jpg', midias: [], eventos })
    const o = juntar(resumo, detalhe)
    expect(o?.midia_url).toBe('/nova.jpg')
    expect(o?.eventos).toBe(eventos)
  })

  it('o que mudou depois do detalhe vale mais', () => {
    const detalhe = chamado({ status: 'em_atendimento', atualizado_em: '2026-11-15T10:00:00Z', eventos })
    const resumo = chamado({ status: 'resolvida', atualizado_em: '2026-11-15T10:05:00.5Z' })
    expect(juntar(resumo, detalhe)?.status).toBe('resolvida')
  })

  it('detalhe mais novo que a lista vale mais', () => {
    const resumo = chamado({ nivel: 3, atualizado_em: '2026-11-15T10:00:00Z' })
    const detalhe = chamado({ nivel: 5, atualizado_em: '2026-11-15T10:05:00Z' })
    expect(juntar(resumo, detalhe)?.nivel).toBe(5)
  })

  it('funciona só com um dos dois e ignora detalhe de outro chamado', () => {
    const resumo = chamado({ id: 'a' })
    expect(juntar(resumo, null)).toBe(resumo)
    expect(juntar(null, resumo)).toBe(resumo)
    expect(juntar(null, null)).toBeNull()
    expect(juntar(resumo, chamado({ id: 'outro', nivel: 5 }))).toBe(resumo)
  })
})

describe('falhas', () => {
  it('traduz o status e o código do servidor', () => {
    expect(codigoDaFalha(0)).toBe('sem_rede')
    expect(codigoDaFalha(401)).toBe('sessao')
    expect(codigoDaFalha(404)).toBe('nao_e_da_equipe')
    expect(codigoDaFalha(409)).toBe('ja_resolvido')
    expect(codigoDaFalha(429, 'muitos_envios')).toBe('muitos_envios')
    expect(codigoDaFalha(400, 'foto_formato')).toBe('foto_formato')
    expect(codigoDaFalha(400, 'foto_grande')).toBe('foto_grande')
    expect(codigoDaFalha(400, 'fotos_demais')).toBe('fotos_demais')
    expect(codigoDaFalha(413)).toBe('foto_grande')
    expect(codigoDaFalha(500)).toBe('servidor')
    expect(codigoDaFalha(400, 'codigo_novo')).toBe('servidor')
  })

  it('a queda de rede com fotos avisa que elas continuam ali', () => {
    expect(mensagemDaFalha('sem_rede', true)).toBe('Sem internet. Suas fotos continuam aqui: toque em Tentar de novo.')
    expect(mensagemDaFalha('sem_rede')).toContain('Tentar de novo')
  })

  it('as mensagens da tela', () => {
    expect(mensagemDaFalha('ja_resolvido')).toBe('Este chamado já foi concluído por outra pessoa.')
    expect(mensagemDaFalha('sessao')).toBe('Sua sessão expirou. Entre de novo.')
  })

  it('nenhuma mensagem usa travessão nem termo interno', () => {
    const codigos = ['sem_rede', 'sessao', 'ja_resolvido', 'nao_e_da_equipe', 'foto_formato', 'foto_grande', 'fotos_demais', 'muitos_envios', 'servidor'] as const
    for (const c of codigos) {
      const m = mensagemDaFalha(c, true) + mensagemDaFalha(c)
      expect(m).not.toMatch(/[\u2013\u2014]/)
      expect(m.toLowerCase()).not.toMatch(/gut|triagem|status|http|token/)
    }
  })
})

describe('rótulos do passo de concluir', () => {
  it('o botão final muda com as fotos e com a falha', () => {
    expect(rotuloDeConcluir(2, false)).toBe('Concluir chamado')
    expect(rotuloDeConcluir(0, false)).toBe('Concluir sem foto')
    expect(rotuloDeConcluir(0, true)).toBe('Tentar de novo')
    expect(rotuloDeConcluir(3, true)).toBe('Tentar de novo')
  })

  it('o botão da câmera acompanha a contagem', () => {
    expect(rotuloDeFotos(0)).toBe('Tirar foto')
    expect(rotuloDeFotos(1)).toBe('Tirar outra foto')
    expect(rotuloDeFotos(3)).toBe('Já tem 3 fotos')
  })
})

describe('navegação pelo histórico', () => {
  it('estado vazio ou estranho é a lista', () => {
    expect(lerRota(null)).toBe(NA_LISTA)
    expect(lerRota('texto')).toBe(NA_LISTA)
    expect(lerRota({ passo: 'concluir' })).toBe(NA_LISTA)
    expect(lerRota({ chamado: '' })).toBe(NA_LISTA)
  })

  it('lê o chamado, o passo e a foto', () => {
    expect(lerRota({ chamado: 'abc', n: 1 })).toEqual({ chamado: 'abc', n: 1 })
    expect(lerRota({ chamado: 'abc', passo: 'concluir', n: 2 })).toEqual({ chamado: 'abc', passo: 'concluir', n: 2 })
    expect(lerRota({ chamado: 'abc', foto: 1, n: 2 })).toEqual({ chamado: 'abc', foto: 1, n: 2 })
  })

  it('descarta passo desconhecido e conserta a contagem', () => {
    expect(lerRota({ chamado: 'abc', passo: 'apagar', foto: -1, n: 0 })).toEqual({ chamado: 'abc', n: 1 })
  })

  it('um passo para trás', () => {
    expect(rotaAcima({ chamado: 'abc', passo: 'concluir', n: 2 })).toEqual({ chamado: 'abc', n: 1 })
    expect(rotaAcima({ chamado: 'abc', foto: 0, n: 2 })).toEqual({ chamado: 'abc', n: 1 })
    expect(rotaAcima({ chamado: 'abc', n: 1 })).toBe(NA_LISTA)
  })
})

describe('reconexão do tempo real', () => {
  it('a espera cresce e para em 30 segundos', () => {
    expect(esperaDeReconexao(0, 0.5)).toBe(1000)
    expect(esperaDeReconexao(1, 0.5)).toBe(2000)
    expect(esperaDeReconexao(3, 0.5)).toBe(8000)
    expect(esperaDeReconexao(10, 0.5)).toBe(30_000)
  })

  it('varia até 30% para os aparelhos não voltarem juntos', () => {
    expect(esperaDeReconexao(0, 0)).toBe(700)
    expect(esperaDeReconexao(0, 1)).toBe(1300)
  })
})
