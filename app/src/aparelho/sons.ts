import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import type { AudioPlayer } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import { pode, SONS, toqueDoSom } from '@/logica/sons'
import type { Som } from '@/logica/sons'
import { gravar, ler } from './guardado'

const CHAVE = 'mogi.sons'

const ARQUIVOS: Record<Som, number> = {
  camera: require('../../assets/sons/camera.mp3'),
  foto: require('../../assets/sons/foto.mp3'),
  gravar: require('../../assets/sons/gravar.mp3'),
  parar: require('../../assets/sons/parar.mp3'),
  enviado: require('../../assets/sons/enviado.mp3'),
  pino: require('../../assets/sons/pino.mp3'),
  tambem_vi: require('../../assets/sons/tambem-vi.mp3'),
  resolvido: require('../../assets/sons/resolvido.mp3'),
  erro: require('../../assets/sons/erro.mp3'),
}

const estado: {
  ligado: boolean
  preparado: boolean
  tocadores: Partial<Record<Som, AudioPlayer>>
  ultimas: Partial<Record<Som, number>>
} = { ligado: true, preparado: false, tocadores: {}, ultimas: {} }

// Lembra se o som está ligado neste aparelho. Ligado por padrão.
export async function somGuardado(): Promise<boolean> {
  estado.ligado = (await ler(CHAVE)) !== 'desligado'
  return estado.ligado
}

export function ligarSom(ligado: boolean): void {
  estado.ligado = ligado
  void gravar(CHAVE, ligado ? 'ligado' : 'desligado')
}

function preparar(): void {
  if (estado.preparado) return
  estado.preparado = true
  // Respeita a chave de silencioso do iPhone e o modo silencioso do
  // Android, e não corta a música de quem está ouvindo.
  void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {})
}

function vibrar(som: Som): void {
  const toque = toqueDoSom(som)
  if (!toque) return
  const pedido =
    toque === 'leve'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(toque === 'erro' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success)
  void pedido.catch(() => {})
}

// Dispara o som do propósito. Nunca lança erro e nunca espera: o som só
// acompanha um sinal que já está na tela. A vibração sai mesmo com o som
// desligado.
export function tocar(som: Som): void {
  const agora = Date.now()
  if (!pode(estado.ultimas, som, agora)) return
  estado.ultimas[som] = agora
  try {
    vibrar(som)
    if (!estado.ligado) return
    preparar()
    const tocador = (estado.tocadores[som] ??= createAudioPlayer(ARQUIVOS[som]))
    tocador.volume = SONS[som].volume
    void tocador.seekTo(0).catch(() => {})
    tocador.play()
  } catch {
    /* sem saída de áudio: a tela já mostrou o que aconteceu */
  }
}
