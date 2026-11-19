import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { temServidor } from '@/api/base'
import { Andamento } from '@/componentes/Andamento'
import { Botao } from '@/componentes/Botao'
import { BotaoDeCanto } from '@/componentes/BotaoDeCanto'
import { Cartao } from '@/componentes/Cartao'
import { Folha } from '@/componentes/Folha'
import { IconeCamera, IconeLista, IconeMira, IconeSemRede, IconeSom } from '@/componentes/icones'
import { MapaDaRua } from '@/componentes/mapas'
import { Selo } from '@/componentes/Selo'
import { useApp } from '@/estado/app'
import { useLocal } from '@/estado/localizacao'
import { SEM_SERVIDOR } from '@/logica/corpo'
import { textoDaFila } from '@/logica/fila'
import { avisoCurtoDoLocal } from '@/logica/local'
import { dataHoraSemIntl } from '@/logica/palavras'
import { CONFIG_PADRAO, formatarDataHora, pinosDosRecentes } from '@/logica/web'
import { cores, letra, sombra } from '@/tema'

// "12/11 às 14:30"; o app web usa Intl, que pode faltar no aparelho.
function quando(iso: string): string {
  try {
    return formatarDataHora(iso)
  } catch {
    return dataHoraSemIntl(iso)
  }
}

type FolhaAberta = { tipo: 'nenhuma' } | { tipo: 'relatos' } | { tipo: 'andamento'; protocolo: string } | { tipo: 'fila' }

// Tela inicial: o mapa com a pessoa (o boneco) e os relatos dela, e um
// botão só, o da câmera. O resto fica nos cantos.
export default function Inicio() {
  const margens = useSafeAreaInsets()
  const app = useApp()
  const local = useLocal()
  const [seguindo, setSeguindo] = useState(true)
  const [folha, setFolha] = useState<FolhaAberta>({ tipo: 'nenhuma' })

  const pinos = useMemo(() => pinosDosRecentes(app.relatos), [app.relatos])
  const pessoa = useMemo(() => (local.aqui ? { lat: local.aqui.lat, lng: local.aqui.lng } : null), [local.aqui])
  const avisoDoLocal = local.aqui ? null : avisoCurtoDoLocal(local.situacao)
  const fila = textoDaFila(app.fila.length)
  const fechar = () => setFolha({ tipo: 'nenhuma' })
  const tituloDaFolha =
    folha.tipo === 'relatos' ? 'Meus relatos' : folha.tipo === 'andamento' ? 'Andamento' : (fila ?? 'Nada esperando a internet')
  const aberto = folha.tipo === 'andamento' ? app.relatos.find((r) => r.protocolo === folha.protocolo) : undefined

  return (
    <View style={estilos.tela}>
      <MapaDaRua
        centro={(app.config ?? CONFIG_PADRAO).centro}
        pessoa={pessoa}
        andando={local.andando}
        pinos={pinos}
        destaque={app.destaque}
        seguindo={seguindo}
        aoSoltar={() => setSeguindo(false)}
        aoTocarPino={(protocolo) => setFolha({ tipo: 'andamento', protocolo })}
      />

      <View style={[estilos.topo, { top: margens.top + 10 }]} pointerEvents="box-none">
        {app.aviso && <Cartao texto={app.aviso.texto} tom={app.aviso.tom === 'certo' ? 'certo' : 'neutro'} />}
        {!temServidor && <Cartao texto={SEM_SERVIDOR} tom="erro" />}
        {avisoDoLocal && (
          <Cartao texto={avisoDoLocal} tom="aviso">
            {local.situacao === 'negado' && (
              <Botao titulo="Abrir os ajustes" tipo="destaque" aoTocar={() => void Linking.openSettings()} estilo={estilos.acao} />
            )}
            <Botao titulo="Tentar de novo" tipo="claro" ocupado={local.buscando} aoTocar={local.buscar} estilo={estilos.acao} />
          </Cartao>
        )}
        {fila && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fila}
            accessibilityHint="Abre as opções de enviar agora ou descartar"
            onPress={() => setFolha({ tipo: 'fila' })}
            style={estilos.fila}
          >
            <IconeSemRede tamanho={24} />
            <Text style={estilos.filaTexto}>{fila}</Text>
          </Pressable>
        )}
      </View>

      <View style={[estilos.base, { bottom: Math.max(20, margens.bottom + 12) }]} pointerEvents="box-none">
        <View style={estilos.canto}>
          {app.relatos.length > 0 && (
            <BotaoDeCanto rotulo="Meus relatos" conta={app.relatos.length} aoTocar={() => setFolha({ tipo: 'relatos' })}>
              <IconeLista tamanho={28} />
            </BotaoDeCanto>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fotografar o problema"
          accessibilityHint="Abre a câmera"
          onPress={() => router.push('/camera')}
          style={({ pressed }) => [estilos.camera, pressed && estilos.cameraApertada]}
        >
          <IconeCamera tamanho={50} />
        </Pressable>

        <View style={estilos.canto}>
          <BotaoDeCanto rotulo={app.somLigado ? 'Som ligado. Toque para desligar' : 'Som desligado. Toque para ligar'} aoTocar={app.alternarSom}>
            <IconeSom tamanho={28} ligado={app.somLigado} />
          </BotaoDeCanto>
          {!seguindo && pessoa && (
            <BotaoDeCanto rotulo="Centralizar em mim" aoTocar={() => setSeguindo(true)}>
              <IconeMira tamanho={28} />
            </BotaoDeCanto>
          )}
        </View>
      </View>

      {/* Uma folha só, que troca de conteúdo: duas folhas trocando de lugar
          ao mesmo tempo travam no iPhone. */}
      <Folha aberta={folha.tipo !== 'nenhuma'} titulo={tituloDaFolha} aoFechar={fechar}>
        {folha.tipo === 'relatos' && (
          <FlatList
            data={app.relatos}
            keyExtractor={(r) => r.protocolo}
            ItemSeparatorComponent={() => <View style={estilos.separador} />}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Relato ${item.protocolo}, de ${quando(item.criado_em)}`}
                accessibilityHint="Abre o andamento"
                onPress={() => setFolha({ tipo: 'andamento', protocolo: item.protocolo })}
                style={({ pressed }) => [estilos.relato, pressed && { opacity: 0.6 }]}
              >
                <View style={estilos.relatoTexto}>
                  <Text style={estilos.relatoProtocolo}>{item.protocolo}</Text>
                  <Text style={estilos.relatoData}>{quando(item.criado_em)}</Text>
                </View>
                <Selo nivel={item.nivel} pequeno />
              </Pressable>
            )}
          />
        )}
        {folha.tipo === 'andamento' && <Andamento key={folha.protocolo} protocolo={folha.protocolo} chave={aberto?.chave ?? null} />}
        {folha.tipo === 'fila' && (
          <View style={estilos.opcoes}>
            <Botao titulo="Enviar agora" ocupado={app.enviandoFila} desligado={app.fila.length === 0} aoTocar={app.enviarFila} />
            {app.fila.map((item, i) => (
              <Botao
                key={item.chave}
                titulo={app.fila.length > 1 ? `Descartar o relato ${i + 1}` : 'Descartar'}
                tipo="secundario"
                desligado={app.enviandoFila}
                aoTocar={() => app.descartarDaFila(item.chave)}
              />
            ))}
          </View>
        )}
      </Folha>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.creme2 },
  topo: { position: 'absolute', left: 16, right: 16, gap: 10 },
  acao: { minHeight: 48, paddingVertical: 8, flexGrow: 1 },
  fila: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: cores.aviso,
    borderWidth: 2.5,
    borderColor: cores.ipeFundo,
    ...sombra,
  },
  filaTexto: { flex: 1, fontSize: letra.base, fontWeight: '900', color: cores.cafezal },
  base: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  canto: { width: 64, alignItems: 'center', gap: 12, flexDirection: 'column-reverse' },
  camera: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.ipe,
    borderWidth: 5,
    borderColor: cores.cafezal,
    ...sombra,
  },
  cameraApertada: { backgroundColor: cores.ipeFundo, transform: [{ scale: 0.95 }] },
  separador: { height: 2, backgroundColor: cores.creme2 },
  relato: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8 },
  relatoTexto: { flex: 1 },
  relatoProtocolo: { fontSize: letra.base, fontWeight: '900', color: cores.cafezal },
  relatoData: { fontSize: letra.menor, fontWeight: '600', color: cores.cafe },
  opcoes: { gap: 10, paddingTop: 6 },
})
