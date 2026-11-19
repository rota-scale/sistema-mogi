import { useEffect, useRef } from 'react'
import { IconeAjuda, IconeFechar, IconeMapa } from './pecas'

interface Props {
  aoFechar: () => void
  aoVerTour: () => void
  aoVerBoasVindas: () => void
  // modulos.cadastro: relatar pede o cadastro do morador.
  cadastro: boolean
}

// Ajuda do morador: rever o tour é a primeira opção; o resto fica em blocos
// curtos que abrem e fecham. Os números de emergência ficam sempre à vista.
export default function Ajuda({ aoFechar, aoVerTour, aoVerBoasVindas, cadastro }: Props) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus()
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  return (
    <>
      <div className="folha-fundo" aria-hidden="true" onClick={aoFechar} />
      <section className="folha ajuda" role="dialog" aria-modal="true" aria-labelledby="ajuda-titulo">
        <span className="folha-alca" aria-hidden="true" />
        <header className="folha-topo">
          <span className="folha-tipo" aria-hidden="true">
            <IconeAjuda />
          </span>
          <div className="folha-cabeca">
            <h2 id="ajuda-titulo" ref={titulo} tabIndex={-1} className="folha-titulo">
              Ajuda
            </h2>
          </div>
          <button type="button" className="botao-mapa botao-plano" aria-label="Fechar a ajuda" onClick={aoFechar}>
            <IconeFechar />
          </button>
        </header>

        <button type="button" className="botao botao-primario" onClick={aoVerTour}>
          <IconeMapa tamanho={22} />
          Ver o passo a passo no mapa
        </button>
        <button type="button" className="botao botao-secundario" onClick={aoVerBoasVindas}>
          Rever a apresentação
        </button>

        <details className="ajuda-bloco">
          <summary>Como mandar um aviso</summary>
          <ol>
            <li>Toque no botão da câmera e tire a foto.</li>
            <li>Escolha o que é: buraco, luz, água, lixo.</li>
            <li>Toque em Enviar. Pronto.</li>
          </ol>
        </details>

        <details className="ajuda-bloco">
          <summary>Mexer no mapa</summary>
          <ul>
            <li>Um dedo arrasta.</li>
            <li>Dois dedos aproximam e giram.</li>
            <li>A bússola volta o norte para cima.</li>
          </ul>
        </details>

        <details className="ajuda-bloco">
          <summary>{cadastro ? 'Seus dados' : 'Sem cadastro'}</summary>
          <p>
            {cadastro
              ? 'A prefeitura vê seu nome. O CPF fica guardado com segurança. Rostos e placas na foto são protegidos.'
              : 'Ninguém sabe quem enviou. Rostos e placas na foto são protegidos.'}
          </p>
        </details>

        <details className="ajuda-bloco">
          <summary>Letra grande, som e leitor de tela</summary>
          <ul>
            <li>Aumente a letra no celular e o MOGI acompanha.</li>
            <li>Funciona com VoiceOver e TalkBack.</li>
            <li>O som desliga no botão do alto-falante.</li>
          </ul>
        </details>

        <div className="ajuda-bloco ajuda-urgente" role="note">
          <h3>Risco de vida? Ligue primeiro</h3>
          <p className="ajuda-telefones">
            <a href="tel:193">193 Bombeiros</a>
            <a href="tel:192">192 SAMU</a>
            <a href="tel:190">190 Polícia</a>
          </p>
        </div>

        <p className="ajuda-credito">Desenhos da apresentação feitos com inteligência artificial.</p>
      </section>
    </>
  )
}
