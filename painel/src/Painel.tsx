import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as TeclaReact } from 'react'
import { despachar, detalhar, reabrir, resolver, revisar, secretarias as listarSecretarias, verDocumento, apagarCadastro } from './api'
import { alternar, estadoDaListaVazia, type CargaDaLista, fichasAtivas, opcoesDeFiltro, SEM_FILTROS, temFiltro, type Filtros, type Opcao } from './filtros'
import { Galeria } from './Galeria'
import { haQuanto } from './gestor'
import { ehCampoDeTexto, useFecharAoSair } from './ganchos'
import { CheckDesenhado, FormaDoNivel, Icone } from './icones'
import {
  ABAS, contarPorAba, corDoNivel, hora, juntarDetalhe, naAba, NIVEIS, NOME_CATEGORIA, NOME_ETAPA, NOME_SINAL, nomeDoNivel,
  nomeDoStatus, NOME_FERRAMENTA, notaDoEvento, oQueFoiFeito, ordenarFila, perguntaDaConferencia, porQueEssaUrgencia, prazoEmPalavras,
  quandoEmPalavras, reais, resumoDoContexto, rotuloDoEvento, SIMBOLO_CATEGORIA, textoSobreNivel,
  type Aba, type Ordem,
} from './niveis'
import { useAgora } from './relogio'
import { tocar, type Som } from './sons'
import type { Distribuicao, Ocorrencia, Relato, Usuario } from './tipos'
import { Vazio } from './Vazio'

// Lado direito do cartão da fila: a foto do problema, para reconhecer de
// bate-olho, e há quanto tempo chegou.
function ItemLado({ o }: { o: Ocorrencia }) {
  const agora = useAgora()
  return (
    <span className="item-lado" aria-hidden="true">
      {o.midia_url ? <img className="item-foto" src={o.midia_url} alt="" loading="lazy" /> : <span className="item-foto item-foto-vazia" />}
      <span className="item-ha">{haQuanto(o.criado_em, agora).replace('agora há pouco', 'agora')}</span>
    </span>
  )
}

// A cor nunca vem sozinha: o selo traz a forma e o nome da urgência.
export function Selo({ nivel, numero }: { nivel: number | null; numero?: boolean }) {
  return (
    <span className="selo" style={{ background: corDoNivel(nivel), color: textoSobreNivel(nivel) }}>
      <FormaDoNivel nivel={nivel} tamanho={12} />
      {numero && nivel != null ? `${nivel} · ` : ''}
      {nomeDoNivel(nivel)}
    </span>
  )
}

// "em 14/11 às 9h", mas "hoje às 9h" sem o "em".
const emQuando = (iso: string | null, agora: Date) => {
  const q = quandoEmPalavras(iso, agora)
  return /^\d/.test(q) ? `em ${q}` : q
}

function Prazo({ o, longo }: { o: Ocorrencia; longo?: boolean }) {
  // O relógio redesenha só este texto: o prazo vence mesmo sem evento ao vivo.
  const agora = new Date(useAgora())
  if (o.status === 'resolvida') return <span className="prazo-texto">resolvido {emQuando(o.resolvido_em, agora)}</span>
  const p = prazoEmPalavras(o.prazo_ate, agora)
  return <span className={'prazo-texto' + (p.atrasado ? ' atrasado' : '')}>{longo ? p.longo : p.curto}</span>
}

// Mais que isso a lista fica pesada de rolar; o resto aparece conforme a fila anda.
const LIMITE_FILA = 200

export type CargaDaFila = CargaDaLista

const ORDENS: { id: Ordem; nome: string }[] = [
  { id: 'urgencia', nome: 'Mais urgente' },
  { id: 'prazo', nome: 'Prazo mais perto' },
]

function Fichas({ titulo, opcoes, escolhidas, simbolo, aoAlternar }: {
  titulo: string
  opcoes: Opcao[]
  escolhidas: string[]
  simbolo?: (valor: string) => string
  aoAlternar: (valor: string) => void
}) {
  if (opcoes.length < 2) return null
  return (
    <div className="fichas" role="group" aria-label={titulo}>
      <span className="fichas-titulo">{titulo}</span>
      {opcoes.map((op) => (
        <button key={op.valor} type="button" className="ficha" aria-pressed={escolhidas.includes(op.valor)} onClick={() => aoAlternar(op.valor)}>
          {simbolo && <span aria-hidden="true">{simbolo(op.valor)} </span>}
          {op.nome}
        </button>
      ))}
    </div>
  )
}

// Fila de trabalho: para conferir, aguardando equipe, equipe a caminho e
// resolvidos. A busca e os filtros são os mesmos do mapa.
export function Fila({
  lista,
  filtrada,
  carga,
  aba,
  aoAba,
  filtros,
  aoFiltrar,
  ordem,
  aoOrdem,
  selecionada,
  aoSelecionar,
  focar,
}: {
  // Todos os chamados e os que passam nos filtros.
  lista: Ocorrencia[]
  filtrada: Ocorrencia[]
  carga: CargaDaFila
  aba: Aba
  aoAba: (a: Aba) => void
  filtros: Filtros
  aoFiltrar: (f: Filtros) => void
  ordem: Ordem
  aoOrdem: (o: Ordem) => void
  selecionada: string | null
  aoSelecionar: (id: string) => void
  // Chamado cujo detalhe acabou de fechar: o foco volta para ele.
  focar: string | null
}) {
  const [filtrando, setFiltrando] = useState(false)
  const raiz = useRef<HTMLElement>(null)
  const ordenada = useMemo(() => ordenarFila(filtrada, aba, ordem), [filtrada, aba, ordem])
  const contagens = useMemo(() => contarPorAba(filtrada), [filtrada])
  const totalDaAba = useMemo(() => lista.filter((o) => naAba(o, aba)).length, [lista, aba])
  const opcoes = useMemo(() => opcoesDeFiltro(lista), [lista])
  const fila = ordenada.length > LIMITE_FILA ? ordenada.slice(0, LIMITE_FILA) : ordenada
  const ativas = fichasAtivas(filtros)
  const filtrado = temFiltro(filtros)
  const vazio = estadoDaListaVazia(carga, aba, totalDaAba)

  // Só ao montar: a fila volta a aparecer quando o detalhe fecha.
  useEffect(() => {
    if (!focar) return
    const alvo = raiz.current?.querySelector<HTMLElement>(`[data-id="${focar}"]`) ?? raiz.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    alvo?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // J e K andam pela fila; Enter abre o item com o foco, como qualquer botão.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((k !== 'j' && k !== 'k') || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || ehCampoDeTexto(e.target)) return
      if (document.querySelector('.tela-cheia')) return
      const itens = [...(raiz.current?.querySelectorAll<HTMLElement>('.item-fila') ?? [])]
      if (itens.length === 0) return
      const i = itens.indexOf(document.activeElement as HTMLElement)
      const destino = i < 0 ? 0 : Math.max(0, Math.min(itens.length - 1, i + (k === 'j' ? 1 : -1)))
      e.preventDefault()
      itens[destino].focus()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [])

  const teclaNasAbas = (e: TeclaReact<HTMLDivElement>) => {
    const i = ABAS.findIndex((a) => a.id === aba)
    const destino =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? ABAS[(i + 1) % ABAS.length]
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? ABAS[(i - 1 + ABAS.length) % ABAS.length]
      : e.key === 'Home' ? ABAS[0]
      : e.key === 'End' ? ABAS[ABAS.length - 1]
      : null
    if (!destino) return
    e.preventDefault()
    aoAba(destino.id)
    e.currentTarget.querySelector<HTMLElement>(`#aba-${destino.id}`)?.focus()
  }

  return (
    <section className="fila" aria-label="Fila de chamados" ref={raiz}>
      <header className="fila-topo" data-arrasta>
        <h2>Chamados</h2>
        <p role="status">
          <strong>{contagens.revisao}</strong> para conferir
        </p>
      </header>
      <div className="fila-rolagem">
        <div className="abas" role="tablist" aria-label="Situação dos chamados" onKeyDown={teclaNasAbas}>
          {ABAS.map((a) => (
            <button
              key={a.id}
              id={`aba-${a.id}`}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              aria-controls="lista-da-fila"
              tabIndex={aba === a.id ? 0 : -1}
              className={aba === a.id ? 'ligada' : ''}
              onClick={() => aoAba(a.id)}
            >
              {a.nome} <span className="contagem">{contagens[a.id]}</span>
            </button>
          ))}
        </div>

        <label className="busca">
          <span className="oculto">Buscar chamado</span>
          <Icone nome="busca" tamanho={18} />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => aoFiltrar({ ...filtros, busca: e.target.value })}
            placeholder="Buscar por rua, bairro, protocolo ou palavra"
            enterKeyHint="search"
          />
        </label>
        <div className="fila-ferramentas">
          <button type="button" className="ficha filtrar" aria-expanded={filtrando} aria-controls="filtros-da-fila" onClick={() => setFiltrando((f) => !f)}>
            <Icone nome="filtro" tamanho={18} />
            Filtrar
            {ativas > 0 && <span className="contador" aria-label={`${ativas} ${ativas === 1 ? 'filtro ativo' : 'filtros ativos'}`}>{ativas}</span>}
          </button>
          {filtrado && (
            <>
              <p className="fila-aviso" role="status">
                Mostrando {ordenada.length} de {totalDaAba}
              </p>
              <button type="button" className="link" onClick={() => aoFiltrar(SEM_FILTROS)}>
                Limpar filtros
              </button>
            </>
          )}
        </div>

        {filtrando && (
          <div className="filtros" id="filtros-da-fila">
            <Fichas
              titulo="Tipo de problema"
              opcoes={opcoes.categorias}
              escolhidas={filtros.categorias}
              simbolo={(v) => SIMBOLO_CATEGORIA[v] ?? SIMBOLO_CATEGORIA.outros}
              aoAlternar={(v) => aoFiltrar({ ...filtros, categorias: alternar(filtros.categorias, v) })}
            />
            <Fichas
              titulo="Secretaria"
              opcoes={opcoes.secretarias}
              escolhidas={filtros.secretarias}
              aoAlternar={(v) => aoFiltrar({ ...filtros, secretarias: alternar(filtros.secretarias, v) })}
            />
            <Fichas
              titulo="Bairro"
              opcoes={opcoes.bairros}
              escolhidas={filtros.bairros}
              aoAlternar={(v) => aoFiltrar({ ...filtros, bairros: alternar(filtros.bairros, v) })}
            />
            <div className="fichas" role="radiogroup" aria-label="Ordenar por">
              <span className="fichas-titulo">Ordenar por</span>
              {ORDENS.map((op) => (
                <button key={op.id} type="button" role="radio" className="ficha" aria-checked={ordem === op.id} onClick={() => aoOrdem(op.id)}>
                  {op.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div id="lista-da-fila" role="tabpanel" aria-labelledby={`aba-${aba}`}>
          {fila.length === 0 ? (
            <Vazio
              tipo={vazio.tipo}
              titulo={vazio.titulo}
              texto={vazio.texto}
              acao={vazio.limpar ? { nome: 'Limpar filtros', aoClicar: () => aoFiltrar(SEM_FILTROS) } : undefined}
            />
          ) : (
            <ul>
              {fila.map((o) => (
                <li key={o.id}>
                  <button type="button" data-id={o.id} className={'item-fila' + (o.id === selecionada ? ' ativo' : '')} onClick={() => aoSelecionar(o.id)}>
                    <span className="item-icone" aria-hidden="true" style={{ borderColor: corDoNivel(o.nivel) }}>
                      {SIMBOLO_CATEGORIA[o.categoria] ?? SIMBOLO_CATEGORIA.outros}
                    </span>
                    <span className="item-corpo">
                      <span className="item-titulo">
                        {NOME_CATEGORIA[o.categoria] ?? 'Outros'}
                        {o.relatos > 1 && <span className="relatos">{o.relatos} relatos</span>}
                        {o.demo && (
                          <span className="simulado" title="Chamado de demonstração, não é relato real de morador">
                            Simulado
                          </span>
                        )}
                      </span>
                      <span className="item-sub">{o.endereco ?? o.bairro ?? 'Ver no mapa'}</span>
                      <span className="item-selos">
                        <Selo nivel={o.nivel} />
                        <Prazo o={o} />
                      </span>
                    </span>
                    <ItemLado o={o} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ordenada.length > fila.length && (
            <p className="fila-corte">
              Aparecem os {fila.length} primeiros de {ordenada.length}. Use a busca ou os filtros para achar os outros.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function Barras({ rotulo, nome, d }: { rotulo: string; nome: string; d: Distribuicao }) {
  return (
    <div className="barras" role="img" aria-label={`${nome}: ${d.map((p, i) => `nota ${i + 1} ${Math.round(p * 100)}%`).join(', ')}`}>
      <span className="barras-rotulo" title={nome}>{rotulo}</span>
      {d.map((p, i) => (
        <span key={i} className="barra" title={`${nome}, nota ${i + 1}: ${Math.round(p * 100)}%`}>
          <span className="barra-cheia" style={{ height: `${Math.max(p * 100, 2)}%` }} />
          <span className="barra-nota">{i + 1}</span>
        </span>
      ))}
    </div>
  )
}

// Só a primeira frase da orientação: o resto está na base, não no painel.
function primeiraFrase(t: string): string {
  const fim = t.search(/[.:](\s|$)/)
  return fim > 0 ? t.slice(0, fim + 1) : t
}

// O que a IA consultou antes de decidir (RAG e function calling, ADR 0023):
// orientações da prefeitura, casos parecidos e as funções chamadas.
function ContextoConsultado({ o }: { o: Ocorrencia }) {
  const cx = o.triagem?.contexto
  const resumo = resumoDoContexto(cx)
  if (!cx || !resumo) return null
  return (
    <section className="consultou" aria-label="O que a IA consultou">
      <h4>O que a IA consultou <span className="fonte">· {resumo}</span></h4>
      <ul>
        {cx.ferramentas?.map((f, i) => (
          <li key={`f${i}`} className={f.erro ? 'falhou' : ''}>
            <span className="consultou-tipo">Função</span>
            <span>
              <strong>{NOME_FERRAMENTA[f.nome] ?? f.nome}</strong>
              <span className="fonte"> · {f.erro ? 'sem resposta' : `${f.ms} ms`}</span>
            </span>
          </li>
        ))}
        {cx.casos?.map((k) => (
          <li key={k.protocolo}>
            <span className="consultou-tipo">Caso</span>
            <span>
              <strong>{k.protocolo}</strong> {k.resumo}
              <span className="fonte">
                {' '}· {nomeDoStatus(k.status as Ocorrencia['status']).toLowerCase()}
                {k.distancia_m != null && ` · a ${k.distancia_m} m`}
              </span>
            </span>
          </li>
        ))}
        {cx.orientacoes?.map((g, i) => (
          <li key={`o${i}`}>
            <span className="consultou-tipo">Base</span>
            <span>
              <strong>{g.titulo}</strong> {primeiraFrase(g.texto)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Auditoria da triagem (matriz GUT, confiança, provedor, etapas e custo): só o
// gestor vê, e fechada. Quem opera recebe a mesma informação em palavras.
function DetalhesDaTriagem({ o }: { o: Ocorrencia }) {
  const c = o.triagem?.classificacao
  const sinais = Object.entries(c?.sinais ?? {}).sort((a, b) => b[1] - a[1])
  return (
    <details className="bloco recolhido triagem">
      <summary>Detalhes da triagem</summary>
      <dl className="campos">
        <dt>Motivo</dt>
        <dd>{o.triagem?.motivo ?? 'Sem triagem'}</dd>
        <dt>Prazo</dt>
        <dd>
          {o.prazo_ate ? hora(o.prazo_ate) : 'Rotina da equipe'}
          {o.prazo_fonte && <span className="fonte"> · {o.prazo_fonte}</span>}
        </dd>
        {o.nivel_ia != null && (
          <>
            <dt>Nível</dt>
            <dd>
              {o.nivel ?? 'sem'} agora · {o.nivel_ia} pela triagem
            </dd>
          </>
        )}
        {o.triagem?.descricao?.resumo && (
          <>
            <dt>Visão</dt>
            <dd>{o.triagem.descricao.resumo}</dd>
          </>
        )}
      </dl>
      <ContextoConsultado o={o} />
      {c && (
        <>
          <h4>Matriz GUT</h4>
          <div className="gut">
            <Barras rotulo="G" nome="Gravidade" d={c.g} />
            <Barras rotulo="U" nome="Urgência" d={c.u} />
            <Barras rotulo="T" nome="Tendência" d={c.t} />
          </div>
          <p className="gut-legenda">
            GUT esperada {o.triagem!.gut_esperada.toFixed(0)} · pessimista {o.triagem!.gut_p90.toFixed(0)} · confiança {Math.round(c.confianca * 100)}% · {c.provedor}
          </p>
          {sinais.length > 0 && (
            <ul className="sinais">
              {sinais.map(([nome, p]) => (
                <li key={nome} className={p > 0.8 ? 'forte' : ''}>
                  <span>{NOME_SINAL[nome] ?? nome}</span>
                  <span className="sinal-barra" aria-hidden="true">
                    <span style={{ width: `${Math.round(p * 100)}%` }} />
                  </span>
                  <strong>{Math.round(p * 100)}%</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {o.etapas && o.etapas.length > 0 && (
        <>
          <h4>
            Etapas da triagem · {o.latencia_ms != null ? `${(o.latencia_ms / 1000).toFixed(1).replace('.', ',')} s` : 'sem tempo'} · {reais(o.custo_brl)}
          </h4>
          <table className="etapas">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Tempo</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {o.etapas.map((e, i) => (
                <tr key={i} className={e.ok ? '' : 'falhou'}>
                  <td>
                    {NOME_ETAPA[e.etapa] ?? e.etapa}
                    {!e.ok && <span className="fonte"> · falhou, seguiu pelo fallback</span>}
                    {e.etapa !== 'borrao' && e.provedor && <span className="fonte"> · {e.provedor}</span>}
                  </td>
                  <td>{e.ms} ms</td>
                  <td>{e.custo_brl > 0 ? reais(e.custo_brl) : 'sem custo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </details>
  )
}

const coordenada = (v: number) => String(Number(v.toFixed(6)))

// Rota até o local: abre o aplicativo de navegação já com o destino.
function Rota({ lat, lng }: { lat: number; lng: number }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => setAberto(false), [])
  useFecharAoSair(ref, aberto, fechar)
  return (
    <div className="suspenso" ref={ref}>
      <button type="button" className="pilula" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <Icone nome="rota" tamanho={18} />
        Abrir rota
      </button>
      {aberto && (
        <div className="suspenso-painel" role="menu" aria-label="Abrir rota em">
          <a role="menuitem" href={`https://waze.com/ul?ll=${coordenada(lat)},${coordenada(lng)}&navigate=yes`} target="_blank" rel="noopener" onClick={fechar}>
            Waze
          </a>
          <a role="menuitem" href={`https://www.google.com/maps/dir/?api=1&destination=${coordenada(lat)},${coordenada(lng)}`} target="_blank" rel="noopener" onClick={fechar}>
            Google Maps
          </a>
        </div>
      )}
    </div>
  )
}

function CopiarLocal({ lat, lng }: { lat: number; lng: number }) {
  const [copiado, setCopiado] = useState(false)
  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 2500)
    return () => clearTimeout(t)
  }, [copiado])
  const copiar = async () => {
    // Seis casas dão cerca de 10 cm: mais que isso é ruído da conta.
    const texto = `${coordenada(lat)}, ${coordenada(lng)}`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      window.prompt('Local do chamado:', texto)
    }
  }
  return (
    <button type="button" className="pilula" onClick={copiar}>
      <Icone nome={copiado ? 'certo' : 'copiar'} tamanho={18} />
      <span role="status">{copiado ? 'Local copiado' : 'Copiar local'}</span>
    </button>
  )
}

type Modo = 'urgencia' | 'secretaria' | 'resolucao' | 'reabertura'

const temSecretaria = (s: string | null): s is string => !!s && s !== 'A definir'

// Detalhe do chamado. Responde, nesta ordem: o que é, onde é, quão urgente e o
// que fazer agora, com um botão principal conforme a situação (princípio 7 do
// ADR 0017). O rodapé com as ações fica sempre à vista.
export function Detalhe({
  o: resumo,
  papel,
  aoFechar,
  aoMudar,
}: {
  o: Ocorrencia
  papel: Usuario['papel'] | null
  aoFechar: () => void
  aoMudar: (o: Ocorrencia) => void
}) {
  const [completo, setCompleto] = useState<Ocorrencia | null>(null)
  const [falhouDetalhe, setFalhouDetalhe] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [nivel, setNivel] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo | null>(null)
  const [mais, setMais] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [recado, setRecado] = useState('')
  const [outra, setOutra] = useState('')
  const [secretarias, setSecretarias] = useState<string[] | null>(null)
  const [podeDesfazer, setPodeDesfazer] = useState(false)
  // Confirmação curta da ação que deu certo, com o check que se desenha.
  const [confirmacao, setConfirmacao] = useState<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const agora = new Date(useAgora())

  // Relatos, etapas e histórico só vêm no detalhe; recarrega quando o chamado muda.
  useEffect(() => {
    let vivo = true
    detalhar(resumo.id)
      .then((d) => {
        if (!vivo) return
        setCompleto(d)
        setFalhouDetalhe(false)
      })
      .catch(() => vivo && setFalhouDetalhe(true))
    return () => {
      vivo = false
    }
  }, [resumo.id, resumo.atualizado_em, tentativa])

  // "Desfazer" fica à mão por 10 s depois de resolver.
  useEffect(() => {
    if (!podeDesfazer) return
    const t = setTimeout(() => setPodeDesfazer(false), 10_000)
    return () => clearTimeout(t)
  }, [podeDesfazer])

  useEffect(() => {
    if (!confirmacao) return
    const t = setTimeout(() => setConfirmacao(null), 4000)
    return () => clearTimeout(t)
  }, [confirmacao])

  // Quem usa teclado ou leitor de tela cai no título do chamado ao abrir.
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
  }, [])

  // A lista de secretarias só é pedida quando alguém vai trocar a responsável.
  useEffect(() => {
    if (modo !== 'secretaria' || secretarias) return
    let vivo = true
    listarSecretarias()
      .then((l) => vivo && setSecretarias(l))
      .catch(() => {
        if (!vivo) return
        setErro('Não foi possível carregar as secretarias. Tente de novo.')
        tocar('erro')
      })
    return () => {
      vivo = false
    }
  }, [modo, secretarias])

  const o = juntarDetalhe(resumo, completo)
  const paraConferir = o.status === 'revisao' || o.status === 'a_classificar'
  const eventos = o.eventos ?? []
  const relatos = o.relatos_lista ?? []
  const resumoDaFoto = o.triagem?.descricao?.resumo
  const feito = oQueFoiFeito(o.eventos)
  // Sem sugestão da triagem, o servidor escolhe direto entre as cinco urgências.
  const escolhendo = paraConferir && (modo === 'urgencia' || o.nivel == null)

  // O som confirma a ação que deu certo e avisa da que falhou; o sinal visual
  // é a mudança do chamado ou a mensagem de erro.
  const agir = async (f: () => Promise<Ocorrencia>, som: Som, aviso?: string): Promise<boolean> => {
    setEnviando(true)
    setErro(null)
    setConfirmacao(null)
    try {
      aoMudar(await f())
      tocar(som)
      if (aviso) setConfirmacao(aviso)
      return true
    } catch (e) {
      setErro(e instanceof Error ? `Não deu certo: ${e.message}. Tente de novo.` : 'Não deu certo. Tente de novo.')
      tocar('erro')
      return false
    } finally {
      setEnviando(false)
    }
  }

  const irPara = (m: Modo | null) => {
    setMotivo('')
    setErro(null)
    setNivel(null)
    setOutra('')
    setMais(false)
    setModo(m)
  }

  const conferir = async (n: number | null) => {
    if (n != null && (await agir(() => revisar(o.id, n), 'confirmado', `Urgência conferida: ${nomeDoNivel(n)}`))) irPara(null)
  }

  const mandar = async (secretaria?: string) => {
    if (!(await agir(() => despachar(o.id, recado, secretaria), 'confirmado', 'Equipe avisada'))) return
    setRecado('')
    irPara(null)
  }

  const confirmarResolucao = async (e: FormEvent) => {
    e.preventDefault()
    if (!(await agir(() => resolver(o.id, motivo), 'resolvido'))) return
    irPara(null)
    setPodeDesfazer(true)
  }

  const confirmarReabertura = async (e: FormEvent) => {
    e.preventDefault()
    if (!motivo.trim()) return
    if (await agir(() => reabrir(o.id, motivo), 'confirmado', 'Chamado reaberto')) irPara(null)
  }

  const desfazer = async () => {
    if (await agir(() => reabrir(o.id, 'resolvido por engano'), 'desfazer', 'Resolução desfeita')) setPodeDesfazer(false)
  }

  const formularioDeResolucao = (
    <form className="acoes-form" onSubmit={confirmarResolucao}>
      <label className="campo-acao">
        O que foi feito (opcional)
        {/* O botão clicado some; o foco segue para o campo. */}
        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} autoFocus />
      </label>
      <div className="acoes-par">
        <button type="submit" className="botao-principal" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Confirmar: resolvido'}
        </button>
        <button type="button" className="botao-secundario" onClick={() => irPara(null)} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  )

  return (
    <section className="detalhe" aria-labelledby="titulo-detalhe">
      <header className="detalhe-topo" data-arrasta>
        <span className="item-icone" aria-hidden="true" style={{ borderColor: corDoNivel(o.nivel) }}>
          {SIMBOLO_CATEGORIA[o.categoria] ?? SIMBOLO_CATEGORIA.outros}
        </span>
        <div className="detalhe-titulo">
          <h2 id="titulo-detalhe" ref={titulo} tabIndex={-1}>
            {NOME_CATEGORIA[o.categoria] ?? 'Outros'}
          </h2>
          <p className="protocolo">
            {nomeDoStatus(o.status)} · <span className="nobr">{o.protocolo}</span>
            {o.demo && <span className="simulado"> Simulado, não é relato real</span>}
          </p>
        </div>
        <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar e voltar para a lista">
          <Icone nome="fechar" tamanho={24} />
        </button>
      </header>

      <div className="detalhe-corpo">
        {/* A abertura do vídeo entra no histórico sem mexer no chamado: o detalhe é pedido de novo. */}
        <Galeria o={o} aoAbrirVideo={() => setTentativa((t) => t + 1)} />

        <p className="urgencia-linha">
          <Selo nivel={o.nivel} />
          <Prazo o={o} longo />
        </p>
        <p className="porque">
          <span className="oculto">Por que essa urgência: </span>
          {porQueEssaUrgencia(o)}
        </p>

        <div className="bloco">
          <h3>Onde</h3>
          <p>{o.endereco ?? 'Endereço não identificado: veja no mapa'}</p>
          {o.bairro && !o.endereco?.includes(o.bairro) && <p className="apoio">{o.bairro}</p>}
          <div className="pilulas">
            <Rota lat={o.lat} lng={o.lng} />
            <CopiarLocal lat={o.lat} lng={o.lng} />
          </div>
        </div>

        {(o.texto || resumoDaFoto || relatos.length > 1) && (
          <div className="bloco">
            <h3>O que o morador disse</h3>
            {o.texto ? (
              <p className="citacao">“{o.texto}”</p>
            ) : (
              <p className="apoio">O morador não escreveu nada.{resumoDaFoto ? ` Pela foto: ${resumoDaFoto}` : ''}</p>
            )}
            {relatos.length > 1 && (
              <details className="recolhido">
                <summary>Ver os {relatos.length} relatos</summary>
                {/* As fotos de cada relato estão na galeria, na mesma ordem. */}
                <ol className="relatos-lista">
                  {relatos.map((r, i) => (
                    <li key={r.id}>
                      {r.tipo === 'tambem_vi' ? (
                        'Confirmado por quem passou'
                      ) : (
                        <>
                          Relato {i + 1}: {r.texto ? `“${r.texto}”` : 'só a foto, sem texto'}
                        </>
                      )}
                      <span className="fonte"> · {quandoEmPalavras(r.criado_em, agora)}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}

        {relatos.some((r) => r.morador) && <QuemRelatou chamado={o.id} relatos={relatos} gestor={papel === 'gestor'} />}

        <div className="bloco">
          <h3>Quem cuida</h3>
          <p>{temSecretaria(o.secretaria) ? o.secretaria : 'Secretaria ainda não definida'}</p>
        </div>

        {!completo && !falhouDetalhe && <p className="carregando" role="status">Carregando o resto do chamado…</p>}
        {falhouDetalhe && (
          <p className="erro" role="alert">
            Não foi possível carregar o histórico e os relatos.{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                setFalhouDetalhe(false)
                setTentativa((t) => t + 1)
              }}
            >
              Tentar de novo
            </button>
          </p>
        )}

        {eventos.length > 0 && (
          <details className="bloco recolhido">
            <summary>Ver histórico ({eventos.length})</summary>
            <ol className="historico">
              {eventos.map((e, i) => {
                const nota = notaDoEvento(e, o.nivel_ia)
                return (
                  <li key={i}>
                    <strong>{rotuloDoEvento(e)}</strong>
                    <span className="fonte">
                      {e.autor ? `${e.autor} · ` : ''}
                      {quandoEmPalavras(e.criado_em, agora)}
                    </span>
                    {nota && <span className="historico-nota">{nota}</span>}
                  </li>
                )
              })}
            </ol>
          </details>
        )}

        {papel === 'gestor' && <DetalhesDaTriagem o={o} />}
      </div>

      {/* O prefeito acompanha o chamado; quem age é a central e a equipe. */}
      <footer className="detalhe-acoes" hidden={papel === 'prefeito'}>
        {paraConferir && (
          <>
            <p className="acoes-pergunta">{perguntaDaConferencia(o)}</p>
            {escolhendo ? (
              <>
                <div className="escolha-nivel" role="radiogroup" aria-label="Urgência">
                  {[...NIVEIS].reverse().map((n) => (
                    <button
                      key={n.nivel}
                      type="button"
                      role="radio"
                      aria-checked={nivel === n.nivel}
                      className="nivel-opcao"
                      style={nivel === n.nivel ? { background: n.cor, borderColor: n.cor, color: textoSobreNivel(n.nivel) } : { borderColor: n.cor }}
                      onClick={() => setNivel(n.nivel)}
                    >
                      <FormaDoNivel nivel={n.nivel} cor={nivel === n.nivel ? 'currentColor' : n.cor} tamanho={18} contorno={nivel === n.nivel ? undefined : '#2B1A10'} />
                      {n.nome}
                    </button>
                  ))}
                </div>
                <div className="acoes-par">
                  <button type="button" className="botao-principal" onClick={() => conferir(nivel)} disabled={enviando || nivel == null}>
                    {enviando ? 'Enviando…' : nivel == null ? 'Escolha a urgência' : `Confirmar: ${nomeDoNivel(nivel)}`}
                  </button>
                  {o.nivel != null && (
                    <button type="button" className="botao-secundario" onClick={() => irPara(null)} disabled={enviando}>
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="acoes-par">
                <button type="button" className="botao-principal" onClick={() => conferir(o.nivel)} disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Sim, confirmar'}
                </button>
                <button type="button" className="botao-secundario" onClick={() => irPara('urgencia')} disabled={enviando}>
                  Mudar a urgência
                </button>
              </div>
            )}
          </>
        )}

        {o.status === 'aberta' && modo !== 'resolucao' && (
          <>
            <label className="campo-acao">
              Recado para a equipe (opcional)
              <input type="text" value={recado} onChange={(e) => setRecado(e.target.value)} maxLength={200} />
            </label>
            {modo === 'secretaria' ? (
              <>
                <label className="campo-acao">
                  Mandar para qual secretaria?
                  <select value={outra} onChange={(e) => setOutra(e.target.value)} disabled={!secretarias} autoFocus>
                    <option value="">{secretarias ? 'Escolha a secretaria' : 'Carregando…'}</option>
                    {(secretarias ?? []).filter((s) => temSecretaria(s) && s !== o.secretaria).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="acoes-par">
                  <button type="button" className="botao-principal" onClick={() => mandar(outra)} disabled={enviando || !outra}>
                    {enviando ? 'Enviando…' : outra ? `Mandar equipe de ${outra}` : 'Escolha a secretaria'}
                  </button>
                  <button type="button" className="botao-secundario" onClick={() => irPara(null)} disabled={enviando}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                {temSecretaria(o.secretaria) ? (
                  <button type="button" className="botao-principal" onClick={() => mandar()} disabled={enviando}>
                    {enviando ? 'Enviando…' : `Mandar equipe de ${o.secretaria}`}
                  </button>
                ) : (
                  <button type="button" className="botao-principal" onClick={() => irPara('secretaria')} disabled={enviando}>
                    Escolher a secretaria
                  </button>
                )}
                <button type="button" className="mais-opcoes" aria-expanded={mais} onClick={() => setMais((m) => !m)}>
                  Mais opções
                  <Icone nome={mais ? 'acima' : 'abaixo'} tamanho={18} />
                </button>
                {mais && (
                  <div className="acoes-par">
                    {temSecretaria(o.secretaria) && (
                      <button type="button" className="botao-secundario" onClick={() => irPara('secretaria')} disabled={enviando}>
                        Mandar para outra secretaria
                      </button>
                    )}
                    <button type="button" className="botao-secundario" onClick={() => irPara('resolucao')} disabled={enviando}>
                      Já foi resolvido
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {o.status === 'aberta' && modo === 'resolucao' && formularioDeResolucao}

        {o.status === 'em_atendimento' && (
          <>
            <p className="acoes-situacao">
              Equipe{temSecretaria(o.secretaria) ? ` de ${o.secretaria}` : ''} a caminho{o.despachado_em ? ` desde ${quandoEmPalavras(o.despachado_em, agora)}` : ''}
            </p>
            {modo === 'resolucao' ? (
              formularioDeResolucao
            ) : (
              <button type="button" className="botao-principal" onClick={() => irPara('resolucao')} disabled={enviando}>
                Marcar como resolvido
              </button>
            )}
          </>
        )}

        {o.status === 'resolvida' && (
          <>
            {podeDesfazer && (
              <p className="barra-desfazer" role="status">
                <span className="feito-texto">
                  <CheckDesenhado />
                  Chamado resolvido.
                </span>
                <button type="button" onClick={desfazer} disabled={enviando}>
                  Desfazer
                </button>
              </p>
            )}
            <p className="acoes-situacao">
              Resolvido{o.resolvido_por ? ` por ${o.resolvido_por}` : ''} {emQuando(o.resolvido_em, agora)}
              {feito && <span className="apoio">O que foi feito: {feito}</span>}
            </p>
            {modo === 'reabertura' ? (
              <form className="acoes-form" onSubmit={confirmarReabertura}>
                <label className="campo-acao">
                  Por que reabrir?
                  <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} required autoFocus />
                </label>
                <div className="acoes-par">
                  <button type="submit" className="botao-principal" disabled={enviando || !motivo.trim()}>
                    {enviando ? 'Enviando…' : 'Confirmar: reabrir'}
                  </button>
                  <button type="button" className="botao-secundario" onClick={() => irPara(null)} disabled={enviando}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button type="button" className="mais-opcoes" aria-expanded={mais} onClick={() => setMais((m) => !m)}>
                  Mais opções
                  <Icone nome={mais ? 'acima' : 'abaixo'} tamanho={18} />
                </button>
                {mais && (
                  <button type="button" className="botao-secundario" onClick={() => irPara('reabertura')} disabled={enviando}>
                    Reabrir chamado
                  </button>
                )}
              </>
            )}
          </>
        )}
        {confirmacao && (
          <p className="feito" role="status">
            <CheckDesenhado />
            {confirmacao}
          </p>
        )}
        {erro && <p className="erro" role="alert">{erro}</p>}
      </footer>
    </section>
  )
}

const NOME_DO_TIPO: Record<string, string> = { pf: 'Pessoa física', pj: 'Empresa', servidor: 'Servidor público' }

// Quem relatou (ADR 0024): nome e documento mascarado para a central; só o
// gestor abre o número completo, e cada abertura fica no histórico.
function QuemRelatou({ chamado, relatos, gestor }: { chamado: string; relatos: Relato[]; gestor: boolean }) {
  const [abertos, setAbertos] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const ver = async (relato: string) => {
    setErro(null)
    try {
      const { documento } = await verDocumento(chamado, relato)
      setAbertos((a) => ({ ...a, [relato]: documento }))
      tocar('registrado')
    } catch {
      setErro('Não deu para abrir o documento agora.')
    }
  }
  // Liberar o CPF: apaga o cadastro de quem relatou (o relato fica), para a
  // pessoa se cadastrar de novo em outro celular. Confirma na própria linha.
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [liberados, setLiberados] = useState<ReadonlySet<string>>(new Set())
  const liberar = async (relato: string) => {
    setErro(null)
    try {
      await apagarCadastro(chamado, relato)
      setLiberados((l) => new Set(l).add(relato))
      setConfirmando(null)
      tocar('registrado')
    } catch {
      setErro('Não deu para liberar o cadastro agora.')
    }
  }
  const comCadastro = relatos.filter((r) => r.morador)
  return (
    <div className="bloco">
      <h3>Quem relatou</h3>
      <ul className="quem-relatou">
        {comCadastro.map((r) => (
          <li key={r.id}>
            <strong>{r.morador!.nome}</strong>
            <span className="apoio">
              {NOME_DO_TIPO[r.morador!.tipo] ?? r.morador!.tipo}
              {r.morador!.profissao ? ` · ${r.morador!.profissao}` : ''} · {abertos[r.id] ?? r.morador!.documento_mascarado}
            </span>
            {liberados.has(r.id) ? (
              <span className="apoio">Cadastro liberado. A pessoa pode se cadastrar de novo.</span>
            ) : (
              gestor && (
                <span className="quem-acoes">
                  {!abertos[r.id] && (
                    <button type="button" className="link" onClick={() => void ver(r.id)}>
                      Ver documento
                    </button>
                  )}
                  {confirmando === r.id ? (
                    <span className="quem-confirma" role="group" aria-label="Confirmar liberação do cadastro">
                      <span>Apagar o cadastro? O relato continua.</span>
                      <button type="button" className="link link-perigo" onClick={() => void liberar(r.id)}>
                        Sim, liberar
                      </button>
                      <button type="button" className="link" onClick={() => setConfirmando(null)}>
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="link" onClick={() => setConfirmando(r.id)}>
                      Liberar CPF
                    </button>
                  )}
                </span>
              )
            )}
          </li>
        ))}
      </ul>
      {gestor && (
        <p className="apoio">
          Abrir o documento e liberar o CPF ficam registrados no histórico, com o seu login. Libere quando a pessoa trocar de celular.
        </p>
      )}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
