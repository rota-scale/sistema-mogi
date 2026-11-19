import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type Icone = { tamanho?: number }

const base = (tamanho: number) => ({
  width: tamanho,
  height: tamanho,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

export const IconeVoltar = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)} strokeWidth={3}>
    <path d="M14.5 5l-7 7 7 7" />
  </svg>
)

export const IconeAvancar = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)} strokeWidth={3}>
    <path d="M9.5 5l7 7-7 7" />
  </svg>
)

export const IconeAtualizar = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v5h-5" />
  </svg>
)

export const IconeCamera = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)}>
    <path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.6" />
  </svg>
)

// Seta de navegação, como a dos apps de rota.
export const IconeRota = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)}>
    <path d="M12 3l7 17-7-4-7 4z" fill="currentColor" />
  </svg>
)

// desenha: o visto se desenha num traço, como no "Enviado" do app do morador.
export const IconeCerto = ({ tamanho = 24, desenha = false }: Icone & { desenha?: boolean }) => (
  <svg {...base(tamanho)} strokeWidth={3.2}>
    <path className={desenha ? 'certo-desenha' : undefined} pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const IconeFechar = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)} strokeWidth={3}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconeLocal = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)}>
    <path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.3" />
  </svg>
)

export const IconeRelogio = ({ tamanho = 24 }: Icone) => (
  <svg {...base(tamanho)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const Girando = ({ claro = false }: { claro?: boolean }) => (
  <span className={claro ? 'girando girando-claro' : 'girando'} aria-hidden="true" />
)

interface TopoProps {
  aoVoltar: () => void
  titulo: string
}

// Topo das telas de dentro: o voltar fica sempre no mesmo lugar.
export function TopoDeVoltar({ aoVoltar, titulo }: TopoProps) {
  return (
    <header className="topo">
      <button type="button" className="voltar" onClick={aoVoltar}>
        <IconeVoltar />
        Voltar
      </button>
      <span className="topo-titulo">{titulo}</span>
    </header>
  )
}

interface FalhaProps {
  children: ReactNode
  aoTentar?: () => void
  rotulo?: string
}

export function CaixaDeErro({ children, aoTentar, rotulo = 'Tentar de novo' }: FalhaProps) {
  return (
    <div className="erro" role="alert">
      <span>{children}</span>
      {aoTentar && (
        <button type="button" className="botao botao-secundario" onClick={aoTentar}>
          {rotulo}
        </button>
      )}
    </div>
  )
}

interface FichasProps {
  opcoes: string[]
  escolhida: string
  aoEscolher: (opcao: string) => void
  rotulo: string
  desligado?: boolean
}

// Respostas rápidas: um toque preenche o texto, que continua editável.
export function Fichas({ opcoes, escolhida, aoEscolher, rotulo, desligado }: FichasProps) {
  return (
    <div className="fichas" role="group" aria-label={rotulo}>
      {opcoes.map((op) => (
        <button
          key={op}
          type="button"
          className="ficha"
          aria-pressed={escolhida.trim() === op}
          disabled={desligado}
          onClick={() => aoEscolher(op)}
        >
          {op}
        </button>
      ))}
    </div>
  )
}

interface AmpliadaProps {
  fotos: string[]
  indice: number
  aoTrocar: (indice: number) => void
  aoFechar: () => void
}

// Foto em tela cheia. Fecha pelo botão, pelo voltar do aparelho ou pelo Esc.
export function FotoAmpliada({ fotos, indice, aoTrocar, aoFechar }: AmpliadaProps) {
  const fechar = useRef<HTMLButtonElement>(null)
  const i = Math.min(Math.max(0, indice), fotos.length - 1)
  useEffect(() => {
    fechar.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])
  return (
    <div className="ampliada" role="dialog" aria-modal="true" aria-label="Foto ampliada">
      <div className="ampliada-topo">
        <button ref={fechar} type="button" className="ampliada-botao" onClick={aoFechar}>
          <IconeFechar />
          Fechar
        </button>
        {fotos.length > 1 && (
          <span className="ampliada-conta">
            {i + 1} de {fotos.length}
          </span>
        )}
      </div>
      <img className="ampliada-foto" src={fotos[i]} alt={`Foto ${i + 1} do chamado`} />
      {fotos.length > 1 && (
        <div className="ampliada-rodape">
          <button type="button" className="ampliada-botao" disabled={i === 0} onClick={() => aoTrocar(i - 1)}>
            <IconeVoltar />
            Anterior
          </button>
          <button type="button" className="ampliada-botao" disabled={i === fotos.length - 1} onClick={() => aoTrocar(i + 1)}>
            Próxima
            <IconeAvancar />
          </button>
        </div>
      )}
    </div>
  )
}
