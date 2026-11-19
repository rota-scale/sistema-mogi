import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { cores, letra, sombra } from '@/tema'

interface Props {
  texto: string
  detalhe?: string
  tom?: 'neutro' | 'aviso' | 'erro' | 'certo'
  // Erro e aviso são lidos na hora pelo leitor de tela.
  children?: ReactNode
}

// Cartão curto por cima do mapa ou da câmera: uma frase e, no máximo,
// dois botões.
export function Cartao({ texto, detalhe, tom = 'neutro', children }: Props) {
  const urgente = tom === 'erro' || tom === 'aviso'
  return (
    <View
      style={[estilos.cartao, estilos[tom]]}
      accessibilityRole={urgente ? 'alert' : undefined}
      accessibilityLiveRegion={urgente ? 'assertive' : 'polite'}
    >
      <Text style={[estilos.texto, tom === 'erro' && { color: cores.cerejaFundo }, tom === 'certo' && { color: cores.creme }]}>{texto}</Text>
      {detalhe ? <Text style={estilos.detalhe}>{detalhe}</Text> : null}
      {children ? <View style={estilos.acoes}>{children}</View> : null}
    </View>
  )
}

const estilos = StyleSheet.create({
  cartao: { padding: 14, borderRadius: 18, borderWidth: 2.5, gap: 8, ...sombra },
  neutro: { backgroundColor: cores.papel, borderColor: cores.cafezal },
  aviso: { backgroundColor: cores.aviso, borderColor: cores.ipeFundo },
  erro: { backgroundColor: cores.cerejaClaro, borderColor: cores.cereja },
  certo: { backgroundColor: cores.folha, borderColor: cores.cafezal },
  texto: { fontSize: letra.base, fontWeight: '900', color: cores.cafezal },
  detalhe: { fontSize: letra.menor, fontWeight: '600', color: cores.cafe, marginTop: -4 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
})
