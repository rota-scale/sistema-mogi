import { useCallback, useEffect, useRef, useState } from 'react'
import { avisarFalha } from './api'
import { lerRota, mudouDeLugar, NA_LISTA, rotaAcima } from './logica'
import type { Ponto, Rota } from './logica'

// Põe o foco no título quando a tela troca, para o leitor de tela anunciar
// onde a pessoa está, e sobe a página.
export function useTituloEmFoco<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}

// Relógio da tela: os prazos ("atrasado há 2 h") andam sem recarregar.
export function useAgora(intervaloMs = 30_000): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}

type Destino = Partial<Omit<Rota, 'n'>>

// Se o voltar do navegador não mudou nada (aba aberta sem histórico), a tela
// sobe um passo por conta própria: ninguém fica preso no chamado.
const ESPERA_DO_VOLTAR_MS = 400

// Navegação pelo histórico do navegador: abrir o chamado empilha um estado,
// e o botão de voltar do Android desempilha.
export function useRota() {
  const [rota, setRota] = useState<Rota>(() => lerRota(history.state))

  useEffect(() => {
    const aoVoltar = (e: PopStateEvent) => setRota(lerRota(e.state))
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  const ir = useCallback((destino: Destino) => {
    const atual = lerRota(history.state)
    const nova: Rota = { ...atual, ...destino, n: atual.n + 1 }
    history.pushState(nova, '')
    setRota(nova)
  }, [])

  // Troca de foto na tela cheia não empilha: um voltar só fecha a foto.
  const trocar = useCallback((destino: Destino) => {
    const atual = lerRota(history.state)
    const nova: Rota = { ...atual, ...destino }
    history.replaceState(nova, '')
    setRota(nova)
  }, [])

  const recuar = useCallback((passos: number, seNada: (atual: Rota) => Rota) => {
    const atual = lerRota(history.state)
    if (atual.n === 0) return
    const antes: unknown = history.state
    history.go(-passos)
    setTimeout(() => {
      if (history.state !== antes) return
      const nova = seNada(atual)
      history.replaceState(nova.n === 0 ? null : nova, '')
      setRota(nova)
    }, ESPERA_DO_VOLTAR_MS)
  }, [])

  const voltar = useCallback(() => recuar(1, rotaAcima), [recuar])
  const paraLista = useCallback(() => recuar(lerRota(history.state).n, () => NA_LISTA), [recuar])

  return { rota, ir, trocar, voltar, paraLista }
}

export type EstadoDoLocal =
  | 'conferindo'
  | 'perguntar'
  | 'buscando'
  | 'ligada'
  | 'desligada'
  | 'bloqueada'
  | 'indisponivel'

export interface Localizacao {
  estado: EstadoDoLocal
  aqui: Ponto | null
  pedir: () => void
  dispensar: () => void
}

const CHAVE_GPS = 'mogi.campo.gps'

function lerEscolha(): string | null {
  try {
    return localStorage.getItem(CHAVE_GPS)
  } catch {
    return null
  }
}

function guardarEscolha(v: 'sim' | 'nao' | null) {
  try {
    if (v) localStorage.setItem(CHAVE_GPS, v)
    else localStorage.removeItem(CHAVE_GPS)
  } catch {
    /* sem armazenamento: a pergunta volta na próxima visita */
  }
}

function estadoInicial(): EstadoDoLocal {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'indisponivel'
  const escolha = lerEscolha()
  if (escolha === 'sim') return 'buscando'
  if (escolha === 'nao') return 'desligada'
  return 'conferindo'
}

// Localização da equipe, só para mostrar a distância. Pergunta uma vez, com
// explicação; negada, a lista segue sem distância.
export function useLocalizacao(): Localizacao {
  const [estado, setEstado] = useState<EstadoDoLocal>(estadoInicial)
  const [aqui, setAqui] = useState<Ponto | null>(null)
  const ultimo = useRef<Ponto | null>(null)

  // Quem já liberou no navegador não vê a pergunta; quem bloqueou, também não.
  useEffect(() => {
    if (estado !== 'conferindo') return
    let vivo = true
    const decidir = (s: EstadoDoLocal) => {
      if (vivo) setEstado(s)
    }
    if (!navigator.permissions?.query) {
      decidir('perguntar')
    } else {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((p) => decidir(p.state === 'granted' ? 'buscando' : p.state === 'denied' ? 'bloqueada' : 'perguntar'))
        .catch(() => decidir('perguntar'))
    }
    return () => {
      vivo = false
    }
  }, [estado])

  const acompanhando = estado === 'buscando' || estado === 'ligada'

  useEffect(() => {
    if (!acompanhando) return
    let id: number | null = null
    const ligar = () => {
      if (id != null || document.visibilityState !== 'visible') return
      id = navigator.geolocation.watchPosition(
        (p) => {
          const ponto = { lat: p.coords.latitude, lng: p.coords.longitude }
          if (mudouDeLugar(ultimo.current, ponto)) {
            ultimo.current = ponto
            setAqui(ponto)
          }
          setEstado('ligada')
          guardarEscolha('sim')
        },
        (e) => {
          // Sem sinal ou demora: fica com a última posição. Só a recusa desliga.
          if (e.code !== e.PERMISSION_DENIED) return
          ultimo.current = null
          setAqui(null)
          setEstado('bloqueada')
          guardarEscolha(null)
          avisarFalha('campo_gps_negado', 'permissão recusada')
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
      )
    }
    // Com a tela apagada ou em outra aba o GPS só gastaria bateria.
    const desligar = () => {
      if (id == null) return
      navigator.geolocation.clearWatch(id)
      id = null
    }
    const aoMudar = () => (document.visibilityState === 'visible' ? ligar() : desligar())
    ligar()
    document.addEventListener('visibilitychange', aoMudar)
    return () => {
      desligar()
      document.removeEventListener('visibilitychange', aoMudar)
    }
  }, [acompanhando])

  const pedir = useCallback(() => setEstado('buscando'), [])
  const dispensar = useCallback(() => {
    guardarEscolha('nao')
    setEstado('desligada')
  }, [])

  return { estado, aqui, pedir, dispensar }
}
