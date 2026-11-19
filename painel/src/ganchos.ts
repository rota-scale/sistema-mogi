import { useEffect, useMemo, useState, useSyncExternalStore, type RefObject } from 'react'
import { alturasDaFolha, type Altura } from './folha'

// Até esta largura o painel é de celular: mapa em tela cheia e folha por cima.
const CELULAR = '(max-width: 980px)'

function assinarCelular(f: () => void): () => void {
  const consulta = window.matchMedia(CELULAR)
  consulta.addEventListener('change', f)
  return () => consulta.removeEventListener('change', f)
}

export function useCelular(): boolean {
  return useSyncExternalStore(assinarCelular, () => window.matchMedia(CELULAR).matches)
}

// Altura do topo, para a conta antes de a área do mapa existir.
const TOPO = 56

function assinarJanela(f: () => void): () => void {
  window.addEventListener('resize', f)
  return () => window.removeEventListener('resize', f)
}

// Alturas da folha dentro de "area" (a área do mapa). Mudam quando o celular
// gira, a barra do navegador some ou a faixa de alerta aparece.
export function useAlturasDaFolha(area: HTMLElement | null): Record<Altura, number> {
  const janela = useSyncExternalStore(assinarJanela, () => window.innerHeight)
  const [espaco, setEspaco] = useState<number | null>(null)
  useEffect(() => {
    if (!area) return
    const medir = () => setEspaco(area.clientHeight)
    medir()
    const olho = new ResizeObserver(medir)
    olho.observe(area)
    return () => olho.disconnect()
  }, [area])
  return useMemo(() => alturasDaFolha(janela, area && espaco ? espaco : janela - TOPO), [janela, area, espaco])
}

// Menu ou painel suspenso: fecha com Esc e com o toque fora dele. O Esc é
// pego antes de chegar ao resto da página e sai marcado, para não fechar
// também o detalhe que está por baixo.
export function useFecharAoSair(ref: RefObject<HTMLElement | null>, aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      fechar()
    }
    const toque = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) fechar()
    }
    window.addEventListener('keydown', tecla, true)
    window.addEventListener('pointerdown', toque, true)
    return () => {
      window.removeEventListener('keydown', tecla, true)
      window.removeEventListener('pointerdown', toque, true)
    }
  }, [ref, aberto, fechar])
}

// Campo em que se digita: atalho de teclado não dispara com o foco nele.
export function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))
}
