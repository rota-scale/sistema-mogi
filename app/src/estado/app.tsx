import * as Network from 'expo-network'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AccessibilityInfo, AppState } from 'react-native'
import { buscarConfig } from '@/api/config'
import { filaGuardada, guardarNaFila, tentarFila, tirarDaFila } from '@/aparelho/fila'
import { guardarRelatos, relatosGuardados } from '@/aparelho/relatos'
import { ligarSom, somGuardado, tocar } from '@/aparelho/sons'
import { RECUSADO_NA_FILA } from '@/logica/fila'
import type { ItemDaFila } from '@/logica/fila'
import { aposConsulta, mesclarRelatos } from '@/logica/relatos'
import { recenteDaResposta } from '@/logica/web'
import type { Acompanhamento, Config, Recente, Resposta } from '@/logica/web'

interface Aviso {
  texto: string
  tom: 'certo' | 'neutro'
}

interface App {
  // null: /api/config ainda não respondeu (no máximo 4 s).
  config: Config | null
  configFinal: () => Promise<Config>
  relatos: Recente[]
  // Guarda o recibo no aparelho e devolve o que ficou guardado.
  registrar: (r: Resposta, lat: number | null, lng: number | null) => void
  aoConsultar: (a: Acompanhamento) => void
  fila: ItemDaFila[]
  enviandoFila: boolean
  esperarInternet: (item: ItemDaFila) => Promise<void>
  enviarFila: () => void
  descartarDaFila: (chave: string) => void
  aviso: Aviso | null
  avisarNaTela: (texto: string, tom?: Aviso['tom']) => void
  // Protocolo que o mapa deve destacar (o relato recém-enviado).
  destaque: string | null
  somLigado: boolean
  alternarSom: () => void
}

const Contexto = createContext<App | null>(null)

const TEMPO_DO_AVISO_MS = 4000

export function ProvedorDoApp({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [relatos, setRelatos] = useState<Recente[]>([])
  const [fila, setFila] = useState<ItemDaFila[]>([])
  const [enviandoFila, setEnviandoFila] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [destaque, setDestaque] = useState<string | null>(null)
  const [somLigado, setSomLigado] = useState(true)
  const pedidoDeConfig = useRef<Promise<Config> | null>(null)
  const relatosAtuais = useRef<Recente[]>([])
  const relogioDoAviso = useRef<ReturnType<typeof setTimeout> | null>(null)

  const porRelatos = useCallback((lista: Recente[]) => {
    relatosAtuais.current = lista
    setRelatos(lista)
    void guardarRelatos(lista)
  }, [])

  const avisarNaTela = useCallback((texto: string, tom: Aviso['tom'] = 'certo') => {
    if (relogioDoAviso.current) clearTimeout(relogioDoAviso.current)
    setAviso({ texto, tom })
    AccessibilityInfo.announceForAccessibility(texto)
    relogioDoAviso.current = setTimeout(() => setAviso(null), TEMPO_DO_AVISO_MS)
  }, [])

  const registrar = useCallback(
    (r: Resposta, lat: number | null, lng: number | null) => {
      porRelatos(mesclarRelatos(relatosAtuais.current, recenteDaResposta(r, lat !== null && lng !== null ? { lat, lng } : null)))
      setDestaque(r.protocolo)
      // O pino aparece no mapa logo depois do som de enviado.
      setTimeout(() => tocar('pino'), 900)
    },
    [porRelatos],
  )

  const aoConsultar = useCallback(
    (a: Acompanhamento) => {
      const { lista, estreia } = aposConsulta(relatosAtuais.current, a)
      if (estreia) tocar('resolvido')
      if (JSON.stringify(lista) !== JSON.stringify(relatosAtuais.current)) porRelatos(lista)
    },
    [porRelatos],
  )

  const configFinal = useCallback(() => {
    pedidoDeConfig.current ??= buscarConfig()
    return pedidoDeConfig.current
  }, [])

  const enviarFila = useCallback(() => {
    setEnviandoFila(true)
    void tentarFila()
      .then((r) => {
        setFila(r.fila)
        for (const { item, resposta } of r.enviados) {
          const lat = Number(item.campos.lat)
          const lng = Number(item.campos.lng)
          registrar(resposta, Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null)
        }
        if (r.enviados.length > 0) {
          tocar('enviado')
          avisarNaTela('Enviado')
        } else if (r.recusados > 0) {
          tocar('erro')
          avisarNaTela(RECUSADO_NA_FILA, 'neutro')
        }
      })
      .catch(() => {})
      .finally(() => setEnviandoFila(false))
  }, [registrar, avisarNaTela])

  const esperarInternet = useCallback(async (item: ItemDaFila) => {
    setFila(await guardarNaFila(item))
  }, [])

  const alternarSom = useCallback(() => {
    setSomLigado((ligado) => {
      ligarSom(!ligado)
      return !ligado
    })
  }, [])

  const descartarDaFila = useCallback((chave: string) => {
    void tirarDaFila(chave).then(setFila)
  }, [])

  useEffect(() => {
    let vivo = true
    void configFinal().then((c) => vivo && setConfig(c))
    void somGuardado().then((ligado) => vivo && setSomLigado(ligado))
    void relatosGuardados().then((lista) => {
      if (!vivo) return
      relatosAtuais.current = lista
      setRelatos(lista)
    })
    // Ao abrir o app, tenta o que ficou esperando a internet.
    void filaGuardada().then((f) => {
      if (!vivo) return
      setFila(f)
      if (f.length > 0) enviarFila()
    })
    return () => {
      vivo = false
    }
  }, [configFinal, enviarFila])

  // A internet voltou, ou o app voltou para a frente: tenta a fila de novo.
  const temFila = fila.length > 0
  useEffect(() => {
    if (!temFila) return
    const rede = Network.addNetworkStateListener((e) => {
      if (e.isConnected && e.isInternetReachable !== false) enviarFila()
    })
    const estado = AppState.addEventListener('change', (s) => {
      if (s === 'active') enviarFila()
    })
    return () => {
      rede.remove()
      estado.remove()
    }
  }, [temFila, enviarFila])

  const valor = useMemo<App>(
    () => ({
      config,
      configFinal,
      relatos,
      registrar,
      aoConsultar,
      fila,
      enviandoFila,
      esperarInternet,
      enviarFila,
      descartarDaFila,
      aviso,
      avisarNaTela,
      destaque,
      somLigado,
      alternarSom,
    }),
    [somLigado, alternarSom, config, configFinal, relatos, registrar, aoConsultar, fila, enviandoFila, esperarInternet, enviarFila, descartarDaFila, aviso, avisarNaTela, destaque],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useApp(): App {
  const app = useContext(Contexto)
  if (!app) throw new Error('useApp fora do ProvedorDoApp')
  return app
}
