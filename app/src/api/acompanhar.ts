import { lerAcompanhamento } from '@/logica/web'
import type { Acompanhamento } from '@/logica/web'
import { pedir } from './base'

export type Consulta = { andamento: Acompanhamento } | { falha: 'nao_encontrado' | 'sem_conexao' }

export async function buscarAndamento(protocolo: string, chave: string): Promise<Consulta> {
  const r = await pedir(`/acompanhar/${encodeURIComponent(protocolo)}?k=${encodeURIComponent(chave)}`)
  if (r.status === 404) return { falha: 'nao_encontrado' }
  const andamento = r.status === 200 ? lerAcompanhamento(r.corpo) : null
  return andamento ? { andamento } : { falha: 'sem_conexao' }
}
