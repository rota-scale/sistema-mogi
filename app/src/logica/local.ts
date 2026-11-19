import type { SituacaoDoLocal } from './web'

// Frase curta para cada situação em que o GPS não serve; null: está tudo bem.
export function avisoCurtoDoLocal(s: SituacaoDoLocal): string | null {
  switch (s) {
    case 'impreciso':
      return 'GPS impreciso.'
    case 'negado':
      return 'Localização desligada.'
    case 'sem_sinal':
      return 'Sem sinal de GPS.'
    case 'sem_suporte':
      return 'Este aparelho não informa a localização.'
    default:
      return null
  }
}

export type SaidaDoLocal = 'mapa' | 'repetir' | 'ajustes'

// O que oferecer quando o GPS não serve. Sempre há pelo menos uma saída.
export function saidasDoLocal(s: SituacaoDoLocal, temMapa: boolean): SaidaDoLocal[] {
  const saidas: SaidaDoLocal[] = []
  if (s === 'negado') saidas.push('ajustes')
  if (s === 'impreciso' || s === 'sem_sinal' || s === 'negado') saidas.push('repetir')
  if (temMapa && (s === 'impreciso' || s === 'sem_sinal' || s === 'negado' || s === 'sem_suporte')) saidas.push('mapa')
  if (saidas.length === 0 && s === 'sem_suporte') saidas.push('repetir')
  return saidas
}

export const SEM_MAPA_USE_O_SITE = 'Sem localização não dá para enviar por aqui. Use o site do MOGI no navegador.'
