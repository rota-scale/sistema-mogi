import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cheio, cores, letra, toque } from '@/tema'
import { IconeFechar } from './icones'

interface Props {
  aberta: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
}

// Folha que sobe por baixo, por cima do mapa ou da câmera. Fecha no X, no
// toque fora dela e no botão de voltar do Android.
export function Folha({ aberta, titulo, aoFechar, children }: Props) {
  const margens = useSafeAreaInsets()
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={estilos.tela}>
        <Pressable style={estilos.fora} onPress={aoFechar} accessibilityLabel="Fechar" accessibilityRole="button" />
        <View style={[estilos.folha, { paddingBottom: Math.max(16, margens.bottom) }]} accessibilityViewIsModal>
          <View style={estilos.topo}>
            <Text style={estilos.titulo} accessibilityRole="header">
              {titulo}
            </Text>
            <Pressable
              onPress={aoFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={({ pressed }) => [estilos.fechar, pressed && { opacity: 0.6 }]}
            >
              <IconeFechar tamanho={22} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, justifyContent: 'flex-end' },
  fora: { ...cheio, backgroundColor: cores.veu },
  folha: {
    maxHeight: '82%',
    backgroundColor: cores.creme,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 3,
    borderColor: cores.cafezal,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: toque.canto },
  titulo: { flex: 1, fontSize: letra.maior, fontWeight: '900', color: cores.cafezal },
  fechar: {
    width: toque.minimo,
    height: toque.minimo,
    borderRadius: toque.minimo / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.creme2,
  },
})
