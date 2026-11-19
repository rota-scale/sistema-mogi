import { useEffect, useState } from 'react'
import { indicadores } from './api'
import { fraseDoErro } from './apiGestor'
import { nomeDaEtapa, nomeDoProvedor, repetirComAbaVisivel, tempoEmPalavras } from './gestor'
import { FormaDoNivel } from './icones'
import { duracao, NIVEIS, NOME_CATEGORIA, NOME_STATUS, reais } from './niveis'
import { Selo } from './Painel'
import type { Contagem, Indicadores as Dados, Status } from './tipos'
import { Vazio } from './Vazio'
import './gestor.css'

const pct = (parte: number, todo: number) => (todo > 0 ? `${Math.round((parte / todo) * 100)}%` : 'sem dados')

function Cartao({ titulo, valor, nota, meta }: { titulo: string; valor: string; nota?: string; meta?: 'ok' | 'fora' }) {
  return (
    <div className="cartao">
      <p className="cartao-titulo">{titulo}</p>
      <p className="cartao-valor">{valor}</p>
      {nota && (
        <p className={'cartao-nota' + (meta ? ' meta-' + meta : '')}>
          {meta === 'ok' && '✓ '}
          {meta === 'fora' && '▲ '}
          {nota}
        </p>
      )}
    </div>
  )
}

// Barras horizontais com o valor escrito: uma cor só para grandeza; quando a
// linha é um nível de prioridade, a cor do nível vem junto do número e do nome.
function Barras({ titulo, itens }: { titulo: string; itens: { rotulo: string; n: number; cor?: string; nivel?: number }[] }) {
  const maximo = Math.max(1, ...itens.map((i) => i.n))
  return (
    <div className="grafico">
      <h2>{titulo}</h2>
      {itens.length === 0 && <Vazio titulo="Sem dados no período" texto="Escolha um período maior." />}
      <ul>
        {itens.map((i) => (
          <li key={i.rotulo} title={`${i.rotulo}: ${i.n}`}>
            <span className="g-rotulo">
              {i.nivel != null && <FormaDoNivel nivel={i.nivel} cor={i.cor} tamanho={14} contorno="#2B1A10" />}
              {i.rotulo}
            </span>
            <span className="g-trilho">
              <span className="g-barra" style={{ width: `${(i.n / maximo) * 100}%`, background: i.cor }} />
            </span>
            <strong>{i.n}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Quem fez a etapa, só quando ajuda: na avaliação da urgência, quem avaliou;
// nas demais, o nome técnico só aparece para separar linhas da mesma etapa.
function quemFez(etapa: string, provedor: string, todas: { etapa: string }[]): string {
  if (!provedor) return ''
  if (etapa === 'classificacao') return nomeDoProvedor(provedor)
  return todas.filter((x) => x.etapa === etapa).length > 1 ? provedor : ''
}

function PorDia({ dias }: { dias: Contagem[] }) {
  const maximo = Math.max(1, ...dias.map((d) => d.n))
  const total = dias.reduce((s, d) => s + d.n, 0)
  return (
    <div className="grafico largo">
      <h2>Chamados por dia</h2>
      <div className="colunas" role="img" aria-label={`Chamados por dia no período, ${total} no total`}>
        {dias.map((d) => (
          <span key={d.chave} className="coluna" title={`${d.chave.slice(8)}/${d.chave.slice(5, 7)}: ${d.n} chamados`}>
            <span className="coluna-cheia" style={{ height: `${(d.n / maximo) * 100}%` }} />
          </span>
        ))}
      </div>
      <p className="eixo">
        <span>{dias[0] ? `${dias[0].chave.slice(8)}/${dias[0].chave.slice(5, 7)}` : ''}</span>
        <span>pico de {maximo} em um dia</span>
        <span>hoje</span>
      </p>
    </div>
  )
}

// Indicadores do gestor (T8): tempo de resposta, acerto da triagem nos casos
// revisados, custo e tempo da triagem por ocorrência.
// Custo de IA e etapas da triagem são assunto do gestor; a central vê o resto.
export function Indicadores({ gestor = false }: { gestor?: boolean }) {
  const [dias, setDias] = useState(30)
  const [soReais, setSoReais] = useState(false)
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const carregar = () =>
      indicadores(dias, soReais)
        .then((r) => vivo && (setD(r), setErro(null)))
        .catch((e) => vivo && setErro(fraseDoErro(e)))
    void carregar()
    // Com a aba do navegador oculta a atualização para; ao voltar, busca na hora.
    const parar = repetirComAbaVisivel(() => void carregar(), 30000)
    return () => {
      vivo = false
      parar()
    }
  }, [dias, soReais])

  // Sem dados ainda, o erro ocupa a página; com dados, vira um aviso no topo.
  if (!d) {
    return (
      <main className="pagina indicadores">
        <h1>Indicadores</h1>
        {erro ? (
          <Vazio tipo="erro" titulo="Não deu para buscar os indicadores" texto={`${erro} A página tenta de novo sozinha a cada 30 segundos.`} />
        ) : (
          <Vazio tipo="carregando" titulo="Carregando indicadores…" />
        )}
      </main>
    )
  }

  const t = d.triagem
  const resolvidos = d.resposta.reduce((s, r) => s + r.resolvidos, 0)
  const noPrazo = d.resposta.reduce((s, r) => s + r.no_prazo, 0)
  const comPrazo = d.resposta.reduce((s, r) => s + r.com_prazo, 0)

  return (
    <main className="pagina indicadores">
      <div className="pagina-topo">
        <div>
          <h1>Indicadores</h1>
          <p className="sub">
            Desde {new Date(d.desde).toLocaleDateString('pt-BR')}.
            {d.simulados > 0 && !d.so_reais && ` Inclui ${d.simulados} chamados simulados, de demonstração.`}
            {gestor && ' As metas são do projeto e serão ajustadas no piloto.'}
          </p>
        </div>
        <div className="filtros-pagina">
          <div className="segmento" role="group" aria-label="Período">
            {[7, 30, 90].map((n) => (
              <button key={n} type="button" aria-pressed={dias === n} className={dias === n ? 'ligado' : ''} onClick={() => setDias(n)}>
                {n} dias
              </button>
            ))}
          </div>
          <label className="marcar">
            <input type="checkbox" checked={soReais} onChange={(e) => setSoReais(e.target.checked)} /> Só dados reais
          </label>
        </div>
      </div>

      {erro && (
        <p className="g-aviso" role="alert">
          Não deu para atualizar. {erro} Os números abaixo são da última vez que deu certo.
        </p>
      )}

      <div className="cartoes">
        <Cartao titulo="Chamados" valor={String(d.total)} nota={`${d.relatos} relatos · ${d.agrupados} chamados com relatos agrupados`} />
        <Cartao
          titulo="Resolvidos no prazo"
          valor={pct(noPrazo, comPrazo)}
          nota={`${resolvidos} resolvidos no período`}
        />
        {gestor && (
        <Cartao
          titulo="Urgência confirmada sem mudança"
          valor={pct(d.acerto.exatos, d.acerto.revisados)}
          nota={
            d.acerto.revisados > 0
              ? `de ${d.acerto.revisados} conferidos · ${pct(d.acerto.ate_1_nivel, d.acerto.revisados)} com até 1 nível de diferença`
              : 'nenhum chamado conferido ainda'
          }
        />
        )}
        {gestor && (
        <Cartao
          titulo="Do envio ao chamado"
          valor={t.latencia_media_ms != null ? `${(t.latencia_media_ms / 1000).toFixed(1).replace('.', ',')} s` : 'sem dados'}
          nota={`média em relatos reais · meta: menos de ${t.meta_latencia_ms / 1000} s${t.latencia_p95_ms != null ? ` · nos piores casos ${(t.latencia_p95_ms / 1000).toFixed(1).replace('.', ',')} s` : ''}`}
          meta={t.latencia_media_ms == null ? undefined : t.latencia_media_ms < t.meta_latencia_ms ? 'ok' : 'fora'}
        />
        )}
        {gestor && (
          <Cartao
            titulo="Custo de IA por relato"
            valor={reais(t.custo_medio_brl)}
            nota={`meta: menos de ${reais(t.meta_custo_brl)} · total ${reais(t.custo_total_brl)}`}
            meta={t.custo_medio_brl == null ? undefined : t.custo_medio_brl < t.meta_custo_brl ? 'ok' : 'fora'}
          />
        )}
        {gestor && <Cartao titulo="Avaliados à mão" valor={String(t.a_classificar)} nota="o sistema não conseguiu dar a urgência sozinho" />}
      </div>

      <div className="graficos">
        <PorDia dias={d.por_dia} />
        <Barras
          titulo="Por urgência"
          itens={[...NIVEIS].reverse().map((n) => ({
            rotulo: `${n.nivel} · ${n.nome}`,
            n: d.por_nivel.find((x) => Number(x.chave) === n.nivel)?.n ?? 0,
            cor: n.cor,
            nivel: n.nivel,
          }))}
        />
        <Barras titulo="Por categoria" itens={d.por_categoria.map((c) => ({ rotulo: NOME_CATEGORIA[c.chave] ?? c.chave, n: c.n }))} />
        <Barras titulo="Por situação" itens={d.por_status.map((c) => ({ rotulo: NOME_STATUS[c.chave as Status] ?? c.chave, n: c.n }))} />
      </div>

      <div className="tabelas">
        <div className="tabela-caixa">
          <h2>Tempo de resposta por urgência</h2>
          <div className="op-rolagem" tabIndex={0} role="region" aria-label="Tempo de resposta por urgência (role para o lado)">
          <table>
            <thead>
              <tr>
                <th>Urgência</th>
                <th>Chamados</th>
                <th>Até o despacho</th>
                <th>Até resolver</th>
                <th>No prazo</th>
              </tr>
            </thead>
            <tbody>
              {d.resposta.map((r) => (
                <tr key={r.nivel}>
                  <td>
                    <Selo nivel={r.nivel} numero />
                  </td>
                  <td>{r.chamados}</td>
                  <td>{duracao(r.min_ate_despacho)}</td>
                  <td>{duracao(r.min_ate_resolucao)}</td>
                  <td>{r.com_prazo > 0 ? `${r.no_prazo} de ${r.com_prazo}` : 'sem dados'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {gestor && (
            <p className="fonte">
              Na conferência, a central subiu a urgência em {d.acerto.subiu} e baixou em {d.acerto.desceu} de {d.acerto.revisados} chamados.
            </p>
          )}
        </div>
        {gestor && (
        <div className="tabela-caixa">
          <h2>Etapas da triagem: tempo e custo (só relatos reais)</h2>
          <div className="op-rolagem" tabIndex={0} role="region" aria-label="Etapas da triagem (role para o lado)">
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Vezes</th>
                <th>Falhas</th>
                <th>Tempo típico</th>
                <th>Nos piores casos</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {d.etapas.map((e) => (
                <tr key={e.etapa + e.provedor}>
                  <td>
                    {nomeDaEtapa(e.etapa)}
                    {quemFez(e.etapa, e.provedor, d.etapas) && <span className="fonte"> · {quemFez(e.etapa, e.provedor, d.etapas)}</span>}
                  </td>
                  <td>{e.chamadas}</td>
                  <td>{e.falhas}</td>
                  <td>{tempoEmPalavras(e.media_ms)}</td>
                  <td>{tempoEmPalavras(e.p95_ms)}</td>
                  <td>{e.custo_brl > 0 ? reais(e.custo_brl) : 'sem custo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        )}
      </div>
    </main>
  )
}
