import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as EventoDePonteiro, ReactNode } from 'react'
import { tocar } from '../sons'
import { avisar } from './envio'
import type { VideoDoRelato } from './envio'
import {
  anuncioDaGravacao,
  avisoDoDefeito,
  defeitoDoVideo,
  dimensoesReduzidas,
  duracaoPorExtenso,
  escolherQuadros,
  formatarDuracao,
  instantesDosQuadros,
  intervaloDosQuadros,
  LADO_DO_QUADRO,
  PRIMEIRO_QUADRO_MS,
  SEGURAR_MS,
  segundosRestantes,
  SEM_GRAVACAO,
  tipoDeGravacao,
  tipoSemCodec,
  VIDEO_MINIMO_MS,
} from './logica'
import type { LimitesDeMidia } from './logica'
import { Anel, IconeCamera, IconeEnviar, IconeFechar, IconeTocar } from './pecas'

export interface Miniatura {
  id: number
  url: string
}

interface Props {
  midia: LimitesDeMidia
  // Vídeo ligado na cidade e navegador que grava direto da câmera.
  podeGravar: boolean
  fotos: Miniatura[]
  chegando: number
  video: { duracaoMs: number; capa: string | null } | null
  temRascunho: boolean
  aoFoto: (foto: Blob) => void
  aoVideo: (video: VideoDoRelato) => void
  aoRemoverFoto: (id: number) => void
  aoRemoverVideo: () => void
  aoEnviar: () => void
  // Fecha e descarta o que foi capturado (a confirmação já foi feita aqui).
  aoFechar: () => void
  // Botão do microfone e bolha do texto, desenhados pelo Relatar.
  fala: ReactNode
  // Aviso que vem de fora, como a foto que não deu para ler.
  avisoDeFora: string | null
}

type Fase = 'abrindo' | 'pronta' | 'gravando' | 'fechando' | 'sem_camera'

interface Quadro {
  ms: number
  blob: Blob
}

interface Sessao {
  gravador: MediaRecorder
  pedacos: Blob[]
  inicio: number
  fim: number
  relogio: number
  proximoQuadro: number
  quadros: Quadro[]
  capturas: Promise<void>[]
  ultimoRestante: number
}

const QUALIDADE_DA_FOTO = 0.92
const QUALIDADE_DO_QUADRO = 0.8
const BITS_POR_SEGUNDO = 1_500_000
const TIQUE_MS = 100
const PRAZO_FECHAR_MS = 4000
const PRAZO_ABRIR_MS = 3000
const PRAZO_SALTO_MS = 1500

// Câmera traseira, sempre sem áudio: o relato não grava a voz de ninguém.
function abrirCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  })
}

function pararCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}

// Quadro do vídeo agora, em JPEG, no lado maior pedido.
function capturar(video: HTMLVideoElement, tela: HTMLCanvasElement, lado: number, qualidade: number): Promise<Blob | null> {
  const { largura, altura } = dimensoesReduzidas(video.videoWidth, video.videoHeight, lado)
  if (largura === 0 || altura === 0) return Promise.resolve(null)
  try {
    tela.width = largura
    tela.height = altura
    const ctx = tela.getContext('2d')
    if (!ctx) return Promise.resolve(null)
    ctx.drawImage(video, 0, 0, largura, altura)
    return new Promise((ok) => tela.toBlob(ok, 'image/jpeg', qualidade))
  } catch {
    return Promise.resolve(null)
  }
}

// Reserva para quando nenhum quadro foi guardado durante a gravação.
async function extrairQuadros(video: Blob, duracaoMs: number, maximo: number): Promise<Blob[]> {
  const instantes = instantesDosQuadros(duracaoMs, maximo)
  if (instantes.length === 0) return []
  const url = URL.createObjectURL(video)
  const el = document.createElement('video')
  el.muted = true
  el.playsInline = true
  el.preload = 'auto'
  const tela = document.createElement('canvas')
  const esperar = (evento: string, prazo: number) =>
    new Promise<boolean>((ok) => {
      const fim = (valeu: boolean) => {
        clearTimeout(timer)
        el.removeEventListener(evento, sim)
        el.removeEventListener('error', nao)
        ok(valeu)
      }
      const sim = () => fim(true)
      const nao = () => fim(false)
      const timer = setTimeout(nao, prazo)
      el.addEventListener(evento, sim)
      el.addEventListener('error', nao)
    })
  const quadros: Blob[] = []
  try {
    const abriu = esperar('loadeddata', PRAZO_ABRIR_MS)
    el.src = url
    el.load()
    if (!(await abriu)) return []
    for (const ms of instantes) {
      const chegou = esperar('seeked', PRAZO_SALTO_MS)
      el.currentTime = ms / 1000
      if (!(await chegou)) break
      const q = await capturar(el, tela, LADO_DO_QUADRO, QUALIDADE_DO_QUADRO)
      if (q) quadros.push(q)
    }
  } catch {
    /* fica com o que já saiu */
  } finally {
    el.removeAttribute('src')
    el.load()
    URL.revokeObjectURL(url)
    tela.width = tela.height = 0
  }
  return quadros
}

// Câmera traseira em tela cheia: tocar tira foto, segurar grava vídeo.
export default function Camera(props: Props) {
  const { midia, podeGravar, fotos, chegando, video, temRascunho, fala } = props
  const [fase, setFase] = useState<Fase>(() =>
    typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'abrindo' : 'sem_camera',
  )
  const [tentativa, setTentativa] = useState(0)
  const [decorrido, setDecorrido] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [flash, setFlash] = useState(0)
  const [confirmando, setConfirmando] = useState(false)
  // Tira de miniaturas aberta: a miniatura ao lado do disparador alterna.
  const [tira, setTira] = useState(true)

  const previa = useRef<HTMLVideoElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const camera = useRef<MediaStream | null>(null)
  const sessao = useRef<Sessao | null>(null)
  const tela = useRef<HTMLCanvasElement | null>(null)
  const segurar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const apertado = useRef(false)
  const vivo = useRef(true)
  const pausada = useRef(false)
  const atual = useRef(props)

  useEffect(() => {
    atual.current = props
  })

  const cheio = fotos.length + chegando >= midia.fotos_max
  const gravaAgora = podeGravar && !video
  const gravando = fase === 'gravando'

  const mostrarAviso = (frase: string) => {
    setAviso(frase)
    tocar('erro')
  }

  const soltarCamera = () => {
    pararCamera(camera.current)
    camera.current = null
    if (previa.current) previa.current.srcObject = null
  }

  const descartarSessao = () => {
    const s = sessao.current
    if (!s) return
    sessao.current = null
    clearInterval(s.relogio)
    try {
      if (s.gravador.state !== 'inactive') s.gravador.stop()
    } catch {
      /* já parado */
    }
  }

  const concluir = async (s: Sessao) => {
    if (sessao.current !== s) return
    sessao.current = null
    clearInterval(s.relogio)
    if (!s.fim) s.fim = performance.now()
    await Promise.all(s.capturas)
    if (!vivo.current) return
    setFase(camera.current ? 'pronta' : 'abrindo')
    setDecorrido(0)
    setAnuncio('')
    const duracaoMs = Math.round(s.fim - s.inicio)
    const tipo = tipoSemCodec(s.gravador.mimeType || s.pedacos[0]?.type || 'video/webm')
    const blob = new Blob(s.pedacos, { type: tipo })
    const defeito = defeitoDoVideo(blob.size, duracaoMs, atual.current.midia)
    if (defeito) {
      avisar('video_falhou', defeito)
      mostrarAviso(defeito === 'vazio' ? SEM_GRAVACAO : avisoDoDefeito(defeito))
      return
    }
    const maximo = atual.current.midia.quadros_max
    const ordenados = s.quadros.sort((a, b) => a.ms - b.ms)
    let quadros = escolherQuadros(
      ordenados.map((q) => q.ms),
      duracaoMs,
      maximo,
    ).map((i) => ordenados[i].blob)
    if (quadros.length === 0 && maximo > 0) quadros = await extrairQuadros(blob, duracaoMs, maximo)
    if (!vivo.current) return
    atual.current.aoVideo({ blob, duracaoMs, quadros })
    setAnuncio(`Vídeo de ${duracaoPorExtenso(duracaoMs)} adicionado.`)
  }

  const pararGravacao = () => {
    const s = sessao.current
    if (!s || s.fim) return
    // Vídeo curto demais não serve: segue gravando até o mínimo.
    const falta = s.inicio + VIDEO_MINIMO_MS + 150 - performance.now()
    if (falta > 0) {
      setTimeout(pararGravacao, falta)
      return
    }
    s.fim = performance.now()
    clearInterval(s.relogio)
    setFase('fechando')
    tocar('parar')
    try {
      s.gravador.stop()
    } catch {
      void concluir(s)
      return
    }
    setTimeout(() => void concluir(s), PRAZO_FECHAR_MS)
  }

  const tique = (s: Sessao) => {
    const limite = atual.current.midia.video_segundos
    const passou = performance.now() - s.inicio
    setDecorrido(passou)
    const restam = segundosRestantes(passou, limite)
    if (restam !== s.ultimoRestante) {
      s.ultimoRestante = restam
      const frase = anuncioDaGravacao(restam, limite)
      if (frase) setAnuncio(frase)
    }
    const v = previa.current
    if (v && passou >= s.proximoQuadro) {
      s.proximoQuadro += intervaloDosQuadros(limite)
      tela.current ??= document.createElement('canvas')
      s.capturas.push(
        capturar(v, tela.current, LADO_DO_QUADRO, QUALIDADE_DO_QUADRO).then((q) => {
          if (q) s.quadros.push({ ms: passou, blob: q })
        }),
      )
    }
    if (passou >= limite * 1000) pararGravacao()
  }

  const gravar = () => {
    const stream = camera.current
    if (!stream || sessao.current) return
    setAviso(null)
    try {
      const tipo = tipoDeGravacao((t) => MediaRecorder.isTypeSupported(t))
      const gravador = new MediaRecorder(stream, { videoBitsPerSecond: BITS_POR_SEGUNDO, ...(tipo ? { mimeType: tipo } : {}) })
      const s: Sessao = {
        gravador,
        pedacos: [],
        inicio: performance.now(),
        fim: 0,
        relogio: 0,
        proximoQuadro: PRIMEIRO_QUADRO_MS,
        quadros: [],
        capturas: [],
        ultimoRestante: -1,
      }
      gravador.ondataavailable = (e) => {
        if (e.data.size > 0) s.pedacos.push(e.data)
      }
      gravador.onstart = () => {
        s.inicio = performance.now()
      }
      gravador.onstop = () => void concluir(s)
      gravador.onerror = () => {
        if (sessao.current !== s) return
        descartarSessao()
        setFase('pronta')
        avisar('video_falhou', 'gravador')
        mostrarAviso(SEM_GRAVACAO)
      }
      gravador.start(1000)
      sessao.current = s
      s.relogio = window.setInterval(() => tique(s), TIQUE_MS)
      setDecorrido(0)
      setFase('gravando')
      tocar('gravar')
      // Se a pessoa já soltou o dedo enquanto o gravador abria, para no mínimo.
      if (!apertado.current) pararGravacao()
    } catch (e) {
      descartarSessao()
      avisar('video_falhou', e)
      mostrarAviso(SEM_GRAVACAO)
    }
  }

  const tirarFoto = async () => {
    if (cheio) {
      setAnuncio(midia.fotos_max > 1 ? `Até ${midia.fotos_max} fotos.` : 'Só cabe uma foto.')
      return
    }
    const v = previa.current
    if (!v || fase !== 'pronta') return
    tela.current ??= document.createElement('canvas')
    const foto = await capturar(v, tela.current, Math.max(v.videoWidth, v.videoHeight), QUALIDADE_DA_FOTO)
    if (!vivo.current) return
    if (!foto) {
      avisar('foto_ilegivel', 'quadro')
      mostrarAviso('Não consegui tirar a foto. Tente de novo.')
      return
    }
    setFlash((f) => f + 1)
    tocar('foto')
    atual.current.aoFoto(foto)
    setAnuncio(`Foto ${fotos.length + chegando + 1} tirada.`)
  }

  // Toque tira foto; segurar grava vídeo, e soltar para.
  const aoApertar = (e: EventoDePonteiro<HTMLButtonElement>) => {
    if (e.button !== 0 || fase !== 'pronta') return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* sem captura do ponteiro: segue igual */
    }
    apertado.current = true
    clearTimeout(segurar.current)
    if (gravaAgora) {
      segurar.current = setTimeout(() => {
        segurar.current = undefined
        if (apertado.current) gravar()
      }, SEGURAR_MS)
    }
  }

  const aoSoltar = () => {
    if (!apertado.current) return
    apertado.current = false
    if (sessao.current) {
      pararGravacao()
      return
    }
    if (segurar.current !== undefined || !gravaAgora) {
      clearTimeout(segurar.current)
      segurar.current = undefined
      void tirarFoto()
    }
  }

  const aoCancelar = () => {
    apertado.current = false
    clearTimeout(segurar.current)
    segurar.current = undefined
    if (sessao.current) pararGravacao()
  }

  const fechar = () => {
    if (sessao.current) return
    if (temRascunho) setConfirmando(true)
    else atual.current.aoFechar()
  }

  const aoEscolherArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    const vagas = Math.max(0, midia.fotos_max - fotos.length - chegando)
    for (const a of arquivos.slice(0, vagas)) atual.current.aoFoto(a)
  }

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
      clearTimeout(segurar.current)
      descartarSessao()
      soltarCamera()
      if (tela.current) tela.current.width = tela.current.height = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Liga a câmera; sem acesso, fica a câmera do aparelho pelo campo de arquivo.
  useEffect(() => {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      avisar('camera_negada', 'sem_getusermedia')
      return
    }
    let cancelado = false
    let minha: MediaStream | null = null
    const aoPerder = () => {
      if (cancelado) return
      if (sessao.current) pararGravacao()
      soltarCamera()
      setFase('abrindo')
      setTentativa((t) => t + 1)
    }
    abrirCamera().then(
      (stream) => {
        if (cancelado || document.hidden) {
          pararCamera(stream)
          if (!cancelado) pausada.current = true
          return
        }
        minha = stream
        camera.current = stream
        stream.getVideoTracks()[0]?.addEventListener('ended', aoPerder)
        const v = previa.current
        if (v) {
          v.srcObject = stream
          void v.play().catch(() => {})
        }
        setFase('pronta')
        tocar('camera')
      },
      (e: unknown) => {
        if (cancelado) return
        avisar('camera_negada', e)
        setFase('sem_camera')
      },
    )
    return () => {
      cancelado = true
      minha?.getVideoTracks()[0]?.removeEventListener('ended', aoPerder)
      pararCamera(minha)
      if (camera.current === minha) camera.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa])

  // Foco no disparador ao abrir; no modo sem câmera, no botão de abrir.
  const semCamera = fase === 'sem_camera'
  const pronta = fase === 'pronta'
  useEffect(() => {
    if (pronta || semCamera) disparador.current?.focus()
  }, [semCamera, pronta])

  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    // Saiu do navegador: a câmera não fica ligada por trás.
    const aoEsconder = () => {
      if (!document.hidden) {
        if (pausada.current) setTentativa((t) => t + 1)
        pausada.current = false
      } else if (sessao.current) {
        pararGravacao()
      } else if (camera.current) {
        soltarCamera()
        pausada.current = true
        setFase('abrindo')
      }
    }
    window.addEventListener('keydown', aoTeclar)
    document.addEventListener('visibilitychange', aoEsconder)
    return () => {
      document.body.style.overflow = antes
      window.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('visibilitychange', aoEsconder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temRascunho])

  const limite = midia.video_segundos
  const fracao = gravando || fase === 'fechando' ? Math.min(1, decorrido / (limite * 1000)) : 0
  const rotuloDoDisparador = cheio
    ? midia.fotos_max > 1
      ? `Tirar foto. Já são ${midia.fotos_max} fotos, o máximo`
      : 'Tirar foto. Já há uma foto, o máximo'
    : gravaAgora
      ? 'Tirar foto. Segure para gravar vídeo'
      : 'Tirar foto'
  const temMidia = fotos.length > 0 || chegando > 0 || video !== null
  // A última captura, como a miniatura da galeria na câmera do celular.
  const ultima = fotos.length > 0 ? fotos[fotos.length - 1].url : (video?.capa ?? null)
  const total = fotos.length + chegando + (video ? 1 : 0)

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label="Câmera">
      <video ref={previa} className="camera-video" autoPlay playsInline muted aria-hidden="true" />
      {flash > 0 && <span key={flash} className="camera-flash" aria-hidden="true" />}

      {fase === 'abrindo' && <span className="girando girando-claro camera-girando" aria-hidden="true" />}

      {fase === 'sem_camera' && (
        <div className="camera-sem">
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            capture="environment"
            className="escondido"
            tabIndex={-1}
            aria-hidden="true"
            onChange={aoEscolherArquivo}
          />
          <button
            ref={disparador}
            type="button"
            className="botao botao-claro"
            disabled={cheio}
            onClick={() => entrada.current?.click()}
          >
            <IconeCamera tamanho={32} />
            Abrir câmera
          </button>
        </div>
      )}

      <div className="camera-topo">
        <button type="button" className="botao-mapa botao-camera" aria-label="Fechar a câmera" onClick={fechar}>
          <IconeFechar />
        </button>
        <div className="camera-topo-direita">{fala}</div>
      </div>

      {(gravando || fase === 'fechando') && (
        <p className="camera-tempo" aria-hidden="true">
          <span className="camera-ponto" />
          {formatarDuracao(decorrido)}
        </p>
      )}

      <p className="escondido" role="status">
        {anuncio}
      </p>
      {(aviso ?? props.avisoDeFora) && (
        <p className="camera-aviso" role="alert" onClick={() => setAviso(null)}>
          {aviso ?? props.avisoDeFora}
        </p>
      )}

      <div className="camera-baixo">
        {temMidia && tira && (
          <ul className="camera-tira" aria-label="Fotos e vídeo do relato">
            {fotos.map((f, i) => (
              <li key={f.id} className="mini">
                <img src={f.url} alt={`Foto ${i + 1}`} />
                <button
                  type="button"
                  className="mini-x"
                  aria-label={`Remover foto ${i + 1}`}
                  disabled={gravando}
                  onClick={() => atual.current.aoRemoverFoto(f.id)}
                >
                  <span>
                    <IconeFechar tamanho={14} />
                  </span>
                </button>
              </li>
            ))}
            {Array.from({ length: chegando }, (_, i) => (
              <li key={`chegando-${i}`} className="mini mini-espera">
                <span className="girando girando-claro" aria-hidden="true" />
                <span className="escondido">Preparando a foto</span>
              </li>
            ))}
            {video && (
              <li className="mini mini-video">
                {video.capa && <img src={video.capa} alt="" />}
                <span className="mini-faixa">
                  <IconeTocar tamanho={12} />
                  <span aria-hidden="true">{formatarDuracao(video.duracaoMs)}</span>
                  <span className="escondido">Vídeo de {duracaoPorExtenso(video.duracaoMs)}</span>
                </span>
                <button
                  type="button"
                  className="mini-x"
                  aria-label="Remover vídeo"
                  disabled={gravando}
                  onClick={() => atual.current.aoRemoverVideo()}
                >
                  <span>
                    <IconeFechar tamanho={14} />
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}

        <div className="camera-acoes">
          <div className="camera-canto">
            {temMidia && (
              <button
                type="button"
                className="camera-ultima"
                aria-label={`${tira ? 'Esconder' : 'Mostrar'} ${total === 1 ? 'a captura' : `as ${total} capturas`}`}
                aria-expanded={tira}
                onClick={() => setTira((t) => !t)}
              >
                {ultima ? (
                  <img src={ultima} alt="" />
                ) : chegando > 0 ? (
                  <span className="girando girando-claro" aria-hidden="true" />
                ) : (
                  <IconeTocar tamanho={20} />
                )}
                {total > 1 && (
                  <span className="contador" aria-hidden="true">
                    {total}
                  </span>
                )}
              </button>
            )}
          </div>
          {fase !== 'sem_camera' ? (
            <button
              ref={disparador}
              type="button"
              className={`disparador${gravando ? ' gravando' : ''}${cheio ? ' cheio' : ''}`}
              aria-label={rotuloDoDisparador}
              disabled={fase === 'abrindo' || fase === 'fechando'}
              onPointerDown={aoApertar}
              onPointerUp={aoSoltar}
              onPointerCancel={aoCancelar}
              onContextMenu={(e) => e.preventDefault()}
              // Teclado e leitor de tela ativam sem ponteiro: vira foto.
              onClick={(e) => {
                if (e.detail === 0) void tirarFoto()
              }}
            >
              {(gravando || fase === 'fechando') && <Anel fracao={fracao} tamanho={84} cor="#B3261E" />}
              <span className="disparador-miolo" />
            </button>
          ) : (
            <span className="disparador-vazio" />
          )}
          <div className="camera-canto camera-canto-direita">
            {fotos.length > 0 && !gravando && (
              <button
                type="button"
                className="botao-enviar"
                disabled={chegando > 0 || fase === 'fechando'}
                onClick={() => atual.current.aoEnviar()}
              >
                <span className="botao-enviar-texto">Enviar</span>
                <IconeEnviar tamanho={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmando && (
        <div className="confirmar" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo">
          <div className="confirmar-caixa">
            <p id="confirmar-titulo" className="confirmar-titulo">
              Descartar?
            </p>
            <div className="confirmar-botoes">
              <button type="button" className="botao botao-perigo" onClick={() => atual.current.aoFechar()}>
                Descartar
              </button>
              <button type="button" className="botao botao-secundario" autoFocus onClick={() => setConfirmando(false)}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
