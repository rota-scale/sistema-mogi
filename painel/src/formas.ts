// Forma de cada nível de urgência, tirada do mosaico Bauhaus da marca
// (brand/README.md). A cor nunca vem sozinha: quem não distingue vermelho de
// verde, ou vê a tela em preto e branco, reconhece o nível pela forma.
// O mesmo desenho vale para o pino do mapa (canvas, via Path2D), para a
// legenda e para o selo (SVG).

export type Forma = 'losango' | 'triangulo' | 'quadrado' | 'circulo' | 'meio-circulo' | 'traco'

export const FORMA_DO_NIVEL: Record<number, Forma> = {
  5: 'losango',
  4: 'triangulo',
  3: 'quadrado',
  2: 'circulo',
  1: 'meio-circulo',
  0: 'traco',
}

export const NOME_DA_FORMA: Record<Forma, string> = {
  losango: 'losango',
  triangulo: 'triângulo',
  quadrado: 'quadrado',
  circulo: 'círculo',
  'meio-circulo': 'meio círculo',
  traco: 'traço',
}

export function formaDoNivel(nivel: number | null): Forma {
  return FORMA_DO_NIVEL[nivel ?? 0] ?? 'traco'
}

// Ícone num quadro de 24 x 24, para legenda, selo e botões.
const ICONE: Record<Forma, string> = {
  losango: 'M12 1.5L22.5 12L12 22.5L1.5 12Z',
  triangulo: 'M2.5 4H21.5L12 21Z',
  quadrado: 'M4 4H20V20H4Z',
  circulo: 'M3 12A9 9 0 1 1 21 12A9 9 0 1 1 3 12Z',
  'meio-circulo': 'M2 17A10 10 0 0 1 22 17Z',
  traco: 'M3 10H21V14H3Z',
}

export function caminhoDoIcone(nivel: number | null): string {
  return ICONE[formaDoNivel(nivel)]
}

// Pino do mapa num quadro de 44 x 58, com a ponta em (22, 54): o MapLibre
// ancora a imagem pela base. A cabeça muda de forma; a ponta é a mesma.
export const PINO = { largura: 44, altura: 58, ponta: { x: 22, y: 54 } } as const

const GOTA = 'M22 54C17 42 4 33 4 21A18 18 0 0 1 40 21C40 33 27 42 22 54Z'

const CABECA: Record<Forma, { caminho: string; miolo: { x: number; y: number; r: number } }> = {
  losango: { caminho: 'M22 2L41 23L22 54L3 23Z', miolo: { x: 22, y: 22, r: 10.5 } },
  triangulo: { caminho: 'M3 5H41L22 54Z', miolo: { x: 22, y: 19, r: 10.5 } },
  quadrado: { caminho: 'M7 4H37Q40 4 40 7V34Q40 37 37 37H28L22 54L16 37H7Q4 37 4 34V7Q4 4 7 4Z', miolo: { x: 22, y: 20.5, r: 11 } },
  circulo: { caminho: GOTA, miolo: { x: 22, y: 21, r: 12 } },
  'meio-circulo': { caminho: 'M1 34A21 21 0 0 1 43 34H28L22 54L16 34Z', miolo: { x: 22, y: 24.5, r: 10 } },
  traco: { caminho: GOTA, miolo: { x: 22, y: 21, r: 12 } },
}

export function desenhoDoPino(nivel: number | null) {
  const forma = formaDoNivel(nivel)
  // Sem avaliação: a gota cinza com contorno tracejado, de "ainda não sabemos".
  return { forma, ...CABECA[forma], tracejado: forma === 'traco' }
}

// Texto do leitor de tela e da dica: "Crítico (losango)".
export function rotuloComForma(nome: string, nivel: number | null): string {
  return `${nome} (${NOME_DA_FORMA[formaDoNivel(nivel)]})`
}
