import { useEffect, useId, useState, type FormEvent } from 'react'
import { quemSou } from './api'
import { atualizarUsuario, criarUsuario, fraseDoErro, secretarias as buscarSecretarias, usuarios as buscarUsuarios } from './apiGestor'
import {
  comoFrase, conferirNovoUsuario, explicacaoDoPapel, gerarSenha, ordenarUsuarios, rotuloDoPapel, senhaEmBlocos,
  type Cadastro, type Papel,
} from './gestor'
import './gestor.css'

const ENTREGAR = 'Anote e entregue à pessoa: o MOGI não mostra a senha de novo.'
const PAPEIS: Papel[] = ['gestor', 'operador', 'campo', 'prefeito']

function BotaoCopiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Sem permissão de área de transferência (ou fora de https): a pessoa copia à mão.
      window.prompt('Copie daqui:', texto)
    }
  }
  return (
    <button type="button" className="botao-secundario" onClick={copiar}>
      {copiado ? 'Copiado' : rotulo}
    </button>
  )
}

function Senha({ senha, aoGerar }: { senha: string; aoGerar: () => void }) {
  return (
    <div className="us-senha">
      <div className="us-senha-linha">
        {senha && (
          <span className="us-senha-valor" aria-label={`Senha: ${senha.split('').join(' ')}`}>
            {senhaEmBlocos(senha).map((b, i) => (
              <span key={i} aria-hidden="true">{b}</span>
            ))}
          </span>
        )}
        <button type="button" className="botao-secundario" onClick={aoGerar}>
          {senha ? 'Gerar outra' : 'Gerar senha'}
        </button>
        {senha && <BotaoCopiar texto={senha} />}
      </div>
      {senha && <p className="us-senha-aviso">{ENTREGAR} A senha não tem espaço: os blocos são só para facilitar a leitura.</p>}
    </div>
  )
}

function EscolhaDePapel({ papel, secretaria, secretarias, aoMudar }: {
  papel: Papel | ''
  secretaria: string
  secretarias: string[]
  aoMudar: (papel: Papel, secretaria: string) => void
}) {
  const nome = useId()
  // A secretaria atual entra na lista mesmo que tenha sido renomeada depois.
  const opcoes = secretaria && !secretarias.includes(secretaria) ? [secretaria, ...secretarias] : secretarias
  return (
    <>
      <fieldset className="us-papeis">
        <legend>O que a pessoa faz</legend>
        {PAPEIS.map((p) => {
          const [titulo, explicacao] = explicacaoDoPapel(p).split(': ')
          return (
            <label key={p} className="us-papel">
              <input type="radio" name={nome} checked={papel === p} onChange={() => aoMudar(p, p === 'campo' ? secretaria : '')} />
              <strong>{titulo}</strong>
              <span>{explicacao}</span>
            </label>
          )
        })}
      </fieldset>
      {papel === 'campo' && (
        <label className="us-campo">
          Secretaria da equipe
          <select value={secretaria} onChange={(e) => aoMudar('campo', e.target.value)}>
            <option value="">Escolha a secretaria</option>
            {opcoes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <small>A equipe só vê os chamados desta secretaria.</small>
        </label>
      )}
    </>
  )
}

interface Entrega {
  nome: string
  login: string
  senha: string
}

function NovoUsuario({ secretarias, aoCriar, aoCancelar }: {
  secretarias: string[]
  aoCriar: (e: Entrega) => void
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [papel, setPapel] = useState<Papel | ''>('')
  const [secretaria, setSecretaria] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const problema = conferirNovoUsuario({ login, senha, papel, secretaria })
    if (problema || !papel) return setErro(comoFrase(problema ?? ''))
    setEnviando(true)
    setErro(null)
    try {
      const u = await criarUsuario({ login: login.trim(), nome: nome.trim(), senha, papel, secretaria: papel === 'campo' ? secretaria : '' })
      aoCriar({ nome: u.nome || u.login, login: u.login, senha })
    } catch (err) {
      setErro(fraseDoErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="us-form" onSubmit={enviar}>
      <p className="g-titulo">Novo usuário</p>
      <div className="us-dupla">
        <label className="us-campo">
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required autoComplete="off" />
          <small>Da pessoa ou da equipe. Ex.: Equipe de Obras 1.</small>
        </label>
        <label className="us-campo">
          Login
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value.toLowerCase().replace(/\s/g, ''))}
            maxLength={32}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <small>É o que a pessoa digita para entrar. Letras minúsculas e números, sem espaço. Ex.: obras1.</small>
        </label>
      </div>
      <EscolhaDePapel
        papel={papel}
        secretaria={secretaria}
        secretarias={secretarias}
        aoMudar={(p, s) => {
          setPapel(p)
          setSecretaria(s)
        }}
      />
      <div className="us-campo">
        Senha
        <Senha
          senha={senha}
          aoGerar={() => {
            setSenha(gerarSenha())
            setErro(null)
          }}
        />
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="us-acoes">
        <button type="submit" className="botao-principal" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar usuário'}
        </button>
        <button type="button" className="botao-secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

type Acao =
  | { tipo: 'senha'; senha: string; salva: boolean }
  | { tipo: 'papel'; papel: Papel; secretaria: string }
  | { tipo: 'desligar' }

function Item({ u, souEu, secretarias, aoMudar }: {
  u: Cadastro
  souEu: boolean
  secretarias: string[]
  aoMudar: (u: Cadastro) => void
}) {
  const [acao, setAcao] = useState<Acao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const nome = u.nome || u.login

  const abrir = (a: Acao | null) => {
    setAcao(a)
    setErro(null)
  }

  // Devolve se deu certo, para cada ação decidir o que mostrar depois.
  const gravar = async (mudanca: Parameters<typeof atualizarUsuario>[1]): Promise<boolean> => {
    setOcupado(true)
    setErro(null)
    try {
      aoMudar(await atualizarUsuario(u.login, mudanca))
      return true
    } catch (e) {
      setErro(fraseDoErro(e))
      return false
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li className={'us-item' + (u.ativo ? '' : ' desligado')}>
      <div className="us-quem">
        <span className="us-nome">
          {nome} {souEu && <small>(você)</small>}
        </span>
        <span className="fonte">login: {u.login}</span>
        <span className="us-papel-texto">{rotuloDoPapel(u.papel, u.secretaria)}</span>
        <span className={'us-situacao ' + (u.ativo ? 'ativo' : 'desligado')}>{u.ativo ? 'Ativo' : 'Desligado: não entra'}</span>
      </div>
      {!acao && (
        <div className="us-acoes">
          {u.ativo ? (
            <>
              <button type="button" className="botao-secundario" onClick={() => abrir({ tipo: 'senha', senha: gerarSenha(), salva: false })}>
                Trocar senha
              </button>
              <button type="button" className="botao-secundario" onClick={() => abrir({ tipo: 'papel', papel: u.papel, secretaria: u.secretaria })}>
                Mudar papel ou secretaria
              </button>
              <button type="button" className="botao-secundario" onClick={() => abrir({ tipo: 'desligar' })}>
                Desligar
              </button>
            </>
          ) : (
            <button type="button" className="botao-secundario" disabled={ocupado} onClick={() => void gravar({ ativo: true })}>
              {ocupado ? 'Religando…' : 'Religar'}
            </button>
          )}
        </div>
      )}

      {acao?.tipo === 'senha' && (
        <div className="us-form em-linha">
          <p>
            <strong>{acao.salva ? `Senha nova de ${nome} valendo.` : `Senha nova para ${nome}`}</strong>
            {!acao.salva && ' A senha antiga para de valer quando você salvar.'}
          </p>
          {acao.salva ? (
            <div className="us-senha">
              <div className="us-senha-linha">
                <span className="us-senha-valor">
                  {senhaEmBlocos(acao.senha).map((b, i) => (
                    <span key={i}>{b}</span>
                  ))}
                </span>
                <BotaoCopiar texto={acao.senha} />
              </div>
              <p className="us-senha-aviso">{ENTREGAR}</p>
            </div>
          ) : (
            <Senha senha={acao.senha} aoGerar={() => setAcao({ tipo: 'senha', senha: gerarSenha(), salva: false })} />
          )}
          <div className="us-acoes">
            {acao.salva ? (
              <button type="button" className="botao-principal" onClick={() => abrir(null)}>
                Já anotei
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="botao-principal"
                  disabled={ocupado}
                  onClick={async () => {
                    if (await gravar({ senha: acao.senha })) setAcao({ ...acao, salva: true })
                  }}
                >
                  {ocupado ? 'Salvando…' : 'Salvar senha nova'}
                </button>
                <button type="button" className="botao-secundario" onClick={() => abrir(null)}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {acao?.tipo === 'papel' && (
        <div className="us-form em-linha">
          <EscolhaDePapel
            papel={acao.papel}
            secretaria={acao.secretaria}
            secretarias={secretarias}
            aoMudar={(papel, secretaria) => setAcao({ tipo: 'papel', papel, secretaria })}
          />
          <div className="us-acoes">
            <button
              type="button"
              className="botao-principal"
              disabled={ocupado}
              onClick={async () => {
                if (acao.papel === 'campo' && !acao.secretaria) return setErro('Escolha a secretaria da equipe.')
                if (await gravar({ papel: acao.papel, secretaria: acao.papel === 'campo' ? acao.secretaria : '' })) abrir(null)
              }}
            >
              {ocupado ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="botao-secundario" onClick={() => abrir(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {acao?.tipo === 'desligar' && (
        <div className="us-confirma">
          <p>{nome} não entra mais. O histórico dele continua.</p>
          <div className="us-acoes">
            <button
              type="button"
              className="botao-perigo"
              disabled={ocupado}
              onClick={async () => {
                if (await gravar({ ativo: false })) abrir(null)
              }}
            >
              {ocupado ? 'Desligando…' : `Desligar ${nome}`}
            </button>
            <button type="button" className="botao-secundario" onClick={() => abrir(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="erro" role="alert">{erro}</p>}
    </li>
  )
}

// Usuários do sistema (ADR 0016): o gestor cria, troca a senha, muda o papel
// e desliga. Ninguém é apagado, para o histórico continuar apontando para alguém.
export function Usuarios() {
  const [lista, setLista] = useState<Cadastro[] | null>(null)
  const [secretarias, setSecretarias] = useState<string[]>([])
  const [eu, setEu] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [entrega, setEntrega] = useState<Entrega | null>(null)

  // Muda a cada "Tentar de novo" e a cada usuário criado, para buscar a lista outra vez.
  const [busca, setBusca] = useState(0)
  const recarregar = () => setBusca((n) => n + 1)

  useEffect(() => {
    let vivo = true
    Promise.all([buscarUsuarios(), buscarSecretarias()])
      .then(([us, ss]) => {
        if (!vivo) return
        setLista(us)
        setSecretarias(ss)
        setErro(null)
      })
      .catch((e) => vivo && setErro(fraseDoErro(e)))
    return () => {
      vivo = false
    }
  }, [busca])

  useEffect(() => {
    let vivo = true
    // Só para marcar "você" na lista; sem isso a tela funciona igual.
    quemSou().then((u) => vivo && setEu(u.login)).catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])

  const linkDoCampo = `${location.origin}/campo`

  return (
    <div className="g-painel">
      <div className="us-topo">
        <div>
          <h2 className="g-titulo">Quem pode entrar no sistema</h2>
          <p className="sub">Cada pessoa ou equipe entra com o próprio login. Ninguém é apagado: quem sai é desligado e o histórico continua.</p>
        </div>
        {!novo && (
          <button type="button" className="botao-principal" onClick={() => setNovo(true)}>
            Novo usuário
          </button>
        )}
      </div>

      {erro && (
        <div className="g-aviso erro-forte" role="alert">
          <p>{erro}</p>
          <button type="button" className="botao-secundario" onClick={recarregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {entrega && (
        <div className="us-form" role="status">
          <p className="g-titulo">{entrega.nome} já pode entrar</p>
          <p>
            Login: <strong>{entrega.login}</strong>
          </p>
          <div className="us-senha">
            <div className="us-senha-linha">
              <span className="us-senha-valor">
                {senhaEmBlocos(entrega.senha).map((b, i) => (
                  <span key={i}>{b}</span>
                ))}
              </span>
              <BotaoCopiar texto={entrega.senha} rotulo="Copiar senha" />
            </div>
            <p className="us-senha-aviso">{ENTREGAR}</p>
          </div>
          <div className="us-acoes">
            <button type="button" className="botao-principal" onClick={() => setEntrega(null)}>
              Já anotei
            </button>
          </div>
        </div>
      )}

      {novo && (
        <NovoUsuario
          secretarias={secretarias}
          aoCancelar={() => setNovo(false)}
          aoCriar={(e) => {
            setNovo(false)
            setEntrega(e)
            recarregar()
          }}
        />
      )}

      <div className="us-link">
        <span>
          <strong>Tela da equipe de campo:</strong> a equipe abre este endereço no celular e entra com o login dela.
        </span>
        <code>{linkDoCampo}</code>
        <BotaoCopiar texto={linkDoCampo} />
      </div>

      {!lista && !erro && <p className="vazio">Carregando os usuários…</p>}
      {lista && (
        <ul className="us-lista">
          {ordenarUsuarios(lista).map((u) => (
            <Item
              key={u.login}
              u={u}
              souEu={u.login === eu}
              secretarias={secretarias}
              aoMudar={(novoU) => setLista((l) => (l ?? []).map((x) => (x.login === novoU.login ? novoU : x)))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
