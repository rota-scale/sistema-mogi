import {
  Map as MapaGL,
  NavigationControl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
  setWorkerUrl,
} from 'maplibre-gl'
import urlDoWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Chave } from './Chave'
import { ESTILO_LIBERTY, ESTILO_MOGI, ESTILO_SEM_BASE } from './estiloMapa'
import { useFecharAoSair } from './ganchos'
import { agruparPorCelula, celulasParaGeoJSON } from './hexagonos'
import { Icone } from './icones'
import { COR_SEM_NIVEL, NIVEIS } from './niveis'
import { nomeDoPin, registrarPins } from './pins'
import { semMovimento } from './preferencias'
import type { Ocorrencia } from './tipos'

// O worker do MapLibre 6 é um arquivo próprio; o Vite entrega a URL dele
// tanto no desenvolvimento quanto no build.
setWorkerUrl(urlDoWorker)

// Centro de Itamogi-MG (Nominatim, relação OSM 315047).
const ITAMOGI: [number, number] = [-47.0486, -21.0793]
const CAMERA_3D = { pitch: 58, bearing: -18 }

const corPorNivel = (campo: string): ExpressionSpecification =>
  ['match', ['coalesce', ['get', campo], 0], ...NIVEIS.flatMap((n) => [n.nivel, n.cor]), COR_SEM_NIVEL] as unknown as ExpressionSpecification

export type Camada = 'pins' | 'calor' | 'colunas'
type Base = 'mogi' | 'liberty'

interface Props {
  ocorrencias: Ocorrencia[]
  selecionada: string | null
  // Chamado que acabou de chegar: ganha um anel de chegada e, com "seguir"
  // ligado e nenhum detalhe aberto, a câmera voa até ele.
  chegada: Ocorrencia | null
  // Faixa de baixo do mapa coberta pela folha do celular, em px: o chamado
  // escolhido é centralizado na parte que sobra à vista.
  recuo: number
  aoSelecionar: (id: string) => void
}

const CAMADAS: { id: Camada; nome: string }[] = [
  { id: 'pins', nome: 'Pinos' },
  { id: 'calor', nome: 'Calor' },
  { id: 'colunas', nome: 'Colunas 3D' },
]

const BASES: { id: Base; nome: string }[] = [
  { id: 'mogi', nome: 'MOGI' },
  { id: 'liberty', nome: 'Padrão' },
]

function paraGeoJSON(lista: Ocorrencia[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lista.map((o) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
      properties: {
        id: o.id,
        nivel: o.nivel ?? 0,
        relatos: o.relatos,
        pin: nomeDoPin(o.nivel, o.categoria),
        // Resolvido fica apagado no mapa; em revisão ganha destaque.
        resolvida: o.status === 'resolvida',
      },
    })),
  }
}

const VAZIO: FeatureCollection = { type: 'FeatureCollection', features: [] }

// montarCamadas recria fontes e camadas de dados. Roda a cada troca de
// estilo, porque o MapLibre descarta tudo junto com o estilo anterior.
function montarCamadas(m: MapaGL) {
  registrarPins(m)
  // Duas fontes com os mesmos pontos: uma agrupa em clusters para os pins,
  // a outra fica crua para o calor e o pulso.
  m.addSource('pontos', { type: 'geojson', data: VAZIO })
  m.addSource('ocorrencias', {
    type: 'geojson',
    data: VAZIO,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 46,
    clusterProperties: { maior: ['max', ['get', 'nivel']], relatos: ['+', ['get', 'relatos']] },
  })
  m.addSource('celulas', { type: 'geojson', data: VAZIO })

  m.addLayer({
    id: 'colunas',
    type: 'fill-extrusion',
    source: 'celulas',
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': corPorNivel('maior'),
      'fill-extrusion-height': ['get', 'altura'],
      'fill-extrusion-opacity': 0.78,
    },
  })
  m.addLayer({
    id: 'calor',
    type: 'heatmap',
    source: 'pontos',
    filter: ['!', ['get', 'resolvida']],
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['/', ['max', ['get', 'nivel'], 2], 5],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 20, 17, 60],
      'heatmap-intensity': 1,
      'heatmap-opacity': 0.6,
      // Uma cor só, do claro ao escuro: intensidade, não categoria.
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(179,38,30,0)', 0.25, 'rgba(233,181,38,0.55)', 0.6, 'rgba(217,130,43,0.8)', 1, 'rgba(179,38,30,0.92)',
      ],
    },
  })
  m.addLayer({
    id: 'pulso',
    type: 'circle',
    source: 'pontos',
    filter: ['all', ['==', ['get', 'nivel'], 5], ['!', ['get', 'resolvida']]],
    paint: {
      'circle-color': 'rgba(179,38,30,0.18)', 'circle-radius': 14,
      'circle-stroke-color': '#B3261E', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'map',
    },
  })
  m.addLayer({
    id: 'chegada',
    type: 'circle',
    source: 'pontos',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-color': 'rgba(31,77,43,0.12)', 'circle-radius': 10,
      'circle-stroke-color': '#1F4D2B', 'circle-stroke-width': 3, 'circle-pitch-alignment': 'map',
    },
  })
  m.addLayer({
    id: 'grupos',
    type: 'circle',
    source: 'ocorrencias',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#FFFFFF',
      'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 40, 26],
      'circle-stroke-color': corPorNivel('maior'),
      'circle-stroke-width': 6,
    },
  })
  m.addLayer({
    id: 'grupos-numero',
    type: 'symbol',
    source: 'ocorrencias',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'],
      'text-size': 15, 'text-allow-overlap': true,
    },
    paint: { 'text-color': '#2B1A10' },
  })
  m.addLayer({
    id: 'pins',
    type: 'symbol',
    source: 'ocorrencias',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'pin'],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      // O pin cresce com os relatos agrupados (ADR 0004).
      'icon-size': ['interpolate', ['linear'], ['get', 'relatos'], 1, 0.95, 6, 1.2],
      // Os mais urgentes ficam por cima.
      'symbol-sort-key': ['get', 'nivel'],
    },
    paint: { 'icon-opacity': ['case', ['get', 'resolvida'], 0.4, 1] },
  })
  // Selo com o número de relatos no canto do pin.
  m.addLayer({
    id: 'relatos-fundo',
    type: 'circle',
    source: 'ocorrencias',
    filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'relatos'], 1]],
    paint: {
      'circle-radius': 10, 'circle-color': '#1F4D2B', 'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2, 'circle-translate': [17, -52],
    },
  })
  m.addLayer({
    id: 'relatos-numero',
    type: 'symbol',
    source: 'ocorrencias',
    filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'relatos'], 1]],
    layout: {
      'text-field': ['to-string', ['get', 'relatos']], 'text-font': ['Noto Sans Bold'], 'text-size': 12,
      'text-allow-overlap': true, 'text-ignore-placement': true,
    },
    paint: { 'text-color': '#FFFFFF', 'text-translate': [17, -52] },
  })
  m.addLayer({
    id: 'selecionado',
    type: 'symbol',
    source: 'pontos',
    filter: ['==', ['get', 'id'], ''],
    layout: { 'icon-image': ['get', 'pin'], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-size': 1.6 },
  })
}

export function Mapa({ ocorrencias, selecionada, chegada, recuo, aoSelecionar }: Props) {
  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaGL | null>(null)
  const [pronto, setPronto] = useState(0) // conta as cargas de estilo
  const [tresD, setTresD] = useState(true)
  const [camada, setCamada] = useState<Camada>('pins')
  const [base, setBase] = useState<Base>('mogi')
  const [seguir, setSeguir] = useState(true)
  const [semBase, setSemBase] = useState(false)
  const [semWebGL, setSemWebGL] = useState(false)
  const [painel, setPainel] = useState(false)
  const caixaDoPainel = useRef<HTMLDivElement>(null)
  const fecharPainel = useCallback(() => setPainel(false), [])
  useFecharAoSair(caixaDoPainel, painel, fecharPainel)
  const aoSelecionarRef = useRef(aoSelecionar)
  aoSelecionarRef.current = aoSelecionar
  // O MapLibre guarda o último recuo; toda mudança de câmera manda o de agora.
  const borda = { top: 0, left: 0, right: 0, bottom: recuo }
  const chegouEm = useRef(-Infinity)
  const temCritico = useRef(false)
  const ligarAnimacao = useRef<() => void>(() => undefined)

  useEffect(() => {
    if (!div.current) return
    let m: MapaGL
    try {
      m = new MapaGL({
        container: div.current,
        style: ESTILO_MOGI,
        center: ITAMOGI,
        zoom: 15.2,
        ...CAMERA_3D,
        maxPitch: 72,
        // Botões do mapa em português, para o leitor de tela e a dica do mouse.
        locale: {
          'Map.Title': 'Mapa',
          'NavigationControl.ZoomIn': 'Aproximar',
          'NavigationControl.ZoomOut': 'Afastar',
          'NavigationControl.ResetBearing': 'Arraste para girar o mapa, clique para voltar ao norte',
          'AttributionControl.ToggleAttribution': 'Créditos do mapa',
        },
        attributionControl: { compact: true },
      })
    } catch {
      setSemWebGL(true)
      return
    }
    mapa.current = m
    m.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')

    // Se os tiles não carregarem (sem internet), troca para o fundo liso
    // uma única vez; os dados continuam no mapa.
    let caiu = false
    let baseOk = false
    m.on('data', (e) => {
      const d = e as { dataType?: string; sourceId?: string; isSourceLoaded?: boolean }
      if (d.dataType === 'source' && d.sourceId !== undefined && !['pontos', 'ocorrencias', 'celulas'].includes(d.sourceId) && d.isSourceLoaded) baseOk = true
    })
    const cair = () => {
      if (caiu || baseOk) return
      caiu = true
      setSemBase(true)
      m.setStyle(ESTILO_SEM_BASE)
    }
    m.on('error', (e) => {
      // Um tile que falha depois de a base carregar não derruba o mapa.
      const fonte = (e as { sourceId?: string }).sourceId
      if (fonte === 'openmaptiles' || fonte === 'openfreemap' || !m.isStyleLoaded()) cair()
    })
    const semResposta = setTimeout(() => {
      if (!m.isStyleLoaded()) cair()
    }, 8000)

    m.on('style.load', () => {
      clearTimeout(semResposta)
      if (m.getSource('ocorrencias')) return
      montarCamadas(m)
      setPronto((n) => n + 1)
    })
    m.on('click', (e: MapLayerMouseEvent) => {
      const alvo = m.queryRenderedFeatures(e.point, { layers: ['selecionado', 'pins', 'grupos'].filter((l) => m.getLayer(l)) })[0]
      if (!alvo) return
      if (alvo.properties?.cluster) {
        // Abre o grupo: aproxima até os pins se separarem.
        const [lng, lat] = (alvo.geometry as GeoJSON.Point).coordinates
        m.easeTo({ center: [lng, lat], zoom: Math.min(m.getZoom() + 1.6, 17.5), duration: 500 })
      } else if (alvo.properties?.id) {
        aoSelecionarRef.current(String(alvo.properties.id))
      }
    })
    m.on('mousemove', (e) => {
      const sobre = m.queryRenderedFeatures(e.point, { layers: ['pins', 'grupos'].filter((l) => m.getLayer(l)) }).length > 0
      m.getCanvas().style.cursor = sobre ? 'pointer' : ''
    })

    // Vermelho pulsa e o recém-chegado abre um anel (ADR 0004), exceto com
    // movimento reduzido.
    const reduzido = semMovimento()
    let quadro = 0
    const animar = (t: number) => {
      quadro = 0
      const anel = performance.now() - chegouEm.current < 6000
      if (temCritico.current && m.getLayer('pulso')) {
        const fase = (t % 1800) / 1800
        m.setPaintProperty('pulso', 'circle-radius', 14 + fase * 26)
        m.setPaintProperty('pulso', 'circle-stroke-opacity', 1 - fase)
        m.setPaintProperty('pulso', 'circle-opacity', 1 - fase)
      }
      if (m.getLayer('chegada')) {
        const fase = (t % 1200) / 1200
        m.setPaintProperty('chegada', 'circle-radius', anel ? 12 + fase * 44 : 0)
        m.setPaintProperty('chegada', 'circle-stroke-opacity', anel ? 1 - fase : 0)
        m.setPaintProperty('chegada', 'circle-opacity', anel ? 1 - fase : 0)
      }
      // Sem crítico no mapa nem anel aberto, o laço para de redesenhar; os
      // efeitos de dados e de chegada religam quando voltar a haver.
      if (temCritico.current || anel) quadro = requestAnimationFrame(animar)
    }
    ligarAnimacao.current = () => {
      if (!reduzido && !quadro) quadro = requestAnimationFrame(animar)
    }

    return () => {
      clearTimeout(semResposta)
      ligarAnimacao.current = () => undefined
      cancelAnimationFrame(quadro)
      m.remove()
      mapa.current = null
    }
  }, [])

  // Dados nas fontes.
  useEffect(() => {
    const m = mapa.current
    if (!pronto || !m) return
    const dados = paraGeoJSON(ocorrencias)
    ;(m.getSource('ocorrencias') as GeoJSONSource | undefined)?.setData(dados)
    ;(m.getSource('pontos') as GeoJSONSource | undefined)?.setData(dados)
    ;(m.getSource('celulas') as GeoJSONSource | undefined)?.setData(celulasParaGeoJSON(agruparPorCelula(ocorrencias)))
    // Mesmo critério do filtro da camada "pulso".
    temCritico.current = ocorrencias.some((o) => o.nivel === 5 && o.status !== 'resolvida')
    ligarAnimacao.current()
  }, [ocorrencias, pronto])

  // Camada de dados escolhida.
  useEffect(() => {
    const m = mapa.current
    if (!pronto || !m) return
    m.setLayoutProperty('calor', 'visibility', camada === 'calor' ? 'visible' : 'none')
    m.setLayoutProperty('colunas', 'visibility', camada === 'colunas' ? 'visible' : 'none')
  }, [camada, pronto])

  // Seleção: destaca o pin e centraliza na parte do mapa que a folha não cobre.
  useEffect(() => {
    const m = mapa.current
    if (!pronto || !m) return
    m.setFilter('selecionado', ['==', ['get', 'id'], selecionada ?? ''])
    const o = ocorrencias.find((x) => x.id === selecionada)
    if (o) m.easeTo({ center: [o.lng, o.lat], zoom: Math.max(m.getZoom(), 16), padding: borda, duration: 700 })
    // Só reage à troca de seleção e à altura da folha, não a cada evento novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada, recuo, pronto])

  // Chegada ao vivo: anel no ponto e, com "seguir" ligado, voo de câmera.
  // Com um detalhe aberto a câmera fica onde está, para não tirar o chamado
  // em atendimento da frente do operador.
  useEffect(() => {
    const m = mapa.current
    if (!pronto || !m || !chegada) return
    chegouEm.current = performance.now()
    m.setFilter('chegada', ['==', ['get', 'id'], chegada.id])
    ligarAnimacao.current()
    if (seguir && !selecionada) {
      m.flyTo({
        center: [chegada.lng, chegada.lat], zoom: 16.6, pitch: tresD ? 62 : 0,
        bearing: tresD ? m.getBearing() + 25 : 0, padding: borda, duration: 2200, essential: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chegada, pronto])

  const alternar3D = () => {
    const m = mapa.current
    if (!m) return
    const novo = !tresD
    setTresD(novo)
    m.easeTo({ pitch: novo ? CAMERA_3D.pitch : 0, bearing: novo ? CAMERA_3D.bearing : 0, duration: 600 })
    if (m.getLayer('building-3d')) m.setLayoutProperty('building-3d', 'visibility', novo ? 'visible' : 'none')
  }

  const trocarBase = (nova: Base) => {
    const m = mapa.current
    if (!m || semBase || nova === base) return
    setBase(nova)
    const estilo: StyleSpecification | string = nova === 'mogi' ? ESTILO_MOGI : ESTILO_LIBERTY
    m.setStyle(estilo)
  }

  const centralizar = () => {
    mapa.current?.flyTo({ center: ITAMOGI, zoom: 15.2, ...(tresD ? CAMERA_3D : { pitch: 0, bearing: 0 }), padding: borda, duration: 900 })
    setPainel(false)
  }

  if (semWebGL) {
    return (
      <div className="mapa mapa-vazio" role="alert">
        Este navegador não tem WebGL. Abra o painel no Chrome, Edge ou Firefox atualizados.
      </div>
    )
  }

  return (
    <div className="mapa">
      <div ref={div} className="mapa-tela" aria-label="Mapa de Itamogi com as ocorrências" />
      <div className="camadas" ref={caixaDoPainel}>
        <button type="button" className="botao-mapa" aria-expanded={painel} aria-controls="painel-de-camadas" aria-label="Camadas do mapa" title="Camadas do mapa" onClick={() => setPainel((p) => !p)}>
          <Icone nome="camadas" tamanho={24} />
        </button>
        {painel && (
          <div className="camadas-painel" id="painel-de-camadas" role="group" aria-label="Camadas do mapa">
            <div className="camadas-grupo" role="radiogroup" aria-label="Mostrar como">
              <span className="camadas-titulo">Mostrar como</span>
              <div className="segmento">
                {CAMADAS.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={camada === c.id} className={camada === c.id ? 'ligado' : ''} onClick={() => setCamada(c.id)}>
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>
            <Chave nome="Mapa em 3D" ligada={tresD} aoMudar={alternar3D} />
            <Chave nome="Seguir chamados novos" ligada={seguir} aoMudar={() => setSeguir((v) => !v)} />
            {!semBase && (
              <div className="camadas-grupo" role="radiogroup" aria-label="Estilo do mapa">
                <span className="camadas-titulo">Estilo do mapa</span>
                <div className="segmento">
                  {BASES.map((b) => (
                    <button key={b.id} type="button" role="radio" aria-checked={base === b.id} className={base === b.id ? 'ligado' : ''} onClick={() => trocarBase(b.id)}>
                      {b.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="botao-secundario" onClick={centralizar}>
              Voltar ao centro
            </button>
          </div>
        )}
      </div>
      {semBase && (
        <p className="mapa-aviso" role="status">
          Mapa base indisponível (sem internet para os tiles). Os relatos continuam ao vivo.
        </p>
      )}
    </div>
  )
}
