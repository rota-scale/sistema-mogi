import * as Location from 'expo-location'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AppState } from 'react-native'
import { avisar } from '@/api/telemetria'
import { gpsDaMemoria, guardarLeitura, passoDoBoneco, posicaoEscolhida, posicaoManual, situacaoDoLocal } from '@/logica/web'
import type { FalhaDoGps, LeituraDoLocal, MemoriaDoGps, Posicao, SituacaoDoLocal } from '@/logica/web'

export interface Local {
  situacao: SituacaoDoLocal
  // Posição que vai no envio; null enquanto não há uma confiável.
  posicao: Posicao | null
  // Leitura do GPS que vale para o envio (a última boa dura um minuto).
  gps: Posicao | null
  // Última leitura, boa ou não: é onde o boneco aparece.
  aqui: Posicao | null
  manual: Posicao | null
  buscando: boolean
  andando: boolean
  // Pede a permissão (se ainda puder) e recomeça a ouvir o GPS.
  buscar: () => void
  marcar: (lat: number, lng: number) => void
  usarGps: () => void
}

const VAZIA: LeituraDoLocal = { gps: null, manual: null, falha: null, buscando: false }
const PRAZO_DO_GPS_MS = 15000

const Contexto = createContext<Local | null>(null)

// Lugar do morador, acompanhado ao vivo enquanto o app está aberto. Nunca
// inventa coordenada: vale o GPS com precisão aceita ou o ponto marcado no
// mapa, e o ponto marcado vence o GPS.
export function ProvedorDeLocal({ children }: { children: ReactNode }) {
  const [leitura, setLeitura] = useState<LeituraDoLocal>(VAZIA)
  const [andando, setAndando] = useState(false)
  const [aqui, setAqui] = useState<Posicao | null>(null)
  const assinatura = useRef<Location.LocationSubscription | null>(null)
  const memoria = useRef<MemoriaDoGps>({ atual: null, boa: null })
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vez = useRef(0)
  const avisados = useRef(new Set<FalhaDoGps>())

  const falhar = useCallback((falha: FalhaDoGps) => {
    // Uma leitura já guardada vale mais que uma falha posterior, menos
    // quando a permissão foi tirada.
    setLeitura((l) => ({ ...l, gps: falha === 'negado' ? null : l.gps, falha: l.gps && falha !== 'negado' ? null : falha, buscando: false }))
    if (falha === 'negado') {
      memoria.current = { atual: null, boa: null }
      setAqui(null)
    }
    if (!avisados.current.has(falha)) {
      avisados.current.add(falha)
      avisar(falha === 'negado' ? 'gps_negado' : 'gps_impreciso', falha)
    }
  }, [])

  const parar = useCallback(() => {
    assinatura.current?.remove()
    assinatura.current = null
    if (prazo.current) clearTimeout(prazo.current)
    prazo.current = null
  }, [])

  const aoLer = useCallback((l: Location.LocationObject) => {
    if (prazo.current) clearTimeout(prazo.current)
    prazo.current = null
    const { latitude, longitude, accuracy, speed } = l.coords
    const nova: Posicao = {
      lat: latitude,
      lng: longitude,
      precisao: accuracy !== null && Number.isFinite(accuracy) ? accuracy : null,
      em: l.timestamp,
      velocidade: speed,
    }
    // As regras do boneco e da memória do GPS são as do app web.
    setAndando(passoDoBoneco(memoria.current.atual, nova).andando)
    memoria.current = guardarLeitura(memoria.current, nova, l.timestamp)
    const vale = gpsDaMemoria(memoria.current)
    setAqui(nova)
    setLeitura((atual) => ({ ...atual, gps: vale, falha: null, buscando: false }))
  }, [])

  const ouvir = useCallback(
    async (pedirPermissao: boolean) => {
      const esta = ++vez.current
      parar()
      try {
        let permissao = await Location.getForegroundPermissionsAsync()
        if (esta !== vez.current) return
        setLeitura((l) => ({ ...l, falha: null, buscando: true }))
        if (!permissao.granted && pedirPermissao && permissao.canAskAgain) {
          permissao = await Location.requestForegroundPermissionsAsync()
        }
        if (esta !== vez.current) return
        if (!permissao.granted) return falhar('negado')
        if (!(await Location.hasServicesEnabledAsync())) {
          if (esta === vez.current) falhar('sem_sinal')
          return
        }
        const nova = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 1 },
          aoLer,
          () => falhar('sem_sinal'),
        )
        if (esta !== vez.current) return nova.remove()
        assinatura.current = nova
        // Sem nenhuma leitura no prazo, avisa; a escuta continua e a
        // primeira leitura que chegar apaga o aviso.
        prazo.current = setTimeout(() => falhar('sem_sinal'), PRAZO_DO_GPS_MS)
      } catch {
        if (esta === vez.current) falhar('sem_sinal')
      }
    },
    [aoLer, falhar, parar],
  )

  // Desmontou: a escuta para e uma busca em andamento deixa de valer.
  const cancelar = useCallback(() => {
    vez.current++
    parar()
  }, [parar])

  useEffect(() => {
    // A escuta só mexe no estado depois de consultar a permissão.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ouvir(true)
    // Ao voltar dos ajustes do sistema, confere a permissão de novo sem
    // abrir outro pedido na cara da pessoa.
    const estado = AppState.addEventListener('change', (s) => {
      if (s === 'active') void ouvir(false)
      else parar()
    })
    return () => {
      estado.remove()
      cancelar()
    }
  }, [ouvir, parar, cancelar])

  const buscar = useCallback(() => void ouvir(true), [ouvir])

  const marcar = useCallback((lat: number, lng: number) => {
    setLeitura((l) => ({ ...l, manual: posicaoManual(lat, lng) }))
  }, [])

  const usarGps = useCallback(() => {
    setLeitura((l) => ({ ...l, manual: null }))
  }, [])

  const valor = useMemo<Local>(
    () => ({
      situacao: situacaoDoLocal(leitura),
      posicao: posicaoEscolhida(leitura.gps, leitura.manual),
      gps: leitura.gps,
      aqui,
      manual: leitura.manual,
      buscando: leitura.buscando,
      andando,
      buscar,
      marcar,
      usarGps,
    }),
    [leitura, aqui, andando, buscar, marcar, usarGps],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useLocal(): Local {
  const local = useContext(Contexto)
  if (!local) throw new Error('useLocal fora do ProvedorDeLocal')
  return local
}
