import { useEffect, useMemo, useState } from 'react'
import { FormaDoNivel } from './icones'
import { corDoNivel, NOME_CATEGORIA, nomeDoNivel } from './niveis'
import { resumirGabinete, saudacao, tratamento, type Linha } from './resumoDoGabinete'
import type { Ocorrencia, Usuario } from './tipos'

interface Props {
  usuario: Usuario | null
  lista: Ocorrencia[]
  carregando: boolean
  aoAbrir: (id: string) => void
  aoMapa: () => void
  aoIndicadores: () => void
}

function Barras({ titulo, linhas, vazio }: { titulo: string; linhas: Linha[]; vazio: string }) {
  const maior = Math.max(1, ...linhas.map((l) => l.n))
  return (
    <section className="cartao gab-bloco" aria-label={titulo}>
      <h2>{titulo}</h2>
      {linhas.length === 0 ? (
        <p className="cartao-nota">{vazio}</p>
      ) : (
        <ul className="gab-barras">
          {linhas.slice(0, 8).map((l) => (
            <li key={l.nome}>
              <span className="gab-barra-nome">{l.nome}</span>
              <span className="gab-barra-trilho" aria-hidden="true">
                <span className="gab-barra-cheia" style={{ width: `${(l.n / maior) * 100}%` }} />
              </span>
              <strong>{l.n}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Gabinete: a cidade numa tela, para o prefeito. Só leitura: os números vêm
// dos mesmos chamados que a central vê, ao vivo.
export function Gabinete({ usuario, lista, carregando, aoAbrir, aoMapa, aoIndicadores }: Props) {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const r = useMemo(() => resumirGabinete(lista, agora), [lista, agora])
  const hoje = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="pagina gabinete">
      <header className="pagina-topo">
        <div>
          <p className="gab-sobre">Gabinete · Itamogi-MG</p>
          <h1>
            {saudacao(agora)}, {tratamento(usuario?.nome, 'Prefeito')}.
          </h1>
          <p className="gab-data">A cidade agora, {hoje}.</p>
        </div>
        <div className="gab-atalhos">
          <button type="button" className="botao-secundario" onClick={aoMapa}>
            Ver no mapa
          </button>
          <button type="button" className="botao-secundario" onClick={aoIndicadores}>
            Ver indicadores
          </button>
        </div>
      </header>

      {r.simulados > 0 && (
        <p className="gab-aviso" role="note">
          Demonstração: {r.simulados} dos chamados desta tela são simulados, não são relatos reais de moradores.
        </p>
      )}

      {carregando && lista.length === 0 ? (
        <p className="cartao-nota" role="status">
          Carregando os chamados…
        </p>
      ) : (
        <>
          <section className="gab-cartoes" aria-label="Resumo da cidade">
            <div className="cartao">
              <p className="cartao-titulo">Em aberto</p>
              <p className="cartao-valor">{r.emAberto}</p>
              <p className="cartao-nota">chamados esperando solução</p>
            </div>
            <div className={'cartao' + (r.criticos > 0 ? ' gab-alerta' : '')}>
              <p className="cartao-titulo">Críticos</p>
              <p className="cartao-valor">{r.criticos}</p>
              <p className="cartao-nota">risco para as pessoas, em aberto</p>
            </div>
            <div className={'cartao' + (r.atrasados > 0 ? ' gab-alerta' : '')}>
              <p className="cartao-titulo">Fora do prazo</p>
              <p className="cartao-valor">{r.atrasados}</p>
              <p className="cartao-nota">passaram do prazo combinado</p>
            </div>
            <div className="cartao">
              <p className="cartao-titulo">Resolvidos em 7 dias</p>
              <p className="cartao-valor">{r.resolvidosNaSemana}</p>
              <p className="cartao-nota">{r.noPrazoPct == null ? 'sem prazo para comparar' : `${r.noPrazoPct}% dentro do prazo`}</p>
            </div>
          </section>

          <section className="cartao gab-bloco" aria-label="Pede a sua atenção">
            <h2>Pede a sua atenção</h2>
            {r.atencao.length === 0 ? (
              <p className="cartao-nota">Nenhum chamado crítico ou muito urgente em aberto.</p>
            ) : (
              <ul className="gab-atencao">
                {r.atencao.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => aoAbrir(o.id)}>
                      <FormaDoNivel nivel={o.nivel} cor={corDoNivel(o.nivel)} tamanho={18} contorno="#2B1A10" />
                      <span className="gab-atencao-texto">
                        <strong>{NOME_CATEGORIA[o.categoria] ?? 'Outros'}</strong>
                        <span>
                          {nomeDoNivel(o.nivel)} · {o.bairro ?? o.endereco ?? 'sem endereço'}
                          {o.secretaria ? ` · ${o.secretaria}` : ''}
                        </span>
                      </span>
                      {o.prazo_ate != null && new Date(o.prazo_ate).getTime() < agora.getTime() && <span className="gab-selo">fora do prazo</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="gab-dupla">
            <Barras titulo="Em aberto por bairro" linhas={r.porBairro} vazio="Nenhum chamado em aberto." />
            <Barras titulo="Em aberto por secretaria" linhas={r.porSecretaria} vazio="Nenhum chamado em aberto." />
          </div>
        </>
      )}
    </main>
  )
}
