import { useSyncExternalStore } from 'react'

// Um relógio só para todos os prazos na tela: a cada 30 s avisa quem assina,
// e só esses componentes se redesenham.
const INTERVALO = 30_000
let agora = Date.now()
let timer: ReturnType<typeof setInterval> | undefined
const ouvintes = new Set<() => void>()

function bater() {
  agora = Date.now()
  for (const f of ouvintes) f()
}

function assinar(f: () => void): () => void {
  ouvintes.add(f)
  if (ouvintes.size === 1) {
    // O relógio fica parado sem assinantes; acerta a hora ao religar.
    agora = Date.now()
    timer = setInterval(bater, INTERVALO)
  }
  return () => {
    ouvintes.delete(f)
    if (ouvintes.size === 0) clearInterval(timer)
  }
}

export function useAgora(): number {
  return useSyncExternalStore(assinar, () => agora)
}
