import { extensaoDoVideo } from './web'
import type { VideoNaFila } from './fila'

export interface Arquivo {
  uri: string
  name: string
  type: string
}

export type Parte = { nome: string; valor: string } | { nome: string; arquivo: Arquivo }

// A câmera do iPhone grava .mov; a do Android, .mp4.
export function tipoDoVideo(uri: string): string {
  return /\.mov($|\?)/i.test(uri) ? 'video/quicktime' : 'video/mp4'
}

// Partes do multipart do POST /api/ocorrencias, na mesma ordem do app web:
// "foto" repetido, o vídeo com seus quadros e a duração, e os campos.
export function partesDoRelato(fotos: string[], video: VideoNaFila | null, campos: Record<string, string>): Parte[] {
  const partes: Parte[] = fotos.map((uri, i) => ({
    nome: 'foto',
    arquivo: { uri, name: `relato-${i + 1}.jpg`, type: 'image/jpeg' },
  }))
  if (video) {
    partes.push({ nome: 'video', arquivo: { uri: video.uri, name: `relato.${extensaoDoVideo(video.tipo)}`, type: video.tipo } })
    video.quadros.forEach((uri, i) =>
      partes.push({ nome: 'quadro', arquivo: { uri, name: `quadro-${i + 1}.jpg`, type: 'image/jpeg' } }),
    )
    partes.push({ nome: 'video_duracao_ms', valor: String(Math.max(0, Math.round(video.duracaoMs))) })
  }
  for (const [nome, valor] of Object.entries(campos)) partes.push({ nome, valor })
  return partes
}

// Endereço completo de uma rota: a base vem de EXPO_PUBLIC_API_URL e as
// rotas ficam em /api.
export function enderecoDaApi(base: string, caminho: string): string {
  const limpa = base.trim().replace(/\/+$/, '')
  if (!limpa) return ''
  return `${limpa}${caminho.startsWith('/api/') ? '' : '/api'}${caminho.startsWith('/') ? '' : '/'}${caminho}`
}

export const SEM_SERVIDOR = 'Falta o endereço do servidor (EXPO_PUBLIC_API_URL).'

// O app Expo ainda não tem o cadastro do morador: quando o servidor pede,
// a pessoa faz pelo app web, no mesmo servidor.
export const CADASTRO_PELO_WEB = 'Faça seu cadastro pelo app web para relatar.'

export function enderecoDoAppWeb(base: string): string {
  const limpa = base.trim().replace(/\/+$/, '').replace(/\/api$/, '')
  return limpa ? `${limpa}/relatar.html` : ''
}
