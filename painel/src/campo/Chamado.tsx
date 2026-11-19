import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { corDoNivel, textoSobreNivel } from '../niveis'
import { reduzirFoto } from '../relatar/foto'
import { tocar } from '../sons'
import type { Ocorrencia } from '../tipos'
import { avisarFalha, detalhar, Falha, naoEncontrado, resolver, sessaoExpirou } from './api'
import type { UsuarioDeCampo } from './api'
import { useTituloEmFoco } from './ganchos'
import {
  comResposta,
  distanciaAte,
  fotosDoChamado,
  horaFalada,
  juntar,
  lerAppDeRota,
  LIMITE_DE_FOTOS,
  LIMITE_DO_MOTIVO,
  linksDeRota,
  mensagemDaFalha,
  MOTIVOS_NAO_ENCONTREI,
  NOME_DO_APP,
  nomeDaCategoria,
  ondeFica,
  oQueFoiFeito,
  prazoEmPalavras,
  quantasPessoas,
  recadoDaCentral,
  respostasRapidas,
  rotuloDeConcluir,
  rotuloDeFotos,
  urgenciaEmPalavras,
} from './logica'
import type { AppDeRota, CodigoDeFalha, Ponto, Rota } from './logica'
import { FormaDoNivel, IconeDoTipo } from '../relatar/pecas'
import { CaixaDeErro, Fichas, FotoAmpliada, Girando, IconeCamera, IconeCerto, IconeFechar, IconeRota, TopoDeVoltar } from './pecas'

interface FotoNova {
  chave: number
  blob: Blob
  url: string
}

interface ChamadoProps {
  id: string
  // O que a lista já sabe do chamado; null quando a página foi recarregada nele.
  resumo: Ocorrencia | null
  usuario: UsuarioDeCampo
  rota: Rota
  aqui: Ponto | null
  agora: Date
  aoIr: (destino: Partial<Omit<Rota, 'n'>>) => void
  aoTrocar: (destino: Partial<Omit<Rota, 'n'>>) => void
  aoVoltar: () => void
  aoParaLista: () => void
  aoExpirar: () => void
  aoConcluir: (o: Ocorrencia) => void
  aoAvisar: () => void
  aoJaConcluido: () => void
  aoSaiu: () => void
}

const FOTO_ILEGIVEL = 'Não consegui ler essa foto. Tire outra pela câmera.'

export function Chamado(p: ChamadoProps) {
  const { id, resumo, rota, aoExpirar } = p
  const [detalhe, setDetalhe] = useState<Ocorrencia | null>(null)
  const [erro, setErro] = useState<CodigoDeFalha | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tentativa, setTentativa] = useState(0)
  // As fotos e os textos ficam aqui, acima dos passos: voltar para olhar o
  // chamado e entrar de novo em "Resolvi" não perde o que já foi feito.
  const [fotos, setFotos] = useState<FotoNova[]>([])
  const [feito, setFeito] = useState('')
  const [visto, setVisto] = useState('')
  const fotosAtuais = useRef<FotoNova[]>([])
  const serie = useRef(0)

  const versao = resumo?.atualizado_em
  useEffect(() => {
    let vivo = true
    setCarregando(true)
    detalhar(id)
      .then((o) => {
        if (!vivo) return
        setDetalhe(o)
        setErro(null)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        if (sessaoExpirou(e)) aoExpirar()
        else {
          setErro(e instanceof Falha ? e.codigo : 'servidor')
          tocar('erro')
        }
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [id, versao, tentativa, aoExpirar])

  useEffect(
    () => () => {
      for (const f of fotosAtuais.current) URL.revokeObjectURL(f.url)
    },
    [],
  )

  const adicionarFoto = (blob: Blob): boolean => {
    if (fotosAtuais.current.length >= LIMITE_DE_FOTOS) return false
    const nova = { chave: ++serie.current, blob, url: URL.createObjectURL(blob) }
    fotosAtuais.current = [...fotosAtuais.current, nova]
    setFotos(fotosAtuais.current)
    return true
  }

  const removerFoto = (chave: number) => {
    const fora = fotosAtuais.current.find((f) => f.chave === chave)
    if (fora) URL.revokeObjectURL(fora.url)
    fotosAtuais.current = fotosAtuais.current.filter((f) => f.chave !== chave)
    setFotos(fotosAtuais.current)
  }

  const o = juntar(resumo, detalhe)
  const tentar = () => setTentativa((t) => t + 1)

  if (!o) {
    return (
      <div className="pagina">
        <TopoDeVoltar aoVoltar={p.aoVoltar} titulo="Chamado" />
        <main className="conteudo">
          {carregando && !erro && (
            <p className="espera" role="status">
              <Girando /> Carregando…
            </p>
          )}
          {erro === 'nao_e_da_equipe' && (
            <>
              <h1 className="titulo titulo-menor">{mensagemDaFalha('nao_e_da_equipe')}</h1>
              <button type="button" className="botao botao-primario" onClick={p.aoParaLista}>
                Ver os chamados
              </button>
            </>
          )}
          {erro && erro !== 'nao_e_da_equipe' && <CaixaDeErro aoTentar={tentar}>{mensagemDaFalha(erro)}</CaixaDeErro>}
        </main>
      </div>
    )
  }

  const emAtendimento = o.status === 'em_atendimento' && erro !== 'nao_e_da_equipe'
  const galeria = fotosDoChamado(o)
  const todas = [...galeria.antes, ...galeria.depois]

  let tela
  if (emAtendimento && rota.passo === 'concluir') {
    tela = (
      <Concluir
        o={o}
        usuario={p.usuario}
        fotos={fotos}
        aoAdicionar={adicionarFoto}
        aoRemover={removerFoto}
        texto={feito}
        aoEscrever={setFeito}
        aoVoltar={p.aoVoltar}
        aoExpirar={aoExpirar}
        aoConcluir={p.aoConcluir}
        aoJaConcluido={p.aoJaConcluido}
        aoSaiu={p.aoSaiu}
      />
    )
  } else if (emAtendimento && rota.passo === 'nao-encontrei') {
    tela = (
      <NaoEncontrei
        o={o}
        texto={visto}
        aoEscrever={setVisto}
        aoVoltar={p.aoVoltar}
        aoExpirar={aoExpirar}
        aoAvisar={p.aoAvisar}
        aoSaiu={p.aoSaiu}
      />
    )
  } else {
    tela = (
      <Detalhe
        o={o}
        emAtendimento={emAtendimento}
        foraDaEquipe={erro === 'nao_e_da_equipe'}
        carregando={carregando}
        erro={erro}
        aoTentar={tentar}
        aqui={p.aqui}
        agora={p.agora}
        aoVoltar={p.aoVoltar}
        aoIr={p.aoIr}
      />
    )
  }

  return (
    <>
      {tela}
      {rota.foto != null && todas.length > 0 && (
        <FotoAmpliada fotos={todas} indice={rota.foto} aoTrocar={(foto) => p.aoTrocar({ foto })} aoFechar={p.aoVoltar} />
      )}
    </>
  )
}

const CHAVE_ROTA = 'mogi.campo.rota'

function appSalvo(): AppDeRota | null {
  try {
    return lerAppDeRota(localStorage.getItem(CHAVE_ROTA))
  } catch {
    return null
  }
}

interface DetalheProps {
  o: Ocorrencia
  emAtendimento: boolean
  foraDaEquipe: boolean
  carregando: boolean
  erro: CodigoDeFalha | null
  aoTentar: () => void
  aqui: Ponto | null
  agora: Date
  aoVoltar: () => void
  aoIr: (destino: Partial<Omit<Rota, 'n'>>) => void
}

function Detalhe({ o, emAtendimento, foraDaEquipe, carregando, erro, aoTentar, aqui, agora, aoVoltar, aoIr }: DetalheProps) {
  const titulo = useTituloEmFoco<HTMLHeadingElement>()
  const [app, setApp] = useState<AppDeRota | null>(appSalvo)
  const [escolhendo, setEscolhendo] = useState(false)
  const [quebradas, setQuebradas] = useState<string[]>([])

  const galeria = fotosDoChamado(o)
  const antes = galeria.antes.filter((u) => !quebradas.includes(u))
  const depois = galeria.depois.filter((u) => !quebradas.includes(u))
  // O índice da tela cheia vale sobre a lista completa, na ordem em que foi montada.
  const todas = [...galeria.antes, ...galeria.depois]
  const ampliar = (url: string) => aoIr({ foto: Math.max(0, todas.indexOf(url)) })
  const quebrou = (url: string) => setQuebradas((q) => (q.includes(url) ? q : [...q, url]))

  const resolvida = o.status === 'resolvida'
  const prazo = prazoEmPalavras(o.prazo_ate, agora)
  const distancia = distanciaAte(o, aqui)
  const pessoas = quantasPessoas(o.relatos)
  const recado = recadoDaCentral(o.eventos)
  const servico = oQueFoiFeito(o.eventos)
  const links = linksDeRota(o)
  const cores = { '--nivel': corDoNivel(o.nivel), '--sobre-nivel': textoSobreNivel(o.nivel) } as CSSProperties
  const relato = o.texto?.trim()

  const escolher = (qual: AppDeRota) => {
    setApp(qual)
    setEscolhendo(false)
    try {
      localStorage.setItem(CHAVE_ROTA, qual)
    } catch {
      /* sem armazenamento: pergunta de novo na próxima vez */
    }
  }

  return (
    <div className="pagina">
      <TopoDeVoltar aoVoltar={aoVoltar} titulo="Chamado" />
      <main className="conteudo conteudo-chamado" style={cores}>
        {antes.length > 0 ? (
          <div className="galeria">
            <button type="button" className="foto-grande" onClick={() => ampliar(antes[0])} aria-label="Toque para ampliar a foto do morador">
              <img src={antes[0]} alt="" onError={() => quebrou(antes[0])} />
              <span className="foto-dica">Toque para ampliar</span>
            </button>
            {antes.length > 1 && (
              <ul className="tira" aria-label="Outras fotos">
                {antes.slice(1).map((url, i) => (
                  <li key={url}>
                    <button type="button" className="mini" onClick={() => ampliar(url)} aria-label={`Ampliar a foto ${i + 2}`}>
                      <img src={url} alt="" loading="lazy" onError={() => quebrou(url)} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="foto-grande foto-vazia" aria-hidden="true">
            <IconeDoTipo id={o.categoria} tamanho={56} />
          </div>
        )}
        {galeria.temVideo && <p className="nota">Tem vídeo: veja no painel da central.</p>}

        {resolvida && (
          <p className="faixa faixa-boa">
            <IconeCerto />
            Concluído{o.resolvido_em ? ` às ${horaFalada(new Date(o.resolvido_em))}` : ''}
          </p>
        )}
        {!resolvida && !emAtendimento && (
          <p className="faixa faixa-aviso" role="status">
            {foraDaEquipe ? mensagemDaFalha('nao_e_da_equipe') : 'Este chamado voltou para a central.'}
          </p>
        )}

        <div className="oque">
          {!resolvida && (
            <span className="selo selo-nivel">
              <FormaDoNivel nivel={o.nivel} />
              {urgenciaEmPalavras(o.nivel)}
            </span>
          )}
          <h1 className="titulo titulo-menor titulo-tipo" ref={titulo} tabIndex={-1}>
            <IconeDoTipo id={o.categoria} tamanho={30} />
            {nomeDaCategoria(o.categoria)}
          </h1>
          {relato && <blockquote className="fala">“{relato}”</blockquote>}
        </div>

        {recado && !resolvida && (
          <p className="recado">
            <strong>Recado da central</strong>
            {recado}
          </p>
        )}

        {resolvida && (servico || depois.length > 0) && (
          <div className="bloco">
            <h2 className="rotulo">O que foi feito</h2>
            {servico && <p className="bloco-texto">{servico}</p>}
            {depois.length > 0 && (
              <ul className="tira" aria-label="Fotos do serviço pronto">
                {depois.map((url, i) => (
                  <li key={url}>
                    <button type="button" className="mini" onClick={() => ampliar(url)} aria-label={`Ampliar a foto ${i + 1} do serviço`}>
                      <img src={url} alt="" loading="lazy" onError={() => quebrou(url)} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <ul className="fatos">
          <li>
            <IconeFato tipo="local" />
            <span className="fato-texto">
              <strong>{ondeFica(o)}</strong>
              {o.endereco && o.bairro && <span>{o.bairro}</span>}
            </span>
            {distancia && !resolvida && <span className="pilula-fato">{distancia}</span>}
          </li>
          {!resolvida && (
            <li>
              <IconeFato tipo="prazo" />
              <span className="fato-texto">
                <strong className={prazo.atrasado ? 'atrasado' : undefined}>{prazo.texto.charAt(0).toUpperCase() + prazo.texto.slice(1)}</strong>
              </span>
            </li>
          )}
          {pessoas && (
            <li>
              <IconeFato tipo="pessoas" />
              <span className="fato-texto">
                <strong>{pessoas}</strong>
              </span>
            </li>
          )}
        </ul>

        {carregando && !o.eventos && (
          <p className="nota" role="status">
            Carregando as fotos e o recado…
          </p>
        )}
        {erro && erro !== 'nao_e_da_equipe' && !o.eventos && (
          <CaixaDeErro aoTentar={aoTentar}>
            Não deu para carregar todas as fotos e o recado da central. O resto do chamado está aqui.
          </CaixaDeErro>
        )}

        {emAtendimento && (
          <button type="button" className="botao botao-secundario" onClick={() => aoIr({ passo: 'nao-encontrei' })}>
            Não encontrei o problema
          </button>
        )}
        <p className="miudo">
          Chamado <span className="protocolo">{o.protocolo}</span>
        </p>
      </main>

      {emAtendimento && (
        <footer className="barra">
          {escolhendo && (
            <div className="rota-opcoes" role="group" aria-label="Abrir a rota com">
              <p className="rotulo">Abrir a rota com</p>
              <div className="lado-a-lado">
                <a className="botao botao-rota" href={links.waze} target="_blank" rel="noopener" onClick={() => escolher('waze')}>
                  {NOME_DO_APP.waze}
                </a>
                <a className="botao botao-rota" href={links.google} target="_blank" rel="noopener" onClick={() => escolher('google')}>
                  {NOME_DO_APP.google}
                </a>
              </div>
            </div>
          )}
          <div className="lado-a-lado">
            {app && !escolhendo ? (
              <a className="botao botao-rota" href={links[app]} target="_blank" rel="noopener">
                <IconeRota />
                Abrir rota
                <span className="escondido">, abre o {NOME_DO_APP[app]}</span>
              </a>
            ) : (
              <button type="button" className="botao botao-rota" aria-expanded={escolhendo} onClick={() => setEscolhendo((v) => !v)}>
                <IconeRota />
                Abrir rota
              </button>
            )}
            <button type="button" className="botao botao-primario" onClick={() => aoIr({ passo: 'concluir' })}>
              <IconeCerto />
              Resolvi
            </button>
          </div>
          {app && !escolhendo && (
            <p className="rota-app">
              A rota abre no {NOME_DO_APP[app]}.
              <button type="button" className="link link-no-texto" onClick={() => setEscolhendo(true)}>
                trocar
              </button>
            </p>
          )}
        </footer>
      )}
    </div>
  )
}

interface ConcluirProps {
  o: Ocorrencia
  usuario: UsuarioDeCampo
  fotos: FotoNova[]
  aoAdicionar: (blob: Blob) => boolean
  aoRemover: (chave: number) => void
  texto: string
  aoEscrever: (texto: string) => void
  aoVoltar: () => void
  aoExpirar: () => void
  aoConcluir: (o: Ocorrencia) => void
  aoJaConcluido: () => void
  aoSaiu: () => void
}

function Concluir(p: ConcluirProps) {
  const { o, fotos } = p
  const titulo = useTituloEmFoco<HTMLHeadingElement>()
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null)
  // null: parado. De 0 a 1: fração do envio que já subiu.
  const [enviando, setEnviando] = useState<number | null>(null)
  const [falha, setFalha] = useState<CodigoDeFalha | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const caiuARede = useRef(false)

  const ocupado = enviando != null
  const cheio = fotos.length >= LIMITE_DE_FOTOS
  const prontas = respostasRapidas(o.categoria)

  const receber = async (entrada: HTMLInputElement) => {
    const arquivos = Array.from(entrada.files ?? [])
    // Limpa a entrada para a mesma foto poder ser escolhida de novo.
    entrada.value = ''
    if (arquivos.length === 0) return
    setAvisoFoto(null)
    setFalha(null)
    setConfirmar(false)
    setLendo(true)
    let ilegiveis = 0
    let sobrou = false
    for (const arquivo of arquivos) {
      try {
        if (!p.aoAdicionar(await reduzirFoto(arquivo))) sobrou = true
        else tocar('foto')
      } catch {
        ilegiveis++
        avisarFalha('campo_foto_ilegivel', `tipo ${arquivo.type || 'desconhecido'}`)
      }
    }
    setLendo(false)
    if (ilegiveis > 0) {
      setAvisoFoto(FOTO_ILEGIVEL)
      tocar('erro')
    }
    else if (sobrou) setAvisoFoto('São no máximo 3 fotos. As outras ficaram de fora.')
  }

  const enviar = async () => {
    if (ocupado || lendo) return
    // A foto é a prova do serviço: sem ela, a pessoa confirma antes.
    if (fotos.length === 0 && !confirmar) {
      setConfirmar(true)
      return
    }
    setFalha(null)
    setEnviando(0)
    try {
      p.aoConcluir(await resolver(o.id, p.texto, fotos.map((f) => f.blob), setEnviando))
    } catch (e) {
      const codigo = e instanceof Falha ? e.codigo : 'servidor'
      if (codigo === 'sessao') return p.aoExpirar()
      if (codigo === 'nao_e_da_equipe') return p.aoSaiu()
      if (codigo === 'ja_resolvido') {
        // Depois de uma queda de rede, o "já concluído" pode ser o envio
        // anterior, que chegou ao servidor sem a resposta voltar.
        if (caiuARede.current) {
          const atual = await detalhar(o.id).catch(() => null)
          if (atual?.status === 'resolvida' && atual.resolvido_por === p.usuario.login) return p.aoConcluir(atual)
        }
        return p.aoJaConcluido()
      }
      if (codigo === 'sem_rede') caiuARede.current = true
      avisarFalha('campo_envio_falhou', `concluir: ${codigo}, http ${e instanceof Falha ? e.status : 0}, fotos ${fotos.length}`)
      setFalha(codigo)
      setEnviando(null)
    }
  }

  // Depois de uma falha a pessoa já confirmou: o botão vira "Tentar de novo".
  const pedindoConfirmacao = confirmar && !ocupado && !falha && fotos.length === 0
  const porcento = Math.round((enviando ?? 0) * 100)
  const subindo = fotos.length > 0 && porcento < 100

  return (
    <div className="pagina">
      <TopoDeVoltar aoVoltar={p.aoVoltar} titulo="Concluir chamado" />
      <main className="conteudo">
        <h1 className="titulo titulo-menor" ref={titulo} tabIndex={-1}>
          Tire uma foto do serviço pronto
        </h1>
        <p className="apoio apoio-tipo">
          <IconeDoTipo id={o.categoria} tamanho={20} />
          <span>
            {nomeDaCategoria(o.categoria)} · {ondeFica(o)}
          </span>
        </p>

        <input
          ref={camera}
          className="escondido"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Tirar foto do serviço pronto"
          tabIndex={-1}
          onChange={(e) => void receber(e.currentTarget)}
        />
        <input
          ref={galeria}
          className="escondido"
          type="file"
          accept="image/*"
          multiple
          aria-label="Escolher foto da galeria"
          tabIndex={-1}
          onChange={(e) => void receber(e.currentTarget)}
        />
        <button type="button" className="botao botao-foto" disabled={cheio || ocupado || lendo} onClick={() => camera.current?.click()}>
          <span className="botao-foto-icone">{lendo ? <Girando /> : <IconeCamera tamanho={36} />}</span>
          {lendo ? 'Preparando a foto…' : rotuloDeFotos(fotos.length)}
        </button>

        {fotos.length > 0 && (
          <ul className="tira" aria-label="Fotos do serviço pronto">
            {fotos.map((f, i) => (
              <li key={f.chave}>
                <span className="mini">
                  <img src={f.url} alt={`Foto ${i + 1} do serviço`} />
                  <button type="button" className="mini-x" disabled={ocupado} onClick={() => p.aoRemover(f.chave)} aria-label={`Remover a foto ${i + 1}`}>
                    <span>
                      <IconeFechar tamanho={16} />
                    </span>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {avisoFoto && <CaixaDeErro>{avisoFoto}</CaixaDeErro>}
        {!cheio && (
          <button type="button" className="link" disabled={ocupado || lendo} onClick={() => galeria.current?.click()}>
            Escolher da galeria
          </button>
        )}
        <p className="miudo">Até 3 fotos. Rostos e placas são borrados antes de guardar.</p>

        <div className="campo">
          <label htmlFor="feito">
            O que foi feito? <span className="opcional">(opcional)</span>
          </label>
          <Fichas
            opcoes={prontas}
            escolhida={p.texto}
            aoEscolher={(r) => p.aoEscrever(comResposta(p.texto, r, prontas))}
            rotulo="Respostas rápidas"
            desligado={ocupado}
          />
          <textarea
            id="feito"
            rows={2}
            maxLength={LIMITE_DO_MOTIVO}
            placeholder="Se quiser, escreva aqui."
            value={p.texto}
            disabled={ocupado}
            onChange={(e) => p.aoEscrever(e.target.value)}
          />
        </div>

        <div className="acoes">
          {falha && <CaixaDeErro>{mensagemDaFalha(falha, fotos.length > 0)}</CaixaDeErro>}
          {pedindoConfirmacao && (
            <div className="confirmar" role="alertdialog" aria-label="Concluir sem foto">
              <p>
                <strong>Concluir sem foto?</strong> A foto mostra para a central que o serviço foi feito.
              </p>
              <button type="button" className="botao botao-primario" onClick={() => camera.current?.click()}>
                <IconeCamera />
                Tirar foto
              </button>
            </div>
          )}
          {ocupado ? (
            <div className="envio" role="status">
              <p className="envio-texto">
                {fotos.length === 0 ? 'Enviando…' : subindo ? `Enviando as fotos… ${porcento}%` : 'Guardando as fotos…'}
              </p>
              <div className={subindo ? 'progresso' : 'progresso incerta'}>
                <span style={{ width: subindo ? `${Math.max(4, porcento)}%` : '100%' }} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={pedindoConfirmacao ? 'botao botao-secundario' : 'botao botao-primario'}
              disabled={lendo}
              onClick={() => void enviar()}
            >
              {pedindoConfirmacao ? 'Sim, concluir sem foto' : rotuloDeConcluir(fotos.length, falha != null)}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

interface NaoEncontreiProps {
  o: Ocorrencia
  texto: string
  aoEscrever: (texto: string) => void
  aoVoltar: () => void
  aoExpirar: () => void
  aoAvisar: () => void
  aoSaiu: () => void
}

function NaoEncontrei(p: NaoEncontreiProps) {
  const { o } = p
  const titulo = useTituloEmFoco<HTMLHeadingElement>()
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<CodigoDeFalha | null>(null)
  const [faltou, setFaltou] = useState(false)

  const enviar = async () => {
    if (enviando) return
    if (!p.texto.trim()) {
      setFaltou(true)
      return
    }
    setFalha(null)
    setEnviando(true)
    try {
      await naoEncontrado(o.id, p.texto)
      p.aoAvisar()
    } catch (e) {
      const codigo = e instanceof Falha ? e.codigo : 'servidor'
      if (codigo === 'sessao') return p.aoExpirar()
      // 404 e 409 dizem a mesma coisa para a equipe: o chamado já não é dela.
      if (codigo === 'nao_e_da_equipe' || codigo === 'ja_resolvido') return p.aoSaiu()
      avisarFalha('campo_envio_falhou', `nao encontrei: ${codigo}, http ${e instanceof Falha ? e.status : 0}`)
      setFalha(codigo)
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <TopoDeVoltar aoVoltar={p.aoVoltar} titulo="Não encontrei" />
      <main className="conteudo">
        <h1 className="titulo titulo-menor" ref={titulo} tabIndex={-1}>
          O que você viu no local?
        </h1>
        <p className="apoio apoio-tipo">
          <IconeDoTipo id={o.categoria} tamanho={20} />
          <span>
            {nomeDaCategoria(o.categoria)} · {ondeFica(o)}
          </span>
        </p>
        <div className="campo">
          <Fichas
            opcoes={MOTIVOS_NAO_ENCONTREI}
            escolhida={p.texto}
            aoEscolher={(r) => {
              setFaltou(false)
              p.aoEscrever(comResposta(p.texto, r, MOTIVOS_NAO_ENCONTREI))
            }}
            rotulo="Respostas rápidas"
            desligado={enviando}
          />
          <label htmlFor="visto">Ou escreva o que viu</label>
          <textarea
            id="visto"
            rows={3}
            maxLength={LIMITE_DO_MOTIVO}
            value={p.texto}
            disabled={enviando}
            aria-invalid={faltou}
            onChange={(e) => {
              setFaltou(false)
              p.aoEscrever(e.target.value)
            }}
          />
        </div>
        <p className="nota">O chamado volta para a central conferir e sai da sua lista.</p>
        <div className="acoes">
          {faltou && <CaixaDeErro>Escolha uma resposta ou escreva o que você viu.</CaixaDeErro>}
          {falha && <CaixaDeErro>{mensagemDaFalha(falha)}</CaixaDeErro>}
          <button type="button" className="botao botao-primario" disabled={enviando} onClick={() => void enviar()}>
            {enviando ? (
              <>
                <Girando /> Enviando…
              </>
            ) : falha ? (
              'Tentar de novo'
            ) : (
              'Avisar a central'
            )}
          </button>
        </div>
      </main>
    </div>
  )
}

// Ícone de cada linha de fatos do chamado, no traço dos outros ícones.
function IconeFato({ tipo }: { tipo: 'local' | 'prazo' | 'pessoas' }) {
  return (
    <span className="fato-icone" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tipo === 'local' && (
          <>
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </>
        )}
        {tipo === 'prazo' && (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </>
        )}
        {tipo === 'pessoas' && (
          <>
            <circle cx="9" cy="9" r="3" />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.5M17.5 14.5a5 5 0 0 1 3 4.5" />
          </>
        )}
      </svg>
    </span>
  )
}
