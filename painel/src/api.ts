import type { Categoria, EventoAoVivo, Indicadores, Ocorrencia, Regra, Simulado, Usuario } from './tipos'

const BASE = '/api'
const CHAVE_TOKEN = 'mogi.token'

export function tokenSalvo(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function sair() {
  try {
    sessionStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* sem armazenamento: nada a apagar */
  }
}

export class NaoAutorizado extends Error {}

// ErroDaApi carrega o corpo da resposta, que às vezes traz detalhes (ex.: os
// cenários que falharam ao salvar uma regra), e o status HTTP.
export class ErroDaApi extends Error {
  corpo: unknown
  status: number
  constructor(msg: string, corpo: unknown, status = 0) {
    super(msg)
    this.corpo = corpo
    this.status = status
  }
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = tokenSalvo()
  const r = await fetch(BASE + caminho, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const corpo = await r.json().catch(() => ({}))
  // 401 serve tanto para senha errada no login quanto para token vencido;
  // a mensagem do servidor diz qual dos dois.
  if (r.status === 401) throw new NaoAutorizado(corpo.erro ?? 'sessão expirada')
  if (!r.ok) throw new ErroDaApi(corpo.erro ?? `erro ${r.status}`, corpo, r.status)
  return corpo as T
}

const enviar = (metodo: string, corpo?: unknown): RequestInit => ({
  method: metodo,
  body: JSON.stringify(corpo ?? {}),
})

// Campo de texto opcional: só vai no corpo quando foi preenchido.
export function opcional(campo: string, texto?: string): Record<string, string> | undefined {
  const t = texto?.trim()
  return t ? { [campo]: t } : undefined
}

// Frase do erro do login em português comum, sem "Failed to fetch".
export function fraseDoLogin(e: unknown): string {
  if (e instanceof NaoAutorizado) return 'Login ou senha não conferem. Confira e tente de novo.'
  if (e instanceof ErroDaApi && e.status === 429) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  if (e instanceof ErroDaApi && e.status >= 500) return 'O servidor não respondeu. Tente de novo em instantes.'
  if (e instanceof TypeError) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  const msg = e instanceof Error && e.message.trim() ? e.message.trim() : 'Não deu para entrar'
  return msg.charAt(0).toUpperCase() + msg.slice(1) + (/[.!?]$/.test(msg) ? '' : '.')
}

export async function entrar(login: string, senha: string): Promise<Usuario> {
  const r = await pedir<{ token: string; usuario: Usuario }>('/auth/login', enviar('POST', { login, senha }))
  try {
    sessionStorage.setItem(CHAVE_TOKEN, r.token)
  } catch {
    throw new Error('o navegador bloqueou o armazenamento da sessão')
  }
  return r.usuario
}

export const quemSou = () => pedir<Usuario>('/auth/eu')
// Sem ?demo= o servidor decide: com DEMO_CHAMADOS=0 vêm só os relatos reais.
// A chave "Mostrar chamados simulados" pede a demonstração junto.
export const urlDaLista = (simulados: boolean) => `/ocorrencias?limite=5000${simulados ? '&demo=incluir' : ''}`
export const listar = (simulados = false) => pedir<Ocorrencia[]>(urlDaLista(simulados))
export const detalhar = (id: string) => pedir<Ocorrencia>(`/ocorrencias/${id}`)
export const revisar = (id: string, nivel: number) => pedir<Ocorrencia>(`/ocorrencias/${id}/revisao`, enviar('POST', { nivel }))
// Com secretaria, o despacho troca a responsável pelo chamado.
export const despachar = (id: string, observacao?: string, secretaria?: string) =>
  pedir<Ocorrencia>(`/ocorrencias/${id}/despacho`, enviar('POST', { ...opcional('observacao', observacao), ...opcional('secretaria', secretaria) }))
export const secretarias = () => pedir<string[]>('/secretarias')
export const resolver = (id: string, motivo?: string) =>
  pedir<Ocorrencia>(`/ocorrencias/${id}/resolucao`, enviar('POST', opcional('motivo', motivo)))
export const reabrir = (id: string, motivo: string) =>
  pedir<Ocorrencia>(`/ocorrencias/${id}/reabertura`, enviar('POST', { motivo: motivo.trim() }))
// Cada chamada fica no histórico do chamado (evento video_visto): só depois
// do toque do operador. O link devolvido vale validade_s segundos.
// Documento completo de quem relatou: só o gestor; cada abertura fica no
// histórico do chamado (evento documento_visto), sem o número.
export const verDocumento = (id: string, relatoId: string) =>
  pedir<{ documento: string }>(`/ocorrencias/${id}/relatos/${relatoId}/documento`, { method: 'POST' })
// Libera o CPF de quem relatou apagando o cadastro: só o gestor; o relato
// fica no chamado e o histórico guarda quem apagou (evento cadastro_apagado).
export const apagarCadastro = (id: string, relatoId: string) =>
  pedir<Record<string, never>>(`/ocorrencias/${id}/relatos/${relatoId}/morador`, { method: 'DELETE' })
export const abrirVideo = (id: string, midiaId: string) =>
  pedir<{ url: string; validade_s: number }>(`/ocorrencias/${id}/midias/${midiaId}/abertura`, { method: 'POST' })
export const indicadores = (dias: number, soReais: boolean) =>
  pedir<Indicadores>(`/indicadores?dias=${dias}${soReais ? '&reais=1' : ''}`)

export const regras = () => pedir<{ cidade: string; regras: Regra[] }>('/admin/regras')
export const testarRegra = (r: Regra) => pedir<{ ok: boolean; cenarios: Simulado[] }>('/admin/regras/testar', enviar('POST', r))
export const salvarRegra = (r: Regra) =>
  pedir<{ ok: boolean; cenarios: Simulado[] }>(`/admin/regras/${encodeURIComponent(r.arquivo)}`, enviar('PUT', r))
export const categorias = () => pedir<Categoria[]>('/admin/categorias')
export const salvarCategoria = (c: Categoria) => pedir<Categoria>(`/admin/categorias/${c.id}`, enviar('PUT', c))

export type EstadoConexao = 'conectando' | 'ao-vivo' | 'reconectando'

const ESPERA_INICIAL = 1000
const ESPERA_MAXIMA = 15000

// Varia a espera em até 30% para os painéis abertos não reconectarem todos
// no mesmo instante depois de uma queda do servidor.
export function comJitter(ms: number, sorteio: number = Math.random()): number {
  return Math.round(ms * (0.7 + 0.6 * sorteio))
}

// Conecta ao WebSocket /ao-vivo e reconecta com espera crescente.
// Ao (re)conectar, pede uma nova consulta para não perder eventos (ADR 0009).
export function aoVivo(
  aoEvento: (e: EventoAoVivo) => void,
  aoEstado: (s: EstadoConexao) => void,
  aoExpirar: () => void,
): () => void {
  let ws: WebSocket | null = null
  let espera = ESPERA_INICIAL
  let encerrado = false
  let conferindo = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const abrir = () => {
    const token = tokenSalvo()
    if (!token || encerrado) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${proto}//${location.host}${BASE}/ao-vivo?token=${encodeURIComponent(token)}`)
    ws.onopen = () => {
      espera = ESPERA_INICIAL
      aoEstado('ao-vivo')
      aoEvento({ tipo: 'Ressincronizar' })
    }
    ws.onmessage = (m) => {
      try {
        aoEvento(JSON.parse(m.data))
      } catch {
        /* mensagem fora do formato: ignora */
      }
    }
    ws.onclose = () => {
      if (encerrado) return
      aoEstado('reconectando')
      timer = setTimeout(retomar, comJitter(espera))
      espera = Math.min(espera * 2, ESPERA_MAXIMA)
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
      expirou = e instanceof NaoAutorizado
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
    espera = ESPERA_INICIAL
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
