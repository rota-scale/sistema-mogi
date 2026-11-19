import { enderecoDaApi, enderecoDoAppWeb } from '@/logica/corpo'

export const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').trim()

export const temServidor = BASE !== ''

// Onde o morador faz o cadastro (o app web do mesmo servidor).
export const APP_WEB = enderecoDoAppWeb(BASE)

export function endereco(caminho: string): string {
  return enderecoDaApi(BASE, caminho)
}

export interface RespostaJson {
  // 0: o pedido não chegou ao servidor (sem rede, prazo ou endereço errado).
  status: number
  corpo: unknown
}

interface Pedido {
  metodo?: 'GET' | 'POST'
  corpo?: unknown
  cabecalhos?: Record<string, string>
  prazoMs?: number
}

// Pedido JSON com prazo. Nunca rejeita: falha de rede vira status 0.
export async function pedir(caminho: string, { metodo = 'GET', corpo, cabecalhos, prazoMs = 15000 }: Pedido = {}): Promise<RespostaJson> {
  const url = endereco(caminho)
  if (!url) return { status: 0, corpo: null }
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), prazoMs)
  try {
    const r = await fetch(url, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...cabecalhos,
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    })
    let json: unknown = null
    try {
      json = await r.json()
    } catch {
      /* corpo vazio ou que não é JSON: vale só o status */
    }
    return { status: r.status, corpo: json }
  } catch {
    return { status: 0, corpo: null }
  } finally {
    clearTimeout(timer)
  }
}

// As fotos do depois vêm como caminho ("/api/midia?...") ou endereço inteiro.
export function enderecoDaMidia(caminho: string): string {
  return /^https?:\/\//i.test(caminho) ? caminho : endereco(caminho)
}
