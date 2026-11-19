import { StyleSheet, View } from 'react-native'
import type { Ponto, VistaDoMapa } from '@/logica/web'
import { cheio, cores } from '@/tema'
import { Boneco } from './Boneco'

// O mapa nativo não existe no navegador: aqui fica só o fundo neutro, com
// o boneco no meio, para conferir as telas. O morador usa o site do MOGI.
export const temMapa = false

export interface PinoDoMapa extends Ponto {
  protocolo: string
  nivel: number | null
}

interface PropsDaRua {
  centro: Ponto
  pessoa: Ponto | null
  andando: boolean
  pinos: PinoDoMapa[]
  destaque: string | null
  seguindo: boolean
  aoSoltar: () => void
  aoTocarPino: (protocolo: string) => void
}

export function MapaDaRua({ pessoa, andando }: PropsDaRua) {
  return <View style={estilos.neutro}>{pessoa && <Boneco andando={andando} />}</View>
}

export function MapaDeEscolha(_: { inicio: VistaDoMapa; aoMudar: (lat: number, lng: number) => void }) {
  return <View style={estilos.neutro} />
}

const estilos = StyleSheet.create({
  neutro: { ...cheio, backgroundColor: cores.creme2, alignItems: 'center', justifyContent: 'center' },
})
