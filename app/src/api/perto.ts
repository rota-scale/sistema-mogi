import { idDoAparelho } from '@/aparelho/identidade'
import { interpretarConfirmacao, lerPerto } from '@/logica/web'
import type { CodigoDaConfirmacao, Proximo, Resposta } from '@/logica/web'
import { pedir } from './base'

// Lista vazia em qualquer falha: "Perto de você" nunca atrapalha o relato.
export async function buscarPerto(lat: number, lng: number): Promise<Proximo[]> {
  const r = await pedir(`/perto?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { prazoMs: 6000 })
  return r.status === 200 ? lerPerto(r.corpo) : []
}

export type Confirmacao = { resposta: Resposta } | { codigo: CodigoDaConfirmacao }

// "Também vi": a chave é a mesma em toda nova tentativa do mesmo toque.
export async function confirmarPerto(ref: string, lat: number, lng: number, chave: string): Promise<Confirmacao> {
  const r = await pedir('/perto/confirmacao', {
    metodo: 'POST',
    corpo: { ref, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) },
    cabecalhos: { 'Idempotency-Key': chave, 'X-Mogi-Aparelho': await idDoAparelho() },
    prazoMs: 20000,
  })
  if (r.status === 0) return { codigo: 'sem_conexao' }
  return interpretarConfirmacao(r.status, r.corpo)
}
