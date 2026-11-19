// Preferências de quem usa o painel, guardadas neste aparelho. Cada uma vira
// um atributo em <html>, e o CSS decide o resto.

// simulados: mostrar na fila e no mapa os chamados da demo (desligado: só relatos reais).
export type Preferencia = 'textoGrande' | 'altoContraste' | 'poucoMovimento' | 'soMapa' | 'simulados'

export type Preferencias = Record<Preferencia, boolean>

export const PADRAO: Preferencias = { textoGrande: false, altoContraste: false, poucoMovimento: false, soMapa: false, simulados: false }

export const CHAVE_PREFERENCIAS = 'mogi.painel.preferencias'

// Lê o que foi guardado; qualquer coisa estranha volta ao padrão.
export function lerPreferencias(ler: (chave: string) => string | null): Preferencias {
  try {
    const bruto = ler(CHAVE_PREFERENCIAS)
    if (!bruto) return PADRAO
    const dado: unknown = JSON.parse(bruto)
    if (!dado || typeof dado !== 'object') return PADRAO
    const d = dado as Record<string, unknown>
    return {
      textoGrande: d.textoGrande === true,
      altoContraste: d.altoContraste === true,
      poucoMovimento: d.poucoMovimento === true,
      soMapa: d.soMapa === true,
      simulados: d.simulados === true,
    }
  } catch {
    return PADRAO
  }
}

export function guardarPreferencias(p: Preferencias, gravar: (chave: string, valor: string) => void): void {
  try {
    gravar(CHAVE_PREFERENCIAS, JSON.stringify(p))
  } catch {
    // Sem armazenamento (aba privada): vale só nesta visita.
  }
}

// Atributos de <html> para cada preferência ligada.
export function atributos(p: Preferencias): Record<string, string | null> {
  return {
    'data-texto': p.textoGrande ? 'grande' : null,
    'data-contraste': p.altoContraste ? 'alto' : null,
    'data-movimento': p.poucoMovimento ? 'reduzido' : null,
  }
}

// O painel deve evitar animação? Vale a preferência do painel ou a do sistema.
export function semMovimento(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.movimento === 'reduzido') return true
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Atalho de teclado do painel para a tecla apertada; null: não é atalho.
export function atalho(tecla: string, comModificador: boolean): 'ajuda' | 'soMapa' | null {
  if (comModificador) return null
  if (tecla === '?') return 'ajuda'
  if (tecla === 'm' || tecla === 'M') return 'soMapa'
  return null
}
