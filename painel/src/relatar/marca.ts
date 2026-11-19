// Identidade e acessibilidade do MOGI em funções puras: a forma de cada nível
// (para a urgência nunca depender só da cor), o contraste WCAG, a simulação
// de daltonismo que confere a paleta e o confete geométrico do "resolvido".
// Sem DOM: serve ao web, à equipe de campo e aos testes.

// Formas Bauhaus da marca, uma por nível, as mesmas do painel da central
// (src/formas.ts): o mesmo nível tem a mesma forma em todas as telas. Quem não
// distingue laranja de amarelo ainda vê triângulo e quadrado.
export type FormaDoNivel = 'traco' | 'meio-circulo' | 'circulo' | 'quadrado' | 'triangulo' | 'losango'

const FORMAS: Record<number, FormaDoNivel> = {
  1: 'meio-circulo',
  2: 'circulo',
  3: 'quadrado',
  4: 'triangulo',
  5: 'losango',
}

// Sem nível (ainda a classificar): um traço, que não parece nenhum nível.
export function formaDoNivel(nivel: number | null): FormaDoNivel {
  return (nivel != null && FORMAS[nivel]) || 'traco'
}

// Caminho de cada forma num quadro de 24 x 24 (os mesmos do painel), para o
// React e para os marcadores do mapa, que são montados como texto.
const CAMINHOS: Record<FormaDoNivel, string> = {
  losango: 'M12 1.5L22.5 12L12 22.5L1.5 12Z',
  triangulo: 'M2.5 4H21.5L12 21Z',
  quadrado: 'M4 4H20V20H4Z',
  circulo: 'M3 12A9 9 0 1 1 21 12A9 9 0 1 1 3 12Z',
  'meio-circulo': 'M2 17A10 10 0 0 1 22 17Z',
  traco: 'M3 10H21V14H3Z',
}

export function caminhoDaForma(forma: FormaDoNivel): string {
  return CAMINHOS[forma]
}

function canais(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const cheio = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = Number.parseInt(cheio, 16)
  if (cheio.length !== 6 || Number.isNaN(n)) throw new Error(`cor inválida: ${hex}`)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const paraLinear = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const paraSrgb = (l: number) => {
  const v = Math.min(1, Math.max(0, l))
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255)
}

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map(paraLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Razão de contraste WCAG 2.x, de 1 a 21.
export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export type Daltonismo = 'deuteranopia' | 'protanopia'

// Machado, Oliveira e Fernandes (2009), severidade máxima, em RGB linear.
const MATRIZES: Record<Daltonismo, number[]> = {
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')

// Como a cor aparece para quem tem o daltonismo indicado.
export function simularDaltonismo(hex: string, tipo: Daltonismo): string {
  const [r, g, b] = canais(hex).map(paraLinear)
  const m = MATRIZES[tipo]
  const saida = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b]
  return `#${saida.map((c) => hex2(paraSrgb(c))).join('')}`
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = canais(hex).map(paraLinear)
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

// Diferença perceptível entre duas cores (Delta E 1976). Abaixo de uns 20,
// num marcador pequeno visto no sol, as duas se confundem.
export function diferencaDeCor(a: string, b: string): number {
  const [l1, a1, b1] = lab(a)
  const [l2, a2, b2] = lab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

export type FormaDoConfete = 'losango' | 'circulo' | 'meia-lua' | 'triangulo'

export interface PecaDeConfete {
  // Posição de largada, em % da largura, e queda, em % da altura.
  x: number
  queda: number
  deriva: number
  giro: number
  atrasoMs: number
  tamanho: number
  forma: FormaDoConfete
  cor: string
}

export const CORES_DO_CONFETE = ['#1F4D2B', '#3E7B3A', '#E9B526', '#B3261E', '#3B6EA5'] as const
const FORMAS_DO_CONFETE: FormaDoConfete[] = ['losango', 'circulo', 'meia-lua', 'triangulo']

// Confete curto e sempre igual para a mesma semente: poucas peças, formas da
// marca, nada aleatório que mude a cada renderização.
export function confete(semente: number, quantidade = 18, cores: readonly string[] = CORES_DO_CONFETE): PecaDeConfete[] {
  let s = (Math.abs(Math.floor(semente)) % 2147483646) + 1
  const sorteio = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  const n = Math.max(0, Math.min(40, Math.floor(quantidade)))
  return Array.from({ length: n }, (_, i) => ({
    // Espalha por faixas para não amontoar num canto.
    x: Math.round(((i + sorteio()) / n) * 100 * 10) / 10,
    queda: Math.round(45 + sorteio() * 45),
    deriva: Math.round((sorteio() - 0.5) * 24),
    giro: Math.round((sorteio() - 0.5) * 540),
    atrasoMs: Math.round(sorteio() * 260),
    tamanho: 8 + Math.round(sorteio() * 6),
    forma: FORMAS_DO_CONFETE[i % FORMAS_DO_CONFETE.length],
    cor: cores[i % cores.length],
  }))
}
