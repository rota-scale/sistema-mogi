import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tocar } from '../sons'
import { IconeFechar, IconeMao } from './pecas'
import { anteriorVisivel, avancar, contagem, PASSOS, proximoVisivel, voltar } from './tour'
import type { Alvo } from './tour'

interface Props {
  passo: number
  // Elemento de cada alvo agora; null quando não está na tela.
  alvo: (a: Alvo) => HTMLElement | null
  aoMudar: (passo: number) => void
  aoFechar: () => void
}

interface Caixa {
  x: number
  y: number
  w: number
  h: number
}

const MARGEM = 8

function medir(el: HTMLElement | null, mapa: boolean): Caixa | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return null
  if (mapa) {
    // O mapa inteiro: recorte com folga das bordas, para o escuro emoldurar.
    return { x: 12, y: Math.max(r.top, 0) + 90, w: window.innerWidth - 24, h: Math.max(160, Math.min(r.height, window.innerHeight) - 260) }
  }
  return { x: r.left - MARGEM, y: r.top - MARGEM, w: r.width + MARGEM * 2, h: r.height + MARGEM * 2 }
}

// Tour guiado sobre o mapa de verdade: escurece a tela, ilumina o que está
// sendo ensinado e explica com uma frase. Nos passos do mapa, a pessoa mexe
// no mapa de verdade (os toques passam pelo escuro) e o passo avança sozinho.
export default function Tour({ passo, alvo, aoMudar, aoFechar }: Props) {
  const p = PASSOS[passo]
  const doMapa = p.alvo === 'mapa'
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const [presentes, setPresentes] = useState<ReadonlySet<Alvo>>(new Set(['mapa']))
  const balao = useRef<HTMLDivElement>(null)
  const frase = useRef<HTMLParagraphElement>(null)

  // Mede o alvo e quais alvos existem; refaz ao girar a tela e de tempos em
  // tempos (botões aparecem e somem conforme o mapa se mexe).
  useLayoutEffect(() => {
    const atualizar = () => {
      const agora = new Set<Alvo>()
      for (const a of ['mapa', 'centralizar', 'camera', 'perfil'] as const) if (alvo(a)) agora.add(a)
      setPresentes((antes) => (antes.size === agora.size && [...agora].every((a) => antes.has(a)) ? antes : agora))
      // Só redesenha quando o alvo mudou de lugar: nada de repintar por cima do mapa à toa.
      const nova = medir(alvo(p.alvo), doMapa)
      setCaixa((antes) =>
        antes && nova && antes.x === nova.x && antes.y === nova.y && antes.w === nova.w && antes.h === nova.h ? antes : nova,
      )
    }
    atualizar()
    const t = setInterval(atualizar, 300)
    window.addEventListener('resize', atualizar)
    return () => {
      clearInterval(t)
      window.removeEventListener('resize', atualizar)
    }
  }, [alvo, p.alvo, doMapa])

  // Alvo sumiu (ex.: o botão de voltar para onde estou antes de arrastar): pula.
  useEffect(() => {
    if (presentes.has(p.alvo)) return
    const t = setTimeout(() => {
      const seguinte = proximoVisivel(passo, presentes)
      if (seguinte === null) aoFechar()
      else if (seguinte !== passo) aoMudar(seguinte)
    }, 600)
    return () => clearTimeout(t)
  }, [presentes, p.alvo, passo, aoMudar, aoFechar])

  useEffect(() => {
    frase.current?.focus()
    tocar('registrado')
  }, [passo])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  const seguir = () => {
    const seguinte = avancar(passo, presentes)
    if (seguinte === null) aoFechar()
    else aoMudar(seguinte)
  }
  const { atual, total } = contagem(passo, presentes)
  const temAnterior = anteriorVisivel(passo - 1, presentes) !== null

  // Balão: em cima quando o alvo está na metade de baixo; nos passos do
  // mapa, no alto, para deixar o mapa livre.
  const embaixo = caixa !== null && !doMapa && caixa.y + caixa.h / 2 < window.innerHeight / 2
  // Horizontal: o balão centraliza no alvo, mas fica dentro da tela com folga,
  // e a seta acompanha o centro do alvo (um alvo na borda não fica sem seta).
  const folga = 16
  const largura = Math.min(440, window.innerWidth - folga * 2)
  const centro = caixa && !doMapa ? caixa.x + caixa.w / 2 : window.innerWidth / 2
  const esquerda = Math.max(folga, Math.min(centro - largura / 2, window.innerWidth - largura - folga))
  const setaX = Math.max(24, Math.min(centro - esquerda, largura - 24))
  const posicaoHorizontal = { left: esquerda, width: largura, right: 'auto', margin: 0, ['--seta-x' as string]: `${setaX}px` }
  const estiloDoBalao =
    doMapa || !caixa
      ? { ...posicaoHorizontal, top: 'calc(var(--topo, 16px) + 8px)' }
      : embaixo
        ? { ...posicaoHorizontal, top: caixa.y + caixa.h + 14 }
        : { ...posicaoHorizontal, bottom: window.innerHeight - caixa.y + 14 }

  return (
    <div className={`tour${doMapa ? ' tour-livre' : ''}`}>
      {caixa && (
        <div
          className={`tour-recorte${doMapa ? ' tour-recorte-mapa' : ''}`}
          style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }}
          aria-hidden="true"
        >
          {p.animacao === 'arrastar' && (
            <span className="tour-mao tour-arrastar">
              <IconeMao tamanho={56} />
            </span>
          )}
          {p.animacao === 'pinca' && (
            <>
              <span className="tour-dedo tour-dedo-a" />
              <span className="tour-dedo tour-dedo-b" />
            </>
          )}
          {p.animacao === 'toque' && (
            <span className="tour-mao tour-tocar">
              <IconeMao tamanho={44} />
            </span>
          )}
          {p.animacao === 'pulso' && <span className="tour-anel" />}
        </div>
      )}

      <div ref={balao} className={`tour-balao${embaixo ? ' seta-cima' : doMapa ? '' : ' seta-baixo'}`} style={estiloDoBalao} role="dialog" aria-label="Passo a passo">
        <div className="tour-cabeca">
          <span className="tour-conta">
            {atual} de {total}
          </span>
          <button type="button" className="tour-pular" onClick={aoFechar}>
            Pular <IconeFechar tamanho={16} />
          </button>
        </div>
        <p ref={frase} tabIndex={-1} className="tour-frase" aria-live="polite">
          {p.frase}
        </p>
        {doMapa && p.avancaCom.length > 0 && <p className="tour-dica">Experimente agora no mapa.</p>}
        <div className="tour-acoes">
          {temAnterior && (
            <button type="button" className="botao botao-secundario" onClick={() => aoMudar(voltar(passo, presentes))}>
              Voltar
            </button>
          )}
          <button type="button" className="botao botao-primario" onClick={seguir}>
            {p.botao}
          </button>
        </div>
      </div>
    </div>
  )
}
