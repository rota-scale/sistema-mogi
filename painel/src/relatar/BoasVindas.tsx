import { useEffect, useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import { tocar } from '../sons'
import { SLIDES } from './regrasDoTour'
import type { Slide } from './regrasDoTour'

interface Props {
  aoTerminar: () => void
}

// Ilustrações dos slides: desenhos 3D gerados por IA (Nano Banana), sem
// pessoas reais; o crédito fica na Ajuda. Decorativas: o título já diz tudo.
// Fundo transparente; o tamanho de cada uma evita a tela pular ao carregar.
const TAMANHOS: Record<Slide['id'], [number, number]> = { problema: [689, 576], foto: [640, 552], resolvido: [811, 506] }
const imagem = (id: Slide['id']) => `/slides/${id}.webp`

function Desenho({ id }: { id: Slide['id'] }) {
  const [largura, altura] = TAMANHOS[id]
  return <img className="bv-desenho" src={imagem(id)} alt="" width={largura} height={altura} decoding="async" />
}

// Boas-vindas: três slides, um por vez, com calma. Desliza ou toca em
// Próximo; Pular sempre à vista. Depois vem o cadastro e o tour no mapa.
export default function BoasVindas({ aoTerminar }: Props) {
  const [i, setI] = useState(0)
  const titulo = useRef<HTMLHeadingElement>(null)
  const inicioDoToque = useRef<number | null>(null)
  const slide = SLIDES[i]
  const ultimo = i === SLIDES.length - 1

  useEffect(() => {
    titulo.current?.focus()
    // Já carrega o próximo desenho, para a troca ser instantânea.
    const seguinte = SLIDES[i + 1]
    if (seguinte) new Image().src = imagem(seguinte.id)
  }, [i])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoTerminar()
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0))
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoTerminar])

  const proximo = () => {
    tocar('registrado')
    if (ultimo) aoTerminar()
    else setI(i + 1)
  }

  const comecaToque = (e: TouchEvent) => {
    inicioDoToque.current = e.touches[0]?.clientX ?? null
  }
  const terminaToque = (e: TouchEvent) => {
    const x0 = inicioDoToque.current
    const x1 = e.changedTouches[0]?.clientX
    inicioDoToque.current = null
    if (x0 === null || x1 === undefined || Math.abs(x1 - x0) < 50) return
    if (x1 < x0 && !ultimo) setI(i + 1)
    if (x1 > x0 && i > 0) setI(i - 1)
  }

  return (
    <div className="boas-vindas" role="dialog" aria-modal="true" aria-labelledby="bv-titulo" onTouchStart={comecaToque} onTouchEnd={terminaToque}>
      <div className="bv-topo">
        <div className="bv-barras" aria-hidden="true">
          {SLIDES.map((s, n) => (
            <span key={s.id} className={`bv-barra${n < i ? ' cheia' : n === i ? ' atual' : ''}`} />
          ))}
        </div>
        {!ultimo && (
          <button type="button" className="bv-pular" onClick={aoTerminar}>
            Pular
          </button>
        )}
      </div>

      <div key={slide.id} className="bv-slide">
        <Desenho id={slide.id} />
        <p className="bv-passo">
          {i + 1} de {SLIDES.length}
        </p>
        <h2 id="bv-titulo" ref={titulo} tabIndex={-1} className="bv-titulo">
          {slide.titulo}
        </h2>
        <p className="bv-frase">{slide.frase}</p>
      </div>

      <div className="bv-acoes">
        {i > 0 && (
          <button type="button" className="botao botao-secundario bv-voltar" onClick={() => setI(i - 1)}>
            Voltar
          </button>
        )}
        <button type="button" className="botao botao-primario" onClick={proximo}>
          {ultimo ? 'Começar' : 'Próximo'}
        </button>
      </div>
    </div>
  )
}
