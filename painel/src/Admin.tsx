import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { categorias, ErroDaApi, regras, salvarCategoria, salvarRegra, testarRegra } from './api'
import { fraseDoErro } from './apiGestor'
import { Selo } from './Painel'
import { Parametros } from './Parametros'
import type { Categoria, Regra, Simulado } from './tipos'
import { Usuarios } from './Usuarios'
import { Vazio } from './Vazio'
import './gestor.css'

function Cenarios({ lista }: { lista: Simulado[] }) {
  return (
    <table className="cenarios">
      <thead>
        <tr>
          <th>Cenário de referência</th>
          <th>Nível</th>
          <th>Motivo</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((s) => (
          <tr key={s.cenario} className={s.erro ? 'falhou' : ''}>
            <td>{s.cenario}</td>
            <td>{s.erro ? 'erro' : <Selo nivel={s.nivel} />}</td>
            <td>{s.erro ?? s.motivo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const SAIR_SEM_SALVAR = 'Há mudanças não salvas nesta regra. Sair mesmo assim?'

// Regras Lua, limiares e sinais críticos (T7). A regra roda na sandbox contra
// os cenários de referência antes de ser salva, e vale no próximo chamado sem
// novo deploy (C5).
function Regras({ aoSujar }: { aoSujar: (sujo: boolean) => void }) {
  const [lista, setLista] = useState<Regra[]>([])
  const [cidade, setCidade] = useState('')
  const [arquivo, setArquivo] = useState('_comum.lua')
  const [texto, setTexto] = useState('')
  const [cenarios, setCenarios] = useState<Simulado[] | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    regras()
      .then((r) => {
        setLista(r.regras)
        setCidade(r.cidade)
        setTexto(r.regras.find((x) => x.arquivo === '_comum.lua')?.conteudo ?? '')
      })
      .catch((e) => setAviso({ tipo: 'erro', msg: e instanceof Error ? e.message : 'falha ao carregar as regras' }))
  }, [])

  const original = lista.find((r) => r.arquivo === arquivo)?.conteudo ?? ''
  const mudou = texto !== original

  useEffect(() => {
    aoSujar(mudou)
    return () => aoSujar(false)
  }, [mudou, aoSujar])

  const abrir = (a: string) => {
    if (mudou && !window.confirm('Há mudanças não salvas nesta regra. Trocar de arquivo mesmo assim?')) return
    setArquivo(a)
    setTexto(lista.find((r) => r.arquivo === a)?.conteudo ?? '')
    setCenarios(null)
    setAviso(null)
  }

  const rodar = async (salvar: boolean) => {
    setOcupado(true)
    setAviso(null)
    try {
      const r = await (salvar ? salvarRegra : testarRegra)({ arquivo, conteudo: texto })
      setCenarios(r.cenarios)
      if (salvar) {
        setLista((l) => l.map((x) => (x.arquivo === arquivo ? { ...x, conteudo: texto } : x)))
        setAviso({ tipo: 'ok', msg: 'Regra salva. Já vale para o próximo chamado.' })
      } else {
        setAviso(r.ok ? { tipo: 'ok', msg: 'A regra rodou em todos os cenários. Confira os níveis antes de salvar.' } : { tipo: 'erro', msg: 'A regra falhou em algum cenário. Corrija antes de salvar.' })
      }
    } catch (e) {
      const corpo = e instanceof ErroDaApi ? (e.corpo as { cenarios?: Simulado[] }) : null
      if (corpo?.cenarios) setCenarios(corpo.cenarios)
      setAviso({ tipo: 'erro', msg: e instanceof Error ? e.message : 'falha' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="g-painel">
      <div>
        <h2 className="g-titulo">Regras da triagem</h2>
        <p className="sub">
          Scripts Lua da cidade ({cidade || 'itamogi'}): faixas da GUT, limiares e sinais críticos por categoria. Toda alteração fica no histórico com o autor.
        </p>
      </div>
      <p className="g-aviso">Área técnica: mexer aqui muda como a urgência é calculada. Teste antes de salvar.</p>

      <div className="editor">
        <nav className="arquivos" aria-label="Arquivos de regra">
          {lista.map((r) => (
            <button key={r.arquivo} type="button" className={r.arquivo === arquivo ? 'ligado' : ''} onClick={() => abrir(r.arquivo)}>
              {r.arquivo === '_comum.lua' ? 'Faixas e limiares (_comum.lua)' : r.arquivo}
            </button>
          ))}
        </nav>
        <div className="editor-corpo">
          <label className="oculto" htmlFor="codigo">
            Conteúdo de {arquivo}
          </label>
          <textarea id="codigo" spellCheck={false} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="editor-acoes">
            <button type="button" className="botao-secundario" disabled={ocupado} onClick={() => rodar(false)}>
              Testar nos cenários
            </button>
            <button type="button" className="botao-principal" disabled={ocupado || !mudou} onClick={() => rodar(true)}>
              Salvar regra
            </button>
            {mudou && <span className="fonte">mudanças não salvas</span>}
          </div>
          {aviso && (
            <p className={aviso.tipo === 'ok' ? 'aviso-ok' : 'erro'} role="status">
              {aviso.msg}
            </p>
          )}
          {cenarios && (
            <div className="op-rolagem" tabIndex={0} role="region" aria-label="Resultado nos cenários (role para o lado)">
              <Cenarios lista={cenarios} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Categorias() {
  const [cats, setCats] = useState<Categoria[] | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  const carregar = useCallback(() => {
    categorias()
      .then((c) => {
        setCats(c)
        setFalha(null)
      })
      .catch((e) => setFalha(fraseDoErro(e)))
  }, [])

  useEffect(() => carregar(), [carregar])

  const mudar = (i: number, parte: Partial<Categoria>) => setCats((l) => (l ?? []).map((x, j) => (j === i ? { ...x, ...parte } : x)))

  const gravar = async (c: Categoria) => {
    try {
      await salvarCategoria(c)
      setAviso({ tipo: 'ok', msg: `Secretaria de "${c.nome}" atualizada.` })
    } catch (e) {
      setAviso({ tipo: 'erro', msg: e instanceof Error ? e.message : 'falha ao salvar a categoria' })
    }
  }

  return (
    <div className="g-painel">
      {falha && (
        <div className="g-aviso erro-forte" role="alert">
          <p>Não deu para buscar as categorias. {falha}</p>
          <button type="button" className="botao-secundario" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}
      <div className="tabela-caixa">
        <h2>Categorias e secretarias responsáveis</h2>
        <p className="fonte">Os nomes de secretaria são uma proposta, a validar com a prefeitura de Itamogi.</p>
        {!cats && !falha && <Vazio tipo="carregando" titulo="Carregando as categorias…" />}
        {cats && (
          <ul className="ca-lista">
            {cats.map((c, i) => (
              <li key={c.id} className="ca-item">
                <p className="ca-codigo">
                  <span className="oculto">Categoria </span>
                  {c.id}
                </p>
                <label className="us-campo">
                  Nome que aparece
                  <input value={c.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
                </label>
                <label className="us-campo">
                  Secretaria responsável
                  <input value={c.secretaria} onChange={(e) => mudar(i, { secretaria: e.target.value })} />
                </label>
                <button type="button" className="botao-secundario" onClick={() => gravar(c)}>
                  Salvar<span className="oculto"> {c.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {aviso && (
          <p className={aviso.tipo === 'ok' ? 'aviso-ok' : 'erro'} role="status">
            {aviso.msg}
          </p>
        )}
      </div>
    </div>
  )
}

const ABAS = [
  ['usuarios', 'Usuários'],
  ['categorias', 'Categorias'],
  ['parametros', 'Parâmetros'],
  ['regras', 'Regras da triagem'],
] as const
type Aba = (typeof ABAS)[number][0]

const CHAVE_ABA = 'mogi.admin.aba'

function abaSalva(): Aba {
  try {
    const a = sessionStorage.getItem(CHAVE_ABA)
    return ABAS.find(([id]) => id === a)?.[0] ?? 'usuarios'
  } catch {
    return 'usuarios'
  }
}

// Admin do gestor: quem entra (ADR 0016), categorias, ajustes da cidade
// (ADR 0018) e as regras da triagem.
export function Admin() {
  const [aba, setAba] = useState<Aba>(abaSalva)
  // Edição de regra ainda não salva: sair pede confirmação.
  const sujo = useRef(false)
  const aoSujar = useCallback((s: boolean) => {
    sujo.current = s
  }, [])

  useEffect(() => {
    const aoFechar = (e: BeforeUnloadEvent) => {
      if (sujo.current) e.preventDefault()
    }
    // A troca de tela fica no topo do app, fora deste componente: o clique é
    // conferido antes de chegar lá, para a edição não se perder sem aviso.
    const aoClicar = (e: MouseEvent) => {
      if (!sujo.current || !(e.target instanceof Element) || !e.target.closest('nav[aria-label="Telas"] button')) return
      if (window.confirm(SAIR_SEM_SALVAR)) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('beforeunload', aoFechar)
    document.addEventListener('click', aoClicar, true)
    return () => {
      window.removeEventListener('beforeunload', aoFechar)
      document.removeEventListener('click', aoClicar, true)
    }
  }, [])

  const trocar = (a: Aba) => {
    if (a === aba) return
    if (sujo.current && !window.confirm(SAIR_SEM_SALVAR)) return
    setAba(a)
    try {
      sessionStorage.setItem(CHAVE_ABA, a)
    } catch {
      /* sem armazenamento: a aba só não é lembrada */
    }
  }

  // Setas, Home e End andam pelas abas, como em qualquer lista de abas.
  const teclaNasAbas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ABAS.findIndex(([id]) => id === aba)
    const j =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % ABAS.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + ABAS.length) % ABAS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? ABAS.length - 1
      : -1
    if (j < 0) return
    e.preventDefault()
    trocar(ABAS[j][0])
    e.currentTarget.querySelector<HTMLElement>(`#aba-${ABAS[j][0]}`)?.focus()
  }

  return (
    <main className="pagina admin">
      <div className="pagina-topo">
        <div>
          <h1>Administração</h1>
          <p className="sub">Quem entra no sistema, categorias, ajustes da cidade e regras da triagem. Só o gestor mexe aqui.</p>
        </div>
      </div>

      <div className="g-abas" role="tablist" aria-label="Seções da administração" onKeyDown={teclaNasAbas}>
        {ABAS.map(([id, nome]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`aba-${id}`}
            aria-selected={aba === id}
            aria-controls="painel-admin"
            tabIndex={aba === id ? 0 : -1}
            onClick={() => trocar(id)}
          >
            {nome}
          </button>
        ))}
      </div>

      <div id="painel-admin" role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {aba === 'usuarios' && <Usuarios />}
        {aba === 'categorias' && <Categorias />}
        {aba === 'parametros' && <Parametros />}
        {aba === 'regras' && <Regras aoSujar={aoSujar} />}
      </div>
    </main>
  )
}
