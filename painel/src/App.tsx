import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Admin } from './Admin'
import { AjudaDoMapa } from './AjudaDoMapa'
import { Alerta } from './Alerta'
import { criticoParaConferir } from './alerta'
import { aoVivo, entrar, fraseDoLogin, listar, NaoAutorizado, quemSou, sair, tokenSalvo, type EstadoConexao } from './api'
import { CHAVE_NOTIFICACAO, guardar, pedirNotificacao, permissaoDeNotificacao, preferencia, type Permissao } from './avisos'
import { Chave } from './Chave'
import { alternar, filtrar, SEM_FILTROS, type Filtros } from './filtros'
import { Folha } from './Folha'
import { Gabinete } from './Gabinete'
import type { Altura } from './folha'
import { ehCampoDeTexto, useAlturasDaFolha, useCelular, useFecharAoSair } from './ganchos'
import { FormaDoNivel, Icone } from './icones'
import { Indicadores } from './Indicadores'
import { Mapa } from './Mapa'
import { contarAbertosPorNivel, contarPorBairro, corDoNivel, mesclar, mesclarRecarga, NOME_CATEGORIA, nomeDoNivel, type Aba, type Ordem } from './niveis'
import { Operacao } from './Operacao'
import { atalho, atributos, guardarPreferencias, lerPreferencias, type Preferencia } from './preferencias'
import { Detalhe, Fila, type CargaDaFila } from './Painel'
import { ligarSom, prepararSons, somLigado, tocar } from './sons'
import type { Ocorrencia, Usuario } from './tipos'
import { Urgencia } from './Urgencia'
import { useAlerta } from './useAlerta'
import Guia from './Guia'
import { guiaVisto, papelDoGuia } from './guia'

const SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'

function Marca({ grande, titulo }: { grande?: boolean; titulo?: boolean }) {
  const Tag = titulo ? 'h1' : 'div'
  return (
    <Tag className={'marca' + (grande ? ' grande' : '')}>
      <img src="/logo.svg" alt="" />
      <span>MOGI</span>
      {!grande && <small>Itamogi-MG</small>}
    </Tag>
  )
}

function Login({ aviso, aoEntrar }: { aviso: string | null; aoEntrar: (u: Usuario) => void }) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      aoEntrar(await entrar(login, senha))
    } catch (err) {
      setErro(fraseDoLogin(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <form onSubmit={enviar} className="login-caixa">
        <Marca grande titulo />
        <p className="login-sub">Painel da prefeitura · Itamogi-MG</p>
        {aviso && <p className="login-aviso" role="status">{aviso}</p>}
        <label>
          Login
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" className="botao-principal" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <a className="link-morador" href="/relatar">
          Sou morador: relatar um problema
        </a>
      </form>
    </main>
  )
}

// A equipe de campo tem a tela dela; aqui só o caminho até lá.
function SoParaACentral({ aoSair }: { aoSair: () => void }) {
  return (
    <main className="login">
      <div className="login-caixa">
        <Marca grande />
        <h1 className="central-titulo">Esta é a central.</h1>
        <p className="central-texto">A tela da equipe de campo é outra.</p>
        <a className="botao-principal grande" href="/campo">
          Abrir tela da equipe
        </a>
        <button type="button" className="botao-secundario" onClick={aoSair}>
          Sair
        </button>
      </div>
    </main>
  )
}

const NOME_CONEXAO: Record<EstadoConexao, string> = {
  conectando: 'Conectando…',
  'ao-vivo': 'Ao vivo',
  reconectando: 'Reconectando…',
}

const NOME_PAPEL: Record<Usuario['papel'], string> = {
  operador: 'Central',
  gestor: 'Gestor',
  campo: 'Equipe de campo',
  prefeito: 'Gabinete',
}

type Tela = 'gabinete' | 'mapa' | 'indicadores' | 'operacao' | 'admin'

const TELAS: { id: Tela; nome: string; soGestor?: boolean; soPrefeito?: boolean }[] = [
  { id: 'gabinete', nome: 'Gabinete', soPrefeito: true },
  { id: 'mapa', nome: 'Mapa' },
  { id: 'indicadores', nome: 'Indicadores' },
  { id: 'operacao', nome: 'Operação', soGestor: true },
  { id: 'admin', nome: 'Administração', soGestor: true },
]

function MenuDoUsuario({
  usuario,
  telas,
  tela,
  aoTela,
  som,
  aoSom,
  notificacao,
  permissao,
  aoNotificacao,
  aoSair,
  aoGuia,
  aoAjuda,
}: {
  usuario: Usuario | null
  telas: typeof TELAS
  tela: Tela
  aoTela: (t: Tela) => void
  som: boolean
  aoSom: () => void
  notificacao: boolean
  permissao: Permissao
  aoNotificacao: () => void
  aoSair: () => void
  aoGuia: () => void
  aoAjuda: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => setAberto(false), [])
  useFecharAoSair(ref, aberto, fechar)
  const nome = usuario?.nome || usuario?.login || 'Sua conta'

  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 2500)
    return () => clearTimeout(t)
  }, [copiado])

  const copiarLink = async () => {
    const link = `${location.origin}/relatar`
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
    } catch {
      window.prompt('Link do app do morador:', link)
    }
  }

  return (
    <div className="suspenso menu-usuario" ref={ref}>
      <button type="button" className="menu-botao" aria-expanded={aberto} aria-controls="menu-do-usuario" onClick={() => setAberto((a) => !a)}>
        <span className="so-celular">
          <Icone nome="menu" tamanho={24} />
          <span className="oculto">Menu de {nome}</span>
        </span>
        <span className="so-computador">
          <Icone nome="pessoa" tamanho={20} />
          <span className="oculto">Menu de </span>
          <span className="menu-nome">{nome}</span>
          {usuario && <small>{NOME_PAPEL[usuario.papel]}</small>}
          <Icone nome={aberto ? 'acima' : 'abaixo'} tamanho={16} />
        </span>
      </button>
      {aberto && (
        <div className="suspenso-painel menu-painel" id="menu-do-usuario">
          <p className="menu-quem">
            <strong>{nome}</strong>
            {usuario && <span>{NOME_PAPEL[usuario.papel]}</span>}
          </p>
          <nav className="menu-telas so-celular" aria-label="Telas">
            {telas.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={tela === t.id ? 'page' : undefined}
                onClick={() => {
                  aoTela(t.id)
                  fechar()
                }}
              >
                {t.nome}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => {
              aoAjuda()
              fechar()
            }}
          >
            Ajuda e configurações
          </button>
          <button
            type="button"
            onClick={() => {
              aoGuia()
              fechar()
            }}
          >
            Ver o guia de novo
          </button>
          <button type="button" onClick={copiarLink}>
            <span role="status">{copiado ? 'Link copiado' : 'Copiar link do morador'}</span>
          </button>
          <a href="/campo" target="_blank" rel="noopener" onClick={fechar}>
            Abrir tela da equipe de campo
          </a>
          <Chave nome="Sons do painel" ligada={som} aoMudar={aoSom} />
          {permissao !== 'sem-suporte' && (
            <Chave nome="Avisar também com notificação" ligada={notificacao && permissao === 'granted'} aoMudar={aoNotificacao} desativada={permissao === 'denied'} />
          )}
          {permissao === 'denied' && <p className="menu-nota">O navegador bloqueou as notificações deste site. Libere nas configurações do navegador.</p>}
          <button type="button" className="menu-sair" onClick={aoSair}>
            Sair
          </button>
        </div>
      )}
    </div>
  )
}

const lerDetalheDoHistorico = (): string | null => {
  const estado: unknown = history.state
  const id = estado && typeof estado === 'object' ? (estado as { mogiDetalhe?: unknown }).mogiDetalhe : null
  return typeof id === 'string' ? id : null
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  // Quem entrou: o prefeito cai direto no Gabinete; os outros, no mapa.
  const receberUsuario = useCallback((u: Usuario) => {
    setUsuario(u)
    setTela(u.papel === 'prefeito' ? 'gabinete' : 'mapa')
  }, [])
  const [logado, setLogado] = useState(() => tokenSalvo() !== null)
  const [tela, setTela] = useState<Tela>('mapa')
  const [avisoLogin, setAvisoLogin] = useState<string | null>(null)
  const [lista, setLista] = useState<Ocorrencia[]>([])
  const [carga, setCarga] = useState<CargaDaFila>('carregando')
  const [erro, setErro] = useState<string | null>(null)
  const [conexao, setConexao] = useState<EstadoConexao>('conectando')
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS)
  const [aba, setAba] = useState<Aba>('revisao')
  const [ordem, setOrdem] = useState<Ordem>('urgencia')
  const [verResolvidas, setVerResolvidas] = useState(false)
  const [ultima, setUltima] = useState<Ocorrencia | null>(null)
  const [altura, setAltura] = useState<Altura>('meia')
  // Chamado cujo detalhe acabou de fechar: a fila devolve o foco a ele.
  const [focar, setFocar] = useState<string | null>(null)
  const [som, setSom] = useState(somLigado)
  const [notificacao, setNotificacao] = useState(() => preferencia(CHAVE_NOTIFICACAO, false))
  const [permissao, setPermissao] = useState<Permissao>(permissaoDeNotificacao)
  const celular = useCelular()
  // Guia de primeiro uso da central: uma vez por papel e por aparelho.
  const [guiaAberto, setGuiaAberto] = useState(false)
  // Ajuda, comandos e acessibilidade: guardados neste aparelho.
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [preferencias, setPreferencias] = useState(() => lerPreferencias((k) => localStorage.getItem(k)))
  const mudarPreferencia = useCallback((qual: Preferencia) => setPreferencias((p) => ({ ...p, [qual]: !p[qual] })), [])
  useEffect(() => {
    guardarPreferencias(preferencias, (k, v) => localStorage.setItem(k, v))
    for (const [nome, valor] of Object.entries(atributos(preferencias))) {
      if (valor === null) document.documentElement.removeAttribute(nome)
      else document.documentElement.setAttribute(nome, valor)
    }
  }, [preferencias])
  // Atalhos do painel: ? abre a ajuda e M alterna só o mapa, fora de campo de texto.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented || ehCampoDeTexto(e.target) || document.querySelector('dialog[open], .tela-cheia')) return
      const qual = atalho(e.key, e.ctrlKey || e.metaKey || e.altKey)
      if (qual === 'ajuda') setAjudaAberta(true)
      else if (qual === 'soMapa') mudarPreferencia('soMapa')
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [mudarPreferencia])
  const [areaDoMapa, setAreaDoMapa] = useState<HTMLElement | null>(null)
  const alturas = useAlturasDaFolha(areaDoMapa)

  // Espelhos para os ouvintes lerem o estado atual sem se reinscrever.
  const listaRef = useRef(lista)
  const selecionadaRef = useRef(selecionada)
  const alturaRef = useRef(altura)
  useEffect(() => {
    listaRef.current = lista
    selecionadaRef.current = selecionada
    alturaRef.current = altura
  })

  // Controle das recargas: cada sessão, cada pedido e cada chamado que chega
  // ao vivo ganham um número, para a resposta atrasada não apagar o mais novo.
  const sessao = useRef(0)
  const pedido = useRef(0)
  const aplicado = useRef(0)
  const relogio = useRef(0)
  const toques = useRef(new Map<string, number>())

  // Um detalhe guardado no histórico de antes de recarregar a página não vale mais.
  useEffect(() => {
    if (lerDetalheDoHistorico()) history.replaceState(null, '')
  }, [])

  // Volta tudo ao começo, para o próximo login não herdar a tela, o chamado
  // aberto nem o aviso de relato novo de quem saiu.
  const deslogar = useCallback((aviso: string | null = null) => {
    sair()
    sessao.current++
    if (lerDetalheDoHistorico()) history.replaceState(null, '')
    setLogado(false)
    setUsuario(null)
    setLista([])
    setCarga('carregando')
    setErro(null)
    setTela('mapa')
    setSelecionada(null)
    setFocar(null)
    setFiltros(SEM_FILTROS)
    setAba('revisao')
    setUltima(null)
    setAvisoLogin(aviso)
  }, [])

  const expirar = useCallback(() => deslogar(SESSAO_EXPIRADA), [deslogar])

  // Chamado novo ou atualizado, do tempo real ou da resposta de uma ação.
  const aplicar = useCallback((o: Ocorrencia) => {
    toques.current.set(o.id, ++relogio.current)
    setLista((l) => mesclar(l, o))
  }, [])

  // Mostrar os chamados simulados (demo) é preferência deste aparelho. Fica
  // num ref para trocar a chave não derrubar o tempo real.
  const simulados = useRef(preferencias.simulados)
  const recarregar = useCallback(async () => {
    const daSessao = sessao.current
    const n = ++pedido.current
    const inicio = relogio.current
    try {
      const recebida = await listar(simulados.current)
      // Resposta de outra sessão ou mais velha que uma já aplicada: fora.
      if (daSessao !== sessao.current || n < aplicado.current) return
      aplicado.current = n
      const chegaram = new Set([...toques.current].filter(([, quando]) => quando > inicio).map(([id]) => id))
      if (n === pedido.current) toques.current.clear()
      setLista((l) => mesclarRecarga(l, recebida, chegaram))
      setCarga('pronta')
      setErro(null)
    } catch (e) {
      if (daSessao !== sessao.current) return
      if (e instanceof NaoAutorizado) return expirar()
      setCarga((c) => (c === 'pronta' ? c : 'falhou'))
      setErro('Sem conexão com o servidor. O painel tenta de novo sozinho.')
    }
  }, [expirar])

  // Quem está logado: só o 401 desloga; com falha de rede tenta de novo.
  useEffect(() => {
    if (!logado || usuario) return
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tentar = () => {
      quemSou()
        .then((u) => vivo && receberUsuario(u))
        .catch((e) => {
          if (!vivo) return
          if (e instanceof NaoAutorizado) return expirar()
          setCarga('falhou')
          timer = setTimeout(tentar, 4000)
        })
    }
    tentar()
    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [logado, usuario, expirar])

  // A lista e o tempo real só começam para a central: a equipe de campo tem
  // a tela dela e não carrega nada aqui.
  const daCentral = logado && usuario != null && usuario.papel !== 'campo'
  // Primeira entrada deste papel neste aparelho: abre o guia uma vez.
  useEffect(() => {
    const papel = papelDoGuia(usuario?.papel)
    if (!daCentral || !papel || guiaVisto(papel, (k) => localStorage.getItem(k))) return
    const t = setTimeout(() => setGuiaAberto(true), 800)
    return () => clearTimeout(t)
  }, [daCentral, usuario?.papel])
  useEffect(() => {
    if (!daCentral) return
    prepararSons(['novo_relato', 'critico', 'confirmado', 'desfazer', 'registrado', 'reconectou', 'erro', 'resolvido'])
    let caiu = false
    const aoEstado = (s: EstadoConexao) => {
      // Só quando volta de uma queda, não na primeira conexão.
      if (s === 'reconectando') caiu = true
      else if (s === 'ao-vivo' && caiu) {
        caiu = false
        tocar('reconectou')
      }
      setConexao(s)
    }
    return aoVivo((ev) => {
      if (ev.tipo === 'Ressincronizar') {
        void recarregar()
      } else if (ev.ocorrencia) {
        const o = ev.ocorrencia
        // Relato novo, ou mais um relato num chamado que já existia. O
        // crítico para conferir tem a faixa de alerta, que não some sozinha.
        const antes = listaRef.current.find((x) => x.id === o.id)
        // Chamado simulado novo não entra na fila de quem vê só relatos reais.
        if (o.demo && !antes && !simulados.current) return
        if ((ev.tipo === 'OcorrenciaCriada' || (antes && o.relatos > antes.relatos)) && !criticoParaConferir(o)) {
          setUltima(o)
          // O som acompanha o aviso "Chamado novo" e o anel no pino.
          if (ev.tipo === 'OcorrenciaCriada') tocar('novo_relato')
        }
        aplicar(o)
      }
    }, aoEstado, expirar)
  }, [daCentral, recarregar, aplicar, expirar])

  // Ligou ou desligou os simulados: a lista vem de novo do servidor.
  useEffect(() => {
    if (simulados.current === preferencias.simulados) return
    simulados.current = preferencias.simulados
    if (daCentral) void recarregar()
  }, [preferencias.simulados, daCentral, recarregar])

  useEffect(() => {
    if (!ultima) return
    const t = setTimeout(() => setUltima(null), 8000)
    return () => clearTimeout(t)
  }, [ultima])

  // Abrir e fechar o detalhe passam pelo histórico do navegador, para o botão
  // voltar do celular fechar o detalhe em vez de sair do painel.
  const abrir = useCallback((id: string, origem: 'mapa' | 'fila' = 'fila') => {
    if (lerDetalheDoHistorico()) history.replaceState({ mogiDetalhe: id }, '')
    else history.pushState({ mogiDetalhe: id }, '')
    setSelecionada(id)
    // Pelo pino o detalhe abre em meia altura, com o mapa à vista.
    if (origem === 'mapa' || alturaRef.current === 'recolhida') setAltura('meia')
  }, [])

  const fechar = useCallback(() => {
    if (lerDetalheDoHistorico()) {
      history.back()
      return
    }
    setFocar(selecionadaRef.current)
    setSelecionada(null)
  }, [])

  useEffect(() => {
    const aoVoltar = () => {
      const id = lerDetalheDoHistorico()
      if (!id) setFocar(selecionadaRef.current)
      setSelecionada(id)
    }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  // Esc fecha o detalhe. Menus e a tela cheia da galeria tratam o Esc antes.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !selecionadaRef.current) return
      if (ehCampoDeTexto(e.target) || document.querySelector('.tela-cheia')) return
      fechar()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [fechar])

  const verAgora = useCallback((id: string) => {
    setTela('mapa')
    abrir(id, 'mapa')
  }, [abrir])

  const { pendentes, depois } = useAlerta({ lista, carregada: carga === 'pronta', aberto: selecionada, notificacao, aoAbrir: verAgora })

  const filtrada = useMemo(() => filtrar(lista, filtros), [lista, filtros])
  const noMapa = useMemo(() => {
    // O chamado aberto no detalhe fica no mapa mesmo que um filtro o esconda.
    const passam = new Set(filtrada)
    return lista.filter((o) => o.id === selecionada || (passam.has(o) && (verResolvidas || o.status !== 'resolvida')))
  }, [lista, filtrada, selecionada, verResolvidas])
  // A contagem de cada urgência não se filtra por ela mesma.
  const abertosPorNivel = useMemo(() => contarAbertosPorNivel(filtrar(lista, { ...filtros, niveis: [] })), [lista, filtros])
  const bairros = useMemo(() => contarPorBairro(lista).slice(0, 6), [lista])
  const atual = lista.find((o) => o.id === selecionada) ?? null

  const alternarSom = () => {
    const novo = !som
    setSom(novo)
    ligarSom(novo)
    // Ao ligar, toca uma vez: é a confirmação de que o som está saindo.
    if (novo) tocar('confirmado')
  }

  const alternarNotificacao = async () => {
    if (notificacao && permissao === 'granted') {
      setNotificacao(false)
      guardar(CHAVE_NOTIFICACAO, '0')
      return
    }
    const p = permissao === 'granted' ? permissao : await pedirNotificacao()
    setPermissao(p)
    setNotificacao(p === 'granted')
    guardar(CHAVE_NOTIFICACAO, p === 'granted' ? '1' : '0')
  }

  if (!logado) {
    return (
      <Login
        aviso={avisoLogin}
        aoEntrar={(u) => {
          setAvisoLogin(null)
          receberUsuario(u)
          setLogado(true)
        }}
      />
    )
  }

  if (usuario?.papel === 'campo') return <SoParaACentral aoSair={() => deslogar()} />

  const gestor = usuario?.papel === 'gestor'
  const prefeito = usuario?.papel === 'prefeito'
  const telas = TELAS.filter((t) => (!t.soGestor || gestor) && (!t.soPrefeito || prefeito))

  return (
    <div className="app">
      <header className="topo">
        <Marca />
        <nav className="telas so-computador" aria-label="Telas">
          {telas.map((t) => (
            <button key={t.id} type="button" className={tela === t.id ? 'ligada' : ''} aria-current={tela === t.id ? 'page' : undefined} onClick={() => setTela(t.id)}>
              {t.nome}
            </button>
          ))}
        </nav>
        <span className={'conexao ' + conexao} role="status">
          <span className="conexao-texto">{NOME_CONEXAO[conexao]}</span>
        </span>
        <MenuDoUsuario
          usuario={usuario}
          telas={telas}
          tela={tela}
          aoTela={setTela}
          som={som}
          aoSom={alternarSom}
          notificacao={notificacao}
          permissao={permissao}
          aoNotificacao={alternarNotificacao}
          aoSair={() => deslogar()}
          aoGuia={() => {
            setTela('mapa')
            setGuiaAberto(true)
          }}
          aoAjuda={() => setAjudaAberta(true)}
        />
      </header>

      {/* O aviso de crítico para conferir é da central; o prefeito acompanha pelo Gabinete. */}
      {!prefeito && <Alerta pendentes={pendentes} aoVer={verAgora} aoDepois={depois} />}

      {tela === 'gabinete' && prefeito && (
        <Gabinete
          usuario={usuario}
          lista={lista}
          carregando={carga === 'carregando'}
          aoAbrir={(id) => {
            setTela('mapa')
            abrir(id, 'mapa')
          }}
          aoMapa={() => setTela('mapa')}
          aoIndicadores={() => setTela('indicadores')}
        />
      )}
      {tela === 'indicadores' && <Indicadores gestor={usuario?.papel === 'gestor'} />}
      {tela === 'operacao' && gestor && <Operacao />}
      {tela === 'admin' && gestor && <Admin />}
      {tela === 'mapa' && (
        <main className={'corpo' + (preferencias.soMapa ? ' so-mapa' : '')} ref={setAreaDoMapa}>
          <h1 className="oculto">Mapa de chamados</h1>
          <div className="area-mapa">
            <Mapa
              ocorrencias={noMapa}
              selecionada={selecionada}
              chegada={ultima}
              recuo={celular ? Math.min(alturas[altura], alturas.meia) : 0}
              aoSelecionar={(id) => abrir(id, 'mapa')}
            />
            <Urgencia
              celular={celular}
              escolhidos={filtros.niveis}
              abertos={abertosPorNivel}
              aoAlternar={(n) => setFiltros((f) => ({ ...f, niveis: alternar(f.niveis, n) }))}
              verResolvidas={verResolvidas}
              aoVerResolvidas={setVerResolvidas}
            />
            <div className="atalhos-mapa">
              <button
                type="button"
                className="botao-mapa"
                aria-pressed={preferencias.soMapa}
                aria-label="Ver só o mapa"
                title={preferencias.soMapa ? 'Mostrar os painéis (M)' : 'Ver só o mapa (M)'}
                onClick={() => mudarPreferencia('soMapa')}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {preferencias.soMapa ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
                </svg>
              </button>
              <button type="button" className="botao-mapa" aria-haspopup="dialog" aria-label="Ajuda e configurações" title="Ajuda e configurações (?)" onClick={() => setAjudaAberta(true)}>
                ?
              </button>
            </div>
            {bairros.length > 0 && (
              <details className="bairros" open={!celular && window.innerWidth >= 1200}>
                <summary>Em aberto por bairro</summary>
                <ul>
                  {bairros.map(([b, n]) => (
                    <li key={b}>
                      <span>{b}</span> <strong>{n}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {ultima && (
              <button type="button" className="aviso-novo" onClick={() => abrir(ultima.id, 'mapa')}>
                <FormaDoNivel nivel={ultima.nivel} cor={corDoNivel(ultima.nivel)} tamanho={16} contorno="#2B1A10" />
                <span className="aviso-novo-texto">
                  Chamado novo: {NOME_CATEGORIA[ultima.categoria] ?? 'Outros'}
                  {(ultima.bairro ?? ultima.endereco) && ` · ${ultima.bairro ?? ultima.endereco}`}
                </span>
              </button>
            )}
            {/* O leitor de tela ouve o chamado novo sem o foco sair de onde está. */}
            <p className="oculto" role="status">
              {ultima ? `Chamado novo: ${NOME_CATEGORIA[ultima.categoria] ?? 'Outros'}, ${nomeDoNivel(ultima.nivel)}` : ''}
            </p>
            {erro && <p className="erro flutuante" role="alert">{erro}</p>}
          </div>
          <Folha celular={celular} altura={altura} alturas={alturas} aoMudar={setAltura} rotulo={atual ? 'Detalhe do chamado' : 'Fila de chamados'}>
            {atual ? (
              <Detalhe key={atual.id} o={atual} papel={usuario?.papel ?? null} aoFechar={fechar} aoMudar={aplicar} />
            ) : (
              <Fila
                lista={lista}
                filtrada={filtrada}
                carga={carga}
                aba={aba}
                aoAba={setAba}
                filtros={filtros}
                aoFiltrar={setFiltros}
                ordem={ordem}
                aoOrdem={setOrdem}
                selecionada={selecionada}
                aoSelecionar={abrir}
                focar={focar}
              />
            )}
          </Folha>
        </main>
      )}
      <AjudaDoMapa
        aberta={ajudaAberta}
        preferencias={preferencias}
        aoMudar={mudarPreferencia}
        aoFechar={() => setAjudaAberta(false)}
        aoGuia={() => {
          setAjudaAberta(false)
          setTela('mapa')
          setGuiaAberto(true)
        }}
      />
      {guiaAberto && tela === 'mapa' && papelDoGuia(usuario?.papel) && (
        <Guia papel={papelDoGuia(usuario?.papel)!} celular={celular} aoFechar={() => setGuiaAberto(false)} />
      )}
    </div>
  )
}
