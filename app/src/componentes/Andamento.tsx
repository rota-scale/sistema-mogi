import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { buscarAndamento } from '@/api/acompanhar'
import { enderecoDaMidia } from '@/api/base'
import { useApp } from '@/estado/app'
import { passos, prazo } from '@/logica/palavras'
import type { Acompanhamento } from '@/logica/web'
import { cores, letra } from '@/tema'
import { Botao } from './Botao'
import { IconeCerto, IconeCompartilhar } from './icones'
import { Selo } from './Selo'

interface Props {
  protocolo: string
  chave: string | null
}

type Estado = { fase: 'buscando' } | { fase: 'pronto'; andamento: Acompanhamento } | { fase: 'falhou'; motivo: 'nao_encontrado' | 'sem_conexao' }

// Andamento de um relato: prazo no topo e a linha do tempo dos quatro
// passos. Puxar para baixo atualiza.
export function Andamento({ protocolo, chave }: Props) {
  const { aoConsultar } = useApp()
  const [estado, setEstado] = useState<Estado>({ fase: 'buscando' })
  const [atualizando, setAtualizando] = useState(false)

  const buscar = useCallback(async () => {
    const r = await (chave ? buscarAndamento(protocolo, chave) : Promise.resolve({ falha: 'nao_encontrado' } as const))
    if ('andamento' in r) {
      setEstado({ fase: 'pronto', andamento: r.andamento })
      aoConsultar(r.andamento)
    } else {
      // Uma atualização que falha não apaga o que já estava na tela.
      setEstado((e) => (e.fase === 'pronto' && r.falha === 'sem_conexao' ? e : { fase: 'falhou', motivo: r.falha }))
    }
  }, [protocolo, chave, aoConsultar])

  // A folha remonta este componente a cada protocolo (key), então o estado
  // já nasce em "buscando".
  useEffect(() => {
    // A busca só mexe no estado depois de esperar a resposta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void buscar()
  }, [buscar])

  const atualizar = () => {
    setAtualizando(true)
    void buscar().finally(() => setAtualizando(false))
  }

  const tentar = () => {
    setEstado({ fase: 'buscando' })
    void buscar()
  }

  const compartilhar = (a: Acompanhamento) => {
    // Só o protocolo: a chave de acompanhamento fica no aparelho.
    void Share.share({ message: `Protocolo MOGI ${a.protocolo}` }).catch(() => {})
  }

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.cafezal} colors={[cores.cafezal]} />}
    >
      <Text style={estilos.rotulo}>Protocolo</Text>
      <Text style={estilos.protocolo} selectable>
        {protocolo}
      </Text>

      {estado.fase === 'buscando' && (
        <View style={estilos.linha} accessibilityRole="progressbar" accessibilityLabel="Buscando o andamento">
          <ActivityIndicator color={cores.cafezal} />
          <Text style={estilos.texto}>Buscando o andamento…</Text>
        </View>
      )}

      {estado.fase === 'falhou' && (
        <View style={estilos.erro} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Text style={estilos.erroTexto}>
            {estado.motivo === 'nao_encontrado' ? 'Protocolo não encontrado.' : 'Sem internet agora.'}
          </Text>
          {estado.motivo === 'sem_conexao' && <Botao titulo="Tentar de novo" aoTocar={tentar} />}
        </View>
      )}

      {estado.fase === 'pronto' && (
        <>
          <View style={estilos.resumo}>
            <Selo nivel={estado.andamento.nivel} />
            {estado.andamento.categoria_nome !== '' && <Text style={estilos.texto}>{estado.andamento.categoria_nome}</Text>}
          </View>
          {prazo(estado.andamento.prazo_ate, estado.andamento.status) && (
            <Text style={estilos.prazo}>{prazo(estado.andamento.prazo_ate, estado.andamento.status)}</Text>
          )}

          <View style={estilos.passos}>
            {passos(estado.andamento).map((passo, i, todos) => (
              <View
                key={passo.tipo}
                style={estilos.passo}
                accessible
                accessibilityLabel={`${passo.rotulo}: ${passo.feito ? `feito ${passo.quando}` : passo.agora ? 'é o próximo' : 'ainda não'}`}
              >
                <View style={estilos.trilho}>
                  <View style={[estilos.bola, passo.feito && estilos.bolaFeita, passo.agora && estilos.bolaAgora]}>
                    {passo.feito && <IconeCerto tamanho={18} cor={cores.branco} />}
                  </View>
                  {i < todos.length - 1 && <View style={[estilos.fio, todos[i + 1].feito && estilos.fioFeito]} />}
                </View>
                <View style={estilos.passoTexto}>
                  <Text style={[estilos.passoNome, !passo.feito && estilos.passoPendente]}>{passo.rotulo}</Text>
                  {passo.quando !== '' && <Text style={estilos.passoHora}>{passo.quando}</Text>}
                </View>
              </View>
            ))}
          </View>

          {estado.andamento.o_que_foi_feito && (
            <View style={estilos.feito}>
              <Text style={estilos.rotulo}>O que foi feito</Text>
              <Text style={estilos.texto}>{estado.andamento.o_que_foi_feito}</Text>
            </View>
          )}

          {estado.andamento.fotos_do_depois.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fotos}>
              {estado.andamento.fotos_do_depois.map((caminho, i) => (
                <Image
                  key={caminho}
                  source={{ uri: enderecoDaMidia(caminho) }}
                  style={estilos.foto}
                  accessibilityLabel={`Foto do depois ${i + 1}`}
                />
              ))}
            </ScrollView>
          )}

          <Botao
            titulo="Compartilhar"
            tipo="secundario"
            icone={<IconeCompartilhar tamanho={24} />}
            aoTocar={() => compartilhar(estado.andamento)}
          />
        </>
      )}
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  conteudo: { gap: 14, paddingBottom: 12, paddingTop: 4 },
  rotulo: { fontSize: letra.menor, fontWeight: '900', color: cores.cafe, textTransform: 'uppercase', letterSpacing: 1 },
  protocolo: { marginTop: -10, fontSize: letra.titulo, fontWeight: '900', color: cores.cafezal },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  texto: { fontSize: letra.base, fontWeight: '600', color: cores.cafezal, flexShrink: 1 },
  resumo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  prazo: { fontSize: letra.maior, fontWeight: '900', color: cores.cafezal },
  passos: { paddingVertical: 4 },
  passo: { flexDirection: 'row', gap: 14, minHeight: 60 },
  trilho: { width: 32, alignItems: 'center' },
  bola: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: cores.apagado,
    backgroundColor: cores.papel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bolaAgora: { borderColor: cores.cafezal, borderStyle: 'dashed' },
  bolaFeita: { backgroundColor: cores.folha, borderColor: cores.cafezal },
  fio: { flex: 1, width: 4, backgroundColor: cores.creme2 },
  fioFeito: { backgroundColor: cores.folha },
  passoTexto: { flex: 1, paddingTop: 3, paddingBottom: 12 },
  passoNome: { fontSize: letra.base, fontWeight: '900', color: cores.cafezal },
  passoPendente: { fontWeight: '600', color: cores.cafe },
  passoHora: { fontSize: letra.menor, fontWeight: '600', color: cores.cafe },
  feito: { gap: 4, padding: 14, borderRadius: 16, backgroundColor: cores.papel, borderWidth: 2, borderColor: cores.creme2 },
  fotos: { gap: 10 },
  foto: { width: 150, height: 110, borderRadius: 16, backgroundColor: cores.creme2, borderWidth: 2, borderColor: cores.cafezal },
  erro: { gap: 12, padding: 14, borderRadius: 16, backgroundColor: cores.cerejaClaro, borderWidth: 2, borderColor: cores.cereja },
  erroTexto: { fontSize: letra.base, fontWeight: '700', color: cores.cerejaFundo },
})
