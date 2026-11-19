// Sons do MOGI (ADR 0022). Cada som tem um propósito e sempre acompanha um
// sinal visual: quem não ouve, ou está com o som desligado, não perde nada.
// Os arquivos vêm do banco de sons do earshot (MIT), renderizados e
// nivelados por papel em painel/public/sons/ (veja docs/sons.md).

export type Som =
  // Morador e equipe: confirmam o próprio gesto.
  | 'camera' // a câmera abriu
  | 'foto' // a foto foi tirada
  | 'gravar' // o vídeo começou a gravar
  | 'parar' // o vídeo parou
  | 'ouvir' // o microfone começou a ouvir
  | 'parou' // o microfone parou
  | 'enviado' // o relato chegou à prefeitura: a recompensa do gesto
  | 'pino' // o pino do relato apareceu no mapa
  | 'tambem_vi' // a confirmação de quem passou foi registrada
  | 'resolvido' // o problema foi resolvido (morador acompanhando, ou equipe concluindo)
  | 'erro' // algo não saiu: sem alarme, só um aviso para olhar a tela
  // Central e gestor.
  | 'novo_relato' // um pino novo chegou ao vivo
  | 'critico' // chegou um chamado crítico: pede atenção agora
  | 'confirmado' // uma ação da central foi gravada (conferir, despachar)
  | 'desfazer' // a última ação foi desfeita
  | 'registrado' // uma ação ficou na trilha de auditoria (abrir vídeo sem borrão)
  | 'reconectou' // o painel voltou a receber ao vivo
  | 'chamado_equipe' // chegou um chamado novo para a equipe de campo

interface Definicao {
  arquivo: string
  volume: number
  // Intervalo mínimo entre duas vezes do mesmo som: numa rajada de pinos a
  // central ouve um som, não vinte.
  intervaloMs: number
  // Padrão de vibração no celular, junto do som (ou no lugar dele no silencioso).
  vibrar?: number[]
}

export const SONS: Record<Som, Definicao> = {
  camera: { arquivo: 'camera', volume: 0.5, intervaloMs: 300 },
  foto: { arquivo: 'foto', volume: 0.7, intervaloMs: 120, vibrar: [12] },
  gravar: { arquivo: 'gravar', volume: 0.6, intervaloMs: 300, vibrar: [20] },
  parar: { arquivo: 'parar', volume: 0.6, intervaloMs: 300, vibrar: [12] },
  ouvir: { arquivo: 'ouvir', volume: 0.5, intervaloMs: 300 },
  parou: { arquivo: 'parou', volume: 0.5, intervaloMs: 300 },
  enviado: { arquivo: 'enviado', volume: 0.7, intervaloMs: 1500, vibrar: [15, 60, 25] },
  pino: { arquivo: 'pino', volume: 0.5, intervaloMs: 400 },
  tambem_vi: { arquivo: 'tambem-vi', volume: 0.6, intervaloMs: 800, vibrar: [15] },
  resolvido: { arquivo: 'resolvido', volume: 0.7, intervaloMs: 1500, vibrar: [15, 50, 15, 50, 30] },
  erro: { arquivo: 'erro', volume: 0.6, intervaloMs: 1000, vibrar: [40, 60, 40] },
  novo_relato: { arquivo: 'novo-relato', volume: 0.45, intervaloMs: 4000 },
  critico: { arquivo: 'critico', volume: 0.8, intervaloMs: 8000, vibrar: [80, 80, 80] },
  confirmado: { arquivo: 'confirmado', volume: 0.5, intervaloMs: 200 },
  desfazer: { arquivo: 'desfazer', volume: 0.5, intervaloMs: 300 },
  registrado: { arquivo: 'registrado', volume: 0.45, intervaloMs: 300 },
  reconectou: { arquivo: 'reconectou', volume: 0.4, intervaloMs: 10000 },
  chamado_equipe: { arquivo: 'chamado-equipe', volume: 0.7, intervaloMs: 5000, vibrar: [60, 80, 60] },
}

const CHAVE = 'mogi.sons'

// Lembra se o som está ligado neste aparelho. Ligado por padrão.
export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== 'desligado'
  } catch {
    return true
  }
}

export function ligarSom(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE, ligado ? 'ligado' : 'desligado')
  } catch {
    // Sem armazenamento (aba privada): vale só nesta visita.
  }
  estado.ligado = ligado
}

// pode decide, sem efeito colateral, se o som toca agora: respeita o
// intervalo mínimo de cada som. Exportada para teste.
export function pode(ultimas: Partial<Record<Som, number>>, som: Som, agora: number): boolean {
  const antes = ultimas[som]
  return antes === undefined || agora - antes >= SONS[som].intervaloMs
}

const estado: {
  ligado: boolean
  contexto: AudioContext | null
  buffers: Map<Som, AudioBuffer>
  carregando: Map<Som, Promise<AudioBuffer | null>>
  ultimas: Partial<Record<Som, number>>
  liberado: boolean
} = {
  ligado: somLigado(),
  contexto: null,
  buffers: new Map(),
  carregando: new Map(),
  ultimas: {},
  liberado: false,
}

function contexto(): AudioContext | null {
  if (estado.contexto) return estado.contexto
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  try {
    estado.contexto = new Ctx()
  } catch {
    return null
  }
  return estado.contexto
}

function carregar(som: Som): Promise<AudioBuffer | null> {
  const pronto = estado.buffers.get(som)
  if (pronto) return Promise.resolve(pronto)
  const emCurso = estado.carregando.get(som)
  if (emCurso) return emCurso
  const ctx = contexto()
  if (!ctx) return Promise.resolve(null)
  const p = fetch(`/sons/${SONS[som].arquivo}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((dados) => ctx.decodeAudioData(dados))
    .then((buf) => {
      estado.buffers.set(som, buf)
      return buf
    })
    .catch(() => {
      estado.carregando.delete(som) // tenta de novo na próxima vez
      return null
    })
  estado.carregando.set(som, p)
  return p
}

// prepararSons baixa os sons de uma tela antes da hora, para o primeiro
// toque não sair atrasado. Chame ao montar a tela.
export function prepararSons(sons: Som[]): void {
  for (const s of sons) void carregar(s)
}

// O navegador só deixa tocar som depois de um gesto da pessoa, e no celular
// o gesto que vale é o soltar do toque (touchend, pointerup, click), não o
// encostar (touchstart). Tenta a cada gesto até o áudio estar rodando; no
// iPhone, toca um som mudo dentro do gesto, que é o que destrava de vez.
export const GESTOS_QUE_LIBERAM = ['touchend', 'pointerup', 'click', 'keydown'] as const

function liberar(): void {
  const ctx = contexto()
  if (!ctx) return
  if (ctx.state !== 'running') {
    void ctx.resume().catch(() => undefined)
    try {
      const mudo = ctx.createBufferSource()
      mudo.buffer = ctx.createBuffer(1, 1, 22050)
      mudo.connect(ctx.destination)
      mudo.start(0)
    } catch {
      // sem saída de áudio
    }
  }
  if (ctx.state === 'running' && !estado.liberado) {
    estado.liberado = true
    for (const ev of GESTOS_QUE_LIBERAM) window.removeEventListener(ev, liberar, true)
  }
}
if (typeof window !== 'undefined') {
  for (const ev of GESTOS_QUE_LIBERAM) window.addEventListener(ev, liberar, { passive: true, capture: true })
}

// tocar dispara o som do propósito. Nunca lança erro e nunca espera: som é
// enfeite de uma ação que já aconteceu na tela.
export function tocar(som: Som): void {
  const agora = Date.now()
  if (!pode(estado.ultimas, som, agora)) return
  estado.ultimas[som] = agora
  const def = SONS[som]
  // Vibrar antes do primeiro toque da pessoa é bloqueado pelo navegador e vira
  // erro no console: só vibra depois de um gesto.
  const tocou = typeof navigator === 'undefined' || (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false
  if (def.vibrar && tocou && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(def.vibrar)
    } catch {
      // vibração indisponível
    }
  }
  if (!estado.ligado) return
  const ctx = contexto()
  if (!ctx) return
  // Pausado (ainda sem gesto, ou o celular suspendeu): espera voltar antes de
  // tocar, para o som não se perder.
  const pronto = ctx.state === 'running' ? Promise.resolve() : ctx.resume().catch(() => undefined)
  void Promise.all([carregar(som), pronto]).then(([buf]) => {
    if (ctx.state !== 'running') return
    if (!buf) return
    try {
      const fonte = ctx.createBufferSource()
      const ganho = ctx.createGain()
      ganho.gain.value = def.volume
      fonte.buffer = buf
      fonte.connect(ganho).connect(ctx.destination)
      fonte.start()
    } catch {
      // contexto fechado ou sem saída de áudio
    }
  })
}
