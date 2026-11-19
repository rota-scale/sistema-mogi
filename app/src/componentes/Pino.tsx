import { StyleSheet, Text, View } from 'react-native'
import { corDoNivel, textoSobreNivel } from '@/logica/web'
import { cores } from '@/tema'

// Pino de um relato do próprio morador: a cor é a da urgência e o número
// do nível vai dentro, para a cor não ir sozinha.
export function Pino({ nivel, destaque = false }: { nivel: number | null; destaque?: boolean }) {
  const lado = destaque ? 44 : 36
  return (
    <View style={estilos.caixa} accessible={false}>
      <View style={[estilos.disco, { width: lado, height: lado, borderRadius: lado / 2, backgroundColor: corDoNivel(nivel) }]}>
        <Text style={[estilos.numero, { color: textoSobreNivel(nivel) }]}>{nivel ?? '?'}</Text>
      </View>
      <View style={estilos.ponta} />
    </View>
  )
}

const estilos = StyleSheet.create({
  caixa: { alignItems: 'center', padding: 2 },
  disco: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: cores.papel },
  numero: { fontSize: 17, fontWeight: '900' },
  ponta: { width: 6, height: 10, marginTop: -2, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: cores.cafezal },
})
