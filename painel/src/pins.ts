import type { Map as MapaGL } from 'maplibre-gl'
import { desenhoDoPino, PINO } from './formas'
import { COR_SEM_NIVEL, NIVEIS, SIMBOLO_CATEGORIA } from './niveis'

// Pinos como na capa do brand kit, com a cabeça na forma do nível
// (formas.ts): losango para o crítico, triângulo, quadrado, gota e meio
// círculo. Cor e forma juntas: o daltônico distingue os cinco níveis. São
// desenhados em canvas e registrados como imagens do mapa, então milhares de
// pinos rodam na GPU (RNF02).
const L = PINO.largura
const A = PINO.altura
const ESCALA = 2

export function nomeDoPin(nivel: number | null, categoria: string): string {
  const cat = categoria in SIMBOLO_CATEGORIA ? categoria : 'outros'
  return `pin-${nivel ?? 0}-${cat}`
}

function desenhar(nivel: number | null, cor: string, simbolo: string): ImageData | null {
  const c = document.createElement('canvas')
  c.width = L * ESCALA
  c.height = A * ESCALA
  const g = c.getContext('2d')
  if (!g || typeof Path2D === 'undefined') return null
  g.scale(ESCALA, ESCALA)
  const d = desenhoDoPino(nivel)
  // Sombra no chão, para o pino parecer espetado no mapa inclinado.
  g.fillStyle = 'rgba(40, 25, 15, 0.22)'
  g.beginPath()
  g.ellipse(PINO.ponta.x, A - 3, 7, 2.6, 0, 0, Math.PI * 2)
  g.fill()
  const corpo = new Path2D(d.caminho)
  g.fillStyle = cor
  g.fill(corpo)
  // Contorno branco largo: separa o pino do mapa e dos vizinhos.
  g.lineJoin = 'round'
  g.lineWidth = 2.5
  g.strokeStyle = '#FFFFFF'
  if (d.tracejado) g.setLineDash([4, 3])
  g.stroke(corpo)
  g.setLineDash([])
  // Miolo branco com o símbolo da categoria.
  g.beginPath()
  g.arc(d.miolo.x, d.miolo.y, d.miolo.r, 0, Math.PI * 2)
  g.fillStyle = '#FFFFFF'
  g.fill()
  g.font = `${Math.round(d.miolo.r * 1.25)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#2B1A10'
  g.fillText(simbolo, d.miolo.x, d.miolo.y + 1)
  return g.getImageData(0, 0, c.width, c.height)
}

export function registrarPins(m: MapaGL) {
  const niveis: [number, string][] = [[0, COR_SEM_NIVEL], ...NIVEIS.map((n): [number, string] => [n.nivel, n.cor])]
  for (const [nivel, cor] of niveis) {
    for (const [cat, simbolo] of Object.entries(SIMBOLO_CATEGORIA)) {
      const nome = `pin-${nivel}-${cat}`
      if (m.hasImage(nome)) continue
      const img = desenhar(nivel || null, cor, simbolo)
      if (img) m.addImage(nome, img, { pixelRatio: ESCALA })
    }
  }
}
