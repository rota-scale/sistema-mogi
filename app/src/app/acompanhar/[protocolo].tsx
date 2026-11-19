import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Andamento } from '@/componentes/Andamento'
import { Botao } from '@/componentes/Botao'
import { useApp } from '@/estado/app'
import { cores } from '@/tema'

// Andamento em tela cheia, para quem chega por link (mogi://acompanhar/...).
// Dentro do app o mesmo conteúdo abre numa folha por cima do mapa.
export default function Acompanhar() {
  const { protocolo, k } = useLocalSearchParams<{ protocolo: string; k?: string }>()
  const { relatos } = useApp()
  const chave = (typeof k === 'string' && k) || relatos.find((r) => r.protocolo === protocolo)?.chave || null
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'))
  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.conteudo}>
        <Andamento protocolo={String(protocolo ?? '')} chave={chave} />
      </View>
      <Botao titulo="Voltar ao mapa" tipo="secundario" aoTocar={voltar} />
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.creme, padding: 20, gap: 12 },
  conteudo: { flex: 1 },
})
