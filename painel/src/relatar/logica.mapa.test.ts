import { describe, expect, it } from 'vitest'
import {
  CENTRO_PADRAO,
  consultaServe,
  depoisDaConfirmacao,
  detalheDaTelemetria,
  diametroDaPrecisao,
  distanciaCurta,
  distanciaM,
  estreiaResolvido,
  escolherPerto,
  falaDoEnvio,
  gpsDaMemoria,
  guardarLeitura,
  interpolar,
  interpretarConfirmacao,
  ladoNaTela,
  lerAcompanhamento,
  lerConfig,
  lerPerto,
  lerRecentes,
  linhaDoPerto,
  marcoDoEnvio,
  mensagemDaConfirmacao,
  MODULOS_PADRAO,
  nomeCurto,
  passoDoBoneco,
  passosNaTela,
  pessoas,
  pinosDosRecentes,
  prazoEmPalavras,
  recenteAtualizado,
  rumoEntre,
} from './logica'
import type { Posicao, Proximo, Recente } from './logica'

const FUSO = 'America/Sao_Paulo'
const praca = { lat: -21.0756, lng: -47.0486 }
// Um grau de latitude tem cerca de 111 km: 0,00009 grau dá uns 10 m.
const aoNorte = (p: { lat: number; lng: number }, metros: number) => ({ ...p, lat: p.lat + metros / 111_195 })

describe('mapa ao vivo', () => {
  it('mede a distância e o rumo entre dois pontos', () => {
    expect(distanciaM(praca, praca)).toBe(0)
    expect(distanciaM(praca, aoNorte(praca, 30))).toBeCloseTo(30, 0)
    expect(rumoEntre(praca, aoNorte(praca, 30))).toBeCloseTo(0, 0)
    expect(rumoEntre(praca, { ...praca, lng: praca.lng + 0.001 })).toBeCloseTo(90, 0)
    expect(rumoEntre(praca, { ...praca, lng: praca.lng - 0.001 })).toBeCloseTo(270, 0)
    expect(rumoEntre(praca, aoNorte(praca, -30))).toBeCloseTo(180, 0)
  })

  it('interpola a posição entre duas leituras, sem passar das pontas', () => {
    const b = { lat: -21.0746, lng: -47.0476 }
    expect(interpolar(praca, b, 0)).toEqual(praca)
    expect(interpolar(praca, b, 1)).toEqual(b)
    expect(interpolar(praca, b, 0.5).lat).toBeCloseTo(-21.0751, 6)
    expect(interpolar(praca, b, 2)).toEqual(b)
    expect(interpolar(praca, b, -1)).toEqual(praca)
    expect(interpolar(praca, b, NaN)).toEqual(b)
  })

  it('anda quando a velocidade passa do limite e fica parado no tremor do GPS', () => {
    const a: Posicao = { ...praca, precisao: 9, em: 0 }
    // 8 m em 1 s: andando para o norte.
    const andou = passoDoBoneco(a, { ...aoNorte(praca, 8), precisao: 9, em: 1000 })
    expect(andou.andando).toBe(true)
    expect(andou.rumo).toBeCloseTo(0, 0)
    expect(andou.duracaoMs).toBe(1000)
    // 3 m com precisão de 9 m: tremor.
    expect(passoDoBoneco(a, { ...aoNorte(praca, 3), precisao: 9, em: 1000 }).andando).toBe(false)
    // 10 m em 60 s: devagar demais para ser passo.
    expect(passoDoBoneco(a, { ...aoNorte(praca, 10), precisao: 5, em: 60_000 }).andando).toBe(false)
    // A velocidade do GPS vale mais que a conta.
    expect(passoDoBoneco(a, { ...aoNorte(praca, 10), precisao: 5, em: 60_000, velocidade: 1.2 }).andando).toBe(true)
    expect(passoDoBoneco(a, { ...aoNorte(praca, 10), precisao: 5, em: 1000, velocidade: 0 }).andando).toBe(false)
    // Leitura fraca não faz o boneco andar sozinho, mesmo com velocidade e salto grande.
    expect(passoDoBoneco(a, { ...aoNorte(praca, 40), precisao: 60, em: 1000, velocidade: 1.2 }).andando).toBe(false)
    expect(passoDoBoneco(a, { ...aoNorte(praca, 40), precisao: 60, em: 1000 }).andando).toBe(false)
    // Sem leitura anterior não há passo; a animação fica entre 0,3 s e 1,5 s.
    expect(passoDoBoneco(null, a)).toEqual({ andando: false, rumo: null, duracaoMs: 0 })
    expect(passoDoBoneco(a, { ...aoNorte(praca, 20), precisao: 5, em: 9000 }).duracaoMs).toBe(1500)
    expect(passoDoBoneco(a, { ...aoNorte(praca, 20), precisao: 5, em: 100 }).duracaoMs).toBe(300)
  })

  it('o boneco vira para o lado do movimento na tela', () => {
    expect(ladoNaTela(90, 0, 'esquerda')).toBe('direita')
    expect(ladoNaTela(270, 0, 'direita')).toBe('esquerda')
    expect(ladoNaTela(45, 0, 'esquerda')).toBe('direita')
    // Quase reto para o norte ou para o sul: fica como estava.
    expect(ladoNaTela(2, 0, 'esquerda')).toBe('esquerda')
    expect(ladoNaTela(181, 0, 'direita')).toBe('direita')
    expect(ladoNaTela(null, 0, 'direita')).toBe('direita')
    // Mapa girado: o leste vira para baixo.
    expect(ladoNaTela(90, 90, 'esquerda')).toBe('esquerda')
  })

  it('desenha o círculo de precisão sem sumir nem cobrir a tela', () => {
    expect(diametroDaPrecisao(null, praca.lat, 17)).toBe(0)
    const d9 = diametroDaPrecisao(9, praca.lat, 17)
    expect(d9).toBeGreaterThanOrEqual(24)
    expect(diametroDaPrecisao(50, praca.lat, 17)).toBeGreaterThan(d9)
    expect(diametroDaPrecisao(5000, praca.lat, 17)).toBe(320)
  })

  it('uma leitura ruim no meio das boas não tira a localização por um minuto', () => {
    const boa: Posicao = { ...praca, precisao: 9, em: 1000 }
    const ruim: Posicao = { ...praca, precisao: 400, em: 5000 }
    let m = guardarLeitura({ atual: null, boa: null }, boa, 1000)
    expect(gpsDaMemoria(m)).toBe(boa)
    m = guardarLeitura(m, ruim, 5000)
    expect(m.atual).toBe(ruim)
    expect(gpsDaMemoria(m)).toBe(boa)
    m = guardarLeitura(m, { ...ruim, em: 70_000 }, 70_000)
    expect(m.boa).toBeNull()
    expect(gpsDaMemoria(m)?.precisao).toBe(400)
    expect(gpsDaMemoria({ atual: null, boa: null })).toBeNull()
  })

  it('fala o envio em porcentagem e anuncia de quarto em quarto', () => {
    expect(falaDoEnvio({ fase: 'enviando', fracao: 0.62 })).toBe('Enviando 62%')
    expect(falaDoEnvio({ fase: 'analisando' })).toBe('Enviando 100%')
    expect(marcoDoEnvio({ fase: 'enviando', fracao: 0.62 })).toBe('Enviando 50%')
    expect(marcoDoEnvio({ fase: 'enviando', fracao: 0.1 })).toBe('Enviando 0%')
    expect(marcoDoEnvio({ fase: 'preparando' })).toBe('Enviando')
  })
})

describe('relatos deste aparelho no mapa', () => {
  const novo: Recente = {
    protocolo: 'MOGI-2026-000123',
    nivel: 3,
    criado_em: '2026-11-12T17:30:00Z',
    chave: 'k',
    status: 'aberta',
    lat: -21.07,
    lng: -47.04,
    categoria: 'vias',
  }

  it('guarda lat e lng e aceita os antigos sem elas', () => {
    const antigo = { protocolo: 'MOGI-2026-000007', nivel: null, criado_em: '2026-11-01T10:00:00Z' }
    const lidos = lerRecentes(JSON.parse(JSON.stringify([novo, antigo, { ...antigo, protocolo: 'X', lat: 200, lng: 'a' }])))
    expect(lidos[0]).toEqual(novo)
    expect(lidos[1]).toMatchObject({ lat: null, lng: null, categoria: null })
    expect(lidos[2]).toMatchObject({ lat: null, lng: null })
  })

  it('só relato com lugar vira pino; o resto fica só na lista', () => {
    const antigo: Recente = { ...novo, protocolo: 'MOGI-1', lat: null, lng: null }
    expect(pinosDosRecentes([novo, antigo]).map((r) => r.protocolo)).toEqual(['MOGI-2026-000123'])
  })

  it('avisa do resolvido só na primeira vez, e lembra disso no aparelho', () => {
    expect(estreiaResolvido(novo, { status: 'resolvida' })).toBe(true)
    expect(estreiaResolvido({ ...novo, viuResolvido: true }, { status: 'resolvida' })).toBe(false)
    expect(estreiaResolvido(novo, { status: 'aberta' })).toBe(false)
    expect(lerRecentes([{ ...novo, viuResolvido: true }])[0].viuResolvido).toBe(true)
    expect(lerRecentes([{ ...novo, viuResolvido: 'sim' }])[0]).not.toHaveProperty('viuResolvido')
  })

  it('o acompanhamento atualiza a cor do pino', () => {
    expect(recenteAtualizado(novo, { nivel: 5, status: 'em_atendimento', categoria: '' })).toEqual({
      ...novo,
      nivel: 5,
      status: 'em_atendimento',
    })
  })
})

describe('configuração nova', () => {
  const cats = [{ id: 'vias', nome: 'Vias' }]

  it('lê o centro e os módulos', () => {
    const c = lerConfig({
      categorias: cats,
      centro: { lat: -21.08, lng: -47.05 },
      modulos: { video: true, perto: true, campo: true, voz: false },
      midia: { video: true },
    })
    expect(c.centro).toEqual({ lat: -21.08, lng: -47.05 })
    expect(c.modulos).toEqual({ video: true, perto: true, campo: true, voz: false, cadastro: false, recuperacao: false })
  })

  it('servidor antigo: centro de Itamogi, sem perto, voz ligada, vídeo só se a mídia deixar', () => {
    const c = lerConfig({ categorias: cats })
    expect(c.centro).toBe(CENTRO_PADRAO)
    expect(c.modulos).toEqual(MODULOS_PADRAO)
    expect(lerConfig({ categorias: cats, centro: { lat: 'x' } }).centro).toBe(CENTRO_PADRAO)
    expect(lerConfig({ categorias: cats, midia: { video: true } }).modulos.video).toBe(true)
    // Módulo de vídeo ligado sem vídeo na mídia não grava.
    expect(lerConfig({ categorias: cats, modulos: { video: true } }).modulos.video).toBe(false)
    expect(lerConfig({ categorias: cats, modulos: {} }).modulos.voz).toBe(true)
  })

  it('dá um nome de uma palavra para cada tipo', () => {
    expect(nomeCurto('vias')).toBe('Buraco')
    expect(nomeCurto('iluminacao', 'Iluminação e energia')).toBe('Luz')
    expect(nomeCurto('poda', 'Poda de árvores')).toBe('Poda')
    expect(nomeCurto('nada', '')).toBe('Outro')
  })
})

describe('perto de você', () => {
  const item = (distancia_m: number, relatos = 3): Proximo => ({
    ref: `r${distancia_m}`,
    categoria: 'vias',
    categoria_nome: 'Vias e buracos',
    distancia_m,
    desde: '2026-11-15T02:00:00Z',
    relatos,
    status: 'aberta',
  })

  it('lê a lista e descarta o que não tem formato', () => {
    expect(lerPerto('x')).toEqual([])
    expect(lerPerto([item(30), { ref: '' }, null, { ...item(10), relatos: 0 }])).toEqual([item(30), item(10, 1)])
  })

  it('mostra só o mais perto, e só até 80 m', () => {
    expect(escolherPerto([item(70), item(30), item(50)])?.ref).toBe('r30')
    expect(escolherPerto([item(90), item(120)])).toBeNull()
    expect(escolherPerto([item(80)])?.ref).toBe('r80')
    expect(escolherPerto([])).toBeNull()
  })

  it('escreve o cartão curto', () => {
    expect(linhaDoPerto(item(30))).toBe('Buraco · a 30 m · 3 pessoas')
    expect(linhaDoPerto(item(4, 1))).toBe('Buraco · a 10 m · 1 pessoa')
    expect(distanciaCurta(1240)).toBe('a 1,2 km')
    expect(pessoas(2)).toBe('2 pessoas')
  })

  it('reaproveita a consulta se a pessoa andou pouco e faz pouco tempo', () => {
    const c = { ...praca, em: 0, itens: [] }
    expect(consultaServe(c, praca, 30_000)).toBe(true)
    expect(consultaServe(c, aoNorte(praca, 40), 30_000)).toBe(false)
    expect(consultaServe(c, praca, 61_000)).toBe(false)
    expect(consultaServe(null, praca, 0)).toBe(false)
  })

  it('interpreta a confirmação e diz o que fazer depois', () => {
    const recibo = interpretarConfirmacao(201, { protocolo: 'MOGI-2026-000009', chave: 'k', relatos: 4, agrupada: true })
    expect(recibo).toMatchObject({ resposta: { protocolo: 'MOGI-2026-000009', relatos: 4 } })
    expect(interpretarConfirmacao(409, { codigo: 'ja_confirmou' })).toEqual({ codigo: 'ja_confirmou' })
    expect(interpretarConfirmacao(422, null)).toEqual({ codigo: 'longe_demais' })
    expect(interpretarConfirmacao(400, { codigo: 'ref_invalida' })).toEqual({ codigo: 'ref_invalida' })
    expect(interpretarConfirmacao(201, {})).toEqual({ codigo: 'desconhecido' })
    expect(interpretarConfirmacao(500, null)).toEqual({ codigo: 'desconhecido' })
    expect(depoisDaConfirmacao('ja_confirmou')).toBe('avisar')
    expect(depoisDaConfirmacao('longe_demais')).toBe('camera')
    expect(depoisDaConfirmacao('ref_invalida')).toBe('camera')
    expect(depoisDaConfirmacao('sem_conexao')).toBe('tentar')
    for (const c of ['ja_confirmou', 'muitos_envios', 'sem_conexao', 'desconhecido'] as const) {
      expect(mensagemDaConfirmacao(c)).toMatch(/\.$/)
      expect(mensagemDaConfirmacao(c)).not.toMatch(/[\u2013\u2014]/)
    }
  })
})

describe('acompanhamento', () => {
  const corpo = {
    protocolo: 'MOGI-2026-000123',
    categoria: 'vias',
    categoria_nome: 'Vias e buracos',
    status: 'em_atendimento',
    nivel: 3,
    prazo_ate: '2026-11-16T21:00:00Z',
    relatos: 2,
    enviado_em: '2026-11-15T13:00:00Z',
    passos: [
      { tipo: 'recebido', feito: true, quando: '2026-11-15T13:00:00Z' },
      { tipo: 'conferido', feito: true, quando: '2026-11-15T13:20:00Z' },
      { tipo: 'a_caminho', feito: false, quando: null },
      { tipo: 'resolvido', feito: false, quando: null },
    ],
  }

  it('lê os quatro passos, na ordem, com a hora dos feitos', () => {
    const a = lerAcompanhamento(corpo)
    expect(a?.passos.map((p) => p.tipo)).toEqual(['recebido', 'conferido', 'a_caminho', 'resolvido'])
    const tela = passosNaTela(a!, FUSO)
    expect(tela.map((p) => p.rotulo)).toEqual(['Recebido', 'Prefeitura conferiu', 'Equipe a caminho', 'Resolvido'])
    expect(tela[0].quando).toBe('15/11 às 10:00')
    expect(tela[1].quando).toBe('15/11 às 10:20')
    expect(tela[2]).toMatchObject({ feito: false, quando: '', agora: true })
    expect(tela[3].agora).toBe(false)
  })

  it('completa o que faltar e recusa o que não serve', () => {
    expect(lerAcompanhamento(null)).toBeNull()
    expect(lerAcompanhamento({ status: 'aberta' })).toBeNull()
    const a = lerAcompanhamento({ protocolo: 'MOGI-1', passos: 'x', fotos_do_depois: ['/api/midia?a', 3] })
    expect(a?.passos.map((p) => p.feito)).toEqual([true, false, false, false])
    expect(a?.fotos_do_depois).toEqual(['/api/midia?a'])
    expect(a?.o_que_foi_feito).toBeNull()
  })

  it('diz o prazo em palavras', () => {
    const agora = new Date('2026-11-15T14:00:00Z')
    expect(prazoEmPalavras('2026-11-15T21:00:00Z', 'aberta', agora, FUSO)).toBe('Até hoje, 18:00')
    expect(prazoEmPalavras('2026-11-16T12:00:00Z', 'aberta', agora, FUSO)).toBe('Até amanhã, 09:00')
    expect(prazoEmPalavras('2026-11-20T12:00:00Z', 'aberta', agora, FUSO)).toBe('Até sexta-feira')
    expect(prazoEmPalavras('2026-11-28T12:00:00Z', 'aberta', agora, FUSO)).toBe('Até 28/11')
    expect(prazoEmPalavras('2026-11-14T12:00:00Z', 'aberta', agora, FUSO)).toBe('Prazo vencido')
    expect(prazoEmPalavras(null, 'aberta', agora, FUSO)).toBe('Na rotina da equipe')
    expect(prazoEmPalavras('2026-11-16T12:00:00Z', 'resolvida', agora, FUSO)).toBeNull()
  })
})

describe('telemetria', () => {
  it('manda só um detalhe curto e limpo', () => {
    expect(detalheDaTelemetria('NotAllowedError')).toBe('NotAllowedError')
    expect(detalheDaTelemetria(new DOMException('x', 'NotReadableError'))).toBe('NotReadableError')
    expect(detalheDaTelemetria('a'.repeat(100))).toHaveLength(60)
    expect(detalheDaTelemetria('<b>"oi"</b>')).toBe('boi/b')
    expect(detalheDaTelemetria(undefined)).toBe('')
  })
})
