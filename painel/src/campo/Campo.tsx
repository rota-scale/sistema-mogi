import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { EventoAoVivo, Ocorrencia } from '../tipos'
import { aoVivo, buscarCidade, entrar, Falha, listar, LoginRecusado, quemSou, sair, sessaoExpirou, tokenSalvo } from './api'
import type { ErroDeLogin, EstadoConexao, UsuarioDeCampo } from './api'
import './campo.css'
import Guia from '../Guia'
import { guiaVisto } from '../regrasDoGuia'
import { Chamado } from './Chamado'
import { useAgora, useLocalizacao, useRota, useTituloEmFoco } from './ganchos'
import { Lista } from './Lista'
import type { Aba } from './Lista'
import { aplicarEvento, mensagemDaFalha, SESSAO_EXPIROU } from './logica'
import { prepararSons, tocar } from '../sons'
import type { Ordem } from './logica'
import { Confete } from '../relatar/pecas'
import { CaixaDeErro, Girando, IconeCerto } from './pecas'

type Sessao =
  | { fase: 'conferindo' }
  | { fase: 'sem-rede' }
  | { fase: 'login'; aviso?: string }
  | { fase: 'dentro'; usuario: UsuarioDeCampo }

// Tela da equipe de campo (ADR 0016): lista de chamados da secretaria e, em
// cada chamado, rota até o local e registro do serviço feito.
export function Campo() {
  const [sessao, setSessao] = useState<Sessao>(() => (tokenSalvo() ? { fase: 'conferindo' } : { fase: 'login' }))
  const [cidade, setCidade] = useState<string | null>(null)

  const conferir = useCallback(async () => {
    setSessao({ fase: 'conferindo' })
    try {
      setSessao({ fase: 'dentro', usuario: await quemSou() })
    } catch (e) {
      setSessao(sessaoExpirou(e) ? { fase: 'login', aviso: SESSAO_EXPIROU } : { fase: 'sem-rede' })
    }
  }, [])

  useEffect(() => {
    if (tokenSalvo()) void conferir()
    void buscarCidade().then(setCidade)
  }, [conferir])

  const aoExpirar = useCallback(() => {
    sair()
    setSessao({ fase: 'login', aviso: SESSAO_EXPIROU })
  }, [])

  const aoSair = useCallback(() => {
    sair()
    setSessao({ fase: 'login' })
  }, [])

  switch (sessao.fase) {
    case 'conferindo':
      return (
        <Moldura cidade={cidade}>
          <p className="espera" role="status">
            <Girando /> Carregando…
          </p>
        </Moldura>
      )
    case 'sem-rede':
      return (
        <Moldura cidade={cidade}>
          <h1 className="titulo titulo-menor">Sem conexão</h1>
          <CaixaDeErro aoTentar={() => void conferir()}>
            Não deu para falar com a prefeitura. Confira a internet e toque em Tentar de novo.
          </CaixaDeErro>
          <button type="button" className="link" onClick={aoSair}>
            Entrar com outro login
          </button>
        </Moldura>
      )
    case 'login':
      return (
        <Moldura cidade={cidade}>
          <Login aviso={sessao.aviso} aoEntrar={(usuario) => setSessao({ fase: 'dentro', usuario })} />
        </Moldura>
      )
    default:
      if (sessao.usuario.papel !== 'campo') {
        return (
          <Moldura cidade={cidade}>
            <TelaErrada aoSair={aoSair} />
          </Moldura>
        )
      }
      return <Equipe usuario={sessao.usuario} cidade={cidade} aoExpirar={aoExpirar} aoSair={aoSair} />
  }
}

function Marca({ cidade }: { cidade: string | null }) {
  return (
    <>
      <img className="topo-logo" src="/logo.svg" width={40} height={40} alt="" />
      <span className="topo-marca">MOGI</span>
      {cidade && <span className="topo-cidade">{cidade}</span>}
    </>
  )
}

function Moldura({ cidade, children }: { cidade: string | null; children: ReactNode }) {
  return (
    <div className="pagina">
      <header className="topo">
        <Marca cidade={cidade} />
      </header>
      <main className="conteudo">{children}</main>
    </div>
  )
}

const ERRO_DE_LOGIN: Record<ErroDeLogin, string> = {
  senha: 'Login ou senha não conferem. Confira e tente de novo.',
  muitas: 'Muitas tentativas erradas. Espere 10 minutos e tente de novo.',
  sem_rede: 'Não consegui falar com o servidor. Confira a internet e o endereço, e toque em Entrar de novo.',
  armazenamento: 'O navegador não deixou guardar a sua entrada. Saia do modo anônimo e tente de novo.',
  servidor: 'Não deu certo agora. Espere um pouco e toque em Entrar de novo.',
}

function Login({ aviso, aoEntrar }: { aviso?: string; aoEntrar: (u: UsuarioDeCampo) => void }) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const titulo = useTituloEmFoco<HTMLHeadingElement>()

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (entrando) return
    if (!login.trim() || !senha) {
      setErro('Preencha o login e a senha.')
      return
    }
    setEntrando(true)
    setErro(null)
    try {
      aoEntrar(await entrar(login.trim(), senha))
    } catch (falha) {
      setErro(ERRO_DE_LOGIN[falha instanceof LoginRecusado ? falha.motivo : 'servidor'])
      setEntrando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={(e) => void enviar(e)} noValidate>
      <h1 className="titulo" ref={titulo} tabIndex={-1}>
        Equipe de campo
      </h1>
      <p className="apoio">Entre para ver os chamados da sua equipe.</p>
      {aviso && !erro && (
        <p className="aviso" role="status">
          {aviso}
        </p>
      )}
      <div className="campo">
        <label htmlFor="login">Login</label>
        <input
          id="login"
          name="login"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <div className="campo-senha">
          <input
            id="senha"
            name="senha"
            type={mostrar ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button type="button" className="ver-senha" aria-pressed={mostrar} onClick={() => setMostrar((m) => !m)}>
            {mostrar ? 'Esconder' : 'Mostrar'}
          </button>
        </div>
      </div>
      {erro && <CaixaDeErro>{erro}</CaixaDeErro>}
      <button type="submit" className="botao botao-primario" disabled={entrando}>
        {entrando ? (
          <>
            <Girando /> Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </button>
    </form>
  )
}

function TelaErrada({ aoSair }: { aoSair: () => void }) {
  const titulo = useTituloEmFoco<HTMLHeadingElement>()
  return (
    <>
      <h1 className="titulo titulo-menor" ref={titulo} tabIndex={-1}>
        Esta tela é da equipe de campo.
      </h1>
      <p className="apoio">Para a central, use o painel.</p>
      <a className="botao botao-primario" href="/">
        Abrir o painel
      </a>
      <button type="button" className="botao botao-secundario" onClick={aoSair}>
        Sair
      </button>
    </>
  )
}

type Aviso = 'concluido' | 'avisado' | 'ja-concluido' | 'saiu'

const TEXTO_DO_AVISO: Record<Aviso, { titulo: string; apoio: string; bom: boolean }> = {
  concluido: { titulo: 'Chamado concluído. Obrigado!', apoio: 'Ele saiu da sua lista e está em Feitos hoje.', bom: true },
  avisado: { titulo: 'Avisamos a central.', apoio: 'O chamado saiu da sua lista e a central vai conferir.', bom: true },
  'ja-concluido': {
    titulo: 'Este chamado já foi concluído por outra pessoa.',
    apoio: 'Ele saiu da sua lista. Não precisa fazer mais nada.',
    bom: false,
  },
  saiu: {
    titulo: 'Este chamado não está mais com a sua equipe.',
    apoio: 'A central mudou o chamado. Ele saiu da sua lista.',
    bom: false,
  },
}

const RECARGA_SEM_SOCKET_MS = 60_000
// Os links das fotos vencem; depois de um tempo fora, a lista é buscada de novo.
const LISTA_VELHA_MS = 5 * 60_000
const AVISO_SOME_EM_MS = 4000

interface EquipeProps {
  usuario: UsuarioDeCampo
  cidade: string | null
  aoExpirar: () => void
  aoSair: () => void
}

function textoDaFalha(e: unknown): string {
  return mensagemDaFalha(e instanceof Falha ? e.codigo : 'servidor')
}

function Equipe({ usuario, cidade, aoExpirar, aoSair }: EquipeProps) {
  // Guia de primeiro uso da equipe: uma vez por aparelho, e de novo pelo botão Ajuda.
  const [guia, setGuia] = useState(() => !guiaVisto('campo', (k) => localStorage.getItem(k)))
  useEffect(() => prepararSons(['chamado_equipe', 'resolvido', 'confirmado', 'foto', 'erro']), [])
  const [pendentes, setPendentes] = useState<Ocorrencia[] | null>(null)
  const [erroPendentes, setErroPendentes] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [feitos, setFeitos] = useState<Ocorrencia[] | null>(null)
  const [erroFeitos, setErroFeitos] = useState<string | null>(null)
  const [buscandoFeitos, setBuscandoFeitos] = useState(false)
  const [conexao, setConexao] = useState<EstadoConexao>('conectando')
  const [aba, setAba] = useState<Aba>('atender')
  const [ordem, setOrdem] = useState<Ordem>('urgencia')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  // Última versão do chamado aberto que chegou pelo tempo real, para a tela
  // saber que ele saiu da lista enquanto a pessoa olhava.
  const [avulso, setAvulso] = useState<Ocorrencia | null>(null)
  const { rota, ir, trocar, voltar, paraLista } = useRota()
  const local = useLocalizacao()
  const agora = useAgora()

  const emCurso = useRef(false)
  const refazer = useRef(false)
  const ultimaCarga = useRef(0)
  const feitosPedidos = useRef(false)
  const conexaoAtual = useRef<EstadoConexao>('conectando')
  const chamadoAberto = useRef<string | undefined>(rota.chamado)
  const rolagem = useRef(0)

  useEffect(() => {
    chamadoAberto.current = rota.chamado
  }, [rota.chamado])

  const carregar = useCallback(async () => {
    // Pedido no meio do caminho: refaz no fim, para não perder o que mudou
    // entre a consulta e a conexão do tempo real.
    if (emCurso.current) {
      refazer.current = true
      return
    }
    emCurso.current = true
    setBuscando(true)
    try {
      do {
        refazer.current = false
        const lista = await listar('em_atendimento')
        setPendentes(lista)
        setErroPendentes(null)
        ultimaCarga.current = Date.now()
      } while (refazer.current)
    } catch (e) {
      if (sessaoExpirou(e)) aoExpirar()
      else setErroPendentes(textoDaFalha(e))
    } finally {
      emCurso.current = false
      setBuscando(false)
    }
  }, [aoExpirar])

  const carregarFeitos = useCallback(async () => {
    feitosPedidos.current = true
    setBuscandoFeitos(true)
    try {
      setFeitos(await listar('resolvida'))
      setErroFeitos(null)
    } catch (e) {
      if (sessaoExpirou(e)) aoExpirar()
      else setErroFeitos(textoDaFalha(e))
    } finally {
      setBuscandoFeitos(false)
    }
  }, [aoExpirar])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const aoEvento = (e: EventoAoVivo) => {
      if (e.tipo === 'Conectado') return
      if (e.tipo === 'Ressincronizar') {
        void carregar()
        if (feitosPedidos.current) void carregarFeitos()
        return
      }
      // Chamado que acabou de entrar para a equipe: som e vibração, além do cartão novo.
      const o = e.ocorrencia
      setPendentes((l) => {
        if (l && o && o.status === 'em_atendimento' && !l.some((x) => x.id === o.id)) tocar('chamado_equipe')
        return l ? aplicarEvento(l, e) : l
      })
      setFeitos((l) => (l ? aplicarEvento(l, e, 'resolvida') : l))
      if (e.ocorrencia && e.ocorrencia.id === chamadoAberto.current) setAvulso(e.ocorrencia)
    }
    const aoEstado = (s: EstadoConexao) => {
      conexaoAtual.current = s
      setConexao(s)
    }
    return aoVivo(aoEvento, aoEstado, aoExpirar)
  }, [carregar, carregarFeitos, aoExpirar])

  // Sem tempo real a lista se renova sozinha a cada minuto, só com a tela à vista.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && conexaoAtual.current !== 'ao-vivo') void carregar()
    }, RECARGA_SEM_SOCKET_MS)
    const aoVoltarParaAba = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimaCarga.current > LISTA_VELHA_MS) void carregar()
    }
    document.addEventListener('visibilitychange', aoVoltarParaAba)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltarParaAba)
    }
  }, [carregar])

  useEffect(() => {
    if (aviso !== 'concluido' && aviso !== 'avisado') return
    const t = setTimeout(() => setAviso(null), AVISO_SOME_EM_MS)
    return () => clearTimeout(t)
  }, [aviso])

  // Ao voltar do chamado, a lista reaparece onde a pessoa estava.
  const naLista = !rota.chamado
  useEffect(() => {
    if (naLista) window.scrollTo(0, rolagem.current)
  }, [naLista])

  const trocarAba = (nova: Aba) => {
    setAba(nova)
    if (nova === 'feitos') void carregarFeitos()
  }

  const atualizar = () => {
    void carregar()
    if (aba === 'feitos') void carregarFeitos()
  }

  const abrir = (o: Ocorrencia) => {
    rolagem.current = window.scrollY
    setAvulso(null)
    ir({ chamado: o.id })
  }

  const tirarDaLista = (id: string) => setPendentes((l) => (l ? l.filter((x) => x.id !== id) : l))

  const fechar = (id: string, motivo: Aviso, resolvida?: Ocorrencia) => {
    tirarDaLista(id)
    if (resolvida) setFeitos((l) => (l ? [resolvida, ...l.filter((x) => x.id !== id)] : l))
    setAviso(motivo)
    if (motivo === 'concluido') tocar('resolvido')
    else if (motivo === 'avisado') tocar('confirmado')
    paraLista()
    // Quando a mudança não foi feita aqui, a lista do servidor é a verdade.
    if (motivo === 'ja-concluido' || motivo === 'saiu') void carregar()
  }

  if (rota.chamado) {
    const id = rota.chamado
    const resumo =
      pendentes?.find((o) => o.id === id) ?? feitos?.find((o) => o.id === id) ?? (avulso?.id === id ? avulso : null)
    return (
      <Chamado
        key={id}
        id={id}
        resumo={resumo}
        usuario={usuario}
        rota={rota}
        aqui={local.aqui}
        agora={agora}
        aoIr={ir}
        aoTrocar={trocar}
        aoVoltar={voltar}
        aoParaLista={paraLista}
        aoExpirar={aoExpirar}
        aoConcluir={(o) => fechar(id, 'concluido', o)}
        aoAvisar={() => fechar(id, 'avisado')}
        aoJaConcluido={() => fechar(id, 'ja-concluido')}
        aoSaiu={() => fechar(id, 'saiu')}
      />
    )
  }

  return (
    <>
      <Lista
        aoAjuda={() => setGuia(true)}
        usuario={usuario}
        cidade={cidade}
        pendentes={pendentes}
        erroPendentes={erroPendentes}
        feitos={feitos}
        erroFeitos={erroFeitos}
        buscando={aba === 'feitos' ? buscandoFeitos || buscando : buscando}
        conexao={conexao}
        aba={aba}
        aoTrocarAba={trocarAba}
        ordem={ordem}
        aoOrdenar={setOrdem}
        local={local}
        agora={agora}
        aoAbrir={abrir}
        aoAtualizar={atualizar}
        aoSair={aoSair}
      />
      {aviso && <TelaDeAviso aviso={aviso} aoFechar={() => setAviso(null)} />}
      {guia && !aviso && <Guia papel="campo" celular aoFechar={() => setGuia(false)} />}
    </>
  )
}

function TelaDeAviso({ aviso, aoFechar }: { aviso: Aviso; aoFechar: () => void }) {
  const t = TEXTO_DO_AVISO[aviso]
  const botao = useRef<HTMLButtonElement>(null)
  const [semente] = useState(() => Date.now())
  useEffect(() => {
    botao.current?.focus()
  }, [])
  return (
    <div className="aviso-tela" role="alertdialog" aria-modal="true" aria-labelledby="aviso-titulo" aria-describedby="aviso-apoio">
      <div className="aviso-miolo">
        {t.bom && (
          <span className="aviso-disco" aria-hidden="true">
            <IconeCerto tamanho={56} desenha />
          </span>
        )}
        {aviso === 'concluido' && <Confete semente={semente} />}
        <h2 id="aviso-titulo" className="titulo titulo-menor titulo-centro">
          {t.titulo}
        </h2>
        <p id="aviso-apoio" className="apoio apoio-centro">
          {t.apoio}
        </p>
        <button ref={botao} type="button" className="botao botao-primario" onClick={aoFechar}>
          Ver os chamados
        </button>
      </div>
    </div>
  )
}
