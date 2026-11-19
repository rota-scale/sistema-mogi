import { useCallback, useEffect, useState } from 'react'
import { gpsDaMemoria, guardarLeitura, posicaoEscolhida, posicaoManual, situacaoDoLocal } from './logica'
import type { FalhaDoGps, MemoriaDoGps, Posicao, SituacaoDoLocal } from './logica'

const OPCOES: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }

function suportada(): boolean {
  return window.isSecureContext && 'geolocation' in navigator
}

interface Estado {
  memoria: MemoriaDoGps
  manual: Posicao | null
  falha: FalhaDoGps | null
}

const VAZIO: Estado = { memoria: { atual: null, boa: null }, manual: null, falha: null }

export interface Local {
  situacao: SituacaoDoLocal
  // Posição que vai no envio; null enquanto não há uma confiável.
  posicao: Posicao | null
  // Última leitura do GPS, boa ou não: é onde o boneco fica.
  atual: Posicao | null
  manual: Posicao | null
  marcar: (lat: number, lng: number) => void
  soltarManual: () => void
  tentarDeNovo: () => void
}

// Acompanha o GPS desde a abertura. Nunca inventa coordenada: vale a
// leitura com precisão aceita ou o ponto marcado no mapa, que vence o GPS.
export function useLocalizacao(): Local {
  const [estado, setEstado] = useState<Estado>(() => (suportada() ? VAZIO : { ...VAZIO, falha: 'sem_suporte' }))
  const [vez, setVez] = useState(0)

  const aoLer = useCallback((p: GeolocationPosition) => {
    const agora = Date.now()
    const nova: Posicao = {
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      precisao: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
      velocidade: typeof p.coords.speed === 'number' && Number.isFinite(p.coords.speed) ? p.coords.speed : null,
      em: agora,
    }
    setEstado((e) => ({ ...e, memoria: guardarLeitura(e.memoria, nova, agora), falha: null }))
  }, [])

  const aoFalhar = useCallback((e: GeolocationPositionError) => {
    // Uma leitura já guardada vale mais que uma falha posterior.
    const falha: FalhaDoGps = e.code === e.PERMISSION_DENIED ? 'negado' : 'sem_sinal'
    setEstado((s) => (s.memoria.atual && falha !== 'negado' ? s : { ...s, falha }))
  }, [])

  useEffect(() => {
    if (!suportada()) return
    const id = navigator.geolocation.watchPosition(aoLer, aoFalhar, OPCOES)
    return () => navigator.geolocation.clearWatch(id)
  }, [aoLer, aoFalhar, vez])

  const marcar = useCallback((lat: number, lng: number) => {
    setEstado((e) => ({ ...e, manual: posicaoManual(lat, lng) }))
  }, [])

  const soltarManual = useCallback(() => setEstado((e) => (e.manual ? { ...e, manual: null } : e)), [])

  const tentarDeNovo = useCallback(() => {
    if (!suportada()) return
    setEstado((e) => ({ ...e, falha: null }))
    setVez((v) => v + 1)
  }, [])

  const gps = gpsDaMemoria(estado.memoria)
  return {
    situacao: situacaoDoLocal({ gps, manual: estado.manual, falha: estado.falha, buscando: !gps && !estado.falha }),
    posicao: posicaoEscolhida(gps, estado.manual),
    atual: estado.memoria.atual,
    manual: estado.manual,
    marcar,
    soltarManual,
    tentarDeNovo,
  }
}
