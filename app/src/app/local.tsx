import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Botao } from '@/componentes/Botao'
import { IconeLocal } from '@/componentes/icones'
import { MapaDeEscolha, temMapa } from '@/componentes/mapas'
import { useApp } from '@/estado/app'
import { useLocal } from '@/estado/localizacao'
import { SEM_MAPA_USE_O_SITE } from '@/logica/local'
import { vistaInicialDoMapa } from '@/logica/web'
import { cores, letra } from '@/tema'

// Marcar o lugar à mão, para quando o GPS não serve: o pino fica parado no
// centro e a pessoa arrasta o mapa por baixo.
export default function MarcarLocal() {
  const local = useLocal()
  const { config } = useApp()
  // A vista inicial vale só na abertura.
  const [inicio] = useState(() => {
    const vista = vistaInicialDoMapa(local.aqui ?? local.gps, local.manual)
    return local.aqui || local.gps || local.manual || !config ? vista : { ...vista, ...config.centro }
  })
  const centro = useRef({ lat: inicio.lat, lng: inicio.lng })

  const confirmar = () => {
    local.marcar(centro.current.lat, centro.current.lng)
    router.back()
  }

  return (
    <SafeAreaView style={estilos.tela}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Arraste até o lugar
      </Text>
      <View style={estilos.area}>
        <MapaDeEscolha inicio={inicio} aoMudar={(lat, lng) => (centro.current = { lat, lng })} />
        {temMapa ? (
          <View style={estilos.pino} pointerEvents="none">
            <IconeLocal tamanho={56} cor={cores.cereja} />
          </View>
        ) : (
          <Text style={estilos.semMapa}>{SEM_MAPA_USE_O_SITE}</Text>
        )}
      </View>
      <View style={estilos.rodape}>
        {temMapa && <Botao titulo="É aqui" dica="Marca o lugar do problema" aoTocar={confirmar} icone={<IconeLocal tamanho={26} cor={cores.creme} />} />}
        <Botao titulo="Voltar" tipo="secundario" aoTocar={() => router.back()} />
      </View>
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.creme },
  titulo: { fontSize: letra.maior, fontWeight: '900', color: cores.cafezal, paddingHorizontal: 20, paddingVertical: 14 },
  area: { flex: 1, borderTopWidth: 3, borderBottomWidth: 3, borderColor: cores.cafezal, backgroundColor: cores.creme2, justifyContent: 'center' },
  // A ponta do pino fica no centro exato do mapa.
  pino: { position: 'absolute', left: '50%', top: '50%', marginLeft: -28, marginTop: -53 },
  semMapa: { fontSize: letra.base, fontWeight: '700', color: cores.cafe, textAlign: 'center', padding: 24 },
  rodape: { padding: 20, gap: 10 },
})
