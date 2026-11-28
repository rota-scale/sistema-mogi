import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as EventoDeTecla } from 'react'
import { tocar } from '../sons'
import { fraseDosResolvidos, haQuanto, LIMITE_CAMPO, LIMITE_NOME, nomeDoTipo, tempoMedio } from './regrasDoCadastro'
import type { Comunidade, MeusRelatos, Morador, RelatoDoMorador } from './regrasDoCadastro'
import CampoCidade from './CampoCidade'
import type { Municipio } from './municipios'
import { apagarEu, buscarComunidade, buscarEu, buscarMeusRelatos, editarEu } from './conta'
import { distanciaCurta, nomeCurto } from './logica'
import type { Ponto } from './logica'
import { ESTILOS, TONS, corDaPele } from './boneco'
import type { Aparencia } from './boneco'
import { Boneco, IconeAvancar, IconeBairro, IconeDoTipo, IconeFechar, IconeLapis, IconeLixeira, IconePessoa, IconeSair, Selo } from './pecas'

export type Aba = 'perfil' | 'bairro'

interface Props {
  aba: Aba
  aoTrocarAba: (aba: Aba) => void
  temConta: boolean
  morador: Morador | null
  // Onde a pessoa está (ou o centro da cidade): base do "Meu bairro".
  ponto: Ponto
  aoMorador: (m: Morador) => void
  // O histórico chegou: o Relatar junta aos relatos guardados no aparelho.
  aoRelatos: (relatos: RelatoDoMorador[]) => void
  aoAbrirRelato: (protocolo: string) => void
  aoCadastrar: () => void
  // O servidor não reconhece mais o token.
  aoSemConta: () => void
  aoSair: () => void
  aoApagada: () => void
  aoFechar: () => void
  aparencia: Aparencia
  aoAparencia: (a: Aparencia) => void
}

type Carga<T> = { fase: 'carregando' } | { fase: 'pronto'; dados: T } | { fase: 'falhou' }

// Folha do perfil, com duas abas: o perfil e os relatos da pessoa, e o que
// a prefeitura resolveu perto dela nos últimos 30 dias.
export default function Perfil(props: Props) {
  const { aba, aoTrocarAba, temConta, morador, aoFechar } = props
  const titulo = useRef<HTMLHeadingElement>(null)
  const abaPerfil = useRef<HTMLButtonElement>(null)
  const abaBairro = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  // Setas trocam de aba, como nas abas do sistema.
  const aoTeclarAba = (e: EventoDeTecla) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const nova: Aba = e.key === 'Home' ? 'perfil' : e.key === 'End' ? 'bairro' : aba === 'perfil' ? 'bairro' : 'perfil'
    aoTrocarAba(nova)
    ;(nova === 'perfil' ? abaPerfil : abaBairro).current?.focus()
  }

  const nomeNaTela = temConta && morador ? morador.nome : 'Perfil'

  return (
    <>
      <div className="folha-fundo" aria-hidden="true" onClick={aoFechar} />
      <section className="folha perfil" role="dialog" aria-modal="true" aria-labelledby="perfil-titulo">
        <span className="folha-alca" aria-hidden="true" />
        <header className="folha-topo">
          <span className="folha-tipo" aria-hidden="true">
            <IconePessoa />
          </span>
          <div className="folha-cabeca">
            <h2 id="perfil-titulo" ref={titulo} tabIndex={-1} className="folha-titulo">
              {nomeNaTela}
            </h2>
            {temConta && morador && (
              <p className="folha-protocolo">
                {nomeDoTipo(morador.tipo)}
                {morador.documento_mascarado && (
                  <>
                    {' · '}
                    <span className="protocolo">{morador.documento_mascarado}</span>
                  </>
                )}
              </p>
            )}
          </div>
          <button type="button" className="botao-mapa botao-plano" aria-label="Fechar" onClick={aoFechar}>
            <IconeFechar />
          </button>
        </header>

        <div className="abas" role="tablist" aria-label="Perfil">
          <button
            ref={abaPerfil}
            type="button"
            role="tab"
            id="aba-perfil"
            className="aba"
            aria-selected={aba === 'perfil'}
            aria-controls="painel-perfil"
            tabIndex={aba === 'perfil' ? 0 : -1}
            onClick={() => aoTrocarAba('perfil')}
            onKeyDown={aoTeclarAba}
          >
            <IconePessoa tamanho={20} />
            Meu perfil
          </button>
          <button
            ref={abaBairro}
            type="button"
            role="tab"
            id="aba-bairro"
            className="aba"
            aria-selected={aba === 'bairro'}
            aria-controls="painel-bairro"
            tabIndex={aba === 'bairro' ? 0 : -1}
            onClick={() => aoTrocarAba('bairro')}
            onKeyDown={aoTeclarAba}
          >
            <IconeBairro tamanho={20} />
            Meu bairro
          </button>
        </div>

        {aba === 'perfil' ? (
          <div role="tabpanel" id="painel-perfil" aria-labelledby="aba-perfil" className="folha-corpo">
            {temConta ? <MeuPerfil {...props} /> : <SemConta aoCadastrar={props.aoCadastrar} />}
            <EscolhaDoBoneco aparencia={props.aparencia} aoMudar={props.aoAparencia} />
          </div>
        ) : (
          <div role="tabpanel" id="painel-bairro" aria-labelledby="aba-bairro" className="folha-corpo">
            <MeuBairro ponto={props.ponto} />
          </div>
        )}
      </section>
    </>
  )
}

// O boneco que anda no mapa: a pessoa escolhe. Fica só neste celular.
function EscolhaDoBoneco({ aparencia, aoMudar }: { aparencia: Aparencia; aoMudar: (a: Aparencia) => void }) {
  return (
    <section className="escolha-boneco" aria-labelledby="boneco-titulo">
      <h3 id="boneco-titulo" className="perfil-sub">
        Seu boneco no mapa
      </h3>
      <div className="bonecos" role="radiogroup" aria-label="Escolha o boneco">
        {ESTILOS.map((e) => (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={aparencia.estilo === e.id}
            className={`boneco-opcao${aparencia.estilo === e.id ? ' marcado' : ''}`}
            onClick={() => aoMudar({ ...aparencia, estilo: e.id })}
          >
            <Boneco andando={false} lado="direita" aparencia={{ estilo: e.id, tom: aparencia.tom }} />
            <span>{e.nome}</span>
          </button>
        ))}
      </div>
      <div className="tons" role="radiogroup" aria-label="Tom de pele">
        {TONS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={aparencia.tom === t.id}
            aria-label={t.nome}
            className={`tom${aparencia.tom === t.id ? ' marcado' : ''}`}
            style={{ background: corDaPele(t.id) }}
            onClick={() => aoMudar({ ...aparencia, tom: t.id })}
          />
        ))}
      </div>
      <p className="perfil-nota">Só aparece no seu celular. O MOGI não guarda isso.</p>
    </section>
  )
}

function SemConta({ aoCadastrar }: { aoCadastrar: () => void }) {
  return (
    <>
      <p className="perfil-nota">Com o cadastro, seus relatos ficam guardados em qualquer celular.</p>
      <button type="button" className="botao botao-primario" onClick={aoCadastrar}>
        Criar cadastro
      </button>
    </>
  )
}

function MeuPerfil({ morador, aoMorador, aoRelatos, aoAbrirRelato, aoSemConta, aoSair, aoApagada }: Props) {
  const [vez, setVez] = useState(0)
  const [carga, setCarga] = useState<Carga<MeusRelatos>>({ fase: 'carregando' })
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [falhaApagar, setFalhaApagar] = useState(false)
  const [agora] = useState(() => new Date())
  const avisos = useRef({ aoMorador, aoRelatos, aoSemConta })
  const tituloConfirma = useRef<HTMLParagraphElement>(null)
  const botaoApagar = useRef<HTMLButtonElement>(null)
  const botaoEditar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    avisos.current = { aoMorador, aoRelatos, aoSemConta }
  })

  useEffect(() => {
    let vivo = true
    void buscarEu().then((r) => {
      if (!vivo) return
      if ('dados' in r) avisos.current.aoMorador(r.dados)
      else if (r.falha === 'sem_cadastro') avisos.current.aoSemConta()
    })
    void buscarMeusRelatos().then((r) => {
      if (!vivo) return
      if ('dados' in r) {
        setCarga({ fase: 'pronto', dados: r.dados })
        avisos.current.aoRelatos(r.dados.relatos)
      } else if (r.falha === 'sem_cadastro') {
        avisos.current.aoSemConta()
      } else {
        setCarga({ fase: 'falhou' })
      }
    })
    return () => {
      vivo = false
    }
  }, [vez])

  useEffect(() => {
    if (confirmando) tituloConfirma.current?.focus()
  }, [confirmando])

  const apagar = async () => {
    setApagando(true)
    setFalhaApagar(false)
    const ok = await apagarEu()
    setApagando(false)
    if (ok) aoApagada()
    else {
      tocar('erro')
      setFalhaApagar(true)
    }
  }

  if (editando && morador) {
    return (
      <Edicao
        morador={morador}
        aoSalvo={(m) => {
          aoMorador(m)
          setEditando(false)
          requestAnimationFrame(() => botaoEditar.current?.focus())
        }}
        aoSemConta={aoSemConta}
        aoCancelar={() => {
          setEditando(false)
          requestAnimationFrame(() => botaoEditar.current?.focus())
        }}
      />
    )
  }

  return (
    <>
      {carga.fase === 'carregando' && (
        <p className="folha-carregando" role="status">
          <span className="girando" aria-hidden="true" />
          Buscando seus relatos
        </p>
      )}
      {carga.fase === 'falhou' && (
        <div className="folha-falha" role="alert">
          <p>Sem internet agora. Confira o sinal.</p>
          <button type="button" className="botao botao-secundario" onClick={() => setVez((v) => v + 1)}>
            Tentar de novo
          </button>
        </div>
      )}
      {carga.fase === 'pronto' && (
        <>
          <dl className="numeros">
            <div className="numero">
              <dt>Enviados</dt>
              <dd>{carga.dados.total}</dd>
            </div>
            <div className="numero">
              <dt>Resolvidos</dt>
              <dd>{carga.dados.resolvidos}</dd>
            </div>
            <div className="numero">
              <dt>Tempo médio</dt>
              <dd className={carga.dados.tempo_medio_horas === null ? 'numero-vazio' : undefined}>{tempoMedio(carga.dados.tempo_medio_horas)}</dd>
            </div>
          </dl>
          <h3 className="perfil-sub">Seus relatos</h3>
          {carga.dados.relatos.length === 0 ? (
            <p className="perfil-nota">Você ainda não enviou relatos. Toque na câmera para começar.</p>
          ) : (
            <ul className="folha-lista">
              {carga.dados.relatos.map((r) => (
                <li key={r.protocolo}>
                  <button type="button" className="folha-item" onClick={() => aoAbrirRelato(r.protocolo)}>
                    <span className="folha-icone">
                      <IconeDoTipo id={r.categoria} />
                    </span>
                    <span className="folha-item-texto">
                      <strong>{nomeCurto(r.categoria, r.categoria_nome)}</strong>
                      <span className="protocolo">
                        {r.protocolo}
                        {r.criado_em && ` · ${haQuanto(r.criado_em, agora)}`}
                      </span>
                      {r.status === 'resolvida' ? <span className="selo selo-pequeno selo-resolvido">Resolvido</span> : <Selo nivel={r.nivel} pequeno />}
                    </span>
                    <IconeAvancar />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {confirmando ? (
        <div className="confirma" role="group" aria-labelledby="confirma-titulo">
          <p id="confirma-titulo" ref={tituloConfirma} tabIndex={-1} className="confirma-titulo">
            Apagar sua conta?
          </p>
          <p className="perfil-nota">Seu nome e seu documento saem do MOGI. Os relatos continuam na prefeitura, sem o seu nome.</p>
          {falhaApagar && (
            <p className="campo-erro" role="alert">
              Não deu para apagar agora. Confira a internet.
            </p>
          )}
          <div className="cartao-botoes">
            <button type="button" className="botao botao-perigo" aria-disabled={apagando} onClick={() => !apagando && void apagar()}>
              {apagando && <span className="girando girando-claro" aria-hidden="true" />}
              Apagar conta
            </button>
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => {
                setConfirmando(false)
                requestAnimationFrame(() => botaoApagar.current?.focus())
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="perfil-acoes">
          {morador && (
            <button ref={botaoEditar} type="button" className="botao botao-secundario" onClick={() => setEditando(true)}>
              <IconeLapis tamanho={20} />
              Editar perfil
            </button>
          )}
          <button type="button" className="botao botao-secundario" onClick={aoSair}>
            <IconeSair tamanho={20} />
            Sair deste aparelho
          </button>
          <button ref={botaoApagar} type="button" className="botao botao-texto-perigo" onClick={() => setConfirmando(true)}>
            <IconeLixeira tamanho={20} />
            Apagar minha conta
          </button>
        </div>
      )}
    </>
  )
}

function Edicao({ morador, aoSalvo, aoSemConta, aoCancelar }: { morador: Morador; aoSalvo: (m: Morador) => void; aoSemConta: () => void; aoCancelar: () => void }) {
  const [nome, setNome] = useState(morador.nome)
  const [profissao, setProfissao] = useState(morador.profissao ?? '')
  const [bairro, setBairro] = useState(morador.bairro ?? '')
  const inicial: Municipio | null = morador.municipio && morador.uf ? { nome: morador.municipio, uf: morador.uf, ibge: '' } : null
  const [municipio, setMunicipio] = useState<Municipio | null>(inicial)
  const [mexeuNaCidade, setMexeuNaCidade] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    campo.current?.focus()
  }, [])

  const salvar = async () => {
    if (salvando) return
    if (nome.trim().length < 2) {
      setErro(morador.tipo === 'pj' ? 'Escreva o nome da empresa.' : 'Escreva seu nome.')
      campo.current?.focus()
      return
    }
    setSalvando(true)
    setErro(null)
    const r = await editarEu({ nome, profissao, bairro, ...(mexeuNaCidade ? { municipio } : {}) })
    setSalvando(false)
    if ('dados' in r) aoSalvo(r.dados)
    else if (r.falha === 'sem_cadastro') aoSemConta()
    else {
      tocar('erro')
      setErro('Não deu para salvar agora. Confira a internet.')
    }
  }

  return (
    <form
      className="formulario"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void salvar()
      }}
    >
      <h3 className="perfil-sub">Editar perfil</h3>
      <div className="campo">
        <label className="campo-rotulo" htmlFor="eu-nome">
          {morador.tipo === 'pj' ? 'Nome da empresa' : 'Seu nome'}
        </label>
        <input
          ref={campo}
          id="eu-nome"
          className="campo-entrada"
          type="text"
          autoComplete={morador.tipo === 'pj' ? 'organization' : 'name'}
          maxLength={LIMITE_NOME}
          value={nome}
          aria-invalid={erro && nome.trim().length < 2 ? true : undefined}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor="eu-profissao">
          Profissão ou o que faz <span className="campo-opcional">(opcional)</span>
        </label>
        <input id="eu-profissao" className="campo-entrada" type="text" maxLength={LIMITE_CAMPO} value={profissao} onChange={(e) => setProfissao(e.target.value)} />
      </div>
      <CampoCidade
        id="eu-cidade"
        valor={municipio}
        aoMudar={(m) => {
          setMunicipio(m)
          setMexeuNaCidade(true)
        }}
        preferidas={[]}
        nota="(opcional)"
      />
      <div className="campo">
        <label className="campo-rotulo" htmlFor="eu-bairro">
          Bairro <span className="campo-opcional">(opcional)</span>
        </label>
        <input id="eu-bairro" className="campo-entrada" type="text" maxLength={LIMITE_CAMPO} value={bairro} onChange={(e) => setBairro(e.target.value)} />
      </div>
      {erro && (
        <p className="campo-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="cartao-botoes">
        <button type="submit" className="botao botao-primario" aria-disabled={salvando}>
          {salvando && <span className="girando girando-claro" aria-hidden="true" />}
          Salvar
        </button>
        <button type="button" className="botao botao-secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function MeuBairro({ ponto }: { ponto: Ponto }) {
  const [vez, setVez] = useState(0)
  const [carga, setCarga] = useState<Carga<Comunidade>>({ fase: 'carregando' })
  const [agora] = useState(() => new Date())
  // O ponto da primeira abertura: andar um pouco não recarrega a lista.
  const [base] = useState(ponto)

  useEffect(() => {
    let vivo = true
    void buscarComunidade(base.lat, base.lng).then((c) => {
      if (vivo) setCarga(c ? { fase: 'pronto', dados: c } : { fase: 'falhou' })
    })
    return () => {
      vivo = false
    }
  }, [base, vez])

  if (carga.fase === 'carregando') {
    return (
      <p className="folha-carregando" role="status">
        <span className="girando" aria-hidden="true" />
        Buscando o seu bairro
      </p>
    )
  }
  if (carga.fase === 'falhou') {
    return (
      <div className="folha-falha" role="alert">
        <p>Sem internet agora. Confira o sinal.</p>
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() => {
            setCarga({ fase: 'carregando' })
            setVez((v) => v + 1)
          }}
        >
          Tentar de novo
        </button>
      </div>
    )
  }
  const c = carga.dados
  return (
    <>
      <div className="bairro-placar">
        {c.bairro && <p className="bairro-nome">{c.bairro}</p>}
        <p className="bairro-resolvidos">
          <strong>{c.resolvidos_30d}</strong>
          <span>{fraseDosResolvidos(c.resolvidos_30d).replace(/^\d+ /, '')}</span>
        </p>
        <p className="bairro-abertos">{c.abertos === 1 ? '1 em aberto' : `${c.abertos} em aberto`}</p>
      </div>
      {c.itens.length === 0 ? (
        <p className="perfil-nota">Ainda não há resolvidos perto de você. Quando a prefeitura resolver, aparece aqui.</p>
      ) : (
        <ul className="bairro-lista">
          {c.itens.map((i, n) => {
            const nome = nomeCurto(i.categoria, i.categoria_nome)
            return (
              <li key={`${i.categoria}-${i.resolvido_em}-${n}`} className="bairro-item">
                {i.foto_depois_url ? (
                  <img className="bairro-foto" src={i.foto_depois_url} alt="" loading="lazy" />
                ) : (
                  <span className="bairro-foto bairro-sem-foto" aria-hidden="true">
                    <IconeDoTipo id={i.categoria} tamanho={28} />
                  </span>
                )}
                <span className="folha-item-texto">
                  <strong>{nome}</strong>
                  <span className="bairro-quando">
                    Resolvido {haQuanto(i.resolvido_em, agora)}
                    {i.distancia_m > 0 && ` · ${distanciaCurta(i.distancia_m)}`}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
