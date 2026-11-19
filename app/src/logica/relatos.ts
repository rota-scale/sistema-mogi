import { estreiaResolvido, lerRecentes, recenteAtualizado } from './web'
import type { Acompanhamento, Recente } from './web'

// O app guarda mais relatos que o site: até dez em "Meus relatos".
export const MAX_RELATOS = 10

// Lê o que estava guardado no aparelho com a mesma regra do app web, item
// por item, para o teto de cinco do site não cortar a lista do app.
export function lerRelatos(bruto: unknown): Recente[] {
  if (!Array.isArray(bruto)) return []
  return bruto.flatMap((item) => lerRecentes([item])).slice(0, MAX_RELATOS)
}

// Mais novo primeiro, sem repetir protocolo, no máximo dez. Se o protocolo
// já estava guardado com ponto e o novo veio sem, o ponto antigo fica.
export function mesclarRelatos(lista: Recente[], novo: Recente): Recente[] {
  const antigo = lista.find((r) => r.protocolo === novo.protocolo)
  const junto = antigo && novo.lat === null ? { ...novo, lat: antigo.lat, lng: antigo.lng } : novo
  return [junto, ...lista.filter((r) => r.protocolo !== novo.protocolo)].slice(0, MAX_RELATOS)
}

export interface Consulta {
  lista: Recente[]
  // O aparelho está vendo este relato resolvido pela primeira vez.
  estreia: boolean
}

// O andamento consultado atualiza a cor do pino e o status guardado, e
// marca o relato resolvido como já visto.
export function aposConsulta(lista: Recente[], a: Acompanhamento): Consulta {
  let estreia = false
  const nova = lista.map((r) => {
    if (r.protocolo !== a.protocolo) return r
    estreia = estreiaResolvido(r, a)
    const atualizado = recenteAtualizado(r, a)
    return a.status === 'resolvida' ? { ...atualizado, viuResolvido: true } : atualizado
  })
  return { lista: nova, estreia }
}
