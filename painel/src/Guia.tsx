import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './guia.css'
import { chaveDoGuia, passosDoGuia } from './guia'
import type { PapelDoGuia } from './guia'

interface Props {
  papel: PapelDoGuia
  celular: boolean
  aoFechar: () => void
}

interface Caixa {
  x: number
  y: number
  w: number
  h: number
}

function medir(seletor: string | null): Caixa | null {
  if (!seletor) return null
  const el = document.querySelector(seletor)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return null
  const m = 6
  return { x: r.left - m, y: r.top - m, w: r.width + m * 2, h: r.height + m * 2 }
}

// Guia de primeiro uso da prefeitura: escurece a tela, ilumina uma área por
// vez e explica com uma frase. Pular sempre à vista; não volta sozinho.
export default function Guia({ papel, celular, aoFechar }: Props) {
  const passos = passosDoGuia(papel, celular)
  const [i, setI] = useState(0)
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const p = passos[i]
  const ultimo = i === passos.length - 1

  const fechar = () => {
    try {
      localStorage.setItem(chaveDoGuia(papel), 'visto')
    } catch {
      // aba privada: mostra de novo na próxima vez
    }
    aoFechar()
  }

  useLayoutEffect(() => {
    const atualizar = () => setCaixa(medir(p.alvo))
    atualizar()
    const t = setInterval(atualizar, 400)
    window.addEventListener('resize', atualizar)
    return () => {
      clearInterval(t)
      window.removeEventListener('resize', atualizar)
    }
  }, [p.alvo])

  useEffect(() => {
    titulo.current?.focus()
  }, [i])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cartão perto do alvo: embaixo se o alvo está no alto, em cima se está embaixo.
  // Sem alvo (ou alvo fora da tela), no meio.
  const alto = window.innerHeight
  const largo = window.innerWidth
  // Em tela larga, o cartão fica alinhado ao alvo; no celular, ocupa a largura.
  const horizontal =
    caixa !== null && largo > 720 ? { left: Math.min(Math.max(16, caixa.x + caixa.w / 2 - 210), largo - 436), right: 'auto', margin: 0 } : {}
  const estilo =
    caixa === null
      ? { top: '50%', transform: 'translateY(-50%)' }
      : caixa.y + caixa.h / 2 < alto / 2
        ? { ...horizontal, top: Math.min(caixa.y + caixa.h + 14, alto - 260) }
        : { ...horizontal, bottom: Math.min(alto - caixa.y + 14, alto - 260) }

  return (
    <div className="guia" role="dialog" aria-modal="true" aria-labelledby="guia-titulo">
      {caixa ? (
        <div className="guia-recorte" style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }} aria-hidden="true" />
      ) : (
        <div className="guia-fundo" aria-hidden="true" />
      )}
      <div className="guia-cartao" style={estilo}>
        <div className="guia-cabeca">
          <span className="guia-conta">
            {i + 1} de {passos.length}
          </span>
          {!ultimo && (
            <button type="button" className="guia-pular" onClick={fechar}>
              Pular
            </button>
          )}
        </div>
        <h2 id="guia-titulo" ref={titulo} tabIndex={-1} className="guia-titulo">
          {p.titulo}
        </h2>
        <p className="guia-frase" aria-live="polite">
          {p.frase}
        </p>
        <div className="guia-acoes">
          {i > 0 && (
            <button type="button" className="guia-botao guia-voltar" onClick={() => setI(i - 1)}>
              Voltar
            </button>
          )}
          <button type="button" className="guia-botao guia-seguir" onClick={() => (ultimo ? fechar() : setI(i + 1))}>
            {ultimo ? 'Começar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  )
}
