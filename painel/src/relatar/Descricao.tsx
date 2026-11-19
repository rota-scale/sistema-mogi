import { useEffect, useRef, useState } from 'react'
import { juntarSugestao, sugestoesDoTipo } from './cadastro'
import { juntarFala, LIMITE_TEXTO, nomeCurto } from './logica'
import type { Categoria } from './logica'
import { IconeDoTipo, IconeEnviar, IconeMicrofone, IconeParar, IconeVoltar } from './pecas'
import type { Voz } from './voz'

interface Props {
  // Miniatura da captura: a primeira foto ou a capa do vídeo.
  capa: string | null
  categorias: Categoria[]
  escolha: string | null
  aoEscolher: (id: string | null) => void
  // Sem IA, o tipo é obrigatório.
  exigeTipo: boolean
  texto: string
  aoTexto: (texto: string) => void
  voz: Voz
  vozLigada: boolean
  aoEnviar: (categoria: string | null) => void
  aoVoltar: () => void
}

// Depois da foto: o que é o problema. Tipo em ícones grandes, um campo de
// texto com o microfone e três sugestões rápidas. Tudo opcional com IA.
export default function Descricao({ capa, categorias, escolha, aoEscolher, exigeTipo, texto, aoTexto, voz, vozLigada, aoEnviar, aoVoltar }: Props) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const primeiroTipo = useRef<HTMLButtonElement>(null)
  const [faltaTipo, setFaltaTipo] = useState(false)
  const usaVoz = vozLigada && voz.disponivel

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoVoltar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoVoltar])

  const enviar = () => {
    if (exigeTipo && !escolha) {
      setFaltaTipo(true)
      primeiroTipo.current?.focus()
      return
    }
    voz.parar()
    aoEnviar(escolha)
  }

  return (
    <>
      <div className="folha-fundo" aria-hidden="true" onClick={aoVoltar} />
      <section className="folha descricao" role="dialog" aria-modal="true" aria-labelledby="descricao-titulo">
        <span className="folha-alca" aria-hidden="true" />
        <header className="folha-topo">
          <button type="button" className="botao-mapa botao-plano" aria-label="Voltar para a câmera" onClick={aoVoltar}>
            <IconeVoltar />
          </button>
          <h2 id="descricao-titulo" ref={titulo} tabIndex={-1} className="folha-titulo descricao-titulo">
            O que é o problema?
          </h2>
          {capa && <img className="descricao-capa" src={capa} alt="Sua foto" />}
        </header>

        <div className="descricao-bloco">
          <p className="campo-rotulo" id="descricao-tipos">
            {exigeTipo ? 'Escolha o tipo' : 'Tipo'} {!exigeTipo && <span className="campo-opcional">(se souber)</span>}
          </p>
          <div className="tipos" role="group" aria-labelledby="descricao-tipos" aria-describedby={faltaTipo && !escolha ? 'descricao-falta' : undefined}>
            {categorias.map((cat, i) => {
              const curto = nomeCurto(cat.id, cat.nome)
              return (
                <button
                  key={cat.id}
                  ref={i === 0 ? primeiroTipo : undefined}
                  type="button"
                  className="tipo"
                  aria-pressed={escolha === cat.id}
                  onClick={() => {
                    aoEscolher(escolha === cat.id ? null : cat.id)
                    setFaltaTipo(false)
                  }}
                >
                  <IconeDoTipo id={cat.id} tamanho={30} />
                  <span>{curto}</span>
                  {curto !== cat.nome && <span className="escondido">, {cat.nome}</span>}
                </button>
              )
            })}
          </div>
          {faltaTipo && !escolha && (
            <p id="descricao-falta" className="campo-erro" role="alert">
              Toque no tipo do problema.
            </p>
          )}
        </div>

        <div className="descricao-bloco">
          <label className="campo-rotulo" htmlFor="descricao-texto">
            Conte em poucas palavras <span className="campo-opcional">(opcional)</span>
          </label>
          <div className="descricao-linha">
            <textarea
              id="descricao-texto"
              className="campo-entrada descricao-texto"
              rows={3}
              maxLength={LIMITE_TEXTO}
              value={voz.ouvindo && voz.parcial ? juntarFala(texto, voz.parcial) : texto}
              enterKeyHint="done"
              onChange={(e) => {
                // Digitar com o microfone ligado para a escuta, para não misturar as duas.
                if (voz.ouvindo) voz.parar()
                aoTexto(e.target.value.slice(0, LIMITE_TEXTO))
              }}
            />
            {usaVoz && (
              <button
                type="button"
                className={`botao-mapa descricao-mic${voz.ouvindo ? ' ouvindo' : ''}`}
                aria-label={voz.ouvindo ? 'Parar de ouvir' : 'Falar'}
                aria-pressed={voz.ouvindo}
                onClick={voz.alternar}
              >
                {voz.ouvindo ? <IconeParar /> : <IconeMicrofone />}
              </button>
            )}
          </div>
          {voz.ouvindo && (
            <p className="fala-ouvindo" role="status">
              <span className="fala-ponto" aria-hidden="true" />
              Ouvindo. Sua voz não é guardada.
            </p>
          )}
          {voz.aviso && (
            <p className="fala-aviso" role="status">
              {voz.aviso}
            </p>
          )}
          <div className="sugestoes" role="group" aria-label="Sugestões">
            {sugestoesDoTipo(escolha).map((s) => (
              <button key={s} type="button" className="sugestao" onClick={() => aoTexto(juntarSugestao(texto, s))}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="botao botao-primario" onClick={enviar}>
          <IconeEnviar tamanho={22} />
          Enviar relato
        </button>
      </section>
    </>
  )
}
