import { useCallback, useEffect, useRef, useState } from 'react'
import { tocar } from '../sons'

// Tipos mínimos da Web Speech API, que ainda tem prefixo em vários navegadores.
interface Alternativa {
  transcript: string
}
interface Resultado {
  isFinal: boolean
  0: Alternativa
}
interface EventoDeFala {
  resultIndex: number
  results: { length: number; [i: number]: Resultado }
}
interface Reconhecimento {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: EventoDeFala) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type Construtor = new () => Reconhecimento

function construtor(): Construtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface Voz {
  disponivel: boolean
  ouvindo: boolean
  // Texto ainda não confirmado pelo reconhecedor, para mostrar ao vivo.
  parcial: string
  aviso: string | null
  alternar: () => void
  parar: () => void
}

// Ditado em pt-BR pelo reconhecedor do próprio aparelho. Este código não
// grava nem envia áudio: só recebe o texto pronto.
export function useVoz(aoFalar: (trecho: string) => void): Voz {
  // Desliga de vez quando o navegador diz que não faz ditado aqui (sem
  // serviço, sem microfone, permissão negada): o botão vira teclado.
  const [disponivel, setDisponivel] = useState(() => construtor() !== null)
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const atual = useRef<Reconhecimento | null>(null)
  const destino = useRef(aoFalar)
  const parcialDoRec = useRef('')

  useEffect(() => {
    destino.current = aoFalar
  }, [aoFalar])

  const parar = useCallback(() => {
    atual.current?.stop()
  }, [])

  const iniciar = useCallback(() => {
    const Ctor = construtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'pt-BR'
    rec.interimResults = true

    rec.continuous = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      let provisorio = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          parcialDoRec.current = ''
          destino.current(r[0].transcript)
        } else provisorio += r[0].transcript
      }
      // O trecho que ainda não fechou aparece já na caixa de texto.
      parcialDoRec.current = provisorio
      setParcial(provisorio)
    }
    rec.onerror = (e) => {
      if (['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'].includes(e.error)) {
        setDisponivel(false)
        setAviso(null)
      } else if (e.error === 'no-speech') {
        setAviso('Não ouvi nada. Toque no microfone e fale de novo.')
      } else if (e.error !== 'aborted') {
        setAviso('Não deu para ouvir agora. Você pode escrever.')
      }
    }
    rec.onend = () => {
      // Se parou com um trecho ainda sem fechar, ele entra no texto mesmo assim.
      if (parcialDoRec.current.trim()) destino.current(parcialDoRec.current)
      parcialDoRec.current = ''
      if (atual.current === rec) tocar('parou')
      if (atual.current === rec) atual.current = null
      setOuvindo(false)
      setParcial('')
    }
    try {
      rec.start()
      atual.current = rec
      setAviso(null)
      setOuvindo(true)
      tocar('ouvir')
    } catch {
      setDisponivel(false)
    }
  }, [])

  const alternar = useCallback(() => {
    if (atual.current) atual.current.stop()
    else iniciar()
  }, [iniciar])

  // Ao sair da página, solta o microfone.
  useEffect(() => () => atual.current?.abort(), [])

  return { disponivel, ouvindo, parcial, aviso, alternar, parar }
}
