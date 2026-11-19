import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { cores, sombra, toque } from '@/tema'

interface Props {
  rotulo: string
  aoTocar: () => void
  children: ReactNode
  // Número pequeno no canto do botão (quantos relatos, por exemplo).
  conta?: number
  escuro?: boolean
}

// Botão redondo de canto, com 56 pt de toque. O nome vai para o leitor de
// tela; na tela fica só o desenho.
export function BotaoDeCanto({ rotulo, aoTocar, children, conta, escuro = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={conta ? `${rotulo}, ${conta}` : rotulo}
      onPress={aoTocar}
      hitSlop={6}
      style={({ pressed }) => [estilos.botao, escuro && estilos.escuro, pressed && { opacity: 0.7 }]}
    >
      {children}
      {conta !== undefined && conta > 0 && (
        <View style={estilos.conta}>
          <Text style={estilos.contaTexto}>{conta}</Text>
        </View>
      )}
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  botao: {
    width: toque.canto,
    height: toque.canto,
    borderRadius: toque.canto / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.papel,
    borderWidth: 2.5,
    borderColor: cores.cafezal,
    ...sombra,
  },
  escuro: { backgroundColor: cores.cafezalFundo, borderColor: cores.creme },
  conta: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.cafezal,
    borderWidth: 2,
    borderColor: cores.papel,
  },
  contaTexto: { color: cores.creme, fontSize: 14, fontWeight: '900' },
})
