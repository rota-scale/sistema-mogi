import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lerVistos, lugarDoChamado, marcarVistos, pendentesDoAlerta, semAviso, tituloDaAba } from './regrasDoAlerta'
import { CHAVE_VISTOS, guardar, lerGuardado, notificar } from './avisos'
import { NOME_CATEGORIA } from './niveis'
import { tocar } from './sons'
import type { Ocorrencia } from './tipos'

// Alerta de chamado crítico: quais estão na faixa, som, notificação e o
// contador no título da aba. "carregada" evita tratar a lista vazia do começo
// como "nenhum crítico".
export function useAlerta({
  lista,
  carregada,
  aberto,
  notificacao,
  aoAbrir,
}: {
  lista: Ocorrencia[]
  carregada: boolean
  aberto: string | null
  notificacao: boolean
  aoAbrir: (id: string) => void
}): { pendentes: Ocorrencia[]; depois: () => void } {
  const [vistos, setVistos] = useState(() => lerVistos(lerGuardado(CHAVE_VISTOS)))
  const pendentes = useMemo(() => (carregada ? pendentesDoAlerta(lista, vistos) : []), [lista, vistos, carregada])
  // null até a primeira carga: o que já estava lá entra na faixa, mas sem som.
  // Depois dela, só toca o que é novo de verdade, inclusive numa ressincronização.
  const avisados = useRef<Set<string> | null>(null)
  const [titulo] = useState(() => document.title)
  const preferencias = useRef({ notificacao, aoAbrir })
  useEffect(() => {
    preferencias.current = { notificacao, aoAbrir }
  })

  const marcar = useCallback((ids: string[]) => setVistos((v) => marcarVistos(v, ids)), [])

  useEffect(() => {
    guardar(CHAVE_VISTOS, JSON.stringify([...vistos]))
  }, [vistos])

  // Abrir o chamado é reconhecer o alerta.
  useEffect(() => {
    if (aberto && pendentes.some((o) => o.id === aberto)) marcar([aberto])
  }, [aberto, pendentes, marcar])

  useEffect(() => {
    if (!carregada) {
      avisados.current = null
      return
    }
    if (avisados.current === null) {
      avisados.current = new Set(pendentes.map((o) => o.id))
      return
    }
    const novos = semAviso(pendentes, avisados.current)
    if (novos.length === 0) return
    for (const o of novos) avisados.current.add(o.id)
    const p = preferencias.current
    // O som acompanha a faixa, que é o sinal visual; desligado, só vibra.
    tocar('critico')
    if (p.notificacao) {
      for (const o of novos) {
        notificar('Chamado crítico', [NOME_CATEGORIA[o.categoria] ?? 'Outros', lugarDoChamado(o)].filter(Boolean).join(', '), o.id, () => p.aoAbrir(o.id))
      }
    }
  }, [pendentes, carregada])

  useEffect(() => {
    document.title = tituloDaAba(pendentes.length, titulo)
    return () => {
      document.title = titulo
    }
  }, [pendentes.length, titulo])

  const depois = useCallback(() => marcar(pendentes.map((o) => o.id)), [marcar, pendentes])
  return { pendentes, depois }
}
