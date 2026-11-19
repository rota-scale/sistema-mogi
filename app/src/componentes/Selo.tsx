import { StyleSheet, Text, View } from 'react-native'
import { corDoNivel, nomeDoNivel, textoSobreNivel } from '@/logica/web'
import { letra } from '@/tema'

// Urgência em palavra e cor. A cor nunca vai sozinha.
export function Selo({ nivel, pequeno = false }: { nivel: number | null; pequeno?: boolean }) {
  return (
    <View style={[estilos.selo, pequeno && estilos.pequeno, { backgroundColor: corDoNivel(nivel) }]}>
      <Text style={[estilos.texto, pequeno && estilos.textoPequeno, { color: textoSobreNivel(nivel) }]}>{nomeDoNivel(nivel)}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  selo: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  pequeno: { paddingVertical: 4, paddingHorizontal: 12 },
  texto: { fontSize: letra.base, fontWeight: '900' },
  textoPequeno: { fontSize: letra.menor, fontWeight: '700' },
})
