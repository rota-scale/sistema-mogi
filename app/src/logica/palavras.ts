import { passosNaTela, prazoEmPalavras, ROTULO_DO_PASSO } from './web'
import type { Acompanhamento, PassoNaTela, Status } from './web'

const dois = (n: number) => String(n).padStart(2, '0')

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function data(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const hora = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`
const dia = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`

// Dias de calendário entre duas datas, no fuso do aparelho.
function diasEntre(de: Date, ate: Date): number {
  const a = Date.UTC(de.getFullYear(), de.getMonth(), de.getDate())
  const b = Date.UTC(ate.getFullYear(), ate.getMonth(), ate.getDate())
  return Math.round((b - a) / 86_400_000)
}

// As datas do app web são montadas com Intl, que o motor do React Native
// pode não trazer inteiro. As funções "SemIntl" dão o mesmo texto só com
// Date e entram quando a do web falha; um teste garante que são iguais.

// "12/11 às 14:30" no fuso do aparelho.
export function dataHoraSemIntl(iso: string | null | undefined): string {
  const d = data(iso)
  return d ? `${dia(d)} às ${hora(d)}` : ''
}

// "Até hoje, 18:00", "Até amanhã, 09:00", "Até sexta-feira", "Até 28/11".
export function prazoSemIntl(iso: string | null, status: Status, agora: Date): string | null {
  if (status === 'resolvida') return null
  const d = data(iso)
  if (!d) return 'Na rotina da equipe'
  if (d.getTime() < agora.getTime()) return 'Prazo vencido'
  const dias = diasEntre(agora, d)
  if (dias <= 0) return `Até hoje, ${hora(d)}`
  if (dias === 1) return `Até amanhã, ${hora(d)}`
  if (dias < 7) return `Até ${DIAS[d.getDay()]}`
  return `Até ${dia(d)}`
}

// Prazo em palavras, com a regra do app web.
export function prazo(iso: string | null, status: Status, agora: Date = new Date()): string | null {
  try {
    return prazoEmPalavras(iso, status, agora)
  } catch {
    return prazoSemIntl(iso, status, agora)
  }
}

// Os quatro passos do andamento, com a regra do app web.
export function passos(a: Pick<Acompanhamento, 'passos'>): PassoNaTela[] {
  try {
    return passosNaTela(a)
  } catch {
    const proximo = a.passos.findIndex((p) => !p.feito)
    return a.passos.map((p, i) => ({
      tipo: p.tipo,
      rotulo: ROTULO_DO_PASSO[p.tipo],
      feito: p.feito,
      quando: p.feito ? dataHoraSemIntl(p.quando) : '',
      agora: i === proximo,
    }))
  }
}

// "agora há pouco", "há 20 minutos", "há 2 horas", "há 3 dias".
export function idadeEmPalavras(iso: string | null | undefined, agora: Date = new Date()): string {
  const d = data(iso)
  if (!d) return ''
  const minutos = Math.floor((agora.getTime() - d.getTime()) / 60_000)
  if (minutos < 5) return 'agora há pouco'
  if (minutos < 60) return `há ${minutos} minutos`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return horas === 1 ? 'há 1 hora' : `há ${horas} horas`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

// A primeira frase de um aviso: na tela do app cabe uma linha, e o botão
// logo abaixo já diz o que fazer.
export function fraseCurta(aviso: string): string {
  const fim = aviso.search(/[.!?:](\s|$)/)
  return fim < 0 ? aviso : `${aviso.slice(0, fim)}.`
}
