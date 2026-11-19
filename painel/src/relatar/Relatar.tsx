import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ligarSom, prepararSons, somLigado, tocar } from '../sons'
import Cadastro from './Cadastro'
import { atualizarRecentes, unirRelatos } from './cadastro'
import type { Morador, RelatoDoMorador } from './cadastro'
import Camera from './Camera'
import { esquecerConta, moradorSalvo, tokenSalvo } from './conta'
import Descricao from './Descricao'
import {
  avisar,
  buscarAcompanhamento,
  buscarConfig,
  buscarPerto,
  confirmarPerto,
  enviarRelato,
  FalhaDeEnvio,
  novoUuid,
  recentesSalvos,
  salvarRecentes,
} from './envio'
import type { VideoDoRelato } from './envio'
import Folha from './Folha'
import { reduzirFoto } from './foto'
import { useLocalizacao } from './localizacao'
import {
  foraDaCidade,
  acaoDoErro,
  camposDoRelato,
  CONFIG_PADRAO,
  consultaServe,
  depoisDaConfirmacao,
  escolherPerto,
  estreiaResolvido,
  falaDoEnvio,
  FOTO_ILEGIVEL,
  juntarFala,
  distanciaCurta,
  marcoDoEnvio,
  mensagemDaConfirmacao,
  mensagemDeErro,
  mesclarRecentes,
  nomeCurto,
  pedeMapa,
  pessoas,
  pinosDosRecentes,
  porcentagem,
  recenteAtualizado,
  recenteDaResposta,
  rotuloDoEnvio,
  nomeDoNivel,
  suportaGravacao,
} from './logica'
import type { AcaoDoErro, Acompanhamento, CodigoDeErro, Config, ConsultaPerto, Ponto, Posicao, Progresso, Proximo, Recente } from './logica'
import Ajuda from './Ajuda'
import BoasVindas from './BoasVindas'
import Tour from './Tour'
import { CHAVE_BOAS_VINDAS, CHAVE_TOUR, concluiCom, lerVistos } from './tour'
import { CHAVE_BONECO, gravarAparencia, lerAparencia } from './boneco'
import type { Aparencia } from './boneco'
import type { Alvo, Gesto } from './tour'
import MapaVivo from './MapaVivo'
import Perfil from './Perfil'
import type { Aba } from './Perfil'
import type { ControleDoMapa, Fase as FaseDoMapa, Orientacao } from './MapaVivo'
import {
  Anel,
  Confete,
  IconeAjuda,
  IconeBairro,
  IconeBussola,
  IconeCamera,
  IconeCerto,
  IconeDoTipo,
  IconeFechar,
  IconeLista,
  IconeMira,
  IconeMogi,
  IconePessoa,
  IconeSemSom,
  IconeSom,
} from './pecas'
import { useVoz } from './voz'

interface Foto {
  id: number
  // Sempre o JPEG já reduzido: é o que vai ao servidor e o que a tira mostra.
  blob: Blob
  url: string
}

interface Video extends VideoDoRelato {
  capa: string | null
}

type Aviso =
  | { tipo: 'enviado'; protocolo: string }
  | { tipo: 'erro'; codigo: CodigoDeErro; acao: AcaoDoErro }
  | { tipo: 'nota'; texto: string }

type FaseDoPerto = 'pergunta' | 'confirmando' | 'obrigado' | 'falhou'

// O que esperava o cadastro: o envio do relato ou o "Também vi".
type Pendente = { tipo: 'envio'; categoria: string | null; posicao: Posicao | null } | { tipo: 'perto' }

const PAUSA_DO_PINO_MS = 400

export default function Relatar() {
  const [config, setConfig] = useState<Config | null>(null)
  const [fotos, setFotos] = useState<Foto[]>([])
  const [chegando, setChegando] = useState(0)
  const [video, setVideo] = useState<Video | null>(null)
  const [texto, setTexto] = useState('')
  const [escolha, setEscolha] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)
  const [avisoDaFoto, setAvisoDaFoto] = useState<string | null>(null)
  const [descricao, setDescricao] = useState(false)
  const [perto, setPerto] = useState<Proximo | null>(null)
  const [fasePerto, setFasePerto] = useState<FaseDoPerto>('pergunta')
  const [buscandoPerto, setBuscandoPerto] = useState(false)
  const [folha, setFolha] = useState<{ protocolo: string | null; doPerfil?: boolean } | null>(null)
  const [temConta, setTemConta] = useState(() => tokenSalvo() !== null)
  const [morador, setMorador] = useState<Morador | null>(moradorSalvo)
  const [cadastro, setCadastro] = useState<'inicio' | 'envio' | 'apagada' | null>(null)
  const [perfil, setPerfil] = useState<Aba | null>(null)
  const [doServidor, setDoServidor] = useState<RelatoDoMorador[]>([])
  const [foraDoEscopo, setForaDoEscopo] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [marcarParaEnviar, setMarcarParaEnviar] = useState(false)
  const [seguir, setSeguir] = useState(true)
  const [recentes, setRecentes] = useState<Recente[]>(recentesSalvos)
  const [novoPino, setNovoPino] = useState<string | null>(null)
  const [faseDoMapa, setFaseDoMapa] = useState<FaseDoMapa>('carregando')
  const [som, setSom] = useState(somLigado)
  // Primeiro contato: slides de boas-vindas, cadastro e o tour no mapa,
  // uma vez por aparelho. A Ajuda abre só pelo botão.
  const [vistos] = useState(() => lerVistos((k) => localStorage.getItem(k)))
  const [boasVindas, setBoasVindas] = useState(!vistos.boasVindas)
  const [tourPasso, setTourPasso] = useState<number | null>(null)
  const tourOferecido = useRef(vistos.tour)
  const [ajuda, setAjuda] = useState(false)
  const [aparencia, setAparencia] = useState<Aparencia>(() => {
    try {
      return lerAparencia(localStorage.getItem(CHAVE_BONECO))
    } catch {
      return lerAparencia(null)
    }
  })
  const mudarAparencia = (a: Aparencia) => {
    setAparencia(a)
    try {
      localStorage.setItem(CHAVE_BONECO, gravarAparencia(a))
    } catch {
      // aba privada: vale só nesta visita
    }
  }
  const fecharAjuda = () => setAjuda(false)
  const guardar = (chave: string, valor: string) => {
    try {
      localStorage.setItem(chave, valor)
    } catch {
      // aba privada: mostra de novo na próxima visita
    }
  }
  const fecharBoasVindas = () => {
    setBoasVindas(false)
    guardar(CHAVE_BOAS_VINDAS, 'vista')
  }
  const fecharTour = useCallback(() => {
    setTourPasso(null)
    tourOferecido.current = true
    guardar(CHAVE_TOUR, 'visto')
  }, [])
  const refPerfil = useRef<HTMLButtonElement>(null)
  const refAjuda = useRef<HTMLButtonElement>(null)
  const refCentralizar = useRef<HTMLButtonElement>(null)
  const refMapa = useRef<HTMLElement>(null)
  const alvoDoTour = useCallback((a: Alvo): HTMLElement | null => {
    if (a === 'mapa') return refMapa.current
    if (a === 'centralizar') return refCentralizar.current
    if (a === 'camera') return principal.current
    return refPerfil.current ?? refAjuda.current
  }, [])
  // O gesto certo conclui o passo do tour, com uma pausa para a pessoa ver.
  const passoAtual = useRef<number | null>(null)
  passoAtual.current = tourPasso
  const aoGesto = useCallback((g: Gesto) => {
    const n = passoAtual.current
    if (n === null || !concluiCom(n, g)) return
    passoAtual.current = null
    setTimeout(() => setTourPasso((atual) => (atual === n ? n + 1 : atual)), 700)
  }, [])
  const [orientacao, setOrientacao] = useState<Orientacao>('norte')
  const [orientacaoVez, setOrientacaoVez] = useState(0)
  const [graus, setGraus] = useState(0)
  // Bússola: com o mapa girado, o toque volta o norte; com o norte em cima,
  // alterna para seguir a direção, como no Waze.
  const tocarBussola = () => {
    if (orientacao === 'norte' && Math.abs(graus) < 1) setOrientacao('rumo')
    else setOrientacao('norte')
    setOrientacaoVez((v) => v + 1)
  }
  const [gravaVideo] = useState(() => suportaGravacao(navigator, window))
  // Semente do confete do resolvido; null: sem festa na tela.
  const [festa, setFesta] = useState<number | null>(null)

  const principal = useRef<HTMLButtonElement>(null)
  const tambemVi = useRef<HTMLButtonElement>(null)
  const mapa = useRef<ControleDoMapa>(null)
  const configFinal = useRef<Promise<Config> | null>(null)
  const fotosAtuais = useRef<Foto[]>([])
  const videoAtual = useRef<Video | null>(null)
  const serie = useRef(0)
  // Chave de idempotência: a mesma em toda nova tentativa do mesmo relato.
  const chave = useRef(novoUuid())
  const chaveDoPerto = useRef(novoUuid())
  const consulta = useRef<ConsultaPerto | null>(null)
  const ultimaConsulta = useRef(0)
  const algoAberto = useRef(false)
  const pendente = useRef<Pendente | null>(null)
  const ofereceuCadastro = useRef(false)
  const entendi = useRef<HTMLButtonElement>(null)

  const local = useLocalizacao()
  const voz = useVoz(useCallback((trecho: string) => setTexto((t) => juntarFala(t, trecho)), []))

  const c = config ?? CONFIG_PADRAO
  const midia = c.midia
  const podeGravar = c.modulos.video && midia.video && gravaVideo
  const enviando = progresso !== null
  const temRascunho = fotos.length > 0 || chegando > 0 || video !== null || texto.trim() !== ''
  const seletor = marcarParaEnviar || (pedeMapa(local.situacao) && !local.manual && !enviando)

  useEffect(() => {
    // Funil (ADR 0019): uma vez por visita, sem dado pessoal.
    avisar('funil_abriu')
    prepararSons(['camera', 'foto', 'gravar', 'parar', 'ouvir', 'parou', 'enviado', 'pino', 'tambem_vi', 'resolvido', 'erro'])
    let vivo = true
    const pedido = buscarConfig()
    configFinal.current = pedido
    void pedido.then((cfg) => {
      if (vivo) setConfig(cfg)
    })
    return () => {
      vivo = false
    }
  }, [])

  // Na abertura, os pinos ganham a cor de agora (nível muda depois da triagem).
  useEffect(() => {
    let vivo = true
    for (const r of recentesSalvos().filter((x) => x.chave)) {
      void buscarAcompanhamento(r.protocolo, r.chave!).then((l) => {
        if (!vivo || !('acompanhamento' in l)) return
        const a = l.acompanhamento
        setRecentes((lista) => {
          const nova = lista.map((x) => (x.protocolo === r.protocolo ? recenteAtualizado(x, a) : x))
          salvarRecentes(nova)
          return nova
        })
      })
    }
    return () => {
      vivo = false
    }
  }, [])

  // Avisos do GPS: uma vez cada, com o som de erro quando o seletor aparece.
  useEffect(() => {
    if (local.situacao === 'negado') {
      avisar('gps_negado')
      tocar('erro')
    } else if (local.situacao === 'impreciso') {
      avisar('gps_impreciso', local.atual?.precisao != null ? `${Math.round(local.atual.precisao)} m` : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.situacao])

  // Ao fechar câmera, cartão, descrição, folha, perfil ou cadastro, o foco volta ao botão principal.
  const aberto = camera || descricao || perto !== null || folha !== null || perfil !== null || cadastro !== null || foraDoEscopo || boasVindas
  useEffect(() => {
    if (aberto) algoAberto.current = true
    else if (algoAberto.current) {
      algoAberto.current = false
      principal.current?.focus()
    }
  }, [aberto])

  useEffect(() => {
    if (perto && fasePerto === 'pergunta' && cadastro === null) tambemVi.current?.focus()
  }, [perto, fasePerto, cadastro])

  // Primeira visita: depois dos slides, o cadastro (uma vez por visita).
  const pedeCadastro = config?.modulos.cadastro === true
  useEffect(() => {
    if (!pedeCadastro || temConta || boasVindas || ofereceuCadastro.current) return
    ofereceuCadastro.current = true
    setCadastro('inicio')
  }, [pedeCadastro, temConta, boasVindas])

  // GPS fora da cerca da cidade: o mapa mostra a pessoa onde ela está, no
  // mundo inteiro, e avisa uma vez que os avisos só chegam a esta prefeitura.
  const avisouFora = useRef(false)
  const longe = foraDaCidade(c.caixa, local.atual)
  useEffect(() => {
    if (!longe || avisouFora.current) return
    avisouFora.current = true
    setAviso({ tipo: 'nota', texto: `Você está fora de ${c.cidade}. O mapa mostra onde você está, mas os avisos só chegam à prefeitura de ${c.cidade}.` })
  }, [longe, c.cidade])

  // Depois dos slides e do cadastro, o tour no mapa, uma vez por aparelho,
  // quando o mapa já carregou e nada mais está aberto.
  const esperaCadastro = pedeCadastro && !temConta && !ofereceuCadastro.current
  useEffect(() => {
    // Nem no modo de marcar o lugar (sem GPS): o tour falaria de botões que não estão na tela.
    if (tourOferecido.current || boasVindas || ajuda || aberto || seletor || esperaCadastro || faseDoMapa !== 'pronto') return
    tourOferecido.current = true
    const t = setTimeout(() => setTourPasso(0), 500)
    return () => clearTimeout(t)
  }, [boasVindas, ajuda, aberto, seletor, esperaCadastro, faseDoMapa])

  useEffect(() => {
    if (foraDoEscopo) entendi.current?.focus()
  }, [foraDoEscopo])

  // Esc fecha o cartão, como o toque fora dele.
  const cartaoAberto = perto !== null
  useEffect(() => {
    if (!cartaoAberto || fasePerto === 'confirmando' || cadastro !== null) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPerto(null)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [cartaoAberto, fasePerto, cadastro])

  // Adianta a consulta do "perto" enquanto a pessoa anda, para o cartão abrir na hora.
  const pertoLigado = c.modulos.perto
  const aqui = local.posicao
  useEffect(() => {
    if (!pertoLigado || !aqui) return
    const agora = Date.now()
    if (consultaServe(consulta.current, aqui, agora) || agora - ultimaConsulta.current < 15_000) return
    ultimaConsulta.current = agora
    void buscarPerto(aqui.lat, aqui.lng).then((itens) => {
      consulta.current = { lat: aqui.lat, lng: aqui.lng, em: Date.now(), itens }
    })
  }, [pertoLigado, aqui])

  useEffect(
    () => () => {
      for (const f of fotosAtuais.current) URL.revokeObjectURL(f.url)
      if (videoAtual.current?.capa) URL.revokeObjectURL(videoAtual.current.capa)
    },
    [],
  )

  const guardarRecentes = (lista: Recente[]) => {
    setRecentes(lista)
    salvarRecentes(lista)
  }

  const porFotos = (lista: Foto[]) => {
    fotosAtuais.current = lista
    setFotos(lista)
  }

  const porVideo = (novo: Video | null) => {
    const antigo = videoAtual.current
    if (antigo?.capa && antigo.capa !== novo?.capa) URL.revokeObjectURL(antigo.capa)
    videoAtual.current = novo
    setVideo(novo)
  }

  // Outro conjunto de fotos e vídeo é outro pedido para o servidor.
  const midiasMudaram = () => {
    chave.current = novoUuid()
    setAviso((a) => (a?.tipo === 'erro' ? null : a))
  }

  const limparRascunho = () => {
    for (const f of fotosAtuais.current) URL.revokeObjectURL(f.url)
    porFotos([])
    porVideo(null)
    setChegando(0)
    serie.current++
    setTexto('')
    setEscolha(null)
    setAvisoDaFoto(null)
    voz.parar()
    chave.current = novoUuid()
  }

  const abrirCamera = () => {
    setAvisoDaFoto(null)
    setCamera(true)
  }

  const aoFoto = (bruta: Blob) => {
    avisar('funil_foto')
    const lote = serie.current
    setChegando((n) => n + 1)
    setAvisoDaFoto(null)
    reduzirFoto(bruta).then(
      (blob) => {
        if (lote !== serie.current) return
        setChegando((n) => n - 1)
        porFotos([...fotosAtuais.current, { id: Date.now() + Math.random(), blob, url: URL.createObjectURL(blob) }])
        midiasMudaram()
      },
      () => {
        if (lote !== serie.current) return
        setChegando((n) => n - 1)
        avisar('foto_ilegivel', 'reduzir')
        setAvisoDaFoto(FOTO_ILEGIVEL)
        tocar('erro')
      },
    )
  }

  const removerFoto = (id: number) => {
    const f = fotosAtuais.current.find((x) => x.id === id)
    if (!f) return
    URL.revokeObjectURL(f.url)
    porFotos(fotosAtuais.current.filter((x) => x.id !== id))
    midiasMudaram()
    setAnuncio('Foto removida.')
  }

  const aoVideo = (novo: VideoDoRelato) => {
    const doMeio = novo.quadros[Math.floor(novo.quadros.length / 2)]
    porVideo({ ...novo, capa: doMeio ? URL.createObjectURL(doMeio) : null })
    midiasMudaram()
  }

  const removerVideo = () => {
    porVideo(null)
    midiasMudaram()
    setAnuncio('Vídeo removido.')
  }

  const fecharCamera = () => {
    limparRascunho()
    setAviso(null)
    setCamera(false)
  }

  const enviar = async (categoria: string | null, posicao: Posicao) => {
    const lista = fotosAtuais.current
    if (lista.length === 0 || enviando) return
    const cfg = config ?? (await (configFinal.current ?? buscarConfig()))
    voz.parar()
    setAviso(null)
    // Sem cadastro, o relato espera: o cadastro abre e o envio segue sozinho depois.
    if (cfg.modulos.cadastro && !tokenSalvo()) {
      pedirCadastro({ tipo: 'envio', categoria, posicao })
      return
    }
    setSeguir(true)
    setProgresso({ fase: 'preparando' })
    setAnuncio('Enviando')
    try {
      const r = await enviarRelato({
        fotos: lista.map((f) => f.blob),
        video: videoAtual.current,
        campos: camposDoRelato({ posicao, categoria: cfg.ia_ativa ? categoria || null : categoria, texto }),
        chave: chave.current,
        aoProgredir: setProgresso,
      })
      setProgresso(null)
      pendente.current = null
      avisar('funil_enviou')
      if (r.fora_do_escopo) {
        // Foi para a conferência da prefeitura: aviso claro, sem festa e sem pino no mapa.
        setForaDoEscopo(true)
        setAnuncio('Parece ser dentro de um imóvel. Seu relato foi para a prefeitura conferir.')
      } else {
        tocar('enviado')
        setAviso({ tipo: 'enviado', protocolo: r.protocolo })
        setAnuncio(`Enviado. Protocolo ${r.protocolo}`)
      }
      limparRascunho()
      local.soltarManual()
      consulta.current = null
      const ponto: Ponto | null = r.fora_do_escopo ? null : { lat: posicao.lat, lng: posicao.lng }
      // O pino nasce um instante depois da confirmação, com o próprio som.
      setTimeout(() => {
        setRecentes((antes) => {
          const nova = mesclarRecentes(antes, recenteDaResposta(r, ponto))
          salvarRecentes(nova)
          return nova
        })
        if (ponto) {
          setNovoPino(r.protocolo)
          tocar('pino')
        }
      }, PAUSA_DO_PINO_MS)
    } catch (e) {
      setProgresso(null)
      const codigo = e instanceof FalhaDeEnvio ? e.codigo : 'desconhecido'
      const acao = acaoDoErro(codigo)
      if (acao === 'cadastro') {
        // Token velho ou ausente: nada foi criado, o relato espera o cadastro.
        esquecerConta()
        setTemConta(false)
        pedirCadastro({ tipo: 'envio', categoria, posicao })
        return
      }
      avisar('envio_falhou', codigo)
      tocar('erro')
      // Só a falha de rede repete com a mesma chave; o resto muda o relato.
      if (acao !== 'repetir') chave.current = novoUuid()
      if (acao === 'outra_foto') {
        for (const f of fotosAtuais.current) URL.revokeObjectURL(f.url)
        porFotos([])
      }
      if (acao === 'sem_video') porVideo(null)
      setAviso({ tipo: 'erro', codigo, acao })
      setAnuncio(mensagemDeErro(codigo, cfg.cidade, cfg.midia))
    }
  }

  // Depois do tipo: falta o lugar? O mapa vira o seletor e o "É aqui" envia.
  const seguirParaEnvio = (categoria: string | null, posicao: Posicao | null = local.posicao) => {
    if (!posicao) {
      setMarcarParaEnviar(true)
      setSeguir(false)
      setAnuncio('Arraste o mapa até o lugar do problema e toque em É aqui.')
      return
    }
    void enviar(categoria, posicao)
  }

  // Depois da câmera vem a folha "O que é o problema?". A config já chegou
  // (ou caiu no padrão): ela diz se o tipo é obrigatório.
  const aoEnviarDaCamera = async () => {
    if (!config) await (configFinal.current ?? buscarConfig())
    setCamera(false)
    setDescricao(true)
  }

  const aoEnviarDescricao = (categoria: string | null) => {
    setEscolha(categoria)
    setDescricao(false)
    seguirParaEnvio(categoria ?? (c.ia_ativa ? '' : null))
  }

  const pedirCadastro = (p: Pendente) => {
    pendente.current = p
    setCadastro('envio')
    setAnuncio('Para enviar, faça seu cadastro.')
  }

  const aoCadastrado = (m: Morador) => {
    avisar('funil_cadastro')
    setMorador(m)
    setTemConta(true)
    setCadastro(null)
    setAnuncio(`Cadastro feito. Olá, ${m.nome}.`)
    const p = pendente.current
    pendente.current = null
    if (p?.tipo === 'envio') {
      if (p.posicao) void enviar(p.categoria, p.posicao)
      else seguirParaEnvio(p.categoria)
    } else if (p?.tipo === 'perto') {
      void confirmar()
    }
  }

  const fecharCadastro = () => {
    setCadastro(null)
    const p = pendente.current
    // O relato continua guardado; o aviso traz o botão para voltar ao cadastro.
    if (p?.tipo === 'envio') setAviso({ tipo: 'erro', codigo: 'cadastro_obrigatorio', acao: 'cadastro' })
    if (p?.tipo === 'perto') pendente.current = null
  }

  const eAqui = () => {
    const centro = mapa.current?.centro()
    if (!centro) return
    local.marcar(centro.lat, centro.lng)
    if (marcarParaEnviar) {
      setMarcarParaEnviar(false)
      void enviar(escolha ?? (c.ia_ativa ? '' : null), { lat: centro.lat, lng: centro.lng, precisao: null, manual: true })
    } else {
      setSeguir(true)
    }
  }

  const aoPrincipal = async () => {
    if (enviando || buscandoPerto) return
    if (seletor) {
      eAqui()
      return
    }
    if (temRascunho || !c.modulos.perto || !local.posicao) {
      abrirCamera()
      return
    }
    const ponto = local.posicao
    let itens: Proximo[]
    if (consultaServe(consulta.current, ponto, Date.now())) {
      itens = consulta.current!.itens
    } else {
      setBuscandoPerto(true)
      itens = await buscarPerto(ponto.lat, ponto.lng)
      setBuscandoPerto(false)
      consulta.current = { lat: ponto.lat, lng: ponto.lng, em: Date.now(), itens }
    }
    const item = escolherPerto(itens)
    if (!item) {
      abrirCamera()
      return
    }
    chaveDoPerto.current = novoUuid()
    setFasePerto('pergunta')
    setPerto(item)
  }

  const confirmar = async () => {
    const item = perto
    const ponto = local.posicao
    if (!item || !ponto || fasePerto === 'confirmando') return
    if (c.modulos.cadastro && !tokenSalvo()) {
      pendente.current = { tipo: 'perto' }
      setCadastro('envio')
      return
    }
    setFasePerto('confirmando')
    const r = await confirmarPerto(item.ref, ponto.lat, ponto.lng, chaveDoPerto.current)
    if ('resposta' in r) {
      tocar('tambem_vi')
      setFasePerto('obrigado')
      setAnuncio('Obrigado')
      consulta.current = null
      const novo = { ...recenteDaResposta(r.resposta, { lat: ponto.lat, lng: ponto.lng }), categoria: item.categoria }
      guardarRecentes(mesclarRecentes(recentes, novo))
      setNovoPino(r.resposta.protocolo)
      setTimeout(() => setPerto(null), 1400)
      return
    }
    const depois = depoisDaConfirmacao(r.codigo)
    if (depois === 'cadastro') {
      esquecerConta()
      setTemConta(false)
      setFasePerto('pergunta')
      pendente.current = { tipo: 'perto' }
      setCadastro('envio')
    } else if (depois === 'camera') {
      setPerto(null)
      abrirCamera()
    } else if (depois === 'avisar') {
      setPerto(null)
      setAviso({ tipo: 'nota', texto: mensagemDaConfirmacao(r.codigo) })
    } else {
      tocar('erro')
      setFasePerto('falhou')
    }
  }

  const aoAtualizar = useCallback((protocolo: string, a: Acompanhamento) => {
    setRecentes((lista) => {
      const nova = lista.map((r) => {
        if (r.protocolo !== protocolo) return r
        const atual = recenteAtualizado(r, a)
        if (estreiaResolvido(r, a)) {
          tocar('resolvido')
          setFesta(Date.now())
          return { ...atual, viuResolvido: true }
        }
        return atual
      })
      salvarRecentes(nova)
      return nova
    })
  }, [])

  const fecharFolha = useCallback(() => setFolha(null), [])

  const alternarSom = () => {
    const ligado = !somLigado()
    ligarSom(ligado)
    setSom(ligado)
  }

  const pinos = useMemo(
    () =>
      pinosDosRecentes(recentes).map((r) => ({
        protocolo: r.protocolo,
        lat: r.lat,
        lng: r.lng,
        nivel: r.nivel,
        rotulo: `Seu relato ${r.protocolo}, ${nomeDoNivel(r.nivel)}. Ver andamento`,
      })),
    [recentes],
  )

  const pct = progresso ? (progresso.fase === 'preparando' ? 0 : porcentagem(progresso) / 100) : 0
  const marco = progresso ? marcoDoEnvio(progresso) : ''
  useEffect(() => {
    if (marco) setAnuncio(marco)
  }, [marco])

  const acaoDoAviso = (a: Extract<Aviso, { tipo: 'erro' }>) => {
    if (a.acao === 'repetir' || a.acao === 'sem_video') return () => seguirParaEnvio(escolha)
    if (a.acao === 'mapa') {
      return () => {
        setAviso(null)
        setMarcarParaEnviar(true)
        setSeguir(false)
      }
    }
    if (a.acao === 'cadastro') {
      return () => {
        setAviso(null)
        if (!pendente.current) pendente.current = { tipo: 'envio', categoria: escolha ?? (c.ia_ativa ? '' : null), posicao: null }
        setCadastro('envio')
      }
    }
    return () => {
      setAviso(null)
      abrirCamera()
    }
  }

  const rotuloDaAcao = (a: Extract<Aviso, { tipo: 'erro' }>) => {
    if (a.acao === 'repetir' || a.acao === 'sem_video') return rotuloDoEnvio(a.acao, fotos.length)
    if (a.acao === 'mapa') return 'Marcar no mapa'
    if (a.acao === 'cadastro') return 'Fazer cadastro'
    return 'Abrir câmera'
  }

  useEffect(() => {
    if (festa === null) return
    const t = setTimeout(() => setFesta(null), 2200)
    return () => clearTimeout(t)
  }, [festa])

  // O aviso de enviado some sozinho; o de erro fica até a pessoa agir.
  useEffect(() => {
    if (aviso?.tipo !== 'enviado' && aviso?.tipo !== 'nota') return
    const t = setTimeout(() => setAviso(null), aviso.tipo === 'enviado' ? 6000 : 12000)
    return () => clearTimeout(t)
  }, [aviso])

  const rascunho = fotos.length + (video ? 1 : 0)

  // Cartão ou folha abertos cobrem o mapa: os botões do topo saem de cena.
  const cobre = perto !== null || folha !== null || ajuda || perfil !== null || cadastro !== null || descricao || foraDoEscopo || boasVindas
  const mostraPerfil = c.modulos.cadastro || temConta

  // Relatos de outro aparelho entram na folha do andamento, mas só os
  // guardados aqui têm o lugar para virar pino.
  const paraFolha = useMemo(() => unirRelatos(recentes, doServidor), [recentes, doServidor])

  const aoRelatosDoServidor = useCallback((lista: RelatoDoMorador[]) => {
    setDoServidor(lista)
    setRecentes((antes) => {
      const nova = atualizarRecentes(antes, lista)
      salvarRecentes(nova)
      return nova
    })
  }, [])

  const semConta = useCallback(() => {
    setTemConta(false)
    setMorador(null)
    setDoServidor([])
  }, [])

  const fecharPerfil = useCallback(() => setPerfil(null), [])

  return (
    <div className="tela">
      <main ref={refMapa} className="tela-mapa" inert={aberto}>
        <h1 className="escondido">MOGI, relatar um problema da rua</h1>
        <MapaVivo
          ref={mapa}
          inicio={c.centro}
          posicao={local.atual}
          seguir={seguir}
          aoArrastar={() => setSeguir(false)}
          pinos={pinos}
          novo={novoPino}
          aoTocarPino={(protocolo) => setFolha({ protocolo })}
          seletor={seletor}
          aoFalhar={(detalhe) => avisar('mapa_falhou', detalhe)}
          aoMudarFase={setFaseDoMapa}
          orientacao={orientacao}
          orientacaoVez={orientacaoVez}
          aoGirar={setGraus}
          aoGesto={aoGesto}
          aparencia={aparencia}
        />

        {!cobre && (
          <div className="topo">
            <span className="botao-mapa marca" role="img" aria-label="MOGI">
              <IconeMogi tamanho={30} />
            </span>
            <div className="coluna">
              {mostraPerfil && (
                <button ref={refPerfil} type="button" className="botao-mapa" aria-label="Perfil" onClick={() => setPerfil('perfil')}>
                  <IconePessoa />
                </button>
              )}
              {!mostraPerfil && recentes.length > 0 && (
                <button type="button" className="botao-mapa" aria-label={`Meus relatos, ${recentes.length}`} onClick={() => setFolha({ protocolo: null })}>
                  <IconeLista />
                  <span className="contador" aria-hidden="true">
                    {recentes.length}
                  </span>
                </button>
              )}
              <button ref={refAjuda} type="button" className="botao-mapa" aria-label="Ajuda: como usar" onClick={() => setAjuda(true)}>
                <IconeAjuda />
              </button>
              <button
                type="button"
                className={`botao-mapa${orientacao === 'rumo' ? ' bussola-rumo' : ''}`}
                aria-label={orientacao === 'rumo' ? 'Bússola: seguindo a sua direção. Toque para norte em cima' : Math.abs(graus) >= 1 ? 'Bússola: voltar o norte para cima' : 'Bússola: seguir a sua direção'}
                onClick={tocarBussola}
              >
                <IconeBussola graus={graus} />
              </button>
              <button type="button" className="botao-mapa" aria-label="Som" aria-pressed={som} onClick={alternarSom}>
                {som ? <IconeSom /> : <IconeSemSom />}
              </button>
              {!seguir && !seletor && local.atual && (
                <button ref={refCentralizar} type="button" className="botao-mapa" aria-label="Centralizar em mim" onClick={() => setSeguir(true)}>
                  <IconeMira />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="doca">
          {aviso && (
            <div key={aviso.tipo === 'enviado' ? aviso.protocolo : aviso.tipo} className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
              {aviso.tipo === 'enviado' && (
                <button type="button" className="aviso-toque" onClick={() => setFolha({ protocolo: aviso.protocolo })}>
                  <span className="aviso-icone">
                    <IconeCerto tamanho={18} desenha />
                  </span>
                  <span className="aviso-linhas">
                    <strong>Enviado</strong>
                    <span className="protocolo">{aviso.protocolo}</span>
                  </span>
                  <span className="aviso-ver" aria-hidden="true">
                    Ver
                  </span>
                </button>
              )}
              {aviso.tipo === 'nota' && <p className="aviso-texto">{aviso.texto}</p>}
              {aviso.tipo === 'erro' && (
                <>
                  <p className="aviso-texto">{mensagemDeErro(aviso.codigo, c.cidade, midia)}</p>
                  {(aviso.acao !== 'sem_video' && aviso.acao !== 'repetir') || fotos.length > 0 ? (
                    <button type="button" className="aviso-acao" onClick={acaoDoAviso(aviso)}>
                      {rotuloDaAcao(aviso)}
                    </button>
                  ) : null}
                </>
              )}
              {aviso.tipo !== 'enviado' && (
                <button type="button" className="aviso-x" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
                  <IconeFechar tamanho={18} />
                </button>
              )}
            </div>
          )}

          {seletor && (
            <p className="seletor-dica" role="status">
              {faseDoMapa === 'falhou' ? 'Sem mapa agora' : local.atual ? 'Arraste até o lugar' : 'Sem a sua localização: arraste até o lugar'}
            </p>
          )}

          {seletor ? (
            <button
              ref={principal}
              type="button"
              className="botao-aqui"
              disabled={faseDoMapa !== 'pronto'}
              aria-label="É aqui. Marcar o lugar do problema"
              onClick={eAqui}
            >
              <IconeCerto tamanho={24} />
              É aqui
            </button>
          ) : (
            <button
              ref={principal}
              type="button"
              className={`principal${enviando ? ' enviando' : ''}`}
              aria-label={
                progresso
                  ? falaDoEnvio(progresso)
                  : buscandoPerto
                    ? 'Abrindo'
                    : rascunho > 0
                      ? `Continuar o relato, ${rascunho} ${rascunho === 1 ? 'captura pronta' : 'capturas prontas'}`
                      : 'Fotografar o problema'
              }
              aria-disabled={enviando || buscandoPerto}
              onClick={() => void aoPrincipal()}
            >
              {(enviando || buscandoPerto) && <Anel fracao={progresso?.fase === 'enviando' ? pct : null} tamanho={92} />}
              <span className="principal-disco">
                <IconeCamera tamanho={40} />
              </span>
              {rascunho > 0 && !enviando && (
                <span className="contador principal-conta" aria-hidden="true">
                  {rascunho}
                </span>
              )}
            </button>
          )}
        </div>

        <p className="escondido" aria-live="polite">
          {anuncio}
        </p>
      </main>

      {perto && (
        <div
          className="cartao-fundo"
          onClick={(e) => {
            // Toque fora do cartão fecha, como o "É outro" sem a câmera.
            if (e.target === e.currentTarget && fasePerto !== 'confirmando') setPerto(null)
          }}
        >
          <section className="cartao-perto" role="dialog" aria-modal="true" aria-labelledby="perto-titulo" aria-describedby="perto-sub">
            {fasePerto === 'obrigado' ? (
              <p className="cartao-obrigado" id="perto-titulo">
                <span className="aviso-icone">
                  <IconeCerto tamanho={24} desenha />
                </span>
                Obrigado
              </p>
            ) : (
              <>
                <div className="cartao-cabeca">
                  <span className="cartao-icone">
                    <IconeDoTipo id={perto.categoria} tamanho={28} />
                  </span>
                  <div className="cartao-textos">
                    <p className="cartao-rotulo">Já relataram aqui</p>
                    <p id="perto-titulo" className="cartao-titulo">
                      {nomeCurto(perto.categoria, perto.categoria_nome)}
                    </p>
                    <p id="perto-sub" className="cartao-sub">
                      {distanciaCurta(perto.distancia_m)} · {pessoas(perto.relatos)}
                    </p>
                  </div>
                </div>
                {fasePerto === 'falhou' && (
                  <p className="cartao-erro" role="alert">
                    {mensagemDaConfirmacao('sem_conexao')}
                  </p>
                )}
                <div className="cartao-botoes">
                  <button
                    ref={tambemVi}
                    type="button"
                    className="botao botao-primario"
                    disabled={fasePerto === 'confirmando'}
                    onClick={() => void confirmar()}
                  >
                    {fasePerto === 'confirmando' ? <span className="girando girando-claro" aria-hidden="true" /> : <IconeCerto tamanho={20} />}
                    Também vi
                  </button>
                  <button
                    type="button"
                    className="botao botao-secundario"
                    disabled={fasePerto === 'confirmando'}
                    onClick={() => {
                      setPerto(null)
                      abrirCamera()
                    }}
                  >
                    <IconeCamera tamanho={20} />É outro
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {descricao && (
        <Descricao
          capa={fotos[0]?.url ?? video?.capa ?? null}
          categorias={c.categorias}
          escolha={escolha}
          aoEscolher={setEscolha}
          exigeTipo={!c.ia_ativa}
          texto={texto}
          aoTexto={setTexto}
          voz={voz}
          vozLigada={c.modulos.voz}
          aoEnviar={aoEnviarDescricao}
          aoVoltar={() => {
            voz.parar()
            setDescricao(false)
            setCamera(true)
          }}
        />
      )}

      {camera && (
        <Camera
          midia={midia}
          podeGravar={podeGravar}
          fotos={fotos}
          chegando={chegando}
          video={video}
          temRascunho={temRascunho}
          avisoDeFora={avisoDaFoto}
          aoFoto={aoFoto}
          aoVideo={aoVideo}
          aoRemoverFoto={removerFoto}
          aoRemoverVideo={removerVideo}
          aoEnviar={() => void aoEnviarDaCamera()}
          aoFechar={fecharCamera}
          fala={null}
        />
      )}

      {festa !== null && <Confete key={festa} semente={festa} />}

      {foraDoEscopo && (
        <div className="cartao-fundo">
          <section className="cartao-perto" role="alertdialog" aria-modal="true" aria-labelledby="fora-titulo" aria-describedby="fora-texto">
            <div className="cartao-cabeca">
              <span className="cartao-icone">
                <IconeBairro tamanho={28} />
              </span>
              <p id="fora-titulo" className="cartao-titulo">
                Parece ser dentro de um imóvel
              </p>
            </div>
            <p id="fora-texto" className="cartao-texto">
              A prefeitura atende rua, calçada, praça e espaços públicos. Seu relato foi para a prefeitura conferir.
            </p>
            <button ref={entendi} type="button" className="botao botao-primario" onClick={() => setForaDoEscopo(false)}>
              Entendi
            </button>
          </section>
        </div>
      )}

      {ajuda && (
        <Ajuda
          aoFechar={fecharAjuda}
          aoVerTour={() => {
            setAjuda(false)
            setTourPasso(0)
          }}
          aoVerBoasVindas={() => {
            setAjuda(false)
            setBoasVindas(true)
          }}
          cadastro={c.modulos.cadastro}
        />
      )}
      {boasVindas && <BoasVindas aoTerminar={fecharBoasVindas} />}
      {tourPasso !== null && !aberto && !ajuda && !seletor && <Tour passo={tourPasso} alvo={alvoDoTour} aoMudar={setTourPasso} aoFechar={fecharTour} />}
      {folha && (
        <Folha
          recentes={paraFolha}
          protocolo={folha.protocolo}
          aoEscolher={(protocolo) => setFolha({ protocolo })}
          aoFechar={fecharFolha}
          aoAtualizar={aoAtualizar}
          aoVoltar={
            folha.doPerfil
              ? () => {
                  setFolha(null)
                  setPerfil('perfil')
                }
              : undefined
          }
        />
      )}
      {perfil && (
        <Perfil
          aba={perfil}
          aoTrocarAba={setPerfil}
          temConta={temConta}
          morador={morador}
          ponto={local.posicao ?? c.centro}
          aoMorador={setMorador}
          aoRelatos={aoRelatosDoServidor}
          aoAbrirRelato={(protocolo) => {
            setPerfil(null)
            setFolha({ protocolo, doPerfil: true })
          }}
          aoCadastrar={() => {
            setPerfil(null)
            setCadastro('inicio')
          }}
          aoSemConta={semConta}
          aoSair={() => {
            esquecerConta()
            semConta()
            setPerfil(null)
            setAviso({ tipo: 'nota', texto: 'Você saiu deste aparelho.' })
          }}
          aoApagada={() => {
            semConta()
            guardarRecentes([])
            setPerfil(null)
            // Sem conta, não dá para relatar: o próximo passo é o cadastro.
            if (c.modulos.cadastro) setCadastro('apagada')
            else setAviso({ tipo: 'nota', texto: 'Sua conta foi apagada.' })
          }}
          aoFechar={fecharPerfil}
          aparencia={aparencia}
          aoAparencia={mudarAparencia}
        />
      )}
      {cadastro && (
        <Cadastro
          motivo={cadastro}
          ponto={local.atual}
          cidade={c.cidade}
          recuperacao={c.modulos.recuperacao}
          aoEstilo={(estilo) => mudarAparencia({ ...aparencia, estilo })}
          aoPronto={aoCadastrado}
          aoFechar={fecharCadastro}
        />
      )}
    </div>
  )
}
