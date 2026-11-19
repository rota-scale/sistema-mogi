import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { cores } from '@/tema'

const TROCA_DE_PASSO_MS = 320

// O morador no mapa: um boneco no lugar da seta. Anda (troca de passo e
// balança de leve) só quando a pessoa anda. Feito de formas simples porque
// o mapa do Android transforma o marcador numa imagem.
export function Boneco({ andando }: { andando: boolean }) {
  const [par, setPar] = useState(false)

  useEffect(() => {
    if (!andando) return
    const relogio = setInterval(() => setPar((p) => !p), TROCA_DE_PASSO_MS)
    return () => clearInterval(relogio)
  }, [andando])

  // 0: parado. 1 e 2: os dois passos da caminhada.
  const passo = !andando ? 0 : par ? 2 : 1

  const frente = passo === 1 ? '22deg' : passo === 2 ? '-22deg' : '0deg'
  const tras = passo === 1 ? '-22deg' : passo === 2 ? '22deg' : '0deg'
  const balanco = passo === 1 ? '-4deg' : passo === 2 ? '4deg' : '0deg'

  return (
    <View style={estilos.caixa} accessible={false}>
      <View style={[estilos.corpoTodo, { transform: [{ rotate: balanco }] }]}>
        <View style={estilos.cabeca} />
        <View style={estilos.tronco}>
          <View style={[estilos.braco, estilos.bracoEsquerdo, { transform: [{ rotate: tras }] }]} />
          <View style={[estilos.braco, estilos.bracoDireito, { transform: [{ rotate: frente }] }]} />
        </View>
        <View style={estilos.pernas}>
          <View style={[estilos.perna, { transform: [{ rotate: frente }] }]} />
          <View style={[estilos.perna, { transform: [{ rotate: tras }] }]} />
        </View>
      </View>
      <View style={estilos.chao} />
    </View>
  )
}

const borda = { borderWidth: 2, borderColor: cores.papel } as const

const estilos = StyleSheet.create({
  caixa: { width: 56, height: 72, alignItems: 'center', justifyContent: 'flex-end' },
  corpoTodo: { alignItems: 'center', zIndex: 1 },
  cabeca: { width: 20, height: 20, borderRadius: 10, backgroundColor: cores.ipe, ...borda, zIndex: 2 },
  tronco: { width: 22, height: 24, marginTop: -3, borderRadius: 9, backgroundColor: cores.cafezal, ...borda },
  braco: { position: 'absolute', top: 2, width: 7, height: 18, borderRadius: 4, backgroundColor: cores.folha, ...borda, borderWidth: 1.5 },
  bracoEsquerdo: { left: -8 },
  bracoDireito: { right: -8 },
  pernas: { flexDirection: 'row', gap: 3, marginTop: -4 },
  perna: { width: 8, height: 20, borderRadius: 4, backgroundColor: cores.cafe, ...borda, borderWidth: 1.5 },
  // Sombra no chão: mostra onde a pessoa está pisando.
  chao: { width: 30, height: 8, borderRadius: 4, marginTop: -4, backgroundColor: 'rgba(31, 77, 43, 0.3)' },
})
