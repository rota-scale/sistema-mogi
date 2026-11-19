import {
  CONFIG_PADRAO,
  detalheDaTelemetria,
  ehUuid,
  extensaoDoVideo,
  interpretarConfirmacao,
  interpretarEnvio,
  lerAcompanhamento,
  lerConfig,
  lerPerto,
  lerRecentes,
  prazoDeEnvio,
  uuidDeBytes,
} from './logica'
import type {
  Acompanhamento,
  CodigoDaConfirmacao,
  CodigoDeErro,
  Config,
  Progresso,
  Proximo,
  Recente,
  Resposta,
  TipoDeTelemetria,
} from './logica'
import { cabecalhoDoToken } from './conta'

const PRAZO_CONFIG_MS = 4000
const CHAVE_RECENTES = 'mogi.relatos'
const CHAVE_APARELHO = 'mogi.aparelho'

// Sempre resolve em até 4 s: sem resposta nesse prazo, vale a lista padrão
// (sem IA) e o formulário não muda mais depois.
export async function buscarConfig(): Promise<Config> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), PRAZO_CONFIG_MS)
  try {
    const r = await fetch('/api/config', { headers: { Accept: 'application/json' }, signal: controle.signal })
    if (!r.ok) return CONFIG_PADRAO
    return lerConfig(await r.json())
  } catch {
    return CONFIG_PADRAO
  } finally {
    clearTimeout(timer)
  }
}

export function novoUuid(): string {
  // randomUUID só existe em página segura (https); o resto cobre navegador antigo.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  return uuidDeBytes(bytes)
}

let aparelhoDaVisita: string | null = null

// Identifica o aparelho para o limite de envios. É um número sorteado,
// sem nenhum dado da pessoa.
export function idDoAparelho(): string {
  if (aparelhoDaVisita) return aparelhoDaVisita
  let id: string | null = null
  try {
    id = localStorage.getItem(CHAVE_APARELHO)
  } catch {
    /* sem armazenamento: o número vale só nesta visita */
  }
  if (!ehUuid(id)) {
    id = novoUuid()
    try {
      localStorage.setItem(CHAVE_APARELHO, id)
    } catch {
      /* idem */
    }
  }
  aparelhoDaVisita = id
  return id
}

export class FalhaDeEnvio extends Error {
  readonly codigo: CodigoDeErro
  constructor(codigo: CodigoDeErro) {
    super(codigo)
    this.name = 'FalhaDeEnvio'
    this.codigo = codigo
  }
}

export interface VideoDoRelato {
  blob: Blob
  // Medida pelo relógio do aparelho, do começo ao fim da gravação.
  duracaoMs: number
  // Quadros do vídeo em JPEG: viram a capa borrada dele no painel.
  quadros: Blob[]
}

export interface MidiasDoRelato {
  // JPEGs já reduzidos. A primeira é a principal e vai para a triagem.
  fotos: Blob[]
  video?: VideoDoRelato | null
}

export interface Envio extends MidiasDoRelato {
  campos: Record<string, string>
  // Chave de idempotência: a mesma em toda tentativa do mesmo relato.
  chave: string
  aoProgredir: (p: Progresso) => void
}

// Corpo multipart do POST /api/ocorrencias: "foto" repetido, depois o
// vídeo com seus quadros e a duração, depois os campos de texto.
export function montarCorpo({ fotos, video }: MidiasDoRelato, campos: Record<string, string>): FormData {
  const corpo = new FormData()
  fotos.forEach((foto, i) => corpo.append('foto', foto, `relato-${i + 1}.jpg`))
  if (video) {
    corpo.append('video', video.blob, `relato.${extensaoDoVideo(video.blob.type)}`)
    video.quadros.forEach((quadro, i) => corpo.append('quadro', quadro, `quadro-${i + 1}.jpg`))
    corpo.append('video_duracao_ms', String(Math.max(0, Math.round(video.duracaoMs))))
  }
  for (const [nome, valor] of Object.entries(campos)) corpo.append(nome, valor)
  return corpo
}

// Envia o relato como multipart. XMLHttpRequest em vez de fetch porque só
// ele informa o progresso do upload. Em qualquer falha, rejeita com
// FalhaDeEnvio e o código do erro.
export function enviarRelato({ fotos, video, campos, chave, aoProgredir }: Envio): Promise<Resposta> {
  const corpo = montarCorpo({ fotos, video }, campos)
  const temVideo = Boolean(video)

  return new Promise((ok, falha) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/ocorrencias')
    xhr.responseType = 'text'
    xhr.timeout = prazoDeEnvio(temVideo)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('Idempotency-Key', chave)
    xhr.setRequestHeader('X-Mogi-Aparelho', idDoAparelho())
    for (const [nome, valor] of Object.entries(cabecalhoDoToken())) xhr.setRequestHeader(nome, valor)

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return
      aoProgredir(e.loaded >= e.total ? { fase: 'analisando' } : { fase: 'enviando', fracao: e.loaded / e.total })
    }
    xhr.upload.onload = () => aoProgredir({ fase: 'analisando' })

    xhr.onload = () => {
      let json: unknown = null
      try {
        json = JSON.parse(xhr.responseText)
      } catch {
        /* corpo que não é JSON: decide só pelo status */
      }
      const r = interpretarEnvio(xhr.status, json, temVideo)
      if ('resposta' in r) ok(r.resposta)
      else falha(new FalhaDeEnvio(r.codigo))
    }
    xhr.onerror = () => falha(new FalhaDeEnvio('sem_conexao'))
    xhr.onabort = () => falha(new FalhaDeEnvio('sem_conexao'))
    xhr.ontimeout = () => falha(new FalhaDeEnvio('tempo_esgotado'))

    aoProgredir({ fase: 'enviando', fracao: 0 })
    xhr.send(corpo)
  })
}

// Ficam no aparelho só protocolo, chave de acompanhamento, nível, status e
// data: nenhum dado pessoal.
export function recentesSalvos(): Recente[] {
  try {
    return lerRecentes(JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? '[]'))
  } catch {
    return []
  }
}

export function salvarRecentes(lista: Recente[]) {
  try {
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista))
  } catch {
    /* sem armazenamento: a lista vale só nesta visita */
  }
}

// Pedido GET com prazo; qualquer falha vira null.
async function lerJson(url: string, prazoMs: number): Promise<{ status: number; corpo: unknown } | null> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), prazoMs)
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: controle.signal, cache: 'no-store' })
    let corpo: unknown = null
    try {
      corpo = await r.json()
    } catch {
      /* corpo que não é JSON */
    }
    return { status: r.status, corpo }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Chamados abertos perto do ponto. Falha devolve lista vazia: a câmera abre direto.
export async function buscarPerto(lat: number, lng: number, prazoMs = 2500): Promise<Proximo[]> {
  const r = await lerJson(`/api/perto?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, prazoMs)
  return r && r.status === 200 ? lerPerto(r.corpo) : []
}

// "Também vi": uma confirmação por aparelho, com chave para não duplicar.
export async function confirmarPerto(
  ref: string,
  lat: number,
  lng: number,
  chave: string,
): Promise<{ resposta: Resposta } | { codigo: CodigoDaConfirmacao }> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), 15000)
  try {
    const r = await fetch('/api/perto/confirmacao', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': chave,
        'X-Mogi-Aparelho': idDoAparelho(),
        ...cabecalhoDoToken(),
      },
      body: JSON.stringify({ ref, lat, lng }),
      signal: controle.signal,
    })
    let corpo: unknown = null
    try {
      corpo = await r.json()
    } catch {
      /* idem */
    }
    return interpretarConfirmacao(r.status, corpo)
  } catch {
    return { codigo: 'sem_conexao' }
  } finally {
    clearTimeout(timer)
  }
}

export type LeituraDoAcompanhamento = { acompanhamento: Acompanhamento } | { falha: 'nao_encontrado' | 'sem_conexao' }

export async function buscarAcompanhamento(protocolo: string, chave: string): Promise<LeituraDoAcompanhamento> {
  const r = await lerJson(`/api/acompanhar/${encodeURIComponent(protocolo)}?k=${encodeURIComponent(chave)}`, 10000)
  if (!r) return { falha: 'sem_conexao' }
  if (r.status === 404) return { falha: 'nao_encontrado' }
  const a = r.status === 200 ? lerAcompanhamento(r.corpo) : null
  return a ? { acompanhamento: a } : { falha: 'sem_conexao' }
}

const avisados = new Set<string>()

// Avisa o servidor de uma falha, uma vez por tipo e detalhe em cada visita.
// Nunca quebra nada: sem rede ou com erro, só desiste.
export function avisar(tipo: TipoDeTelemetria, detalhe: unknown = ''): void {
  try {
    const limpo = detalheDaTelemetria(detalhe)
    const marca = `${tipo}:${limpo}`
    if (avisados.has(marca)) return
    avisados.add(marca)
    void fetch('/api/telemetria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, detalhe: limpo, tela: 'relatar' }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* nada a fazer */
  }
}
