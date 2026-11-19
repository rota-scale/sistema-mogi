import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { CADASTRO_PELO_WEB, enderecoDaApi, enderecoDoAppWeb, partesDoRelato, tipoDoVideo } from './corpo'
import { cabeNaFila, destinoNaFila, entrarNaFila, lerFila, MAX_FILA, podeEsperarInternet, sairDaFila, textoDaFila } from './fila'
import type { ItemDaFila } from './fila'
import { avisoCurtoDoLocal, saidasDoLocal } from './local'
import { dataHoraSemIntl, fraseCurta, idadeEmPalavras, passos, prazo, prazoSemIntl } from './palavras'
import { aposConsulta, lerRelatos, MAX_RELATOS, mesclarRelatos } from './relatos'
import { pode, SONS, toqueDoSom } from './sons'
import type { Som } from './sons'
import * as web from './web'

const CONFIG_REAL = {
  cidade: 'Itamogi-MG',
  ia_ativa: true,
  categorias: [{ id: 'vias', nome: 'Vias e buracos' }],
  centro: { lat: -21.0793, lng: -47.0486 },
  modulos: { video: true, perto: true, campo: true, voz: true },
  midia: { fotos_max: 4, foto_mb: 12, video: true, video_segundos: 15, video_mb: 25, quadros_max: 3 },
}

const RECIBO = {
  protocolo: 'MOGI-2026-000120',
  chave: 'abc',
  status: 'aberta',
  nivel: 3,
  categoria: 'vias',
  secretaria: 'Obras e vias',
  prazo_ate: '2026-11-18T02:42:06Z',
  prazo_fonte: 'prazo padrão',
  endereco: null,
  bairro: null,
  agrupada: false,
  relatos: 1,
  criado_em: '2026-11-15T02:42:06Z',
  repetido: false,
}

describe('regras compartilhadas com o app web', () => {
  it('vêm do arquivo do web e funcionam no empacotador do app', () => {
    expect(web.mensagemDeErro('sem_conexao')).toContain('Sem internet')
    expect(web.prazoDeEnvio(false)).toBe(90_000)
    expect(web.prazoDeEnvio(true)).toBe(180_000)
    expect(web.acaoDoErro('video_com_audio')).toBe('sem_video')
    expect(web.rotuloDoEnvio('sem_video', 2)).toBe('Enviar só com as fotos')
    expect(web.precisaoAceita({ lat: 0, lng: 0, precisao: 100 })).toBe(true)
    expect(web.precisaoAceita({ lat: 0, lng: 0, precisao: 101 })).toBe(false)
    expect(web.dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 })
  })

  it('leem o recibo real do servidor', () => {
    const r = web.interpretarEnvio(201, RECIBO)
    expect('resposta' in r && r.resposta.protocolo).toBe('MOGI-2026-000120')
    expect('resposta' in r && r.resposta.repetido).toBe(false)
    const de_novo = web.interpretarEnvio(200, { ...RECIBO, repetido: true })
    expect('resposta' in de_novo && de_novo.resposta.repetido).toBe(true)
    expect(web.interpretarEnvio(422, { erro: 'x', codigo: 'fora_da_cidade' })).toEqual({ codigo: 'fora_da_cidade' })
  })

  it('toda mensagem de erro rende uma frase curta que termina em ponto', () => {
    const codigos: web.CodigoDeErro[] = [
      'foto_ausente', 'foto_formato', 'foto_grande', 'fotos_demais', 'video_formato', 'video_grande', 'video_longo',
      'video_com_audio', 'local_invalido', 'fora_da_cidade', 'muitos_envios', 'midia_indisponivel', 'interno',
      'sem_conexao', 'tempo_esgotado', 'desconhecido',
    ]
    for (const c of codigos) {
      const completa = web.mensagemDeErro(c, 'Itamogi', web.lerMidia(CONFIG_REAL.midia))
      const curta = fraseCurta(completa)
      expect(completa.startsWith(curta.slice(0, -1))).toBe(true)
      expect(curta.endsWith('.')).toBe(true)
      expect(curta.length).toBeLessThanOrEqual(60)
      expect(curta).not.toMatch(/[—–]/)
    }
  })
})

describe('config', () => {
  it('a config real do servidor liga perto, vídeo e traz o centro', () => {
    const c = web.lerConfig(CONFIG_REAL)
    expect(c.ia_ativa).toBe(true)
    expect(c.modulos.perto).toBe(true)
    expect(c.modulos.video).toBe(true)
    expect(c.centro).toEqual({ lat: -21.0793, lng: -47.0486 })
    expect(c.midia.fotos_max).toBe(4)
  })
  it('sem resposta, nada de IA, de perto nem de vídeo', () => {
    expect(web.CONFIG_PADRAO.ia_ativa).toBe(false)
    expect(web.CONFIG_PADRAO.modulos.perto).toBe(false)
    expect(web.CONFIG_PADRAO.modulos.video).toBe(false)
  })
})

describe('palavras', () => {
  const agora = new Date(2026, 10, 15, 10, 0)
  const em = (dias: number, h: number, m = 0) => new Date(2026, 10, 15 + dias, h, m).toISOString()

  it('o prazo sem Intl diz o mesmo que o do app web', () => {
    const casos: [string | null, web.Status][] = [
      [null, 'aberta'], ['lixo', 'aberta'], [em(0, 14, 30), 'aberta'], [em(0, 23, 59), 'revisao'], [em(1, 8), 'aberta'],
      [em(2, 8), 'aberta'], [em(3, 8), 'em_atendimento'], [em(6, 23), 'aberta'], [em(7, 8), 'aberta'], [em(40, 8), 'aberta'],
      [em(0, 9), 'aberta'], [em(-2, 9), 'aberta'], [em(1, 8), 'resolvida'],
    ]
    for (const [iso, status] of casos) expect(prazoSemIntl(iso, status, agora)).toBe(web.prazoEmPalavras(iso, status, agora))
    expect(prazo(em(0, 14, 30), 'aberta', agora)).toBe('Até hoje, 14:30')
    expect(prazo(em(1, 8), 'aberta', agora)).toBe('Até amanhã, 08:00')
    expect(prazo(em(3, 8), 'aberta', agora)).toBe('Até quarta-feira')
    expect(prazo(em(10, 8), 'aberta', agora)).toBe('Até 25/11')
    expect(prazo(null, 'aberta', agora)).toBe('Na rotina da equipe')
    expect(prazo(em(-1, 8), 'aberta', agora)).toBe('Prazo vencido')
    expect(prazo(em(1, 8), 'resolvida', agora)).toBeNull()
  })
  it('data e hora sem Intl batem com o formato do app web', () => {
    for (const iso of ['2026-11-12T17:30:00Z', '2026-01-01T02:05:00Z', '2026-12-31T23:59:59Z']) {
      expect(dataHoraSemIntl(iso)).toBe(web.formatarDataHora(iso))
    }
    expect(dataHoraSemIntl('lixo')).toBe('')
  })
  it('idade em palavras', () => {
    const ha = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString()
    expect(idadeEmPalavras(ha(1), agora)).toBe('agora há pouco')
    expect(idadeEmPalavras(ha(20), agora)).toBe('há 20 minutos')
    expect(idadeEmPalavras(ha(60), agora)).toBe('há 1 hora')
    expect(idadeEmPalavras(ha(60 * 5), agora)).toBe('há 5 horas')
    expect(idadeEmPalavras(ha(60 * 24), agora)).toBe('há 1 dia')
    expect(idadeEmPalavras(ha(60 * 24 * 2 + 5), agora)).toBe('há 2 dias')
    expect(idadeEmPalavras('', agora)).toBe('')
  })
  it('frase curta fica com a primeira frase', () => {
    expect(fraseCurta('Sem internet agora. Seu relato continua aqui: toque.')).toBe('Sem internet agora.')
    expect(fraseCurta('Tirei o vídeo do relato: toque no botão')).toBe('Tirei o vídeo do relato.')
    expect(fraseCurta('Sem ponto')).toBe('Sem ponto')
    for (const c of ['ja_confirmou', 'longe_demais', 'ref_invalida', 'muitos_envios', 'sem_conexao', 'desconhecido'] as const) {
      expect(fraseCurta(web.mensagemDaConfirmacao(c)).length).toBeLessThanOrEqual(50)
    }
  })
})

describe('local', () => {
  it('toda situação que trava o envio tem frase e pelo menos uma saída', () => {
    const situacoes: web.SituacaoDoLocal[] = ['impreciso', 'negado', 'sem_sinal', 'sem_suporte']
    for (const s of situacoes) {
      expect(web.pedeMapa(s)).toBe(true)
      expect(avisoCurtoDoLocal(s)).toBeTruthy()
      expect(saidasDoLocal(s, true).length).toBeGreaterThan(0)
      expect(saidasDoLocal(s, false).length).toBeGreaterThan(0)
      expect(saidasDoLocal(s, true)).toContain('mapa')
      expect(saidasDoLocal(s, false)).not.toContain('mapa')
    }
    expect(avisoCurtoDoLocal('ok')).toBeNull()
    expect(avisoCurtoDoLocal('buscando')).toBeNull()
  })
  it('só a localização negada oferece os ajustes', () => {
    expect(saidasDoLocal('negado', true)).toEqual(['ajustes', 'repetir', 'mapa'])
    expect(saidasDoLocal('impreciso', true)).toEqual(['repetir', 'mapa'])
  })
  it('o boneco anda só quando a pessoa anda (regra do app web)', () => {
    const base: web.Posicao = { lat: -21.0793, lng: -47.0486, precisao: 8, em: 0, velocidade: null }
    const adiante: web.Posicao = { ...base, lat: base.lat + 0.00009, em: 5000 }
    expect(web.passoDoBoneco(null, base).andando).toBe(false)
    expect(web.passoDoBoneco(base, adiante).andando).toBe(true)
    expect(web.passoDoBoneco(base, { ...base, em: 5000 }).andando).toBe(false)
    expect(web.passoDoBoneco(base, { ...adiante, velocidade: 0.1 }).andando).toBe(false)
  })
  it('uma leitura ruim não derruba a última boa por um minuto', () => {
    const boa: web.Posicao = { lat: -21, lng: -47, precisao: 10, em: 1000 }
    const ruim: web.Posicao = { lat: -21, lng: -47, precisao: 400, em: 2000 }
    let m = web.guardarLeitura({ atual: null, boa: null }, boa, 1000)
    m = web.guardarLeitura(m, ruim, 2000)
    expect(web.gpsDaMemoria(m)).toEqual(boa)
    m = web.guardarLeitura(m, { ...ruim, em: 90_000 }, 90_000)
    expect(web.precisaoAceita(web.gpsDaMemoria(m)!)).toBe(false)
  })
})

describe('acompanhar', () => {
  const real = {
    protocolo: 'MOGI-2026-000120', categoria: 'vias', categoria_nome: 'Vias e buracos', status: 'aberta', nivel: 3,
    secretaria: 'Obras e vias', prazo_ate: '2026-11-18T02:42:06Z', relatos: 1, enviado_em: '2026-11-15T02:42:06Z',
    passos: [
      { tipo: 'recebido', feito: true, quando: '2026-11-15T02:42:06Z' },
      { tipo: 'conferido', feito: true, quando: '2026-11-15T02:42:06Z' },
      { tipo: 'a_caminho', feito: false, quando: null },
      { tipo: 'resolvido', feito: false, quando: null },
    ],
  }
  it('lê a resposta real e mostra os quatro passos, com hora nos feitos', () => {
    const a = web.lerAcompanhamento(real)!
    const linha = passos(a)
    expect(linha.map((p) => p.rotulo)).toEqual(['Recebido', 'Prefeitura conferiu', 'Equipe a caminho', 'Resolvido'])
    expect(linha.map((p) => p.feito)).toEqual([true, true, false, false])
    expect(linha[0].quando).toBe(dataHoraSemIntl('2026-11-15T02:42:06Z'))
    expect(linha[2]).toMatchObject({ quando: '', agora: true })
    expect(web.lerAcompanhamento({ codigo: 'nao_encontrado' })).toBeNull()
  })
  it('lê o que foi feito e as fotos do depois', () => {
    const a = web.lerAcompanhamento({ ...real, status: 'resolvida', o_que_foi_feito: 'Buraco tapado', fotos_do_depois: ['/api/midia?x=1'] })!
    expect(a.o_que_foi_feito).toBe('Buraco tapado')
    expect(a.fotos_do_depois).toEqual(['/api/midia?x=1'])
  })
})

describe('perto', () => {
  const real = [
    { ref: 'b.1.x', categoria: 'agua', categoria_nome: 'Água e esgoto', distancia_m: 60, desde: '2026-11-13T10:00:00Z', relatos: 3, status: 'aberta' },
    { ref: 'a.1.x', categoria: 'vias', categoria_nome: 'Vias e buracos', distancia_m: 30, desde: '2026-11-15T02:00:00Z', relatos: 1, status: 'aberta' },
    { sem: 'ref' },
  ]
  it('o cartão é o do chamado mais perto', () => {
    const p = web.escolherPerto(web.lerPerto(real))!
    expect(p.ref).toBe('a.1.x')
    expect(web.linhaDoPerto(p)).toBe('Buraco · a 30 m · 1 pessoa')
    expect(web.escolherPerto(web.lerPerto([]))).toBeNull()
    expect(web.escolherPerto(web.lerPerto(null))).toBeNull()
  })
  it('lê o recibo e os erros do Também vi', () => {
    expect('resposta' in web.interpretarConfirmacao(201, { ...RECIBO, agrupada: true })).toBe(true)
    expect(web.interpretarConfirmacao(409, { codigo: 'ja_confirmou' })).toEqual({ codigo: 'ja_confirmou' })
    expect(web.interpretarConfirmacao(422, { codigo: 'longe_demais' })).toEqual({ codigo: 'longe_demais' })
    expect(web.interpretarConfirmacao(400, { codigo: 'ref_invalida' })).toEqual({ codigo: 'ref_invalida' })
    expect(web.depoisDaConfirmacao('sem_conexao')).toBe('tentar')
    expect(web.depoisDaConfirmacao('ja_confirmou')).toBe('avisar')
  })
})

describe('relatos guardados', () => {
  const recibo = (web.interpretarEnvio(201, RECIBO) as { resposta: web.Resposta }).resposta
  const ponto = { lat: -21.0793, lng: -47.0486 }
  it('guarda o recibo com o lugar e lê de volta', () => {
    const r = web.recenteDaResposta(recibo, ponto)
    expect(lerRelatos(JSON.parse(JSON.stringify([r])))).toEqual([r])
    expect(web.recenteDaResposta(recibo).lat).toBeNull()
    expect(lerRelatos('lixo')).toEqual([])
    expect(lerRelatos([null, { protocolo: '' }, r])).toEqual([r])
  })
  it('no máximo dez, sem repetir protocolo, e o ponto antigo não se perde', () => {
    let lista = Array.from({ length: 12 }, (_, i) => web.recenteDaResposta({ ...recibo, protocolo: `P${i}` }, ponto)).reduce(mesclarRelatos, [] as web.Recente[])
    expect(lista).toHaveLength(MAX_RELATOS)
    expect(lista[0].protocolo).toBe('P11')
    expect(lerRelatos(JSON.parse(JSON.stringify(lista)))).toHaveLength(MAX_RELATOS)
    lista = mesclarRelatos(lista, web.recenteDaResposta({ ...recibo, protocolo: 'P5', nivel: 5 }))
    expect(lista).toHaveLength(MAX_RELATOS)
    expect(lista[0]).toMatchObject({ protocolo: 'P5', nivel: 5, ...ponto })
  })
  it('o andamento atualiza o pino, e o resolvido estreia uma vez só', () => {
    const lista = [web.recenteDaResposta(recibo, ponto), web.recenteDaResposta({ ...recibo, protocolo: 'B' })]
    const a = web.lerAcompanhamento({ protocolo: recibo.protocolo, status: 'resolvida', nivel: 4, passos: [] })!
    const primeira = aposConsulta(lista, a)
    expect(primeira.estreia).toBe(true)
    expect(primeira.lista[0]).toMatchObject({ status: 'resolvida', nivel: 4, viuResolvido: true })
    expect(aposConsulta(primeira.lista, a).estreia).toBe(false)
    expect(aposConsulta(lerRelatos(JSON.parse(JSON.stringify(primeira.lista))), a).estreia).toBe(false)
    expect(web.pinosDosRecentes(lista).map((r) => r.protocolo)).toEqual([recibo.protocolo])
  })
})

describe('fila sem rede', () => {
  const item = (n: number): ItemDaFila => ({
    chave: `00000000-0000-4000-8000-00000000000${n}`,
    campos: { lat: '-21.079300', lng: '-47.048600' },
    fotos: ['file:///doc/fila/foto-1.jpg'],
    video: null,
    guardadoEm: '2026-11-15T02:00:00Z',
  })
  it('guarda, lê de volta e descarta o que não tem formato', () => {
    const fila = entrarNaFila([], item(1))
    expect(lerFila(JSON.parse(JSON.stringify(fila)))).toEqual(fila)
    expect(lerFila([{ chave: 'x', fotos: ['a'], campos: {} }, { ...item(2), fotos: [] }, null])).toEqual([])
    expect(lerFila('lixo')).toEqual([])
  })
  it('a mesma chave não entra duas vezes e a fila tem teto', () => {
    let fila = entrarNaFila(entrarNaFila([], item(1)), item(1))
    expect(fila).toHaveLength(1)
    for (let n = 2; n <= 7; n++) fila = entrarNaFila(fila, item(n))
    expect(fila).toHaveLength(MAX_FILA)
    expect(cabeNaFila(fila)).toBe(false)
    expect(sairDaFila(fila, item(7).chave)).toHaveLength(MAX_FILA - 1)
  })
  it('texto da tela inicial', () => {
    expect(textoDaFila(0)).toBeNull()
    expect(textoDaFila(1)).toBe('1 relato esperando a internet')
    expect(textoDaFila(2)).toBe('2 relatos esperando a internet')
  })
  it('só falha de conexão vai para a fila; recusa do conteúdo sai dela', () => {
    expect(podeEsperarInternet('sem_conexao')).toBe(true)
    expect(podeEsperarInternet('tempo_esgotado')).toBe(true)
    expect(podeEsperarInternet('fora_da_cidade')).toBe(false)
    expect(destinoNaFila('sem_conexao')).toBe('esperar')
    expect(destinoNaFila('muitos_envios')).toBe('esperar')
    expect(destinoNaFila('interno')).toBe('esperar')
    expect(destinoNaFila('cadastro_obrigatorio')).toBe('esperar')
    expect(destinoNaFila('fora_da_cidade')).toBe('descartar')
    expect(destinoNaFila('foto_formato')).toBe('descartar')
  })
})

describe('corpo do envio', () => {
  it('monta as partes na ordem do app web', () => {
    const video = { uri: 'file:///c/v.mov', tipo: tipoDoVideo('file:///c/v.mov'), duracaoMs: 7300.4, quadros: ['file:///c/q1.jpg'] }
    const partes = partesDoRelato(['file:///c/a.jpg', 'file:///c/b.jpg'], video, { lat: '-21.079300', lng: '-47.048600' })
    expect(partes.map((p) => p.nome)).toEqual(['foto', 'foto', 'video', 'quadro', 'video_duracao_ms', 'lat', 'lng'])
    expect(partes[0]).toEqual({ nome: 'foto', arquivo: { uri: 'file:///c/a.jpg', name: 'relato-1.jpg', type: 'image/jpeg' } })
    expect(partes[2]).toEqual({ nome: 'video', arquivo: { uri: 'file:///c/v.mov', name: 'relato.mov', type: 'video/quicktime' } })
    expect(partes[4]).toEqual({ nome: 'video_duracao_ms', valor: '7300' })
    expect(partesDoRelato(['a'], null, {}).map((p) => p.nome)).toEqual(['foto'])
  })
  it('tipo do vídeo pela extensão', () => {
    expect(tipoDoVideo('file:///x/Camera/abc.mp4')).toBe('video/mp4')
    expect(tipoDoVideo('file:///x/abc.MOV')).toBe('video/quicktime')
  })
  it('as rotas ficam em /api, com ou sem barra no fim da base', () => {
    expect(enderecoDaApi('https://tunel.exemplo/', '/config')).toBe('https://tunel.exemplo/api/config')
    expect(enderecoDoAppWeb('https://tunel.exemplo/')).toBe('https://tunel.exemplo/relatar.html')
    expect(enderecoDoAppWeb('http://192.168.0.10:8080/api')).toBe('http://192.168.0.10:8080/relatar.html')
    expect(enderecoDoAppWeb('')).toBe('')
    expect(CADASTRO_PELO_WEB).toContain('app web')
    expect(enderecoDaApi('http://192.168.0.10:8080', '/ocorrencias')).toBe('http://192.168.0.10:8080/api/ocorrencias')
    expect(enderecoDaApi('http://x', '/api/midia?a=1')).toBe('http://x/api/midia?a=1')
    expect(enderecoDaApi('  ', '/config')).toBe('')
  })
})

describe('sons', () => {
  it('a tabela do app é igual à do app web', () => {
    const fonte = readFileSync(join(__dirname, '../../../painel/src/sons.ts'), 'utf8')
    for (const som of Object.keys(SONS) as Som[]) {
      const linha = new RegExp(`^\\s*${som}: \\{(.*)\\},$`, 'm').exec(fonte)
      expect(linha).not.toBeNull()
      // A linha do web é um objeto literal simples: dá para ler como JSON5.
      const doWeb = Function(`return ({${linha![1]}})`)() as object
      expect(doWeb).toEqual(SONS[som])
    }
  })
  it('respeita o intervalo mínimo de cada som', () => {
    expect(pode({}, 'foto', 1000)).toBe(true)
    expect(pode({ foto: 1000 }, 'foto', 1050)).toBe(false)
    expect(pode({ foto: 1000 }, 'foto', 1120)).toBe(true)
    expect(pode({ foto: 1000 }, 'enviado', 1050)).toBe(true)
  })
  it('vibração segue o padrão do web', () => {
    expect(toqueDoSom('camera')).toBeNull()
    expect(toqueDoSom('pino')).toBeNull()
    expect(toqueDoSom('foto')).toBe('leve')
    expect(toqueDoSom('enviado')).toBe('certo')
    expect(toqueDoSom('resolvido')).toBe('certo')
    expect(toqueDoSom('erro')).toBe('erro')
  })
})

describe('textos do app', () => {
  it('nenhum arquivo do app usa travessão', () => {
    const raiz = join(__dirname, '..')
    const andar = (pasta: string): string[] =>
      readdirSync(pasta).flatMap((nome) => {
        const caminho = join(pasta, nome)
        return statSync(caminho).isDirectory() ? andar(caminho) : /\.(ts|tsx)$/.test(nome) && !nome.endsWith('.test.ts') ? [caminho] : []
      })
    for (const arquivo of andar(raiz)) expect({ arquivo, travessao: /[—–]/.test(readFileSync(arquivo, 'utf8')) }).toEqual({ arquivo, travessao: false })
  })
})
