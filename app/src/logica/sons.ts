// Sons do app, com o mesmo propósito, volume e intervalo do app web
// (painel/src/sons.ts). O arquivo do web mexe com o navegador e não pode
// ser importado aqui; um teste compara as duas tabelas.
export type Som = 'camera' | 'foto' | 'gravar' | 'parar' | 'enviado' | 'pino' | 'tambem_vi' | 'resolvido' | 'erro'

export interface Definicao {
  arquivo: string
  volume: number
  // Intervalo mínimo entre duas vezes do mesmo som.
  intervaloMs: number
  vibrar?: number[]
}

export const SONS: Record<Som, Definicao> = {
  camera: { arquivo: 'camera', volume: 0.5, intervaloMs: 300 },
  foto: { arquivo: 'foto', volume: 0.7, intervaloMs: 120, vibrar: [12] },
  gravar: { arquivo: 'gravar', volume: 0.6, intervaloMs: 300, vibrar: [20] },
  parar: { arquivo: 'parar', volume: 0.6, intervaloMs: 300, vibrar: [12] },
  enviado: { arquivo: 'enviado', volume: 0.7, intervaloMs: 1500, vibrar: [15, 60, 25] },
  pino: { arquivo: 'pino', volume: 0.5, intervaloMs: 400 },
  tambem_vi: { arquivo: 'tambem-vi', volume: 0.6, intervaloMs: 800, vibrar: [15] },
  resolvido: { arquivo: 'resolvido', volume: 0.7, intervaloMs: 1500, vibrar: [15, 50, 15, 50, 30] },
  erro: { arquivo: 'erro', volume: 0.6, intervaloMs: 1000, vibrar: [40, 60, 40] },
}

// Decide, sem efeito colateral, se o som toca agora.
export function pode(ultimas: Partial<Record<Som, number>>, som: Som, agora: number): boolean {
  const antes = ultimas[som]
  return antes === undefined || agora - antes >= SONS[som].intervaloMs
}

export type Toque = 'leve' | 'certo' | 'erro'

// O celular não repete o padrão de vibração do navegador: um pulso vira um
// toque leve, e os padrões longos viram o toque de sucesso ou de erro do
// sistema. Som sem vibração no web fica sem toque aqui também.
export function toqueDoSom(som: Som): Toque | null {
  const padrao = SONS[som].vibrar
  if (!padrao || padrao.length === 0) return null
  if (som === 'erro') return 'erro'
  return padrao.length === 1 ? 'leve' : 'certo'
}
