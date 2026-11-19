import { useEffect, useState, type ReactNode } from 'react'
import { baixarRelatorio, fraseDoErro, operacao, semPermissao, SO_O_GESTOR } from './apiGestor'
import {
  avisoSemRelato, detalheDoSinal, fraseDoMotivo, resumoDoVeredito, haQuanto, leituraDaHora, linhasDaTriagem, noArHa, nomeDaRota, nomeDoSinal,
  repetirComAbaVisivel, tempoEmPalavras, textoDoGraficoDeRelatos, textoDoGraficoDoServidor, veredito,
  etapasDoFunil, type DadosDaOperacao, type LinhaDaTriagem, type NivelDoVeredito,
} from './gestor'
import { useAgora } from './relogio'
import './gestor.css'

const INTERVALO = 15_000

const horaCheia = (iso: string) => `${String(new Date(iso).getHours()).padStart(2, '0')}h`
const horaEMinuto = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const SINAL_DO_VEREDITO: Record<NivelDoVeredito, string> = { ok: '✓', atencao: '!', problema: '✕' }

function Bloco({ titulo, nota, largo, children }: { titulo: string; nota?: string; largo?: boolean; children: ReactNode }) {
  return (
    <section className={'op-bloco' + (largo ? ' largo' : '')}>
      <h2>
        {titulo}
        {nota && <small> {nota}</small>}
      </h2>
      {children}
    </section>
  )
}

function Numero({ valor, rotulo, alerta }: { valor: string | number; rotulo: string; alerta?: string }) {
  return (
    <div className={'op-numero' + (alerta ? ' alerta' : '') + (typeof valor === 'string' ? ' em-texto' : '')}>
      <strong>{valor}</strong>
      <span>{rotulo}</span>
      {alerta && <em>{alerta}</em>}
    </div>
  )
}

interface Coluna {
  chave: string
  // Uma altura por série, de baixo para cima.
  partes: number[]
  leitura: string
}

// Barras empilhadas em divs, sem biblioteca. A leitura da coluna sob o dedo
// ou o cursor aparece escrita embaixo; o conjunto todo vai no texto alternativo.
function Barras({ alt, colunas, series, marcas, resumo }: {
  alt: string
  colunas: Coluna[]
  series: { nome: string; classe: string }[]
  marcas: { coluna: number; texto: string }[]
  resumo: string
}) {
  const [foco, setFoco] = useState<number | null>(null)
  const maximo = Math.max(1, ...colunas.map((c) => c.partes.reduce((s, n) => s + n, 0)))
  return (
    <div className="op-grafico">
      <ul className="op-legenda" aria-hidden="true">
        {series.map((s) => (
          <li key={s.nome}>
            <span className={'op-amostra ' + s.classe} /> {s.nome}
          </li>
        ))}
      </ul>
      <div
        className="op-colunas"
        role="img"
        aria-label={alt}
        style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}
        onPointerLeave={() => setFoco(null)}
      >
        {colunas.map((c, i) => (
          <span key={c.chave} className={'op-coluna' + (foco === i ? ' em-foco' : '')} onPointerEnter={() => setFoco(i)} onPointerDown={() => setFoco(i)}>
            {c.partes.map((n, j) => n > 0 && <span key={series[j].nome} className={'op-parte ' + series[j].classe} style={{ height: `${(n / maximo) * 100}%` }} />)}
          </span>
        ))}
      </div>
      <div className="op-eixo" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}>
        {marcas.map((m) => (
          <span key={m.coluna} className={m.coluna === colunas.length - 1 ? 'fim' : ''} style={{ gridColumn: m.coluna + 1 }}>
            {m.texto}
          </span>
        ))}
      </div>
      <p className="op-leitura" aria-hidden="true">
        {foco !== null && colunas[foco] ? colunas[foco].leitura : resumo}
      </p>
    </div>
  )
}

function RelatosChegando({ d }: { d: DadosDaOperacao }) {
  const r = d.relatos
  const relogio = useAgora()
  const silencio = avisoSemRelato(r.ultimo_em, d.agora, new Date(relogio).getHours())
  const cheia = r.por_hora.reduce((a, h) => (h.relatos + h.tambem_vi > a.relatos + a.tambem_vi ? h : a), r.por_hora[0])
  const colunas = r.por_hora.map((h) => ({
    chave: h.hora,
    partes: [h.relatos, h.tambem_vi],
    leitura: `${horaCheia(h.hora)}: ${leituraDaHora(h)}`,
  }))
  return (
    <Bloco titulo="Relatos chegando" nota="só relatos reais">
      <div className="op-numeros">
        <Numero valor={r.ultimo_em ? haQuanto(r.ultimo_em, d.agora) : 'nenhum ainda'} rotulo="Último relato" />
        <Numero valor={r.ultima_hora} rotulo="Na última hora" />
        <Numero valor={r.ultimas_24h} rotulo="Nas últimas 24 h" />
      </div>
      {silencio && <p className="op-nota">{silencio}. Pode ser só falta de relato.</p>}
      {colunas.length > 0 && (
        <Barras
          alt={textoDoGraficoDeRelatos(r.por_hora, horaCheia)}
          colunas={colunas}
          series={[{ nome: 'Relatos', classe: 'serie-a' }, { nome: '"Também vi"', classe: 'serie-b' }]}
          marcas={[
            ...[0, 6, 12, 18].filter((i) => i < colunas.length - 3).map((i) => ({ coluna: i, texto: horaCheia(r.por_hora[i].hora) })),
            { coluna: colunas.length - 1, texto: 'agora' },
          ]}
          resumo={
            cheia && cheia.relatos + cheia.tambem_vi > 0
              ? `Hora mais cheia: ${horaCheia(cheia.hora)}, com ${leituraDaHora(cheia)}. Toque numa barra para ver a hora.`
              : 'Nenhum relato nas últimas 24 horas.'
          }
        />
      )}
    </Bloco>
  )
}

function FilaDaCentral({ d }: { d: DadosDaOperacao }) {
  const f = d.fila
  return (
    <Bloco titulo="Fila da central" nota="agora">
      <div className="op-numeros">
        <Numero valor={f.revisao + f.a_classificar} rotulo="Para conferir" />
        <Numero valor={f.abertas} rotulo="Aguardando equipe" />
        <Numero valor={f.em_atendimento} rotulo="Equipe a caminho" />
        <Numero valor={f.nivel5_em_revisao} rotulo="Críticos esperando" alerta={f.nivel5_em_revisao > 0 ? 'conferir já' : undefined} />
        <Numero valor={f.prazo_vencido} rotulo="Com prazo vencido" alerta={f.prazo_vencido > 0 ? 'atrasado' : undefined} />
      </div>
    </Bloco>
  )
}

function EtapaDaTriagem({ l, agora }: { l: LinhaDaTriagem; agora: string }) {
  return (
    <li className="op-etapa">
      <div className="op-etapa-topo">
        <span className="op-etapa-nome">
          {l.nome}
          {l.quem && <small> · {l.quem}</small>}
        </span>
        <span className={'op-selo ' + (l.selo === 'ok' ? 'ok' : l.selo === 'falhando' ? 'falhando' : 'instavel')}>{l.selo}</span>
      </div>
      <p className="op-etapa-conta">
        <span className="nobr">rodou {l.chamadas} {l.chamadas === 1 ? 'vez' : 'vezes'}</span> ·{' '}
        <span className="nobr">{l.falhas === 0 ? 'nenhuma falha' : l.falhas === 1 ? '1 falha' : `${l.falhas} falhas`}</span> ·{' '}
        <span className="nobr">tempo típico: {tempoEmPalavras(l.media_ms)}</span>
      </p>
      {l.falhas > 0 && l.ultima_falha && (
        <div className="op-etapa-falha">
          <span>última falha {haQuanto(l.ultima_falha, agora)}</span>
          {l.ultimo_erro && (
            <details>
              <summary>ver erro</summary>
              <code>{l.ultimo_erro}</code>
            </details>
          )}
        </div>
      )}
    </li>
  )
}

function Triagem({ d }: { d: DadosDaOperacao }) {
  const linhas = linhasDaTriagem(d.triagem)
  return (
    <Bloco titulo="Triagem automática" nota="última hora" largo>
      {linhas.length === 0 ? (
        <p className="vazio">Nenhum relato real na última hora.</p>
      ) : (
        <ul className="op-etapas">
          {linhas.map((l) => (
            <EtapaDaTriagem key={l.chave} l={l} agora={d.agora} />
          ))}
        </ul>
      )}
    </Bloco>
  )
}

const RECENTES_NA_TELA = 8

// Onde o morador desiste: abriu, cadastrou, fotografou, enviou.
function Funil({ d }: { d: DadosDaOperacao }) {
  const etapas = etapasDoFunil(d.funil)
  return (
    <Bloco titulo="Funil do relato" nota="últimos 7 dias">
      {etapas.length === 0 || etapas[0].n === 0 ? (
        <p className="vazio">Ninguém abriu o app nos últimos 7 dias.</p>
      ) : (
        <>
          <ol className="op-funil">
            {etapas.map((e) => (
              <li key={e.chave}>
                <span className="op-funil-nome">{e.nome}</span>
                <span className="op-funil-barra" aria-hidden="true">
                  <span style={{ width: `${Math.max(e.doInicio, 2)}%` }} />
                </span>
                <strong>{e.n}</strong>
                <span className="op-funil-queda">{e.queda === null ? '' : e.queda > 0 ? `${e.queda}% desistiram aqui` : 'ninguém desistiu'}</span>
              </li>
            ))}
          </ol>
          <p className="fonte">Conta visitas ao app, não pessoas. O cadastro é feito uma vez só, então pode ficar abaixo do envio.</p>
        </>
      )}
    </Bloco>
  )
}

function AlertasAtivos({ d }: { d: DadosDaOperacao }) {
  const alertas = d.alertas ?? []
  if (alertas.length === 0) return null
  return (
    <section className="op-alertas" role="alert">
      <h2>Alertas abertos</h2>
      <ul>
        {alertas.map((a) => (
          <li key={a.chave}>
            <strong>{a.texto}</strong> <span className="fonte">desde {haQuanto(a.desde, d.agora)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Celulares({ d }: { d: DadosDaOperacao }) {
  const a = d.aparelhos
  const vazio = a.por_tipo.length === 0 && a.recentes.length === 0
  return (
    <Bloco titulo="Problemas nos celulares" nota="avisados pelo app">
      {vazio ? (
        <p className="vazio">Nenhum problema avisado pelos celulares.</p>
      ) : (
        <>
          {a.por_tipo.length > 0 && (
            <>
              <p className="op-subtitulo">Nas últimas 24 h</p>
              <ul className="op-tipos">
                {a.por_tipo.map((t) => (
                  <li key={t.chave}>
                    <span>{nomeDoSinal(t.chave)}</span>
                    <strong>{t.n}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="op-subtitulo">Mais recentes</p>
          <ul className="op-sinais">
            {a.recentes.slice(0, RECENTES_NA_TELA).map((s, i) => (
              <li key={s.quando + i}>
                <span className="op-sinal-quando">{haQuanto(s.quando, d.agora)}</span>
                <span className="op-sinal-oque">
                  <strong>{nomeDoSinal(s.tipo)}</strong>
                  {s.detalhe && <span> · {detalheDoSinal(s.detalhe)}</span>}
                </span>
                <span className="fonte">{s.navegador && /[a-z]/i.test(s.navegador) ? s.navegador : 'navegador não informado'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Bloco>
  )
}

function Servidor({ d }: { d: DadosDaOperacao }) {
  const s = d.servidor
  const colunas = s.por_minuto.map((m) => ({
    chave: m.minuto,
    partes: [Math.max(0, m.pedidos - m.erros_5xx), m.erros_5xx],
    leitura:
      `${horaEMinuto(m.minuto)}: ${m.pedidos} ${m.pedidos === 1 ? 'pedido' : 'pedidos'}` +
      (m.erros_5xx > 0 ? `, ${m.erros_5xx} com erro do sistema` : '') +
      (m.recusas_4xx > 0 ? `, ${m.recusas_4xx} ${m.recusas_4xx === 1 ? 'recusado' : 'recusados'}` : ''),
  }))
  return (
    <Bloco titulo="Servidor" nota={noArHa(s.no_ar_desde, d.agora)}>
      <div className="op-numeros">
        <Numero valor={s.pedidos} rotulo="Pedidos atendidos" />
        <Numero valor={s.erros_5xx} rotulo="Erros do sistema" alerta={s.erros_5xx > 0 ? 'ver detalhes' : undefined} />
        <Numero valor={s.recusas_4xx} rotulo="Pedidos recusados" />
      </div>
      <p className="op-nota">
        A conta recomeça quando o servidor reinicia. Pedido recusado é o servidor dizendo não a algo fora da regra (senha errada, foto grande demais): não é defeito.
      </p>
      {colunas.length > 0 && (
        <Barras
          alt={textoDoGraficoDoServidor(s.por_minuto)}
          colunas={colunas}
          series={[{ nome: 'Pedidos', classe: 'serie-b' }, { nome: 'Erros do sistema', classe: 'serie-c' }]}
          marcas={[
            ...[0, 20, 40].filter((i) => i < colunas.length - 8).map((i) => ({ coluna: i, texto: horaEMinuto(s.por_minuto[i].minuto) })),
            { coluna: colunas.length - 1, texto: 'agora' },
          ]}
          resumo="Pedidos por minuto na última hora. Toque numa barra para ver o minuto."
        />
      )}
      <details className="op-tecnico">
        <summary>Ver detalhes técnicos</summary>
        <p className="op-subtitulo">Por tipo de pedido</p>
        <div className="op-rolagem" tabIndex={0} role="region" aria-label="Pedidos por tipo (role para o lado)">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Quantos</th>
                <th>Tempo típico</th>
                <th>Nos piores casos</th>
                <th>Erros</th>
                <th>Recusados</th>
              </tr>
            </thead>
            <tbody>
              {s.rotas.map((r) => (
                <tr key={r.rota}>
                  <td>{nomeDaRota(r.rota)}</td>
                  <td>{r.pedidos}</td>
                  <td>{tempoEmPalavras(r.media_ms)}</td>
                  <td>{tempoEmPalavras(r.p95_ms)}</td>
                  <td>{r.erros_5xx}</td>
                  <td>{r.recusas_4xx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="op-subtitulo">Falhas recentes</p>
        {s.falhas.length === 0 ? (
          <p className="vazio">Nenhuma falha desde que o servidor subiu.</p>
        ) : (
          <div className="op-rolagem" tabIndex={0} role="region" aria-label="Falhas recentes (role para o lado)">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Pedido</th>
                  <th>Resposta</th>
                  <th>Demorou</th>
                  <th>Código do pedido</th>
                </tr>
              </thead>
              <tbody>
                {s.falhas.map((f) => (
                  <tr key={f.id + f.quando} className={f.status >= 500 ? 'falhou' : ''}>
                    <td>{haQuanto(f.quando, d.agora)}</td>
                    <td>{nomeDaRota(f.rota)}</td>
                    <td>
                      {f.status >= 500 ? 'erro do sistema' : 'recusado'} ({f.status})
                    </td>
                    <td>{tempoEmPalavras(f.ms)}</td>
                    <td>
                      <code>{f.id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="fonte">
          O código do pedido é o mesmo que aparece no registro do servidor: passe para quem cuida dele. Banco de dados: {d.banco.conexoes_em_uso} de {d.banco.conexoes_max} conexões em uso.
        </p>
      </details>
    </Bloco>
  )
}

const PERIODOS = [1, 7, 30]

function Relatorio() {
  const [dias, setDias] = useState(1)
  const [baixando, setBaixando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  const baixar = async () => {
    setBaixando(true)
    setAviso(null)
    try {
      await baixarRelatorio(dias)
      setAviso({ tipo: 'ok', msg: 'Relatório baixado. Procure na pasta de downloads.' })
    } catch (e) {
      setAviso({ tipo: 'erro', msg: fraseDoErro(e) })
    } finally {
      setBaixando(false)
    }
  }

  return (
    <Bloco titulo="Relatório do teste de campo" largo>
      <div className="op-relatorio">
        <div className="segmento" role="group" aria-label="Período do relatório">
          {PERIODOS.map((n) => (
            <button key={n} type="button" aria-pressed={dias === n} className={dias === n ? 'ligado' : ''} onClick={() => setDias(n)}>
              {n === 1 ? '1 dia' : `${n} dias`}
            </button>
          ))}
        </div>
        <button type="button" className="botao-principal" disabled={baixando} onClick={baixar}>
          {baixando ? 'Baixando…' : dias === 1 ? 'Baixar relatório do dia (CSV)' : `Baixar relatório de ${dias} dias (CSV)`}
        </button>
      </div>
      <p className="op-nota">Uma linha por chamado real. Sem texto do relato, sem coordenada e sem nome de servidor.</p>
      {aviso && (
        <p className={aviso.tipo === 'ok' ? 'aviso-ok' : 'erro'} role="status">
          {aviso.msg}
        </p>
      )}
    </Bloco>
  )
}

// Aba Operação do gestor (ADR 0019): responde "o sistema está funcionando
// agora?" durante o teste de campo, em português comum (ADR 0017, princípio 7).
export function Operacao() {
  const [d, setD] = useState<DadosDaOperacao | null>(null)
  const [recebidoEm, setRecebidoEm] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [proibido, setProibido] = useState(false)
  const [buscando, setBuscando] = useState(true)
  // Cada toque em "Atualizar" ou "Tentar de novo" busca na hora e recomeça a contagem.
  const [pedido, setPedido] = useState(0)
  const relogio = useAgora()

  useEffect(() => {
    if (proibido) return
    let vivo = true
    const buscar = () =>
      operacao()
        .then((r) => {
          if (!vivo) return
          setD(r)
          setRecebidoEm(Date.now())
          setErro(null)
        })
        .catch((e) => {
          if (!vivo) return
          if (semPermissao(e)) setProibido(true)
          setErro(fraseDoErro(e))
        })
        .finally(() => vivo && setBuscando(false))
    void buscar()
    const parar = repetirComAbaVisivel(() => void buscar(), INTERVALO)
    return () => {
      vivo = false
      parar()
    }
  }, [pedido, proibido])

  const atualizar = () => {
    setBuscando(true)
    setPedido((n) => n + 1)
  }

  if (proibido) {
    return (
      <main className="pagina operacao">
        <p className="g-aviso" role="alert">{SO_O_GESTOR}</p>
      </main>
    )
  }

  const v = d ? veredito(d) : null
  const resumo = v ? resumoDoVeredito(v) : null

  return (
    <main className="pagina operacao">
      <div className="pagina-topo">
        <div>
          <h1>Operação</h1>
          <p className="sub">O sistema está funcionando agora? Atualiza sozinho a cada 15 segundos.</p>
        </div>
        <div className="filtros-pagina">
          {d && !erro && <span className="fonte">Atualizado às {new Date(recebidoEm).toLocaleTimeString('pt-BR')}</span>}
          <button type="button" className="botao-secundario" disabled={buscando} onClick={atualizar}>
            {buscando ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="g-aviso" role="alert">
          <p>
            <strong>Não deu para atualizar.</strong> {erro}
            {d && ` Dados de ${haQuanto(recebidoEm, Math.max(relogio, recebidoEm))}.`}
          </p>
          <button type="button" className="botao-secundario" disabled={buscando} onClick={atualizar}>
            {buscando ? 'Tentando…' : 'Tentar de novo'}
          </button>
        </div>
      )}

      {!d && !erro && <p className="vazio">Carregando a operação…</p>}

      {d && v && (
        <div className="op-grade">
          <AlertasAtivos d={d} />
          <section className={'op-veredito ' + v.nivel} aria-live="polite">
            <span className="op-veredito-sinal" aria-hidden="true">{SINAL_DO_VEREDITO[v.nivel]}</span>
            <div>
              <p className="op-veredito-titulo">{v.titulo}</p>
              <p className="op-veredito-frase">{resumo!.frase}</p>
              {resumo!.motivos.length > 0 && (
                <ul className="op-motivos">
                  {resumo!.motivos.map((m) => (
                    <li key={m.texto} className={m.gravidade}>
                      {resumo!.marcarGravidade && <span className="op-motivo-tipo">{m.gravidade === 'problema' ? 'Problema' : 'Atenção'}</span>}
                      {fraseDoMotivo(m)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <RelatosChegando d={d} />
          <Funil d={d} />
          <FilaDaCentral d={d} />
          <Triagem d={d} />
          <Celulares d={d} />
          <Servidor d={d} />
          <Relatorio />
        </div>
      )}
    </main>
  )
}
