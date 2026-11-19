import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as EventoDePonteiro } from 'react'
import { tocar } from '../sons'
import { buscarAcompanhamento } from './envio'
import type { LeituraDoAcompanhamento } from './envio'
import { nomeCurto, passosNaTela, pessoas, prazoEmPalavras } from './logica'
import type { Acompanhamento, Recente } from './logica'
import { IconeAvancar, IconeCompartilhar, IconeDoPasso, IconeDoTipo, IconeRelogio, IconeFechar, IconeVoltar, Selo } from './pecas'

interface Props {
  recentes: Recente[]
  // null: a lista dos relatos deste aparelho.
  protocolo: string | null
  aoEscolher: (protocolo: string | null) => void
  aoFechar: () => void
  // O acompanhamento chegou: o Relatar atualiza o pino guardado.
  aoAtualizar: (protocolo: string, a: Acompanhamento) => void
  // Aberta pelo Perfil: a seta volta para ele em vez da lista.
  aoVoltar?: () => void
}

type Carga = { fase: 'carregando' } | { fase: 'pronto'; a: Acompanhamento } | { fase: 'falhou'; motivo: string }

// A carga guarda de qual pedido é: trocar de relato já mostra "carregando".
type CargaDoPedido = Carga & { pedido: string }

// Puxar a folha para baixo além disto fecha, como a folha nativa.
const ARRASTE_FECHA_PX = 96

async function compartilhar(protocolo: string): Promise<string | null> {
  const texto = `Protocolo MOGI ${protocolo}`
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'MOGI', text: texto })
      return null
    }
  } catch (e) {
    // A pessoa fechou o menu de compartilhar: nada a avisar.
    if ((e as { name?: string } | null)?.name === 'AbortError') return null
  }
  try {
    await navigator.clipboard.writeText(protocolo)
    return 'Protocolo copiado'
  } catch {
    return `Protocolo ${protocolo}`
  }
}

// Folha por baixo do mapa: a lista dos relatos e o andamento de cada um.
export default function Folha({ recentes, protocolo, aoEscolher, aoFechar, aoAtualizar, aoVoltar }: Props) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const [vez, setVez] = useState(0)
  const pedido = `${protocolo}:${vez}`
  const [guardada, setCarga] = useState<CargaDoPedido | null>(null)
  const carga: Carga = guardada && guardada.pedido === pedido ? guardada : { fase: 'carregando' }
  const [copia, setCopia] = useState<{ protocolo: string; texto: string | null } | null>(null)
  const atualizar = useRef(aoAtualizar)
  const recente = protocolo ? recentes.find((r) => r.protocolo === protocolo) : undefined
  const chave = recente?.chave ?? null

  const folha = useRef<HTMLElement>(null)
  const arraste = useRef<{ id: number; y: number; dy: number } | null>(null)
  const [puxado, setPuxado] = useState(0)

  useEffect(() => {
    atualizar.current = aoAtualizar
  })

  // Arrastar para baixo, com a folha no topo da rolagem, fecha.
  const aoApertar = (e: EventoDePonteiro<HTMLElement>) => {
    if ((folha.current?.scrollTop ?? 0) > 0) return
    arraste.current = { id: e.pointerId, y: e.clientY, dy: 0 }
  }
  const aoMover = (e: EventoDePonteiro<HTMLElement>) => {
    const a = arraste.current
    if (!a || a.id !== e.pointerId) return
    a.dy = Math.max(0, e.clientY - a.y)
    // Só captura depois de mexer, para os botões seguirem recebendo o toque.
    if (a.dy > 8 && !e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId)
    if (a.dy > 8) setPuxado(a.dy)
  }
  const aoSoltar = () => {
    const a = arraste.current
    arraste.current = null
    if (a && a.dy > ARRASTE_FECHA_PX) aoFechar()
    else setPuxado(0)
  }

  useEffect(() => {
    titulo.current?.focus()
  }, [protocolo, carga.fase])

  useEffect(() => {
    if (!protocolo || !chave) return
    let vivo = true
    const este = `${protocolo}:${vez}`
    void buscarAcompanhamento(protocolo, chave).then((r: LeituraDoAcompanhamento) => {
      if (!vivo) return
      if ('acompanhamento' in r) {
        setCarga({ fase: 'pronto', a: r.acompanhamento, pedido: este })
        atualizar.current(protocolo, r.acompanhamento)
      } else {
        setCarga({
          fase: 'falhou',
          motivo: r.falha === 'nao_encontrado' ? 'Não achei este protocolo.' : 'Sem internet agora. Confira o sinal.',
          pedido: este,
        })
        tocar('erro')
      }
    })
    return () => {
      vivo = false
    }
  }, [protocolo, chave, vez])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  const nomeDoTitulo = protocolo
    ? carga.fase === 'pronto'
      ? carga.a.categoria_nome || 'Seu relato'
      : recente?.categoria
        ? nomeCurto(recente.categoria)
        : 'Seu relato'
    : 'Meus relatos'

  return (
    <>
      <div className="folha-fundo" aria-hidden="true" onClick={aoFechar} />
      <section
        ref={folha}
        className={`folha${puxado > 0 ? ' puxando' : ''}`}
        style={puxado > 0 ? { transform: `translateY(${puxado}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="folha-titulo"
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <span className="folha-alca" aria-hidden="true" />
        <header className="folha-topo">
          {protocolo && aoVoltar ? (
            <button type="button" className="botao-mapa botao-plano" aria-label="Voltar para o perfil" onClick={aoVoltar}>
              <IconeVoltar />
            </button>
          ) : (
            protocolo &&
            recentes.length > 1 && (
              <button type="button" className="botao-mapa botao-plano" aria-label="Voltar para a lista" onClick={() => aoEscolher(null)}>
                <IconeVoltar />
              </button>
            )
          )}
          {protocolo && (
            <span className="folha-tipo" aria-hidden="true">
              <IconeDoTipo id={(carga.fase === 'pronto' ? carga.a.categoria : recente?.categoria) || 'outros'} />
            </span>
          )}
          <div className="folha-cabeca">
            <h2 id="folha-titulo" ref={titulo} tabIndex={-1} className="folha-titulo">
              {nomeDoTitulo}
            </h2>
            {protocolo && (
              <p className="folha-protocolo">
                <span className="protocolo">{protocolo}</span>
                {carga.fase === 'pronto' && carga.a.relatos > 1 && <span className="folha-pessoas"> · {pessoas(carga.a.relatos)}</span>}
              </p>
            )}
          </div>
          <button type="button" className="botao-mapa botao-plano" aria-label="Fechar" onClick={aoFechar}>
            <IconeFechar />
          </button>
        </header>

        {!protocolo && (
          <ul className="folha-lista">
            {recentes.map((r) => (
              <li key={r.protocolo}>
                <button type="button" className="folha-item" onClick={() => aoEscolher(r.protocolo)}>
                  <span className="folha-icone">
                    <IconeDoTipo id={r.categoria ?? 'outros'} />
                  </span>
                  <span className="folha-item-texto">
                    <strong>{r.categoria ? nomeCurto(r.categoria) : 'Relato'}</strong>
                    <span className="protocolo">{r.protocolo}</span>
                    <Selo nivel={r.nivel} pequeno />
                  </span>
                  <IconeAvancar />
                </button>
              </li>
            ))}
          </ul>
        )}

        {protocolo && (
          <div className="folha-corpo" aria-live="polite">
            {!chave && <p className="folha-nota">Este aparelho não guardou o andamento. O protocolo vale na prefeitura.</p>}
            {chave && carga.fase === 'carregando' && (
              <p className="folha-carregando" role="status">
                <span className="girando" aria-hidden="true" />
                Buscando o andamento
              </p>
            )}
            {chave && carga.fase === 'falhou' && (
              <div className="folha-falha" role="alert">
                <p>{carga.motivo}</p>
                <button type="button" className="botao botao-secundario" onClick={() => setVez((v) => v + 1)}>
                  Tentar de novo
                </button>
              </div>
            )}
            {chave && carga.fase === 'pronto' && <Andamento a={carga.a} />}
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => void compartilhar(protocolo).then((texto) => setCopia({ protocolo, texto }))}
            >
              <IconeCompartilhar tamanho={20} />
              Compartilhar
            </button>
            {copia?.protocolo === protocolo && copia.texto ? (
              <p className="folha-nota" role="status">
                {copia.texto}
              </p>
            ) : (
              <p className="escondido" role="status" />
            )}
          </div>
        )}
      </section>
    </>
  )
}

// Andamento enxuto: selo e prazo numa linha, quatro marcos com ícone ligados
// por um trilho que se enche, e uma frase só. Tocar num marco mostra aquele
// passo; o atual pulsa de leve até o próximo acontecer.
function Andamento({ a }: { a: Acompanhamento }) {
  const [agora] = useState(() => new Date())
  const passos = passosNaTela(a)
  const prazo = prazoEmPalavras(a.prazo_ate, a.status, agora)
  const feitos = passos.filter((p) => p.feito).length
  const ultimo = Math.max(0, feitos - 1)
  const [visto, setVisto] = useState<number | null>(null)
  const i = visto ?? ultimo
  const p = passos[i]
  const progresso = passos.length > 1 ? (ultimo / (passos.length - 1)) * 100 : 0
  return (
    <>
      <div className="folha-resumo">
        <Selo nivel={a.nivel} />
        {prazo && (
          <span className="pilula-prazo">
            <IconeRelogio tamanho={16} />
            {prazo.replace(/^Até /, 'até ')}
          </span>
        )}
      </div>
      <div className="andamento">
        <ol className="marcos" style={{ ['--progresso' as string]: `${progresso}%` }}>
          {passos.map((m, n) => (
            <li key={m.tipo} className={`${m.feito ? 'feito' : m.agora ? 'agora' : 'depois'}${n === i ? ' visto' : ''}`} style={{ ['--n' as string]: n }}>
              <button
                type="button"
                className="marco"
                aria-pressed={n === i}
                aria-label={`${m.rotulo}${m.feito ? ', feito' : m.agora ? ', é o próximo' : ', ainda não'}`}
                onClick={() => setVisto(n === visto ? null : n)}
              >
                <IconeDoPasso tipo={m.tipo} tamanho={20} />
              </button>
            </li>
          ))}
        </ol>
        <p className="andamento-frase" key={i} aria-live="polite">
          <strong>{p?.rotulo}</strong>
          {p && (p.quando ? <span className="passo-hora"> · {p.quando}</span> : <span className="passo-hora"> · {p.agora ? 'é o próximo' : 'ainda não'}</span>)}
        </p>
      </div>
      {a.status === 'resolvida' && a.o_que_foi_feito && <p className="folha-feito">{a.o_que_foi_feito}</p>}
      {a.status === 'resolvida' &&
        a.fotos_do_depois.map((url, k) => <img key={url} className="folha-foto" src={url} alt={`Foto do depois ${k + 1}`} />)}
    </>
  )
}
