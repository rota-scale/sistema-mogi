import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { nomeCurto } from '@/logica/web'
import type { Categoria } from '@/logica/web'
import { cores, letra } from '@/tema'
import { IconeDoTipo } from './icones'

// Grade de tipos com desenho grande e uma palavra, três por linha. Um toque escolhe e
// envia. Só aparece quando o servidor está sem a triagem por IA.
export function GradeDeTipos({ tipos, aoEscolher }: { tipos: Categoria[]; aoEscolher: (id: string) => void }) {
  return (
    <ScrollView contentContainerStyle={estilos.grade}>
      {tipos.map((t) => (
        <Pressable
          key={t.id}
          accessibilityRole="button"
          accessibilityLabel={t.nome}
          accessibilityHint="Escolhe este tipo e envia o relato"
          onPress={() => aoEscolher(t.id)}
          style={({ pressed }) => [estilos.celula, pressed && estilos.apertada]}
        >
          <View style={estilos.disco}>
            <IconeDoTipo id={t.id} tamanho={38} />
          </View>
          <Text style={estilos.nome} numberOfLines={1} adjustsFontSizeToFit>
            {nomeCurto(t.id, t.nome)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingBottom: 8, paddingTop: 4 },
  celula: {
    width: '31.5%',
    minHeight: 116,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: cores.cafezal,
    backgroundColor: cores.papel,
    alignItems: 'center',
    gap: 6,
  },
  apertada: { backgroundColor: cores.ipe },
  disco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.creme2 },
  nome: { fontSize: letra.base, fontWeight: '800', color: cores.cafezal, textAlign: 'center' },
})
