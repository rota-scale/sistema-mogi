import { NOME_CATEGORIA } from './niveis'
import type { Ocorrencia } from './tipos'

// Alerta de chamado crítico (benchmark do Waze: a urgência não depende de
// olhar a tela). Aqui fica só a lógica; a faixa, o som e a notificação estão
// em Alerta.tsx e avisos.ts.

// Crítico que ainda espera alguém conferir.
export function criticoParaConferir(o: Ocorrencia): boolean {
  return o.nivel === 5 && o.status === 'revisao'
}

// Chamados que entram na faixa: críticos para conferir que este painel ainda
// não abriu nem deixou para depois. O mais antigo vem primeiro.
export function pendentesDoAlerta(lista: Ocorrencia[], vistos: ReadonlySet<string>): Ocorrencia[] {
  return lista
    .filter((o) => criticoParaConferir(o) && !vistos.has(o.id))
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
}

// Dos pendentes, os que ainda não tocaram som nem viraram notificação.
export function semAviso(pendentes: Ocorrencia[], avisados: ReadonlySet<string>): Ocorrencia[] {
  return pendentes.filter((o) => !avisados.has(o.id))
}

// O painel lembra o que já viu entre uma recarga e outra, sem crescer para sempre.
export const LIMITE_DE_VISTOS = 300

export function marcarVistos(vistos: ReadonlySet<string>, ids: readonly string[], limite = LIMITE_DE_VISTOS): Set<string> {
  const novo = new Set(vistos)
  for (const id of ids) {
    // Tirar e pôr de novo leva o id para o fim: os mais velhos saem primeiro.
    novo.delete(id)
    novo.add(id)
  }
  const sobra = novo.size - limite
  if (sobra > 0) {
    for (const id of [...novo].slice(0, sobra)) novo.delete(id)
  }
  return novo
}

export function lugarDoChamado(o: Ocorrencia): string | null {
  return o.endereco ?? o.bairro ?? null
}

// "Chamado crítico: Água e esgoto, Rua X" ou "3 chamados críticos".
export function textoDoAlerta(pendentes: Ocorrencia[]): string {
  if (pendentes.length === 0) return ''
  if (pendentes.length > 1) return `${pendentes.length} chamados críticos`
  const o = pendentes[0]
  const lugar = lugarDoChamado(o)
  return `Chamado crítico: ${NOME_CATEGORIA[o.categoria] ?? 'Outros'}${lugar ? `, ${lugar}` : ''}`
}

// Título da aba do navegador: "(2) MOGI · Painel" enquanto houver crítico esperando.
export function tituloDaAba(pendentes: number, base: string): string {
  return pendentes > 0 ? `(${pendentes}) MOGI · Painel` : base
}

export function lerVistos(texto: string | null): Set<string> {
  try {
    const lista: unknown = JSON.parse(texto ?? '[]')
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}
