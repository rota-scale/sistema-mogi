import { ErroDaApi, NaoAutorizado, tokenSalvo } from './api'
import { comoFrase, type Cadastro, type DadosDaOperacao, type Papel, type Parametros, type RespostaDeParametros } from './gestor'

const BASE = '/api'

function cabecalhos(json: boolean): Record<string, string> {
  const token = tokenSalvo()
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// Mesmo contrato do pedir de api.ts, que não é exportado: 401 vira
// NaoAutorizado e os demais erros levam a frase do servidor e o status.
async function pedir<T>(caminho: string, metodo = 'GET', corpo?: unknown): Promise<T> {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: cabecalhos(true),
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const resposta = await r.json().catch(() => ({}))
  if (r.status === 401) throw new NaoAutorizado(resposta.erro ?? 'sessão expirada')
  if (!r.ok) throw new ErroDaApi(resposta.erro ?? `erro ${r.status}`, resposta, r.status)
  return resposta as T
}

export const operacao = () => pedir<DadosDaOperacao>('/operacao')

export const usuarios = () => pedir<Cadastro[]>('/admin/usuarios')
export const secretarias = () => pedir<string[]>('/secretarias')

export interface NovoUsuario {
  login: string
  nome: string
  senha: string
  papel: Papel
  secretaria: string
}
export const criarUsuario = (u: NovoUsuario) => pedir<Cadastro>('/admin/usuarios', 'POST', u)

export type MudancaDeUsuario = Partial<{ nome: string; papel: Papel; secretaria: string; senha: string; ativo: boolean }>
export const atualizarUsuario = (login: string, m: MudancaDeUsuario) =>
  pedir<Cadastro>(`/admin/usuarios/${encodeURIComponent(login)}`, 'PUT', m)

export const parametros = () => pedir<RespostaDeParametros>('/admin/parametros')
export const salvarParametros = (p: Parametros) => pedir<RespostaDeParametros>('/admin/parametros', 'PUT', p)

// O relatório precisa do cabeçalho de autorização, então não serve um link
// simples: o arquivo é baixado aqui e entregue por um link temporário.
export async function baixarRelatorio(dias: number): Promise<void> {
  const r = await fetch(`${BASE}/relatorio.csv?dias=${dias}`, { headers: cabecalhos(false) })
  if (r.status === 401) throw new NaoAutorizado('sessão expirada')
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}))
    throw new ErroDaApi(corpo.erro ?? `erro ${r.status}`, corpo, r.status)
  }
  const nome = /filename="?([^";]+)"?/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? `mogi-relatorio-${dias}d.csv`
  const url = URL.createObjectURL(await r.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  // O navegador ainda está lendo o arquivo logo depois do clique.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const SO_O_GESTOR = 'Só o gestor vê esta tela.'

// Qualquer falha como uma frase para a tela, dizendo o que fazer.
export function fraseDoErro(e: unknown): string {
  if (e instanceof NaoAutorizado) return 'Sua sessão expirou. Saia e entre de novo.'
  if (e instanceof ErroDaApi) {
    if (e.status === 403) return SO_O_GESTOR
    if (e.status >= 500 && /^erro \d+$/.test(e.message)) return 'O servidor não respondeu direito. Tente de novo em instantes.'
    return comoFrase(e.message)
  }
  // O fetch rejeita com TypeError quando não chega ao servidor.
  if (e instanceof TypeError) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  return e instanceof Error ? comoFrase(e.message) : 'Algo deu errado. Tente de novo.'
}

export const semPermissao = (e: unknown) => e instanceof ErroDaApi && e.status === 403
