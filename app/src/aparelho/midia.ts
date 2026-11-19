import { File } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { createVideoPlayer } from 'expo-video'
import { Platform } from 'react-native'
import { dimensoesReduzidas, fotoCabe, instantesDosQuadros, LADO_DO_QUADRO } from '@/logica/web'

const QUALIDADE = 0.8

export function tamanhoDoArquivo(uri: string): number {
  try {
    const arquivo = new File(uri)
    return arquivo.exists ? arquivo.size : 0
  } catch {
    return 0
  }
}

export function apagarArquivo(uri: string): void {
  try {
    const arquivo = new File(uri)
    if (arquivo.exists) arquivo.delete()
  } catch {
    /* arquivo temporário: o sistema limpa depois */
  }
}

// Reduz a foto para no máximo 1600 px no lado maior e regrava em JPEG.
// Regravar tira o EXIF e deixa o envio leve no 4G. Rejeita quando o
// arquivo não abre ou passa do limite do servidor.
export async function reduzirFoto(uri: string, largura: number, altura: number): Promise<string> {
  const alvo = dimensoesReduzidas(largura, altura)
  if (alvo.largura === 0 || alvo.altura === 0) throw new Error('foto sem tamanho')
  const contexto = ImageManipulator.manipulate(uri)
  if (alvo.largura !== largura || alvo.altura !== altura) contexto.resize({ width: alvo.largura, height: alvo.altura })
  const imagem = await contexto.renderAsync()
  const pronta = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE })
  // No navegador (só para conferir as telas) a foto não vira arquivo.
  if (Platform.OS !== 'web' && !fotoCabe(tamanhoDoArquivo(pronta.uri))) throw new Error('foto fora do limite')
  return pronta.uri
}

const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms))

// Tira até "maximo" quadros do vídeo, em JPEG, para a capa borrada no
// painel. Em qualquer falha devolve o que conseguiu, mesmo que nada: o
// vídeo vai sem quadros.
export async function quadrosDoVideo(uri: string, duracaoMs: number, maximo: number): Promise<string[]> {
  const instantes = instantesDosQuadros(duracaoMs, maximo)
  if (instantes.length === 0) return []
  const quadros: string[] = []
  let tocador: ReturnType<typeof createVideoPlayer> | null = null
  try {
    tocador = createVideoPlayer(uri)
    // O tocador precisa abrir o arquivo antes de tirar os quadros.
    for (let i = 0; i < 30 && tocador.status !== 'readyToPlay' && tocador.status !== 'error'; i++) await esperar(100)
    if (tocador.status !== 'readyToPlay') return []
    const miniaturas = await tocador.generateThumbnailsAsync(
      instantes.map((ms) => ms / 1000),
      { maxWidth: LADO_DO_QUADRO, maxHeight: LADO_DO_QUADRO },
    )
    for (const miniatura of miniaturas) {
      const imagem = await ImageManipulator.manipulate(miniatura).renderAsync()
      const pronta = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE })
      quadros.push(pronta.uri)
    }
  } catch {
    /* fica com os quadros que já saíram */
  } finally {
    try {
      tocador?.release()
    } catch {
      /* tocador já solto */
    }
  }
  return quadros
}
