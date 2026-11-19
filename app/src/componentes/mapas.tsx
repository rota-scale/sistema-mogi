import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import type { Region } from 'react-native-maps'
import { avisar } from '@/api/telemetria'
import { nomeDoNivel } from '@/logica/web'
import type { Ponto, VistaDoMapa } from '@/logica/web'
import { cheio, cores } from '@/tema'
import { Boneco } from './Boneco'
import { Pino } from './Pino'

// O mapa nativo (react-native-maps) já vem no Expo Go: Apple Maps no
// iPhone e Google Maps no Android, sem chave. Numa build própria para
// Android, o Google Maps exige uma chave no app.json (veja o README).
export const temMapa = true

export interface PinoDoMapa extends Ponto {
  protocolo: string
  nivel: number | null
}

interface PropsDaRua {
  // Onde o mapa abre enquanto não há leitura do GPS.
  centro: Ponto
  pessoa: Ponto | null
  andando: boolean
  pinos: PinoDoMapa[]
  destaque: string | null
  // true: o mapa acompanha a pessoa. Arrastar o mapa solta.
  seguindo: boolean
  aoSoltar: () => void
  aoTocarPino: (protocolo: string) => void
}

const ABERTURA = 0.004
const ABERTURA_SEM_GPS = 0.02

// Se o mapa quebrar, a tela continua: fica o fundo neutro com os botões.
class Protegido extends Component<{ children: ReactNode }, { quebrou: boolean }> {
  state = { quebrou: false }
  static getDerivedStateFromError() {
    return { quebrou: true }
  }
  componentDidCatch() {
    avisar('mapa_falhou', 'render')
  }
  render() {
    return this.state.quebrou ? <View style={estilos.neutro} /> : this.props.children
  }
}

// Mapa da tela inicial: a pessoa (boneco) e os relatos dela. Nada de
// relato de outras pessoas.
export function MapaDaRua(p: PropsDaRua) {
  return (
    <Protegido>
      <Rua {...p} />
    </Protegido>
  )
}

function Rua({ centro, pessoa, andando, pinos, destaque, seguindo, aoSoltar, aoTocarPino }: PropsDaRua) {
  const mapa = useRef<MapView>(null)
  const abertura = useRef({ latitudeDelta: ABERTURA, longitudeDelta: ABERTURA })
  const [pronto, setPronto] = useState(false)
  // O Android desenha o marcador uma vez só; por um instante depois de
  // cada mudança ele precisa acompanhar o desenho, senão o pino sai vazio.
  const assinatura = pinos.map((x) => `${x.protocolo}:${x.nivel}`).join('|') + destaque
  const [desenhado, setDesenhado] = useState<string | null>(null)
  const desenhando = desenhado !== assinatura

  useEffect(() => {
    const relogio = setTimeout(() => setDesenhado(assinatura), 1500)
    return () => clearTimeout(relogio)
  }, [assinatura])

  const lat = pessoa?.lat
  const lng = pessoa?.lng
  useEffect(() => {
    if (!pronto || !seguindo || lat === undefined || lng === undefined) return
    mapa.current?.animateToRegion({ latitude: lat, longitude: lng, ...abertura.current }, 600)
  }, [pronto, seguindo, lat, lng])

  const inicio = pessoa ?? centro
  const aberturaInicial = pessoa ? ABERTURA : ABERTURA_SEM_GPS

  return (
    <MapView
      ref={mapa}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: inicio.lat, longitude: inicio.lng, latitudeDelta: aberturaInicial, longitudeDelta: aberturaInicial }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      moveOnMarkerPress={false}
      onMapReady={() => setPronto(true)}
      onPanDrag={aoSoltar}
      onRegionChangeComplete={(r: Region) => {
        // Guarda só a aproximação que a pessoa escolheu com os dedos.
        if (pessoa) abertura.current = { latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta }
      }}
    >
      {pinos.map((x) => (
        <Marker
          key={x.protocolo}
          coordinate={{ latitude: x.lat, longitude: x.lng }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={desenhando}
          onPress={() => aoTocarPino(x.protocolo)}
          accessibilityLabel={`Seu relato ${x.protocolo}, ${nomeDoNivel(x.nivel)}. Toque para ver o andamento.`}
        >
          <Pino nivel={x.nivel} destaque={x.protocolo === destaque} />
        </Marker>
      ))}
      {pessoa && (
        <Marker
          coordinate={{ latitude: pessoa.lat, longitude: pessoa.lng }}
          anchor={{ x: 0.5, y: 0.95 }}
          // O boneco troca de passo: o marcador segue o desenho o tempo todo.
          tracksViewChanges
          zIndex={10}
          tappable={false}
          accessibilityLabel="Você está aqui"
        >
          <Boneco andando={andando} />
        </Marker>
      )}
    </MapView>
  )
}

interface PropsDeEscolha {
  inicio: VistaDoMapa
  // Chamado com o centro do mapa sempre que ele para de se mover.
  aoMudar: (lat: number, lng: number) => void
}

// Mapa para marcar o lugar à mão: o pino fica parado no centro da tela e o
// mapa se move por baixo.
export function MapaDeEscolha({ inicio, aoMudar }: PropsDeEscolha) {
  const abertura = inicio.zoom >= 17 ? 0.003 : 0.012
  return (
    <Protegido>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: inicio.lat, longitude: inicio.lng, latitudeDelta: abertura, longitudeDelta: abertura }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={(r: Region) => aoMudar(r.latitude, r.longitude)}
      />
    </Protegido>
  )
}

const estilos = StyleSheet.create({
  neutro: { ...cheio, backgroundColor: cores.creme2 },
})
