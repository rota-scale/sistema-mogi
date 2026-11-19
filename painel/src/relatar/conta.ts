import { corpoDaEdicao, corpoDoCadastro, interpretarCadastro, interpretarEntrada, lerComunidade, lerMeusRelatos, lerMorador, somenteDigitos } from './cadastro'
import type { Comunidade, EdicaoDoPerfil, FalhaDaEntrada, FalhaDoCadastro, FormularioDoCadastro, MeusRelatos, Morador } from './cadastro'

// Cadastro do morador no aparelho: só o token e o perfil já mascarado
// (o documento completo nunca fica guardado aqui).
const CHAVE_TOKEN = 'mogi.token'
const CHAVE_MORADOR = 'mogi.morador'

// Sem armazenamento (aba privada), o token vale só nesta visita.
let tokenDaVisita: string | null = null

export function tokenSalvo(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN) || tokenDaVisita
  } catch {
    return tokenDaVisita
  }
}

export function moradorSalvo(): Morador | null {
  try {
    return lerMorador(JSON.parse(localStorage.getItem(CHAVE_MORADOR) ?? 'null'))
  } catch {
    return null
  }
}

export function guardarConta(token: string, morador: Morador) {
  tokenDaVisita = token
  try {
    localStorage.setItem(CHAVE_TOKEN, token)
    localStorage.setItem(CHAVE_MORADOR, JSON.stringify(morador))
  } catch {
    /* fica só na memória desta visita */
  }
}

export function guardarMorador(morador: Morador) {
  try {
    localStorage.setItem(CHAVE_MORADOR, JSON.stringify(morador))
  } catch {
    /* idem */
  }
}

// Sair: o aparelho esquece o cadastro. Apagar a conta também esquece os relatos.
export function esquecerConta(tudo = false) {
  tokenDaVisita = null
  try {
    localStorage.removeItem(CHAVE_TOKEN)
    localStorage.removeItem(CHAVE_MORADOR)
    if (tudo) localStorage.removeItem('mogi.relatos')
  } catch {
    /* nada guardado */
  }
}

export function cabecalhoDoToken(): Record<string, string> {
  const t = tokenSalvo()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

interface Pedido {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  corpo?: unknown
  prazoMs?: number
}

// Pedido JSON com prazo. Nunca rejeita: falha de rede vira status 0.
async function pedir(url: string, { metodo = 'GET', corpo, prazoMs = 12000 }: Pedido = {}): Promise<{ status: number; corpo: unknown }> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), prazoMs)
  try {
    const r = await fetch(url, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...cabecalhoDoToken(),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
      cache: 'no-store',
    })
    let json: unknown = null
    try {
      json = await r.json()
    } catch {
      /* corpo vazio (204) ou que não é JSON */
    }
    return { status: r.status, corpo: json }
  } catch {
    return { status: 0, corpo: null }
  } finally {
    clearTimeout(timer)
  }
}

// O código de recuperação volta uma vez só e não fica guardado no aparelho:
// a tela mostra para a pessoa anotar.
export async function cadastrar(f: FormularioDoCadastro): Promise<{ morador: Morador; codigo: string | null } | { falha: FalhaDoCadastro }> {
  const r = await pedir('/api/moradores', { metodo: 'POST', corpo: corpoDoCadastro(f), prazoMs: 15000 })
  const lido = interpretarCadastro(r.status, r.corpo)
  if ('falha' in lido) return lido
  guardarConta(lido.token, lido.morador)
  return { morador: lido.morador, codigo: lido.codigo }
}

// Entrar em outro aparelho: documento e código. Derruba o token dos outros.
export async function entrar(documento: string, codigo: string): Promise<{ morador: Morador } | { falha: FalhaDaEntrada }> {
  const r = await pedir('/api/moradores/entrar', { metodo: 'POST', corpo: { documento: somenteDigitos(documento), codigo }, prazoMs: 15000 })
  const lido = interpretarEntrada(r.status, r.corpo)
  if ('falha' in lido) return lido
  guardarConta(lido.token, lido.morador)
  return { morador: lido.morador }
}

// "sem_cadastro": o servidor não reconhece o token (conta apagada em outro
// aparelho, por exemplo). O app esquece o token e oferece o cadastro de novo.
export type Leitura<T> = { dados: T } | { falha: 'sem_cadastro' | 'sem_conexao' }

function leitura<T>(r: { status: number; corpo: unknown }, ler: (b: unknown) => T | null): Leitura<T> {
  if (r.status === 401) {
    esquecerConta()
    return { falha: 'sem_cadastro' }
  }
  const dados = r.status === 200 ? ler(r.corpo) : null
  return dados ? { dados } : { falha: 'sem_conexao' }
}

export async function buscarEu(): Promise<Leitura<Morador>> {
  const r = leitura(await pedir('/api/eu'), lerMorador)
  if ('dados' in r) guardarMorador(r.dados)
  return r
}

export async function editarEu(d: EdicaoDoPerfil): Promise<Leitura<Morador>> {
  const r = leitura(await pedir('/api/eu', { metodo: 'PUT', corpo: corpoDaEdicao(d) }), lerMorador)
  if ('dados' in r) guardarMorador(r.dados)
  return r
}

export async function apagarEu(): Promise<boolean> {
  const r = await pedir('/api/eu', { metodo: 'DELETE' })
  if (r.status === 204 || r.status === 200 || r.status === 401 || r.status === 404) {
    esquecerConta(true)
    return true
  }
  return false
}

export async function buscarMeusRelatos(): Promise<Leitura<MeusRelatos>> {
  return leitura(await pedir('/api/eu/relatos'), lerMeusRelatos)
}

const campoTexto = (c: Record<string, unknown>, k: string) => (typeof c[k] === 'string' ? (c[k] as string).trim() : '')

// Rua, bairro, cidade e estado do ponto do GPS, para o cadastro preencher sozinho.
export async function buscarEndereco(
  lat: number,
  lng: number,
): Promise<{ endereco: string; bairro: string; cidade: string; uf: string } | null> {
  const r = await pedir(`/api/endereco?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { prazoMs: 8000 })
  if (r.status !== 200 || typeof r.corpo !== 'object' || r.corpo === null) return null
  const c = r.corpo as Record<string, unknown>
  const e = { endereco: campoTexto(c, 'endereco'), bairro: campoTexto(c, 'bairro'), cidade: campoTexto(c, 'cidade'), uf: campoTexto(c, 'uf') }
  return e.bairro || e.endereco || e.cidade ? e : null
}

// Cidade, estado e bairro pelo CEP. "nao_achou": o CEP não existe;
// "sem_conexao": a busca não respondeu, a pessoa escolhe a cidade à mão.
export async function buscarCep(
  cep: string,
): Promise<{ cidade: string; uf: string; bairro: string; ibge: string } | 'nao_achou' | 'sem_conexao'> {
  const d = cep.replace(/\D/g, '')
  if (d.length !== 8) return 'nao_achou'
  const r = await pedir(`/api/cep/${d}`, { prazoMs: 8000 })
  if (r.status === 404 || r.status === 400) return 'nao_achou'
  if (r.status !== 200 || typeof r.corpo !== 'object' || r.corpo === null) return 'sem_conexao'
  const c = r.corpo as Record<string, unknown>
  const cidade = campoTexto(c, 'cidade')
  return cidade ? { cidade, uf: campoTexto(c, 'uf'), bairro: campoTexto(c, 'bairro'), ibge: campoTexto(c, 'ibge') } : 'nao_achou'
}

export async function buscarComunidade(lat: number, lng: number): Promise<Comunidade | null> {
  const r = await pedir(`/api/comunidade?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { prazoMs: 10000 })
  return r.status === 200 ? lerComunidade(r.corpo) : null
}
