// Resumo da cidade para o gabinete do prefeito: contas puras sobre a lista
// de chamados que o painel já tem, sem DOM, para testar no Node.
import type { Ocorrencia } from './tipos'

export interface Linha {
  nome: string
  n: number
}

export interface ResumoDoGabinete {
  emAberto: number
  criticos: number
  atrasados: number
  resolvidosNaSemana: number
  // Dos resolvidos na semana que tinham prazo, quantos por cento saíram dentro dele; null sem base.
  noPrazoPct: number | null
  simulados: number
  // Chamados em aberto mais graves, com os atrasados na frente.
  atencao: Ocorrencia[]
  porBairro: Linha[]
  porSecretaria: Linha[]
}

const DIA = 24 * 60 * 60 * 1000

function contar(lista: Ocorrencia[], chave: (o: Ocorrencia) => string | null, semNome: string): Linha[] {
  const m = new Map<string, number>()
  for (const o of lista) {
    const k = chave(o)?.trim() || semNome
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  // O que não tem nome vai para o fim, para o lugar de verdade aparecer.
  const sem = (l: Linha) => (l.nome === semNome ? 1 : 0)
  return [...m.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => sem(a) - sem(b) || b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR'))
}

const atrasado = (o: Ocorrencia, agora: Date) => o.prazo_ate != null && new Date(o.prazo_ate).getTime() < agora.getTime()

export function resumirGabinete(lista: Ocorrencia[], agora: Date, quantos = 6): ResumoDoGabinete {
  const abertos = lista.filter((o) => o.status !== 'resolvida')
  const semana = lista.filter((o) => o.status === 'resolvida' && o.resolvido_em != null && agora.getTime() - new Date(o.resolvido_em).getTime() <= 7 * DIA)
  const comPrazo = semana.filter((o) => o.prazo_ate != null)
  const dentro = comPrazo.filter((o) => new Date(o.resolvido_em!).getTime() <= new Date(o.prazo_ate!).getTime())
  const atencao = abertos
    .filter((o) => (o.nivel ?? 0) >= 4)
    .sort(
      (a, b) =>
        (b.nivel ?? 0) - (a.nivel ?? 0) ||
        Number(atrasado(b, agora)) - Number(atrasado(a, agora)) ||
        new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
    )
    .slice(0, quantos)
  return {
    emAberto: abertos.length,
    criticos: abertos.filter((o) => o.nivel === 5).length,
    atrasados: abertos.filter((o) => atrasado(o, agora)).length,
    resolvidosNaSemana: semana.length,
    noPrazoPct: comPrazo.length > 0 ? Math.round((dentro.length / comPrazo.length) * 100) : null,
    simulados: lista.filter((o) => o.demo).length,
    atencao,
    porBairro: contar(abertos, (o) => o.bairro, 'Sem bairro'),
    porSecretaria: contar(abertos, (o) => o.secretaria, 'Sem secretaria'),
  }
}

// "Bom dia", "Boa tarde" ou "Boa noite", pela hora do aparelho.
export function saudacao(agora: Date): string {
  const h = agora.getHours()
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Como o painel chama quem entrou: o nome cadastrado (por exemplo
// "Prefeito Fulano"); sem nome, o cargo.
export function tratamento(nome: string | undefined, cargo: string): string {
  return nome?.trim() || cargo
}
