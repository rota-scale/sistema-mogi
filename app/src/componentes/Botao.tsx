import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { cores, letra, raio } from '@/tema'

interface Props {
  titulo: string
  aoTocar: () => void
  tipo?: 'primario' | 'secundario' | 'destaque' | 'claro'
  desligado?: boolean
  ocupado?: boolean
  icone?: ReactNode
  dica?: string
  estilo?: StyleProp<ViewStyle>
}

// Botão grande, de uma linha, para usar com uma mão só.
export function Botao({ titulo, aoTocar, tipo = 'primario', desligado = false, ocupado = false, icone, dica, estilo }: Props) {
  const parado = desligado || ocupado
  const corDoTexto = tipo === 'primario' ? cores.creme : cores.cafezal
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: parado, busy: ocupado }}
      disabled={parado}
      onPress={aoTocar}
      style={({ pressed }) => [estilos.base, estilos[tipo], parado && estilos.desligado, pressed && estilos.apertado, estilo]}
    >
      {ocupado ? <ActivityIndicator color={parado ? cores.cafe : corDoTexto} /> : icone}
      <Text style={[estilos.texto, { color: parado ? cores.cafe : corDoTexto }]} numberOfLines={2}>
        {titulo}
      </Text>
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: raio,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  primario: { backgroundColor: cores.cafezal, borderColor: cores.cafezal },
  secundario: { backgroundColor: 'transparent', borderColor: cores.cafezal },
  destaque: { backgroundColor: cores.ipe, borderColor: cores.ipeFundo },
  claro: { backgroundColor: cores.papel, borderColor: cores.cafezal },
  // Desligado: fundo claro e borda tracejada, para dar leitura sem parecer ativo.
  desligado: { backgroundColor: cores.creme2, borderColor: cores.apagado, borderStyle: 'dashed' },
  apertado: { opacity: 0.8, transform: [{ translateY: 2 }] },
  texto: { fontSize: letra.base, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
})
