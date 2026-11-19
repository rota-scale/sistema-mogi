import { cellToBoundary, latLngToCell } from 'h3-js'
import type { FeatureCollection } from 'geojson'
import type { Ocorrencia } from './tipos'

// Resolução 10 do H3 (cerca de 130 m de largura): no zoom de rua mostra o
// quarteirão que concentra problemas. O banco guarda a 9 (ADR 0006).
const RESOLUCAO = 10

export interface Celula {
  h3: string
  chamados: number
  relatos: number
  peso: number // soma dos níveis: quanto mais alto e mais relatos, maior a coluna
  maior: number // maior nível dentro da célula
}

// Agrupa os chamados abertos por quadrante H3 para as colunas 3D do mapa.
export function agruparPorCelula(lista: Ocorrencia[]): Celula[] {
  const m = new Map<string, Celula>()
  for (const o of lista) {
    if (o.status === 'resolvida') continue
    const h3 = latLngToCell(o.lat, o.lng, RESOLUCAO)
    const c = m.get(h3) ?? { h3, chamados: 0, relatos: 0, peso: 0, maior: 0 }
    const nivel = o.nivel ?? 3
    c.chamados++
    c.relatos += o.relatos
    c.peso += nivel + (o.relatos - 1) * 0.5
    c.maior = Math.max(c.maior, nivel)
    m.set(h3, c)
  }
  return [...m.values()]
}

export function celulasParaGeoJSON(celulas: Celula[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: celulas.map((c) => {
      // formatAsGeoJson devolve [lng, lat] com o anel fechado.
      const anel = cellToBoundary(c.h3, true)
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [anel] },
        properties: { h3: c.h3, chamados: c.chamados, relatos: c.relatos, altura: 6 + c.peso * 5, maior: c.maior },
      }
    }),
  }
}
