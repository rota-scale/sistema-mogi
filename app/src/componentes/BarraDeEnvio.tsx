import { StyleSheet, Text, View } from 'react-native'
import { porcentagem, textoDoProgresso } from '@/logica/web'
import type { Midias, Progresso } from '@/logica/web'
import { cores, letra } from '@/tema'

// Progresso real do upload e, depois, "Analisando o relato…".
export function BarraDeEnvio({ progresso, midias }: { progresso: Progresso; midias: Midias }) {
  const enviando = progresso.fase === 'enviando'
  const largura = progresso.fase === 'analisando' ? 100 : Math.max(4, porcentagem(progresso))
  const texto = textoDoProgresso(progresso, midias)
  return (
    <View
      style={estilos.caixa}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Envio do relato"
      accessibilityValue={enviando ? { min: 0, max: 100, now: porcentagem(progresso), text: texto } : { text: texto }}
      // O leitor de tela ouve a troca de etapa, não cada porcentagem.
      accessibilityLiveRegion={enviando ? 'none' : 'polite'}
    >
      <Text style={estilos.texto}>{texto}</Text>
      <View style={estilos.barra}>
        <View style={[estilos.cheio, { width: `${largura}%` }, !enviando && estilos.incerto]} />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  caixa: { gap: 10, minHeight: 64, justifyContent: 'center' },
  texto: { textAlign: 'center', fontSize: letra.base, fontWeight: '900', color: cores.cafezal, fontVariant: ['tabular-nums'] },
  barra: { height: 18, borderRadius: 9, backgroundColor: cores.creme2, borderWidth: 2.5, borderColor: cores.cafezal, overflow: 'hidden' },
  cheio: { height: '100%', borderRadius: 9, backgroundColor: cores.cafezal },
  incerto: { backgroundColor: cores.folha },
})
