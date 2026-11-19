// Alturas da folha deslizante do celular (princípio 3 do ADR 0017: o mapa
// nunca some). Aqui fica só a conta; o gesto está em Folha.tsx.
export type Altura = 'recolhida' | 'meia' | 'cheia'

export const ORDEM_DAS_ALTURAS: Altura[] = ['recolhida', 'meia', 'cheia']

// Recolhida mostra só a alça e o título.
export const ALTURA_RECOLHIDA = 88
// A folha cheia deixa uma fresta do mapa à vista.
const FRESTA = 8

// Parte visível da folha, em px, em cada altura. "espaco" é a altura da área
// do mapa: o que sobra da janela abaixo do topo e da faixa de alerta.
export function alturasDaFolha(janela: number, espaco: number): Record<Altura, number> {
  const cheia = Math.max(ALTURA_RECOLHIDA, Math.round(Math.min(janela * 0.92, espaco - FRESTA)))
  const meia = Math.max(ALTURA_RECOLHIDA, Math.min(Math.round(janela * 0.5), cheia))
  return { recolhida: ALTURA_RECOLHIDA, meia, cheia }
}

// Toque na alça: sobe um degrau e, da cheia, recolhe.
export function proximaAltura(atual: Altura): Altura {
  return ORDEM_DAS_ALTURAS[(ORDEM_DAS_ALTURAS.indexOf(atual) + 1) % ORDEM_DAS_ALTURAS.length]
}

// Um peteleco mais rápido que isto (px por ms) leva ao degrau seguinte na
// direção do gesto, mesmo sem ter passado da metade do caminho.
const PETELECO = 0.45

// Onde a folha para ao soltar: "velocidade" positiva é para cima.
export function alturaAoSoltar(visivel: number, velocidade: number, alturas: Record<Altura, number>): Altura {
  if (Math.abs(velocidade) >= PETELECO) {
    const candidatas = ORDEM_DAS_ALTURAS.filter((a) => (velocidade > 0 ? alturas[a] > visivel : alturas[a] < visivel))
    if (candidatas.length > 0) return velocidade > 0 ? candidatas[0] : candidatas[candidatas.length - 1]
  }
  return ORDEM_DAS_ALTURAS.reduce((perto, a) => (Math.abs(alturas[a] - visivel) < Math.abs(alturas[perto] - visivel) ? a : perto))
}

export const NOME_DA_ACAO: Record<Altura, string> = {
  recolhida: 'Abrir até a metade da tela',
  meia: 'Abrir na tela toda',
  cheia: 'Recolher e ver o mapa',
}
