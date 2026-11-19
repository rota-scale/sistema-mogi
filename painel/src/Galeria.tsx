import { useEffect, useMemo, useRef, useState, type RefObject, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { abrirVideo, ErroDaApi } from './api'
import { direcaoDoGesto, montarGaleria, rotuloDoItem, vizinho, type ItemGaleria } from './galeria'
import { tocar } from './sons'
import type { Ocorrencia } from './tipos'

// "parou": o vídeo deu erro depois de aberto, em geral porque o link venceu.
type EstadoVideo = { fase: 'abrindo' | 'erro' | 'apagado' | 'parou' } | { fase: 'pronto'; url: string }

const ALT_FOTO = 'Foto do relato, com rostos e placas borrados'
const ALT_DEPOIS = 'Foto do depois, tirada pela equipe'
const AVISO_VIDEO = 'O vídeo não é borrado. Abrir fica registrado no histórico do chamado.'

const pedeAviso = (m: ItemGaleria, e?: EstadoVideo) =>
  m.tipo === 'video' && m.disponivel && e?.fase !== 'pronto' && e?.fase !== 'apagado'

const TRACOS = {
  ampliar: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
  anterior: 'M15 5l-7 7 7 7',
  proxima: 'M9 5l7 7-7 7',
  fechar: 'M6 6l12 12M18 6L6 18',
}

function Icone({ nome, tamanho = 22 }: { nome: keyof typeof TRACOS | 'play'; tamanho?: number }) {
  if (nome === 'play') {
    return (
      <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden="true">
        <path d="M8 5v14l11-7z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={TRACOS[nome]} />
    </svg>
  )
}

// O link assinado da mídia vence; se a imagem não carregar, entra um aviso no
// lugar do ícone quebrado do navegador. "neutro" é a capa do vídeo: sem
// imagem, fica só o bloco de fundo.
function Foto({ src, alt, mini, neutro }: { src?: string; alt: string; mini?: boolean; neutro?: boolean }) {
  const [falhou, setFalhou] = useState<string | null>(null)
  if (!src || falhou === src) {
    if (neutro) return <span className="galeria-neutro" />
    return <span className={'foto-indisponivel' + (mini ? ' mini' : '')}>Foto indisponível</span>
  }
  return <img src={src} alt={alt} loading={mini ? 'lazy' : undefined} draggable={false} onError={() => setFalhou(src)} />
}

function Tocador({ src, capa, aoParar }: { src: string; capa?: string; aoParar: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  // O botão "Ver vídeo" tinha o foco e sumiu: o foco segue para o vídeo.
  useEffect(() => {
    if (document.activeElement === document.body) ref.current?.focus()
  }, [])
  return <video ref={ref} className="galeria-video" src={src} poster={capa} controls playsInline muted autoPlay onError={aoParar} />
}

// Capa do vídeo com o botão "Ver vídeo". O link só é pedido no toque, porque
// cada pedido fica registrado no histórico do chamado.
function Video({
  item,
  estado,
  tocar,
  aoPedir,
  aoParar,
}: {
  item: ItemGaleria
  estado: EstadoVideo | undefined
  tocar: boolean
  aoPedir: () => void
  aoParar: () => void
}) {
  const fase = estado?.fase
  if (estado?.fase === 'pronto' && tocar) return <Tocador src={estado.url} capa={item.url} aoParar={aoParar} />
  return (
    <div className="galeria-capa">
      <Foto src={item.url} alt="" neutro />
      {/* Com o vídeo tocando na tela cheia, aqui fica só a capa. */}
      {fase !== 'pronto' && (
        <div className="galeria-capa-acao">
          {!item.disponivel || fase === 'apagado' ? (
            <p role="status">Este vídeo já foi apagado pelo prazo de guarda de 90 dias.</p>
          ) : fase === 'abrindo' ? (
            <p role="status">Abrindo o vídeo…</p>
          ) : (
            <>
              {fase === 'erro' && <p role="alert">Não foi possível abrir o vídeo.</p>}
              {fase === 'parou' && <p role="status">O vídeo parou de tocar. Abra de novo para continuar.</p>}
              <button type="button" className="galeria-ver-video" onClick={aoPedir}>
                {fase !== 'erro' && <Icone nome="play" tamanho={20} />}
                {fase === 'erro' ? 'Tentar de novo' : 'Ver vídeo'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TelaCheia({
  itens,
  indice,
  videos,
  aoAndar,
  aoFechar,
  aoPedirVideo,
  aoPararVideo,
  voltarPara,
}: {
  itens: ItemGaleria[]
  indice: number
  videos: Record<string, EstadoVideo>
  aoAndar: (passo: number) => void
  aoFechar: () => void
  aoPedirVideo: (id: string) => void
  aoPararVideo: (id: string) => void
  voltarPara: RefObject<HTMLElement | null>
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const toque = useRef<{ x: number; y: number } | null>(null)
  const item = itens[indice]
  const varios = itens.length > 1

  // O foco entra no diálogo e, ao fechar, volta para onde estava.
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const reserva = voltarPara.current
    caixa.current?.focus()
    return () => {
      // O botão que abriu some quando a principal troca de foto para vídeo:
      // o foco vai para o botão de ampliar que estiver lá agora.
      const destino = antes?.isConnected ? antes : (reserva?.querySelector<HTMLElement>('.galeria-ampliar, button.galeria-canto') ?? reserva)
      destino?.focus()
    }
  }, [voltarPara])

  // No documento, e não no diálogo: o foco cai fora quando o botão "Ver
  // vídeo" some, e Esc e as setas precisam continuar valendo.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = caixa.current
      if (!el) return
      if (e.key === 'Escape') {
        e.preventDefault()
        aoFechar()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // No vídeo as setas avançam e voltam o tempo.
        if (e.target instanceof HTMLVideoElement) return
        e.preventDefault()
        aoAndar(e.key === 'ArrowLeft' ? -1 : 1)
      } else if (e.key === 'Tab') {
        const focaveis = [...el.querySelectorAll<HTMLElement>('button, video')]
        const primeiro = focaveis[0]
        const ultimo = focaveis[focaveis.length - 1]
        const ativo = document.activeElement
        const fora = ativo === el || !el.contains(ativo)
        if (fora || ativo === (e.shiftKey ? primeiro : ultimo)) {
          e.preventDefault()
          ;(e.shiftKey ? ultimo : primeiro)?.focus()
        }
      }
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  })

  const aoTocar = (e: TouchEvent) => {
    // Dois dedos é zoom; no vídeo o dedo arrasta a barra de tempo.
    const um = e.touches.length === 1 && !(e.target instanceof HTMLVideoElement)
    toque.current = um ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }
  const aoSoltar = (e: TouchEvent) => {
    const inicio = toque.current
    toque.current = null
    // Com zoom, arrastar é para passear pela foto.
    if (!inicio || !varios || (window.visualViewport?.scale ?? 1) > 1.01) return
    const fim = e.changedTouches[0]
    const passo = direcaoDoGesto(fim.clientX - inicio.x, fim.clientY - inicio.y)
    if (passo !== 0) aoAndar(passo)
  }

  if (!item) return null
  return createPortal(
    <div
      className="tela-cheia"
      ref={caixa}
      role="dialog"
      aria-modal="true"
      aria-label="Mídias do chamado em tela cheia"
      tabIndex={-1}
      onTouchStart={aoTocar}
      onTouchEnd={aoSoltar}
    >
      <p className="tela-cheia-contador" aria-live="polite">
        {varios ? `${indice + 1} de ${itens.length}` : ''}
      </p>
      {varios && (
        <button type="button" className="tela-cheia-botao anterior" onClick={() => aoAndar(-1)} aria-label="Mídia anterior">
          <Icone nome="anterior" />
        </button>
      )}
      <div className="tela-cheia-palco" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
        {item.tipo === 'video' ? (
          <Video
            key={item.id}
            item={item}
            estado={videos[item.id]}
            tocar
            aoPedir={() => aoPedirVideo(item.id)}
            aoParar={() => aoPararVideo(item.id)}
          />
        ) : (
          <Foto key={item.id} src={item.url} alt={item.tipo === 'depois' ? ALT_DEPOIS : ALT_FOTO} />
        )}
      </div>
      {varios && (
        <button type="button" className="tela-cheia-botao proxima" onClick={() => aoAndar(1)} aria-label="Próxima mídia">
          <Icone nome="proxima" />
        </button>
      )}
      <div className="tela-cheia-rodape">
        {item.tipo === 'depois' && <span className="galeria-depois">Depois</span>}
        {item.legenda && <p>{item.legenda}</p>}
        {pedeAviso(item, videos[item.id]) && <p className="tela-cheia-aviso">{AVISO_VIDEO}</p>}
      </div>
      {/* Por último na ordem do Tab, para o vídeo nunca ser o último foco. */}
      <button type="button" className="tela-cheia-botao fechar" onClick={aoFechar} aria-label="Fechar tela cheia">
        <Icone nome="fechar" />
      </button>
    </div>,
    document.body,
  )
}

// Galeria do chamado: mídia principal, tira de miniaturas e tela cheia. As
// fotos chegam borradas; o vídeo original não, e só abre a pedido.
export function Galeria({ o, aoAbrirVideo }: { o: Ocorrencia; aoAbrirVideo?: () => void }) {
  const { midias, midia_url, relatos_lista } = o
  const itens = useMemo(() => montarGaleria({ midias, midia_url, relatos_lista }), [midias, midia_url, relatos_lista])
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [aberta, setAberta] = useState(false)
  const [videos, setVideos] = useState<Record<string, EstadoVideo>>({})
  const pedindo = useRef(new Set<string>())
  const raiz = useRef<HTMLDivElement>(null)
  const tira = useRef<HTMLUListElement>(null)

  const indice = Math.max(0, itens.findIndex((i) => i.id === escolhido))
  const item: ItemGaleria | undefined = itens[indice]

  // A miniatura escolhida pela tela cheia pode estar fora da parte visível da tira.
  useEffect(() => {
    const lista = tira.current
    const mini = lista?.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement
    if (!lista || !mini) return
    const inicio = mini.offsetLeft
    const fim = inicio + mini.offsetWidth
    if (inicio < lista.scrollLeft) lista.scrollLeft = inicio - 4
    else if (fim > lista.scrollLeft + lista.clientWidth) lista.scrollLeft = fim - lista.clientWidth + 4
  }, [indice])

  if (!item) return null

  const marcar = (midiaId: string, estado: EstadoVideo) => setVideos((v) => ({ ...v, [midiaId]: estado }))

  const pedirVideo = async (midiaId: string) => {
    // Dois toques seguidos não podem virar dois registros no histórico.
    if (pedindo.current.has(midiaId)) return
    pedindo.current.add(midiaId)
    marcar(midiaId, { fase: 'abrindo' })
    try {
      const { url } = await abrirVideo(o.id, midiaId)
      marcar(midiaId, { fase: 'pronto', url })
      // A abertura ficou registrada no histórico do chamado.
      tocar('registrado')
      aoAbrirVideo?.()
    } catch (e) {
      marcar(midiaId, { fase: e instanceof ErroDaApi && e.status === 404 ? 'apagado' : 'erro' })
    } finally {
      pedindo.current.delete(midiaId)
    }
  }
  const pararVideo = (midiaId: string) => marcar(midiaId, { fase: 'parou' })
  const andar = (passo: number) => setEscolhido(itens[vizinho(indice, passo, itens.length)].id)

  return (
    <div className="galeria" ref={raiz} tabIndex={-1}>
      <div className="galeria-palco">
        {item.tipo === 'video' ? (
          <>
            <Video
              key={item.id}
              item={item}
              estado={videos[item.id]}
              tocar={!aberta}
              aoPedir={() => pedirVideo(item.id)}
              aoParar={() => pararVideo(item.id)}
            />
            <button type="button" className="galeria-canto" onClick={() => setAberta(true)} aria-label="Abrir vídeo em tela cheia">
              <Icone nome="ampliar" tamanho={18} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="galeria-ampliar"
            onClick={() => setAberta(true)}
            aria-label={`${rotuloDoItem(item, indice + 1, itens.length)}. Abrir em tela cheia`}
          >
            <Foto key={item.id} src={item.url} alt="" />
            <span className="galeria-canto" aria-hidden="true">
              <Icone nome="ampliar" tamanho={18} />
            </span>
          </button>
        )}
        {item.tipo === 'depois' && <span className="galeria-depois">Depois</span>}
      </div>
      {item.legenda && <p className="fonte">{item.legenda}</p>}
      {pedeAviso(item, videos[item.id]) && <p className="galeria-aviso">{AVISO_VIDEO}</p>}
      {itens.length > 1 && (
        <ul className="galeria-tira" ref={tira} aria-label="Mídias do chamado">
          {itens.map((m, i) => (
            <li key={m.id} className={i > 0 && m.relatoId !== itens[i - 1].relatoId ? 'novo-relato' : undefined}>
              <button
                type="button"
                className="galeria-mini"
                aria-current={i === indice ? 'true' : undefined}
                aria-label={rotuloDoItem(m, i + 1, itens.length)}
                onClick={() => setEscolhido(m.id)}
              >
                <Foto src={m.url} alt="" mini neutro={m.tipo === 'video'} />
                {m.tipo === 'video' && (
                  <>
                    <span className="galeria-play">
                      <Icone nome="play" tamanho={16} />
                    </span>
                    {m.duracao && <span className="galeria-duracao">{m.duracao}</span>}
                  </>
                )}
                {m.tipo === 'depois' && <span className="galeria-depois">Depois</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberta && (
        <TelaCheia
          itens={itens}
          indice={indice}
          videos={videos}
          aoAndar={andar}
          aoFechar={() => setAberta(false)}
          aoPedirVideo={pedirVideo}
          aoPararVideo={pararVideo}
          voltarPara={raiz}
        />
      )}
    </div>
  )
}
