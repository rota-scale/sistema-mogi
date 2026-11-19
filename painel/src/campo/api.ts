import type { EventoAoVivo, Ocorrencia, Status } from '../tipos'
import { codigoDaFalha, esperaDeReconexao } from './logica'
import type { CodigoDeFalha } from './logica'

const BASE = '/api'
// localStorage, não sessionStorage: a equipe abre e fecha o navegador o dia
// todo e não pode digitar a senha a cada chamado.
const CHAVE_TOKEN = 'mogi.campo.token'

export interface UsuarioDeCampo {
  login: string
  papel: 'gestor' | 'operador' | 'campo'
  nome?: string
  secretaria?: string
}

export function tokenSalvo(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function sair() {
  try {
    localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* sem armazenamento: nada a apagar */
  }
}

// Falha de uma chamada, já traduzida para o que a tela sabe tratar.
export class Falha extends Error {
  codigo: CodigoDeFalha
  status: number
  constructor(codigo: CodigoDeFalha, status: number, msg?: string) {
    super(msg ?? codigo)
    this.codigo = codigo
    this.status = status
  }
}

export function sessaoExpirou(e: unknown): boolean {
  return e instanceof Falha && e.codigo === 'sessao'
}

function falhaDaResposta(status: number, corpo: unknown): Falha {
  const c = (corpo ?? {}) as { erro?: unknown; codigo?: unknown }
  const codigo = codigoDaFalha(status, typeof c.codigo === 'string' ? c.codigo : undefined)
  // Token vencido não serve mais para nada: apaga na hora.
  if (codigo === 'sessao') sair()
  return new Falha(codigo, status, typeof c.erro === 'string' ? c.erro : undefined)
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = tokenSalvo()
  let r: Response
  try {
    r = await fetch(BASE + caminho, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch {
    throw new Falha('sem_rede', 0)
  }
  const corpo: unknown = await r.json().catch(() => null)
  if (!r.ok) throw falhaDaResposta(r.status, corpo)
  return corpo as T
}

export type ErroDeLogin = 'senha' | 'muitas' | 'sem_rede' | 'armazenamento' | 'servidor'

export class LoginRecusado extends Error {
  motivo: ErroDeLogin
  constructor(motivo: ErroDeLogin) {
    super(motivo)
    this.motivo = motivo
  }
}

// No login o 401 é senha errada, não sessão vencida: por isso não passa por pedir().
export async function entrar(login: string, senha: string): Promise<UsuarioDeCampo> {
  let r: Response
  try {
    r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ login, senha }),
    })
  } catch {
    throw new LoginRecusado('sem_rede')
  }
  if (r.status === 401) throw new LoginRecusado('senha')
  if (r.status === 429) throw new LoginRecusado('muitas')
  const corpo = (await r.json().catch(() => null)) as { token?: string; usuario?: UsuarioDeCampo } | null
  if (!r.ok || !corpo?.token || !corpo.usuario) throw new LoginRecusado('servidor')
  try {
    localStorage.setItem(CHAVE_TOKEN, corpo.token)
  } catch {
    throw new LoginRecusado('armazenamento')
  }
  return corpo.usuario
}

export const quemSou = () => pedir<UsuarioDeCampo>('/auth/eu')
export const listar = (status: Status) => pedir<Ocorrencia[]>(`/ocorrencias?status=${status}`)
export const detalhar = (id: string) => pedir<Ocorrencia>(`/ocorrencias/${encodeURIComponent(id)}`)

export const naoEncontrado = (id: string, motivo: string) =>
  pedir<Ocorrencia>(`/ocorrencias/${encodeURIComponent(id)}/nao-encontrado`, {
    method: 'POST',
    body: JSON.stringify({ motivo: motivo.trim() }),
  })

// Conclui o chamado com as fotos do depois. Usa XMLHttpRequest porque o fetch
// não informa o progresso do envio, e foto no 4G demora.
export function resolver(
  id: string,
  motivo: string,
  fotos: Blob[],
  aoProgresso: (fracao: number) => void,
): Promise<Ocorrencia> {
  return new Promise((ok, falha) => {
    const corpo = new FormData()
    const texto = motivo.trim()
    if (texto) corpo.append('motivo', texto)
    fotos.forEach((f, i) => corpo.append('foto', f, `depois-${i + 1}.jpg`))

    const x = new XMLHttpRequest()
    x.open('POST', `${BASE}/ocorrencias/${encodeURIComponent(id)}/resolucao`)
    x.responseType = 'text'
    x.setRequestHeader('Accept', 'application/json')
    const token = tokenSalvo()
    if (token) x.setRequestHeader('Authorization', `Bearer ${token}`)
    // Sem fotos o corpo é pequeno: 3 minutos só fazem sentido com upload.
    x.timeout = fotos.length > 0 ? 180_000 : 30_000
    x.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) aoProgresso(e.loaded / e.total)
    }
    const semRede = () => falha(new Falha('sem_rede', 0))
    x.onerror = semRede
    x.ontimeout = semRede
    x.onabort = semRede
    x.onload = () => {
      let dados: unknown = null
      try {
        dados = JSON.parse(x.responseText)
      } catch {
        /* corpo que não é JSON: vale só o status */
      }
      if (x.status >= 200 && x.status < 300 && dados) ok(dados as Ocorrencia)
      else falha(falhaDaResposta(x.status, dados))
    }
    x.send(corpo)
  })
}

const PRAZO_CONFIG_MS = 4000

// Nome da cidade para o topo. Sem resposta em 4 s, a tela segue sem ele.
export async function buscarCidade(): Promise<string | null> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), PRAZO_CONFIG_MS)
  try {
    const r = await fetch(`${BASE}/config`, { headers: { Accept: 'application/json' }, signal: controle.signal })
    if (!r.ok) return null
    const c = (await r.json()) as { cidade?: unknown }
    return typeof c.cidade === 'string' && c.cidade.trim() ? c.cidade.trim() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export type Sinal = 'campo_envio_falhou' | 'campo_foto_ilegivel' | 'campo_gps_negado'

// Avisa o servidor que algo falhou no aparelho. Sem dado pessoal, sem esperar
// resposta, e nunca pode quebrar a tela.
export function avisarFalha(tipo: Sinal, detalhe: string) {
  try {
    void fetch(`${BASE}/telemetria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, detalhe: detalhe.slice(0, 200), tela: 'campo' }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    /* sem rede ou navegador antigo: fica sem o aviso */
  }
}

export type EstadoConexao = 'conectando' | 'ao-vivo' | 'sem-conexao'

// Conecta ao tempo real e reconecta com espera crescente. A cada conexão
// pede uma nova consulta, para não perder o que mudou enquanto esteve fora.
export function aoVivo(
  aoEvento: (e: EventoAoVivo) => void,
  aoEstado: (s: EstadoConexao) => void,
  aoExpirar: () => void,
): () => void {
  let ws: WebSocket | null = null
  let tentativa = 0
  let encerrado = false
  let conferindo = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const abrir = () => {
    const token = tokenSalvo()
    if (!token || encerrado) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    try {
      ws = new WebSocket(`${proto}//${location.host}${BASE}/ao-vivo?token=${encodeURIComponent(token)}`)
    } catch {
      aoEstado('sem-conexao')
      return
    }
    ws.onopen = () => {
      tentativa = 0
      aoEstado('ao-vivo')
      aoEvento({ tipo: 'Ressincronizar' })
    }
    ws.onmessage = (m) => {
      try {
        aoEvento(JSON.parse(String(m.data)) as EventoAoVivo)
      } catch {
        /* mensagem fora do formato: ignora */
      }
    }
    ws.onclose = () => {
      if (encerrado) return
      aoEstado('sem-conexao')
      timer = setTimeout(retomar, esperaDeReconexao(tentativa))
      tentativa++
    }
  }

  // O navegador não mostra o status do handshake recusado. Com o token
  // vencido o servidor recusa para sempre, então a sessão é conferida antes
  // de cada nova tentativa e só o 401 encerra; erro de rede segue tentando.
  const retomar = async () => {
    clearTimeout(timer)
    if (encerrado || conferindo) return
    conferindo = true
    let expirou = false
    try {
      await quemSou()
    } catch (e) {
      expirou = sessaoExpirou(e)
    } finally {
      conferindo = false
    }
    if (encerrado) return
    if (expirou) {
      encerrado = true
      aoExpirar()
    } else {
      abrir()
    }
  }

  // A rede voltou ou a aba reapareceu: não espera o resto do intervalo.
  const naHora = () => {
    if (encerrado || (ws && ws.readyState !== WebSocket.CLOSED)) return
    tentativa = 0
    void retomar()
  }
  const aoVoltarParaAba = () => {
    if (document.visibilityState === 'visible') naHora()
  }
  window.addEventListener('online', naHora)
  document.addEventListener('visibilitychange', aoVoltarParaAba)

  aoEstado('conectando')
  abrir()
  return () => {
    encerrado = true
    clearTimeout(timer)
    window.removeEventListener('online', naHora)
    document.removeEventListener('visibilitychange', aoVoltarParaAba)
    ws?.close()
  }
}
