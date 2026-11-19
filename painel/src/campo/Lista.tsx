import { useState } from 'react'
import type { CSSProperties } from 'react'
import { corDoNivel, textoSobreNivel } from '../niveis'
import type { Ocorrencia } from '../tipos'
import type { EstadoConexao, UsuarioDeCampo } from './api'
import type { Localizacao } from './ganchos'
import {
  contagemParaAtender,
  distanciaAte,
  feitosHoje,
  horaFalada,
  nomeDaCategoria,
  ondeFica,
  ordenar,
  prazoEmPalavras,
  quantasPessoas,
  urgenciaEmPalavras,
} from './logica'
import type { Ordem, Ponto } from './logica'
import { FormaDoNivel, IconeDoTipo } from '../relatar/pecas'
import { CaixaDeErro, Girando, IconeAtualizar, IconeLocal, IconeRelogio } from './pecas'

export type Aba = 'atender' | 'feitos'

interface ListaProps {
  usuario: UsuarioDeCampo
  cidade: string | null
  pendentes: Ocorrencia[] | null
  erroPendentes: string | null
  feitos: Ocorrencia[] | null
  erroFeitos: string | null
  buscando: boolean
  conexao: EstadoConexao
  aba: Aba
  aoTrocarAba: (aba: Aba) => void
  ordem: Ordem
  aoOrdenar: (ordem: Ordem) => void
  local: Localizacao
  agora: Date
  aoAbrir: (o: Ocorrencia) => void
  aoAtualizar: () => void
  aoAjuda: () => void
  aoSair: () => void
}

const TEXTO_DA_CONEXAO: Record<EstadoConexao, string> = {
  'ao-vivo': 'Ao vivo',
  'sem-conexao': 'Sem conexão',
  conectando: 'Conectando…',
}

export function Lista(p: ListaProps) {
  const [querSair, setQuerSair] = useState(false)
  const { pendentes, feitos, local, agora } = p
  const hoje = feitos ? feitosHoje(feitos, agora) : null
  const comDistancia = local.estado === 'ligada' && local.aqui != null
  const ordem: Ordem = comDistancia ? p.ordem : 'urgencia'
  const fila = pendentes ? ordenar(pendentes, ordem, local.aqui) : null

  return (
    <div className="pagina">
      <header className="topo">
        <img className="topo-logo" src="/logo.svg" width={40} height={40} alt="" />
        <span className="topo-marca">MOGI</span>
        <div className="topo-acoes">
          <button type="button" className="topo-botao" onClick={p.aoAtualizar} disabled={p.buscando}>
            {p.buscando ? <Girando /> : <IconeAtualizar tamanho={22} />}
            Atualizar
          </button>
          <button type="button" className="topo-botao" onClick={p.aoAjuda}>
            Ajuda
          </button>
          <button type="button" className="topo-botao" onClick={() => setQuerSair(true)}>
            Sair
          </button>
        </div>
      </header>

      <main className="conteudo">
        {querSair && (
          <div className="confirmar" role="alertdialog" aria-label="Sair da conta">
            <p>Sair da conta? Você vai precisar da senha para entrar de novo.</p>
            <div className="lado-a-lado">
              <button type="button" className="botao botao-secundario" onClick={() => setQuerSair(false)}>
                Ficar
              </button>
              <button type="button" className="botao botao-primario" onClick={p.aoSair}>
                Sair
              </button>
            </div>
          </div>
        )}

        <div className="cabeca">
          <p className="rotulo">
            {p.usuario.secretaria ?? 'Equipe de campo'}
            {p.cidade ? ` · ${p.cidade}` : ''}
          </p>
          <h1 className="titulo">Chamados da equipe</h1>
          <p className="resumo">
            <strong>{pendentes ? contagemParaAtender(pendentes.length) : 'Carregando…'}</strong>
            <span className={`conexao conexao-${p.conexao}`} role="status">
              <span className="conexao-ponto" aria-hidden="true" />
              {TEXTO_DA_CONEXAO[p.conexao]}
            </span>
          </p>
        </div>

        <div className="abas" role="tablist" aria-label="Chamados">
          <button type="button" role="tab" id="aba-atender" aria-selected={p.aba === 'atender'} aria-controls="painel" onClick={() => p.aoTrocarAba('atender')}>
            Para atender
          </button>
          <button type="button" role="tab" id="aba-feitos" aria-selected={p.aba === 'feitos'} aria-controls="painel" onClick={() => p.aoTrocarAba('feitos')}>
            Feitos hoje
          </button>
        </div>

        <div id="painel" className="painel" role="tabpanel" aria-labelledby={`aba-${p.aba}`}>
          {p.aba === 'atender' ? (
            <>
              <PedidoDeLocal local={local} temChamados={!!fila && fila.length > 0} />
              {comDistancia && fila && fila.length > 1 && (
                <div className="ordem" role="group" aria-label="Ordem da lista">
                  <button type="button" aria-pressed={ordem === 'urgencia'} onClick={() => p.aoOrdenar('urgencia')}>
                    Mais urgente
                  </button>
                  <button type="button" aria-pressed={ordem === 'perto'} onClick={() => p.aoOrdenar('perto')}>
                    Mais perto
                  </button>
                </div>
              )}
              {p.erroPendentes && <CaixaDeErro aoTentar={p.aoAtualizar}>{p.erroPendentes}</CaixaDeErro>}
              {!fila && !p.erroPendentes && <Espera />}
              {fila && fila.length === 0 && !p.erroPendentes && (
                <Vazio texto="Nenhum chamado para a equipe agora. Quando chegar um, o celular toca." aoAtualizar={p.aoAtualizar} buscando={p.buscando} />
              )}
              {fila && fila.length > 0 && (
                <ul className="cartoes">
                  {fila.map((o) => (
                    <li key={o.id}>
                      <Cartao o={o} aqui={comDistancia ? local.aqui : null} agora={agora} aoAbrir={p.aoAbrir} />
                    </li>
                  ))}
                </ul>
              )}
              <RodapeDoLocal local={local} />
            </>
          ) : (
            <>
              {p.erroFeitos && <CaixaDeErro aoTentar={p.aoAtualizar}>{p.erroFeitos}</CaixaDeErro>}
              {!hoje && !p.erroFeitos && <Espera />}
              {hoje && hoje.length === 0 && !p.erroFeitos && (
                <Vazio texto="Nenhum chamado concluído hoje ainda." aoAtualizar={p.aoAtualizar} buscando={p.buscando} />
              )}
              {hoje && hoje.length > 0 && (
                <>
                  <p className="apoio">
                    {hoje.length === 1 ? '1 chamado concluído hoje.' : `${hoje.length} chamados concluídos hoje.`}
                  </p>
                  <ul className="cartoes">
                    {hoje.map((o) => (
                      <li key={o.id}>
                        <Cartao o={o} aqui={null} agora={agora} aoAbrir={p.aoAbrir} feito />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function Espera() {
  return (
    <p className="espera" role="status">
      <Girando /> Carregando…
    </p>
  )
}

function Vazio({ texto, aoAtualizar, buscando }: { texto: string; aoAtualizar: () => void; buscando: boolean }) {
  return (
    <div className="vazio">
      <p>{texto}</p>
      <button type="button" className="botao botao-secundario" onClick={aoAtualizar} disabled={buscando}>
        {buscando ? <Girando /> : <IconeAtualizar />}
        Atualizar
      </button>
    </div>
  )
}

// Pergunta da localização: uma vez, com o porquê, antes do pedido do navegador.
function PedidoDeLocal({ local, temChamados }: { local: Localizacao; temChamados: boolean }) {
  if (local.estado === 'perguntar' && temChamados) {
    return (
      <div className="pedido-local">
        <p>
          <strong>Para mostrar o que está mais perto de você</strong>, o MOGI precisa da sua localização.
        </p>
        <button type="button" className="botao botao-secundario" onClick={local.pedir}>
          <IconeLocal />
          Usar minha localização
        </button>
        <button type="button" className="link" onClick={local.dispensar}>
          Agora não
        </button>
      </div>
    )
  }
  if (local.estado === 'buscando') {
    return (
      <p className="nota-local" role="status">
        <Girando /> Procurando onde você está…
      </p>
    )
  }
  return null
}

// Quem disse "agora não" ou bloqueou tem como voltar atrás.
function RodapeDoLocal({ local }: { local: Localizacao }) {
  if (local.estado === 'desligada') {
    return (
      <button type="button" className="link" onClick={local.pedir}>
        Mostrar a distância até os chamados
      </button>
    )
  }
  if (local.estado === 'bloqueada') {
    return (
      <p className="miudo">
        A localização está bloqueada neste navegador, então a lista não mostra a distância. Para ligar, libere a
        localização nas configurações do site e{' '}
        <button type="button" className="link link-no-texto" onClick={local.pedir}>
          toque aqui
        </button>
        .
      </p>
    )
  }
  return null
}

interface CartaoProps {
  o: Ocorrencia
  aqui: Ponto | null
  agora: Date
  aoAbrir: (o: Ocorrencia) => void
  feito?: boolean
}

function Cartao({ o, aqui, agora, aoAbrir, feito = false }: CartaoProps) {
  const [semFoto, setSemFoto] = useState(false)
  const onde = ondeFica(o)
  const distancia = distanciaAte(o, aqui)
  const prazo = prazoEmPalavras(o.prazo_ate, agora)
  const pessoas = quantasPessoas(o.relatos)
  const cores = { '--nivel': corDoNivel(o.nivel), '--sobre-nivel': textoSobreNivel(o.nivel) } as CSSProperties

  return (
    <button type="button" className={feito ? 'cartao cartao-feito' : 'cartao'} style={cores} onClick={() => aoAbrir(o)}>
      <span className="cartao-corpo">
        {feito ? (
          <span className="selo selo-feito">Feito{o.resolvido_em ? ` às ${horaFalada(new Date(o.resolvido_em))}` : ''}</span>
        ) : (
          <span className="selo selo-nivel">
            <FormaDoNivel nivel={o.nivel} />
            {urgenciaEmPalavras(o.nivel)}
          </span>
        )}
        <span className="cartao-tipo">
          <IconeDoTipo id={o.categoria} tamanho={22} />
          {nomeDaCategoria(o.categoria)}
        </span>
        <span className="cartao-onde">{onde}</span>
        {o.endereco && o.bairro && <span className="cartao-bairro">{o.bairro}</span>}
        {!feito && (
          <span className="cartao-linha">
            {distancia && (
              <span className="cartao-dado">
                <IconeLocal tamanho={20} />
                {distancia}
              </span>
            )}
            <span className={prazo.atrasado ? 'cartao-dado atrasado' : 'cartao-dado'}>
              <IconeRelogio tamanho={20} />
              {prazo.texto}
            </span>
          </span>
        )}
        {pessoas && <span className="cartao-pessoas">{pessoas}</span>}
      </span>
      {o.midia_url && !semFoto ? (
        <img className="cartao-foto" src={o.midia_url} alt="" loading="lazy" onError={() => setSemFoto(true)} />
      ) : (
        <span className="cartao-foto cartao-sem-foto" aria-hidden="true">
          <IconeDoTipo id={o.categoria} tamanho={36} />
        </span>
      )}
    </button>
  )
}
