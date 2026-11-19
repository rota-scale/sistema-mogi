import { CameraView, useCameraPermissions } from 'expo-camera'
import type { CameraMode } from 'expo-camera'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { APP_WEB } from '@/api/base'
import { enviarRelato, FalhaDeEnvio } from '@/api/envio'
import { buscarPerto, confirmarPerto } from '@/api/perto'
import { avisar } from '@/api/telemetria'
import { novoUuid } from '@/aparelho/identidade'
import { tocar } from '@/aparelho/sons'
import { apagarArquivo, quadrosDoVideo, reduzirFoto, tamanhoDoArquivo } from '@/aparelho/midia'
import { BarraDeEnvio } from '@/componentes/BarraDeEnvio'
import { Botao } from '@/componentes/Botao'
import { BotaoDeCanto } from '@/componentes/BotaoDeCanto'
import { Cartao } from '@/componentes/Cartao'
import { Folha } from '@/componentes/Folha'
import { GradeDeTipos } from '@/componentes/GradeDeTipos'
import { IconeFechar, IconeTeclado, IconeTocar } from '@/componentes/icones'
import { temMapa } from '@/componentes/mapas'
import { useApp } from '@/estado/app'
import { useLocal } from '@/estado/localizacao'
import { CADASTRO_PELO_WEB, tipoDoVideo } from '@/logica/corpo'
import { FILA_CHEIA, GUARDADO_NA_FILA, cabeNaFila, podeEsperarInternet } from '@/logica/fila'
import type { VideoNaFila } from '@/logica/fila'
import { avisoCurtoDoLocal, saidasDoLocal, SEM_MAPA_USE_O_SITE } from '@/logica/local'
import { fraseCurta, idadeEmPalavras } from '@/logica/palavras'
import {
  acaoDoErro,
  avisoDoDefeito,
  camposDoRelato,
  categoriaEfetiva,
  categoriaValida,
  CONFIG_PADRAO,
  defeitoDoVideo,
  depoisDaConfirmacao,
  escolherPerto,
  linhaDoPerto,
  mensagemDaConfirmacao,
  SEGURAR_MS,
  duracaoPorExtenso,
  escolhaAposConfig,
  formatarDuracao,
  FOTO_ILEGIVEL,
  LIMITE_TEXTO,
  mensagemDeErro,
  pedeMapa,
  rotuloDoEnvio,
  segundosRestantes,
  SEM_GRAVACAO,
  vagasDeFoto,
} from '@/logica/web'
import type { CodigoDeErro, Midias, Progresso, Proximo } from '@/logica/web'
import { cores, letra, sombra, toque } from '@/tema'

interface Foto {
  id: number
  // Sempre o JPEG já reduzido: é o que vai ao servidor e o que a miniatura mostra.
  uri: string
}

type Envio = { fase: 'parado' } | { fase: 'enviando'; progresso: Progresso; midias: Midias } | { fase: 'falhou'; codigo: CodigoDeErro }

type Gravacao = 'nao' | 'preparando' | 'gravando' | 'fechando'

const PARADO: Envio = { fase: 'parado' }

const agora = () => Date.now()

// Depois de trocar para o modo de vídeo, a câmera leva um instante para
// ficar pronta. O Android avisa; o iPhone não, então vale o prazo.
const ESPERA_DO_MODO_MS = Platform.OS === 'ios' ? 500 : 1200

// Câmera traseira em tela cheia: tocar no disparador tira foto, segurar
// grava vídeo sem som. É aqui também que o relato é enviado.
export default function Camera() {
  const margens = useSafeAreaInsets()
  const app = useApp()
  const local = useLocal()
  const [permissao, pedirPermissao] = useCameraPermissions()

  const [fotos, setFotos] = useState<Foto[]>([])
  const [chegando, setChegando] = useState(0)
  const [video, setVideo] = useState<VideoNaFila | null>(null)
  const [texto, setTexto] = useState('')
  const [campoAberto, setCampoAberto] = useState(false)
  // null: o morador ainda não tocou em nenhum tipo.
  const [escolha, setEscolha] = useState<string | null>(null)
  const [gradeAberta, setGradeAberta] = useState(false)
  const [envio, setEnvio] = useState<Envio>(PARADO)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [modo, setModo] = useState<CameraMode>('picture')
  const [pronta, setPronta] = useState(false)
  const [gravacao, setGravacao] = useState<Gravacao>('nao')
  const [decorridoMs, setDecorridoMs] = useState(0)

  const [perto, setPerto] = useState<Proximo | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const camera = useRef<CameraView>(null)
  const serie = useRef(0)
  const segurando = useRef(false)
  const aoFicarPronta = useRef<(() => void) | null>(null)
  const pertoBuscado = useRef(false)
  // Chave de idempotência do relato: vai igual em toda nova tentativa do
  // mesmo conjunto de fotos e vídeo, para o servidor não duplicar.
  const chave = useRef('')
  const chaveDoTambemVi = useRef('')
  const cameraNegadaAvisada = useRef(false)
  const montada = useRef(true)

  const config = app.config
  const midia = (config ?? CONFIG_PADRAO).midia
  const cidade = (config ?? CONFIG_PADRAO).cidade
  const enviando = envio.fase === 'enviando'
  const acao = envio.fase === 'falhou' ? acaoDoErro(envio.codigo) : null
  const vagas = vagasDeFoto(fotos.length + chegando, midia)
  const ofereceVideo = (config ?? CONFIG_PADRAO).modulos.video
  const ocupada = gravacao !== 'nao'
  const posicao = local.posicao
  const liberado = fotos.length > 0 && chegando === 0 && posicao !== null && !enviando && !ocupada && acao !== 'menos_fotos'
  const proximo = envio.fase === 'parado' && !ocupada ? perto : null

  useEffect(() => {
    if (permissao && !permissao.granted && permissao.canAskAgain) void pedirPermissao()
    if (permissao && !permissao.granted && !permissao.canAskAgain && !cameraNegadaAvisada.current) {
      cameraNegadaAvisada.current = true
      avisar('camera_negada')
    }
  }, [permissao, pedirPermissao])

  useEffect(() => {
    montada.current = true
    return () => {
      montada.current = false
    }
  }, [])

  // "Perto de você": uma consulta por relato, assim que há um lugar.
  const lat = posicao?.lat
  const lng = posicao?.lng
  const consultaPerto = config?.modulos.perto === true
  useEffect(() => {
    if (!consultaPerto || pertoBuscado.current || lat === undefined || lng === undefined) return
    pertoBuscado.current = true
    let vivo = true
    // Um cartão só, o do chamado mais perto: a regra é a do app web.
    void buscarPerto(lat, lng).then((lista) => vivo && setPerto(escolherPerto(lista)))
    return () => {
      vivo = false
    }
  }, [consultaPerto, lat, lng])

  // Todo aviso desta tela é de algo que não saiu: vai com o som de erro,
  // que nunca é o único sinal (a frase está na tela e no leitor de tela).
  const dizer = useCallback((frase: string | null) => {
    setAviso(frase)
    if (!frase) return
    tocar('erro')
    AccessibilityInfo.announceForAccessibility(frase)
  }, [])

  // Outro conjunto de fotos e vídeo é outro pedido para o servidor: ganha
  // outra chave, e a falha do pedido anterior deixa de valer.
  const midiasMudaram = () => {
    chave.current = novoUuid()
    setEnvio((e) => (e.fase === 'falhou' ? PARADO : e))
  }

  const tirarFoto = async () => {
    if (!pronta || ocupada || enviando || modo !== 'picture') return
    if (vagas <= 0) return dizer(fraseCurta(mensagemDeErro('fotos_demais', cidade, midia)))
    dizer(null)
    setChegando((n) => n + 1)
    try {
      const tirada = await camera.current?.takePictureAsync({ quality: 0.9, exif: false })
      if (!tirada) throw new Error('sem foto')
      const uri = await reduzirFoto(tirada.uri, tirada.width, tirada.height)
      if (uri !== tirada.uri) apagarArquivo(tirada.uri)
      const id = ++serie.current
      setFotos((lista) => [...lista, { id, uri }])
      midiasMudaram()
      tocar('foto')
      AccessibilityInfo.announceForAccessibility('Foto tirada.')
    } catch {
      avisar('foto_ilegivel', 'camera')
      dizer(fraseCurta(FOTO_ILEGIVEL))
    } finally {
      setChegando((n) => n - 1)
    }
  }

  const removerFoto = (id: number) => {
    const foto = fotos.find((f) => f.id === id)
    if (!foto) return
    apagarArquivo(foto.uri)
    setFotos((lista) => lista.filter((f) => f.id !== id))
    midiasMudaram()
    dizer(null)
    AccessibilityInfo.announceForAccessibility('Foto removida.')
  }

  const removerVideo = () => {
    if (video) apagarArquivo(video.uri)
    setVideo(null)
    midiasMudaram()
    AccessibilityInfo.announceForAccessibility('Vídeo removido.')
  }

  const videoFalhou = (frase: string, detalhe: string) => {
    avisar('video_falhou', detalhe)
    dizer(fraseCurta(frase))
  }

  // Segurar o disparador: troca a câmera para vídeo, espera ficar pronta e
  // grava até soltar ou até o limite do servidor.
  const comecarVideo = async () => {
    if (!ofereceVideo || video || !pronta || ocupada || enviando) return
    segurando.current = true
    dizer(null)
    setGravacao('preparando')
    setDecorridoMs(0)
    setModo('video')
    await new Promise<void>((ok) => {
      const relogio = setTimeout(ok, ESPERA_DO_MODO_MS)
      aoFicarPronta.current = () => {
        clearTimeout(relogio)
        // Um respiro depois do aviso da câmera, para o gravador ligar.
        setTimeout(ok, 150)
      }
    })
    aoFicarPronta.current = null
    if (!segurando.current) {
      setModo('picture')
      setGravacao('nao')
      return
    }
    const inicio = agora()
    const relogio = setInterval(() => setDecorridoMs(agora() - inicio), 250)
    setGravacao('gravando')
    tocar('gravar')
    AccessibilityInfo.announceForAccessibility('Gravando vídeo sem som. Solte para parar.')
    try {
      const gravado = await camera.current?.recordAsync({ maxDuration: midia.video_segundos })
      clearInterval(relogio)
      setGravacao('fechando')
      tocar('parar')
      if (!gravado?.uri) throw new Error('sem arquivo')
      const duracaoMs = Math.min(agora() - inicio, midia.video_segundos * 1000)
      const defeito = defeitoDoVideo(tamanhoDoArquivo(gravado.uri), duracaoMs, midia)
      if (defeito) {
        apagarArquivo(gravado.uri)
        videoFalhou(avisoDoDefeito(defeito), defeito)
      } else {
        const quadros = await quadrosDoVideo(gravado.uri, duracaoMs, midia.quadros_max)
        setVideo({ uri: gravado.uri, tipo: tipoDoVideo(gravado.uri), duracaoMs, quadros })
        midiasMudaram()
        AccessibilityInfo.announceForAccessibility(`Vídeo de ${duracaoPorExtenso(duracaoMs)} gravado.`)
      }
    } catch {
      videoFalhou(SEM_GRAVACAO, 'gravacao')
    } finally {
      clearInterval(relogio)
      segurando.current = false
      setModo('picture')
      setGravacao('nao')
    }
  }

  const pararVideo = () => {
    segurando.current = false
    aoFicarPronta.current?.()
    if (gravacao === 'gravando') camera.current?.stopRecording()
  }

  const aoTocarNoDisparador = () => {
    // Quem começou a gravar pelo leitor de tela para com um toque.
    if (gravacao === 'gravando') pararVideo()
    else void tirarFoto()
  }

  const sair = () => {
    if (ocupada) pararVideo()
    router.back()
  }

  const concluir = (frase: string) => {
    app.avisarNaTela(frase)
    local.usarGps()
    // Se a pessoa já voltou ao mapa durante o envio, não há o que fechar.
    if (montada.current) router.back()
  }

  const enviar = async (tipoEscolhido: string | null = escolha) => {
    if (fotos.length === 0 || chegando > 0 || !posicao || enviando) return
    const midias: Midias = { fotos: fotos.length, video: video !== null }
    // Se a config ainda não chegou, espera a resposta (ou o prazo) antes de
    // decidir se o tipo é obrigatório.
    const c = config ?? (await app.configFinal())
    const tipo = categoriaEfetiva(escolhaAposConfig(tipoEscolhido, c), c.ia_ativa)
    if (!categoriaValida(tipo, c.ia_ativa)) {
      setGradeAberta(true)
      return
    }
    setGradeAberta(false)
    dizer(null)
    setEnvio({ fase: 'enviando', progresso: { fase: 'preparando' }, midias })
    try {
      const r = await enviarRelato({
        fotos: fotos.map((f) => f.uri),
        video,
        campos: camposDoRelato({ posicao, categoria: tipo, texto }),
        chave: (chave.current ||= novoUuid()),
        aoProgredir: (progresso) => setEnvio({ fase: 'enviando', progresso, midias }),
      })
      app.registrar(r, posicao.lat, posicao.lng)
      tocar('enviado')
      concluir('Enviado')
    } catch (e) {
      const codigo = e instanceof FalhaDeEnvio ? e.codigo : 'desconhecido'
      avisar('envio_falhou', codigo)
      const oQueFazer = acaoDoErro(codigo)
      // O servidor recusou este conteúdo e nada foi criado: o relato
      // corrigido vai com outra chave. Falha de rede mantém a mesma.
      if (oQueFazer !== 'repetir') chave.current = novoUuid()
      if (oQueFazer === 'outra_foto') {
        fotos.forEach((f) => apagarArquivo(f.uri))
        setFotos([])
        setEnvio(PARADO)
        dizer(fraseCurta(mensagemDeErro(codigo, c.cidade, c.midia)))
        return
      }
      // O servidor não aceitou o vídeo: ele sai do relato, que já vale com
      // as fotos, e o próximo toque envia sem ele.
      if (oQueFazer === 'sem_video') setVideo(null)
      setEnvio({ fase: 'falhou', codigo })
      tocar('erro')
      AccessibilityInfo.announceForAccessibility(oQueFazer === 'cadastro' ? CADASTRO_PELO_WEB : fraseCurta(mensagemDeErro(codigo, c.cidade, c.midia)))
    }
  }

  // Sem internet: o relato fica guardado no aparelho, com a mesma chave, e
  // vai sozinho quando a conexão voltar.
  const esperarInternet = async () => {
    if (!posicao || fotos.length === 0) return
    if (!cabeNaFila(app.fila)) return dizer(FILA_CHEIA)
    const c = config ?? (await app.configFinal())
    setGuardando(true)
    try {
      await app.esperarInternet({
        chave: (chave.current ||= novoUuid()),
        campos: camposDoRelato({ posicao, categoria: categoriaEfetiva(escolhaAposConfig(escolha, c), c.ia_ativa), texto }),
        fotos: fotos.map((f) => f.uri),
        video,
        guardadoEm: new Date().toISOString(),
      })
      concluir(GUARDADO_NA_FILA)
    } catch {
      dizer('Não consegui guardar o relato.')
    } finally {
      setGuardando(false)
    }
  }

  const tambemVi = async (p: Proximo) => {
    if (!posicao || confirmando) return
    setConfirmando(true)
    const r = await confirmarPerto(p.ref, posicao.lat, posicao.lng, (chaveDoTambemVi.current ||= novoUuid()))
    setConfirmando(false)
    if ('resposta' in r) {
      app.registrar(r.resposta, posicao.lat, posicao.lng)
      tocar('tambem_vi')
      concluir('Obrigado')
      return
    }
    dizer(r.codigo === 'cadastro_obrigatorio' ? CADASTRO_PELO_WEB : fraseCurta(mensagemDaConfirmacao(r.codigo)))
    if (depoisDaConfirmacao(r.codigo) !== 'tentar') ehOutro()
  }

  const ehOutro = () => {
    chaveDoTambemVi.current = ''
    setPerto(null)
  }

  if (!permissao) return <View style={estilos.tela} />

  if (!permissao.granted) {
    return (
      <View style={[estilos.semCamera, { paddingTop: margens.top + 24, paddingBottom: margens.bottom + 24 }]}>
        <Text style={estilos.semCameraTexto} accessibilityRole="alert">
          Sem acesso à câmera.
        </Text>
        {permissao.canAskAgain ? (
          <Botao titulo="Permitir a câmera" aoTocar={() => void pedirPermissao()} />
        ) : (
          <Botao titulo="Abrir os ajustes" aoTocar={() => void Linking.openSettings()} />
        )}
        <Botao titulo="Voltar" tipo="secundario" aoTocar={() => router.back()} />
      </View>
    )
  }

  const avisoDoLocal = posicao ? null : avisoCurtoDoLocal(local.situacao)
  const saidas = saidasDoLocal(local.situacao, temMapa)
  const restantes = segundosRestantes(decorridoMs, midia.video_segundos)
  const temMidias = fotos.length > 0 || chegando > 0 || video !== null

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* "mute" liga antes de a câmera entrar no modo de vídeo (ela nasce em
          foto), então o microfone nunca é aberto e o arquivo sai sem trilha
          de áudio: o servidor recusa vídeo com som. */}
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode={modo}
        mute
        videoQuality="720p"
        onCameraReady={() => {
          if (!pronta) tocar('camera')
          setPronta(true)
          aoFicarPronta.current?.()
        }}
        onMountError={() => {
          avisar('camera_negada', 'abrir')
          dizer('Não consegui abrir a câmera.')
        }}
      />

      <View style={[estilos.topo, { top: margens.top + 10 }]} pointerEvents="box-none">
        <View style={estilos.topoLinha} pointerEvents="box-none">
          <BotaoDeCanto rotulo="Fechar a câmera" aoTocar={sair} escuro>
            <IconeFechar tamanho={26} cor={cores.creme} />
          </BotaoDeCanto>
          {gravacao === 'gravando' && (
            <View style={estilos.gravando} accessible accessibilityLabel={`Gravando, faltam ${restantes} segundos`}>
              <View style={estilos.ponto} />
              <Text style={estilos.gravandoTexto}>
                {formatarDuracao(decorridoMs)} / {formatarDuracao(midia.video_segundos * 1000)}
              </Text>
            </View>
          )}
        </View>

        {proximo && (
          <Cartao texto="Já relataram aqui" detalhe={[linhaDoPerto(proximo), idadeEmPalavras(proximo.desde)].filter(Boolean).join(' · ')}>
            <Botao titulo="Também vi" tipo="destaque" ocupado={confirmando} aoTocar={() => void tambemVi(proximo)} estilo={estilos.acao} />
            <Botao titulo="É outro" tipo="claro" desligado={confirmando} aoTocar={ehOutro} estilo={estilos.acao} />
          </Cartao>
        )}

        {avisoDoLocal && (
          <Cartao texto={avisoDoLocal} tom="aviso" detalhe={saidas.includes('mapa') ? undefined : SEM_MAPA_USE_O_SITE}>
            {saidas.includes('ajustes') && (
              <Botao titulo="Abrir os ajustes" tipo="destaque" aoTocar={() => void Linking.openSettings()} estilo={estilos.acao} />
            )}
            {saidas.includes('mapa') && (
              <Botao titulo="Marcar no mapa" tipo="destaque" aoTocar={() => router.push('/local')} estilo={estilos.acao} />
            )}
            {saidas.includes('repetir') && (
              <Botao titulo="Tentar de novo" tipo="claro" ocupado={local.buscando} aoTocar={local.buscar} estilo={estilos.acao} />
            )}
          </Cartao>
        )}
        {!posicao && !pedeMapa(local.situacao) && temMidias && <Cartao texto="Procurando você…" />}
        {local.situacao === 'manual' && (
          <Cartao texto="Lugar marcado no mapa">
            <Botao titulo="Usar o GPS" tipo="claro" aoTocar={local.usarGps} estilo={estilos.acao} />
          </Cartao>
        )}
        {aviso && <Cartao texto={aviso} tom="erro" />}
      </View>

      <View style={[estilos.painel, { paddingBottom: Math.max(16, margens.bottom + 8) }]}>
        {envio.fase === 'falhou' && (
          <Cartao texto={acao === 'cadastro' ? CADASTRO_PELO_WEB : fraseCurta(mensagemDeErro(envio.codigo, cidade, midia))} tom="erro">
            {acao === 'cadastro' && APP_WEB !== '' && (
              <Botao titulo="Abrir o app web" tipo="destaque" aoTocar={() => void Linking.openURL(APP_WEB)} estilo={estilos.acao} />
            )}
            {(acao === 'repetir' || acao === 'sem_video') && (
              <Botao titulo={rotuloDoEnvio(acao, fotos.length)} aoTocar={() => void enviar()} desligado={!liberado} estilo={estilos.acao} />
            )}
            {acao === 'mapa' && temMapa && (
              <Botao
                titulo="Marcar no mapa"
                tipo="destaque"
                aoTocar={() => {
                  // Com outro lugar marcado, o erro de lugar deixa de valer.
                  setEnvio(PARADO)
                  router.push('/local')
                }}
                estilo={estilos.acao}
              />
            )}
            {podeEsperarInternet(envio.codigo) && (
              <Botao
                titulo="Enviar quando a internet voltar"
                tipo="claro"
                ocupado={guardando}
                aoTocar={() => void esperarInternet()}
                estilo={estilos.acao}
              />
            )}
          </Cartao>
        )}

        {/* Sem botão de voz: o ditado do web usa a fala do navegador, que
            não existe no Expo Go. O microfone do teclado do sistema dita
            direto neste campo. */}
        {campoAberto && !enviando && (
          <TextInput
            value={texto}
            onChangeText={(t) => setTexto(t.slice(0, LIMITE_TEXTO))}
            maxLength={LIMITE_TEXTO}
            autoFocus
            placeholder="Escreva, se quiser"
            placeholderTextColor={cores.apagado}
            accessibilityLabel="O que você viu? Opcional"
            returnKeyType="done"
            style={estilos.campo}
          />
        )}

        {temMidias && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.tira} accessibilityLabel="Fotos e vídeo do relato">
            {fotos.map((f, i) => (
              <View key={f.id} style={estilos.mini}>
                <Image source={{ uri: f.uri }} style={estilos.miniImagem} accessibilityLabel={`Foto ${i + 1}`} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover foto ${i + 1}`}
                  disabled={enviando}
                  onPress={() => removerFoto(f.id)}
                  style={estilos.miniX}
                >
                  <View style={estilos.miniDisco}>
                    <IconeFechar tamanho={14} cor={cores.creme} />
                  </View>
                </Pressable>
              </View>
            ))}
            {Array.from({ length: chegando }, (_, i) => (
              <View key={`chegando-${i}`} style={[estilos.mini, estilos.miniEspera]} accessibilityLabel="Preparando a foto">
                <ActivityIndicator color={cores.cafezal} />
              </View>
            ))}
            {video && (
              <View style={[estilos.mini, estilos.miniVideo]}>
                {video.quadros.length > 0 && (
                  <Image source={{ uri: video.quadros[Math.floor(video.quadros.length / 2)] }} style={estilos.miniImagem} />
                )}
                <View style={estilos.miniFaixa} accessible accessibilityLabel={`Vídeo de ${duracaoPorExtenso(video.duracaoMs)}, sem som`}>
                  <IconeTocar tamanho={14} />
                  <Text style={estilos.miniFaixaTexto}>{formatarDuracao(video.duracaoMs)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remover vídeo"
                  disabled={enviando}
                  onPress={removerVideo}
                  style={estilos.miniX}
                >
                  <View style={estilos.miniDisco}>
                    <IconeFechar tamanho={14} cor={cores.creme} />
                  </View>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {enviando ? (
          <View style={estilos.envio}>
            <BarraDeEnvio progresso={envio.progresso} midias={envio.midias} />
          </View>
        ) : (
          <View style={estilos.comandos}>
            <View style={estilos.lado}>
              <BotaoDeCanto rotulo={texto ? 'Escrever algo, já há texto' : 'Escrever algo'} aoTocar={() => setCampoAberto((a) => !a)}>
                <IconeTeclado tamanho={28} />
              </BotaoDeCanto>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={gravacao === 'gravando' ? 'Parar o vídeo' : 'Tirar foto'}
              accessibilityHint={ofereceVideo && !video ? 'Segure para gravar vídeo sem som' : undefined}
              accessibilityActions={ofereceVideo && !video ? [{ name: 'longpress', label: 'Gravar vídeo sem som' }] : undefined}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'longpress') void comecarVideo()
              }}
              // Durante o preparo o botão continua ligado: desligar no meio do
              // toque faria o sistema entender que o dedo saiu.
              disabled={!pronta || gravacao === 'fechando'}
              delayLongPress={SEGURAR_MS}
              onPress={aoTocarNoDisparador}
              onLongPress={() => void comecarVideo()}
              onPressOut={() => {
                if (segurando.current) pararVideo()
              }}
              style={({ pressed }) => [estilos.disparador, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <View style={[estilos.miolo, ocupada && estilos.mioloGravando]}>
                {(gravacao === 'preparando' || gravacao === 'fechando' || !pronta) && <ActivityIndicator color={cores.cafezal} />}
              </View>
            </Pressable>

            <View style={estilos.lado}>
              {fotos.length > 0 && acao !== 'repetir' && acao !== 'sem_video' && (
                <Botao
                  titulo="Enviar"
                  aoTocar={() => void enviar()}
                  desligado={!liberado}
                  dica={posicao ? undefined : 'Falta a localização para enviar.'}
                  estilo={estilos.enviar}
                />
              )}
            </View>
          </View>
        )}

        {!enviando && !temMidias && (
          <Text style={estilos.dica}>{ofereceVideo ? 'Toque: foto · Segure: vídeo sem som' : 'Toque para tirar a foto'}</Text>
        )}
      </View>

      <Folha aberta={gradeAberta} titulo="O que é?" aoFechar={() => setGradeAberta(false)}>
        <GradeDeTipos
          tipos={(config ?? CONFIG_PADRAO).categorias}
          aoEscolher={(id) => {
            setEscolha(id)
            void enviar(id)
          }}
        />
      </Folha>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#000' },
  semCamera: { flex: 1, backgroundColor: cores.creme, paddingHorizontal: 24, justifyContent: 'center', gap: 14 },
  semCameraTexto: { fontSize: letra.titulo, fontWeight: '900', color: cores.cafezal, marginBottom: 8 },
  topo: { position: 'absolute', left: 16, right: 16, gap: 10 },
  topoLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  acao: { minHeight: 48, paddingVertical: 8, flexGrow: 1 },
  gravando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: cores.papel,
    borderWidth: 2.5,
    borderColor: cores.cereja,
  },
  ponto: { width: 14, height: 14, borderRadius: 7, backgroundColor: cores.cereja },
  gravandoTexto: { fontSize: letra.base, fontWeight: '900', color: cores.cerejaFundo, fontVariant: ['tabular-nums'] },
  painel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  campo: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: cores.cafezal,
    backgroundColor: cores.papel,
    fontSize: letra.base,
    fontWeight: '600',
    color: cores.cafezal,
  },
  tira: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  mini: {
    width: 84,
    height: 84,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: cores.creme,
    backgroundColor: cores.creme2,
  },
  miniImagem: { width: '100%', height: '100%' },
  miniEspera: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  miniVideo: { backgroundColor: cores.cafezalFundo },
  // O X tem 48 pt de toque; o disco visível é menor para não esconder a foto.
  miniX: { position: 'absolute', top: -2, right: -2, width: toque.minimo, height: toque.minimo, alignItems: 'flex-end' },
  miniDisco: {
    width: 28,
    height: 28,
    margin: 4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.cafezal,
    borderWidth: 2,
    borderColor: cores.creme,
  },
  miniFaixa: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    backgroundColor: cores.cafezal,
  },
  miniFaixaTexto: { fontSize: 15, fontWeight: '800', color: cores.creme, fontVariant: ['tabular-nums'] },
  envio: { padding: 14, borderRadius: 18, backgroundColor: cores.creme, borderWidth: 2.5, borderColor: cores.cafezal },
  comandos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lado: { flex: 1, alignItems: 'center' },
  disparador: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 241, 232, 0.35)',
    borderWidth: 5,
    borderColor: cores.creme,
    ...sombra,
  },
  miolo: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.creme },
  mioloGravando: { width: 36, height: 36, borderRadius: 8, backgroundColor: cores.cereja },
  enviar: { minHeight: 64, paddingHorizontal: 18, alignSelf: 'stretch', marginLeft: 12 },
  dica: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: cores.veu,
    color: cores.creme,
    fontSize: letra.menor,
    fontWeight: '700',
  },
})
