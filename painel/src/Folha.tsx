import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ToqueReact, type ReactNode } from 'react'
import { alturaAoSoltar, NOME_DA_ACAO, ORDEM_DAS_ALTURAS, proximaAltura, type Altura } from './folha'

// Menos que isto é toque, não arrasto.
const FOLGA_DO_TOQUE = 6
// O mesmo tempo da transição no CSS.
const TRANSICAO_MS = 240
const INTERATIVOS = 'button, a, input, select, textarea, summary, label'

interface Gesto {
  id: number
  y: number
  visivel: number
  moveu: boolean
  // Últimas posições, para medir a velocidade ao soltar.
  rastro: { y: number; t: number }[]
}

// Folha deslizante do celular: a fila e o detalhe abrem por cima do mapa, em
// três alturas. Arrasta-se pela alça ou por qualquer área marcada com
// data-arrasta (os cabeçalhos); tocar nelas alterna a altura. No computador
// vira a coluna lateral comum.
export function Folha({
  celular,
  altura,
  alturas,
  aoMudar,
  rotulo,
  children,
}: {
  celular: boolean
  altura: Altura
  alturas: Record<Altura, number>
  aoMudar: (a: Altura) => void
  rotulo: string
  children: ReactNode
}) {
  const [arrasto, setArrasto] = useState<number | null>(null)
  const gesto = useRef<Gesto | null>(null)
  const tocouEm = useRef(0)
  const alvo = alturas[altura]
  // Altura do miolo, que rola por dentro. Ao encolher só muda depois da
  // transição, para o rodapé não pular antes de a folha descer.
  const [miolo, setMiolo] = useState(alvo)
  useEffect(() => {
    if (alvo >= miolo) {
      setMiolo(alvo)
      return
    }
    const t = setTimeout(() => setMiolo(alvo), TRANSICAO_MS)
    return () => clearTimeout(t)
  }, [alvo, miolo])

  if (!celular) {
    return (
      <aside className="lateral" aria-label={rotulo}>
        {children}
      </aside>
    )
  }

  const aoTocar = (e: ToqueReact<HTMLElement>) => {
    const el = e.target as Element
    const pega = el.closest('[data-arrasta]')
    if (!pega || (!el.closest('.folha-alca') && el.closest(INTERATIVOS))) return
    gesto.current = { id: e.pointerId, y: e.clientY, visivel: alvo, moveu: false, rastro: [{ y: e.clientY, t: e.timeStamp }] }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const aoMover = (e: ToqueReact<HTMLElement>) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    const subiu = g.y - e.clientY
    if (!g.moveu && Math.abs(subiu) < FOLGA_DO_TOQUE) return
    g.moveu = true
    g.rastro = [...g.rastro.slice(-4), { y: e.clientY, t: e.timeStamp }]
    setArrasto(Math.max(alturas.recolhida * 0.7, Math.min(alturas.cheia, g.visivel + subiu)))
  }

  const aoSoltar = (e: ToqueReact<HTMLElement>) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    gesto.current = null
    if (!g.moveu) {
      tocouEm.current = e.timeStamp
      aoMudar(proximaAltura(altura))
      return
    }
    const primeiro = g.rastro[0]
    const tempo = Math.max(1, e.timeStamp - primeiro.t)
    const visivel = arrasto ?? alvo
    setMiolo(visivel)
    setArrasto(null)
    aoMudar(alturaAoSoltar(visivel, (primeiro.y - e.clientY) / tempo, alturas))
  }

  const aoCancelar = () => {
    gesto.current = null
    setArrasto(null)
  }

  // Teclado e leitor de tela: o toque do dedo já foi tratado ao soltar.
  const aoClicarNaAlca = (e: { timeStamp: number }) => {
    if (e.timeStamp - tocouEm.current < 500) return
    aoMudar(proximaAltura(altura))
  }

  const visivel = arrasto ?? alvo
  const estilo = {
    height: alturas.cheia,
    transform: `translateY(${Math.round(alturas.cheia - visivel)}px)`,
    '--folha-miolo': `${Math.round(arrasto ?? Math.max(miolo, alvo))}px`,
  } as CSSProperties

  return (
    <aside
      className={'lateral folha ' + altura + (arrasto != null ? ' arrastando' : '')}
      aria-label={rotulo}
      style={estilo}
      onPointerDown={aoTocar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoCancelar}
    >
      <div className="folha-pega" data-arrasta>
        <button
          type="button"
          className="folha-alca"
          aria-label={NOME_DA_ACAO[altura]}
          onClick={aoClicarNaAlca}
          onKeyDown={(e) => {
            const passo = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
            const destino = ORDEM_DAS_ALTURAS[ORDEM_DAS_ALTURAS.indexOf(altura) + passo]
            if (passo !== 0 && destino) {
              e.preventDefault()
              aoMudar(destino)
            }
          }}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <div className="folha-miolo">{children}</div>
    </aside>
  )
}
