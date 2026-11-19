import type { StyleSpecification } from 'maplibre-gl'

// Estilo próprio do MOGI sobre os tiles vetoriais do OpenStreetMap servidos
// pelo OpenFreeMap, sem chave (ADR 0004). Claro e em tons de terra, como na
// capa do brand kit: ruas brancas, avenidas em amarelo ipê, quadras e
// prédios em 3D em tons pastel, para os pins coloridos dominarem.
const FONTE = ['Noto Sans Regular']
const FONTE_FORTE = ['Noto Sans Bold']

const largura = (base: number): unknown => ['interpolate', ['exponential', 1.5], ['zoom'], 12, base * 0.5, 15, base * 2, 18, base * 9]

export const ESTILO_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty'

export const ESTILO_MOGI = {
  version: 8,
  name: 'MOGI',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'fundo', type: 'background', paint: { 'background-color': '#F1E9DA' } },
    {
      id: 'verde', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]],
      paint: { 'fill-color': '#D5E4BC', 'fill-opacity': 0.8 },
    },
    {
      id: 'parque', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
      paint: { 'fill-color': '#C6DFA9' },
    },
    {
      id: 'uso', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'school', 'hospital']]],
      paint: { 'fill-color': '#EDE3D1' },
    },
    { id: 'agua', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#A9CBE8' } },
    {
      id: 'rio', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
      paint: { 'line-color': '#A9CBE8', 'line-width': 2 },
    },
    {
      id: 'ruas-borda', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#DCCFB8', 'line-width': largura(3.2) },
    },
    {
      id: 'ruas', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary', 'track', 'path']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FFFFFF', 'line-width': largura(2.4) },
    },
    {
      id: 'avenidas', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'primary', 'trunk', 'motorway']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#F2C94C', 'line-width': largura(3) },
    },
    {
      id: 'building-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
      paint: {
        // Tom pastel pela altura, para as quadras não ficarem todas iguais.
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 4],
          0, '#EAD9C0', 4, '#F0CDB5', 7, '#EBDDA9', 11, '#D3E0BE', 18, '#E8C7B0',
        ],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 4]],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.92,
      },
    },
    {
      id: 'nomes-ruas', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 14.5,
      layout: {
        'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']],
        'text-font': FONTE, 'text-size': 12,
      },
      paint: { 'text-color': '#6B5A48', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
    },
    {
      id: 'nomes-lugares', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      layout: {
        'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']], 'text-font': FONTE_FORTE,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 15, 16],
      },
      paint: { 'text-color': '#4A2C1D', 'text-halo-color': '#F5F1E8', 'text-halo-width': 2 },
    },
  ],
} as unknown as StyleSpecification

// Sem internet para os tiles, o mapa cai neste fundo liso: os pins, o calor
// e as colunas continuam funcionando (plano B da demo, SOP 05).
export const ESTILO_SEM_BASE = {
  version: 8,
  name: 'MOGI sem base',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#F1E9DA' } }],
} as unknown as StyleSpecification
