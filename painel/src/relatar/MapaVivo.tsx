import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import { createPortal } from 'react-dom'
import type { Map as MapaGL, Marker } from 'maplibre-gl'
import { carregarMapLibre } from './carga'
import type { MapLibre } from './carga'
import { corDoNivel, diametroDaPrecisao, interpolar, ladoNaTela, passoDoBoneco } from './logica'
import type { Lado, Ponto, Posicao } from './logica'
import { ESTILO_MOGI } from './estilo'
import type { Aparencia } from './boneco'
import { Boneco, ConeDeDirecao, IconePino, IconeRecarregar } from './pecas'
import { pinoEmSvg } from './pino'

const PRAZO_MAPA_MS = 20000
const ZOOM_DE_RUA = 17
const INCLINACAO = 45

const TEXTOS = {
  'Map.Title': 'Mapa',
  'NavigationControl.ZoomIn': 'Aproximar',
  'NavigationControl.ZoomOut': 'Afastar',
  'AttributionControl.ToggleAttribution': 'Créditos do mapa',
}

export interface PinoDoMapa extends Ponto {
  protocolo: string
  nivel: number | null
  rotulo: string
}

export interface ControleDoMapa {
  centro: () => Ponto | null
}

interface Props {
  inicio: Ponto
  // Última leitura do GPS: é onde o boneco fica.
  posicao: Posicao | null
  seguir: boolean
  aoArrastar: () => void
  pinos: PinoDoMapa[]
  // Protocolo do pino que acabou de nascer, para a animação de chegada.
  novo: string | null
  aoTocarPino: (protocolo: string) => void
  // Pino fixo no centro: o mapa vira o seletor do lugar.
  seletor: boolean
  aoFalhar: (detalhe: string) => void
  aoMudarFase?: (fase: Fase) => void
  // Orientação do mapa, como no Waze: norte para cima, ou girando para a
  // direção em que a pessoa anda.
  orientacao?: Orientacao
  // O mapa girou (gesto ou orientação): a bússola acompanha.
  aoGirar?: (graus: number) => void
  // Gesto feito pela pessoa (nunca por movimento automático): o tour usa.
  aoGesto?: (gesto: 'arrastar' | 'zoom' | 'girar') => void
  // O boneco escolhido no Perfil.
  aparencia?: Aparencia
  // Muda a cada toque na bússola, para repetir "norte" depois de um giro à mão.
  orientacaoVez?: number
  ref?: Ref<ControleDoMapa>
}

export type Orientacao = 'norte' | 'rumo'

export type Fase = 'carregando' | 'pronto' | 'falhou'

function criarElemento(classe: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = classe
  return el
}

const semMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Mapa em tela cheia, centrado na pessoa e seguindo o GPS ao vivo.
export default function MapaVivo(props: Props) {
  const { inicio, posicao, seguir, pinos, novo, seletor, ref } = props
  const caixa = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaGL | null>(null)
  const gl = useRef<MapLibre | null>(null)
  const [fase, setFase] = useState<Fase>('carregando')
  const [tentativa, setTentativa] = useState(0)
  const [andando, setAndando] = useState(false)
  const [lado, setLado] = useState<Lado>('direita')
  const [rumo, setRumo] = useState<number | null>(null)
  // Elementos dos marcadores: o boneco é desenhado pelo React dentro deles.
  const [elBoneco] = useState(() => criarElemento('marca-boneco'))
  const [elCirculo] = useState(() => criarElemento('marca-precisao'))
  const [elCone] = useState(() => criarElemento('marca-cone'))
  const marcadores = useRef<{ boneco: Marker; circulo: Marker; cone: Marker } | null>(null)
  const pinosNoMapa = useRef(new Map<string, { marcador: Marker; el: HTMLButtonElement }>())
  // Onde o boneco está desenhado agora (no meio da animação, inclusive).
  const mostrada = useRef<Ponto | null>(null)
  const anterior = useRef<Posicao | null>(null)
  const quadro = useRef(0)
  const parar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const primeira = useRef(true)
  // Até quando o mapa está num voo suave: o passo do boneco não o interrompe.
  const voandoAte = useRef(0)
  const vivo = useRef({ seguir, seletor, posicao, props })

  useEffect(() => {
    vivo.current = { seguir, seletor, posicao, props }
  })

  useImperativeHandle(ref, () => ({
    centro: () => {
      const c = mapa.current?.getCenter()
      return c ? { lat: c.lat, lng: c.lng } : null
    },
  }))

  useEffect(() => {
    props.aoMudarFase?.(fase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  const voar = (m: MapaGL, alvo: Parameters<MapaGL['easeTo']>[0], ms: number) => {
    const duration = semMovimento() ? 0 : ms
    voandoAte.current = performance.now() + duration
    m.easeTo({ ...alvo, duration })
  }

  const ajustarCirculo = () => {
    const m = mapa.current
    const p = vivo.current.posicao
    const d = m && p ? diametroDaPrecisao(p.precisao, p.lat, m.getZoom()) : 0
    elCirculo.style.width = elCirculo.style.height = `${d}px`
    elCirculo.hidden = d === 0
  }

  // Cria o mapa. Nova tentativa recria do zero.
  useEffect(() => {
    let ativo = true
    let m: MapaGL | null = null
    let temTile = false
    let prazo: ReturnType<typeof setTimeout> | undefined
    const pinosAtuais = pinosNoMapa.current

    const soltar = () => {
      marcadores.current?.boneco.remove()
      marcadores.current?.circulo.remove()
      marcadores.current?.cone.remove()
      marcadores.current = null
      for (const { marcador } of pinosAtuais.values()) marcador.remove()
      pinosAtuais.clear()
      m?.remove()
      m = null
      mapa.current = null
    }
    const falhar = (detalhe: string) => {
      if (!ativo) return
      clearTimeout(prazo)
      soltar()
      setFase('falhou')
      vivo.current.props.aoFalhar(detalhe)
    }

    void (async () => {
      let lib: MapLibre
      try {
        lib = await carregarMapLibre()
      } catch {
        falhar('script')
        return
      }
      if (!ativo || !caixa.current) return
      gl.current = lib
      prazo = setTimeout(() => {
        if (!temTile) falhar('prazo')
      }, PRAZO_MAPA_MS)
      const p = vivo.current.posicao
      const centro = mostrada.current ?? p ?? inicio
      try {
        m = new lib.Map({
          container: caixa.current,
          style: ESTILO_MOGI,
          center: [centro.lng, centro.lat],
          zoom: p ? ZOOM_DE_RUA : 15,
          pitch: vivo.current.seletor ? 0 : INCLINACAO,
          minZoom: 4,
          maxZoom: 19,
          // Gestos de mapa 3D, como no Waze: arrastar, pinçar, girar com dois
          // dedos e inclinar arrastando dois dedos para cima ou para baixo.
          maxPitch: 70,
          // Créditos no canto de baixo à esquerda, recolhidos no botão "i".
          attributionControl: false,
          locale: TEXTOS,
        })
      } catch {
        falhar('webgl')
        return
      }
      m.addControl(new lib.AttributionControl({ compact: true }), 'bottom-left')
      m.on('rotate', () => vivo.current.props.aoGirar?.(m!.getBearing()))
      mapa.current = m
      const boneco = new lib.Marker({ element: elBoneco, anchor: 'bottom' })
      const circulo = new lib.Marker({ element: elCirculo, pitchAlignment: 'map', rotationAlignment: 'map' })
      const cone = new lib.Marker({ element: elCone, pitchAlignment: 'map', rotationAlignment: 'map' })
      marcadores.current = { boneco, circulo, cone }
      if (mostrada.current ?? p) {
        const onde = mostrada.current ?? p!
        circulo.setLngLat([onde.lng, onde.lat]).addTo(m)
        cone.setLngLat([onde.lng, onde.lat]).addTo(m)
        boneco.setLngLat([onde.lng, onde.lat]).addTo(m)
        primeira.current = false
      }
      ajustarCirculo()

      const pronto = () => {
        if (!ativo || temTile) return
        // Créditos do mapa recolhidos no botão "i": o mapa fica limpo.
        caixa.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
        temTile = true
        clearTimeout(prazo)
        setFase('pronto')
      }
      m.on('sourcedata', (e) => {
        if (e.tile) pronto()
      })
      m.once('load', pronto)
      m.on('error', () => {
        if (!temTile) falhar('estilo')
      })
      // Arrastar com o dedo para de seguir; o botão de centralizar aparece.
      const daPessoa = (e: unknown) => Boolean((e as { originalEvent?: unknown }).originalEvent)
      m.on('dragstart', (e) => {
        if (!daPessoa(e)) return
        vivo.current.props.aoArrastar()
        vivo.current.props.aoGesto?.('arrastar')
      })
      m.on('zoomstart', (e) => {
        if (daPessoa(e)) vivo.current.props.aoGesto?.('zoom')
      })
      m.on('rotatestart', (e) => {
        if (daPessoa(e)) vivo.current.props.aoGesto?.('girar')
      })
      m.on('pitchstart', (e) => {
        if (daPessoa(e)) vivo.current.props.aoGesto?.('girar')
      })
      m.on('zoom', ajustarCirculo)
    })()

    return () => {
      ativo = false
      clearTimeout(prazo)
      soltar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa])

  // Nova leitura: o boneco anda até ela, e o mapa vai junto se estiver seguindo.
  useEffect(() => {
    const m = mapa.current
    const mk = marcadores.current
    if (!posicao) return
    const passo = passoDoBoneco(anterior.current, posicao)
    anterior.current = posicao
    ajustarCirculo()
    if (!m || !mk) {
      mostrada.current = posicao
      return
    }
    if (primeira.current || !mostrada.current) {
      primeira.current = false
      mostrada.current = posicao
      mk.circulo.setLngLat([posicao.lng, posicao.lat]).addTo(m)
      mk.cone.setLngLat([posicao.lng, posicao.lat]).addTo(m)
      mk.boneco.setLngLat([posicao.lng, posicao.lat]).addTo(m)
      if (seguir && !seletor) {
        voar(m, { center: [posicao.lng, posicao.lat], zoom: ZOOM_DE_RUA, pitch: INCLINACAO }, 1200)
      } else if (seletor) {
        m.jumpTo({ center: [posicao.lng, posicao.lat] })
      }
      return
    }
    if (passo.andando) {
      setAndando(true)
      setLado((l) => ladoNaTela(passo.rumo, m.getBearing(), l))
      if (passo.rumo !== null) {
        setRumo(passo.rumo)
        mk.cone.setRotation(passo.rumo)
        // Modo direção: o mapa gira para onde a pessoa anda.
        if (vivo.current.props.orientacao === 'rumo' && vivo.current.seguir && !vivo.current.seletor) {
          m.easeTo({ bearing: passo.rumo, duration: semMovimento() ? 0 : 600 })
        }
      }
      clearTimeout(parar.current)
      parar.current = setTimeout(() => setAndando(false), passo.duracaoMs + 900)
    }
    const de = mostrada.current
    const ate = { lat: posicao.lat, lng: posicao.lng }
    const duracao = semMovimento() ? 0 : passo.duracaoMs
    const comeco = performance.now()
    cancelAnimationFrame(quadro.current)
    const tique = (agora: number) => {
      const t = duracao > 0 ? (agora - comeco) / duracao : 1
      const p = interpolar(de, ate, t)
      mostrada.current = p
      mk.boneco.setLngLat([p.lng, p.lat])
      mk.circulo.setLngLat([p.lng, p.lat])
      mk.cone.setLngLat([p.lng, p.lat])
      if (vivo.current.seguir && !vivo.current.seletor && performance.now() > voandoAte.current) m.jumpTo({ center: [p.lng, p.lat] })
      if (t < 1) quadro.current = requestAnimationFrame(tique)
    }
    quadro.current = requestAnimationFrame(tique)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicao, fase])

  useEffect(
    () => () => {
      cancelAnimationFrame(quadro.current)
      clearTimeout(parar.current)
    },
    [],
  )

  // Voltar a seguir: o mapa volta para a pessoa, inclinado e de perto.
  useEffect(() => {
    const m = mapa.current
    const p = mostrada.current
    if (!m || !p || !seguir || seletor) return
    voar(m, { center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 16), pitch: INCLINACAO }, 700)
  }, [seguir, seletor, fase])

  // Bússola: norte volta o mapa para cima; direção gira para o último rumo.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    if (props.orientacao === 'norte') voar(m, { bearing: 0 }, 500)
    else if (props.orientacao === 'rumo' && rumo !== null) voar(m, { bearing: rumo }, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.orientacao, props.orientacaoVez, fase])

  // Seletor: mapa reto, para marcar o ponto com precisão.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    if (seletor) voar(m, { pitch: 0, zoom: Math.max(m.getZoom(), 16) }, 500)
  }, [seletor, fase])

  // Pinos dos relatos deste aparelho.
  useEffect(() => {
    const m = mapa.current
    const lib = gl.current
    if (!m || !lib) return
    const atuais = pinosNoMapa.current
    const ficam = new Set(pinos.map((p) => p.protocolo))
    for (const [protocolo, { marcador }] of atuais) {
      if (!ficam.has(protocolo)) {
        marcador.remove()
        atuais.delete(protocolo)
      }
    }
    for (const p of pinos) {
      let item = atuais.get(p.protocolo)
      if (!item) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'pino-meu'
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          vivo.current.props.aoTocarPino(p.protocolo)
        })
        const marcador = new lib.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(m)
        item = { marcador, el }
        atuais.set(p.protocolo, item)
      }
      item.el.innerHTML = pinoEmSvg(corDoNivel(p.nivel), p.nivel)
      item.el.setAttribute('aria-label', p.rotulo)
      item.el.classList.toggle('pino-novo', p.protocolo === novo)
    }
  }, [pinos, novo, fase])

  const tentarDeNovo = () => {
    setFase('carregando')
    setTentativa((t) => t + 1)
  }

  // Sem mapa, uma volta da internet já tenta de novo.
  useEffect(() => {
    if (fase !== 'falhou') return
    const aoVoltar = () => tentarDeNovo()
    window.addEventListener('online', aoVoltar)
    return () => window.removeEventListener('online', aoVoltar)
  }, [fase])

  return (
    <div className="vivo-area">
      <div ref={caixa} className="vivo-caixa" hidden={fase === 'falhou'} />
      {seletor && fase === 'pronto' && (
        <span className="mapa-pino" aria-hidden="true">
          <IconePino />
        </span>
      )}
      {fase === 'falhou' && (
        <button type="button" className="botao-mapa vivo-recarregar" aria-label="Carregar o mapa de novo" onClick={tentarDeNovo}>
          <IconeRecarregar tamanho={26} />
        </button>
      )}
      {createPortal(<Boneco andando={andando} lado={lado} aparencia={props.aparencia} />, elBoneco)}
      {/* O cone só aparece enquanto a pessoa anda. */}
      {createPortal(andando && rumo !== null ? <ConeDeDirecao /> : null, elCone)}
    </div>
  )
}
