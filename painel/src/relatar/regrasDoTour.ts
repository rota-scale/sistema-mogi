// Regras puras do primeiro contato do morador: os slides de boas-vindas e o
// tour guiado sobre o mapa. Sem DOM, para testar no Node.

export type Gesto = 'arrastar' | 'zoom' | 'girar'

// O que o tour destaca. "mapa" é a área do mapa inteira.
export type Alvo = 'mapa' | 'centralizar' | 'camera' | 'perfil'

export interface PassoDoTour {
  id: string
  alvo: Alvo
  frase: string
  // Gestos que concluem o passo sozinhos; vazio: só pelo botão.
  avancaCom: readonly Gesto[]
  // Animação de apoio desenhada sobre o alvo.
  animacao: 'arrastar' | 'pinca' | 'toque' | 'pulso' | null
  // Rótulo do botão de avançar.
  botao: string
}

export const PASSOS: readonly PassoDoTour[] = [
  { id: 'arrastar', alvo: 'mapa', frase: 'Arraste o mapa com um dedo.', avancaCom: ['arrastar'], animacao: 'arrastar', botao: 'Próximo' },
  { id: 'aproximar', alvo: 'mapa', frase: 'Com dois dedos, aproxime ou gire o mapa.', avancaCom: ['zoom', 'girar'], animacao: 'pinca', botao: 'Próximo' },
  { id: 'centralizar', alvo: 'centralizar', frase: 'Este botão volta o mapa para onde você está.', avancaCom: [], animacao: 'toque', botao: 'Próximo' },
  { id: 'camera', alvo: 'camera', frase: 'Viu um problema na rua? Toque aqui e tire a foto.', avancaCom: [], animacao: 'pulso', botao: 'Próximo' },
  { id: 'perfil', alvo: 'perfil', frase: 'Aqui ficam os seus avisos. Esqueceu como usa? Toque no i.', avancaCom: [], animacao: null, botao: 'Entendi' },
]

export interface EstadoDoTour {
  // Índice em PASSOS; null: o tour está fechado.
  passo: number | null
  // Alvos que existem na tela agora (o "centralizar" só aparece depois de arrastar).
  presentes: ReadonlySet<Alvo>
}

// Próximo passo cujo alvo está na tela, a partir de "de" (inclusive); null quando acabou.
export function proximoVisivel(de: number, presentes: ReadonlySet<Alvo>): number | null {
  for (let i = de; i < PASSOS.length; i++) if (presentes.has(PASSOS[i].alvo)) return i
  return null
}

export function anteriorVisivel(de: number, presentes: ReadonlySet<Alvo>): number | null {
  for (let i = de; i >= 0; i--) if (presentes.has(PASSOS[i].alvo)) return i
  return null
}

export function avancar(passo: number, presentes: ReadonlySet<Alvo>): number | null {
  return proximoVisivel(passo + 1, presentes)
}

export function voltar(passo: number, presentes: ReadonlySet<Alvo>): number {
  return anteriorVisivel(passo - 1, presentes) ?? passo
}

// O gesto da pessoa conclui o passo atual? Gestos de outros passos não contam.
export function concluiCom(passo: number, gesto: Gesto): boolean {
  return PASSOS[passo]?.avancaCom.includes(gesto) ?? false
}

// "2 de 5": descontam-se só os passos já pulados por falta do alvo; os que
// vêm depois contam, porque o alvo pode aparecer (o botão de voltar para onde
// estou surge quando a pessoa arrasta o mapa).
export function contagem(passo: number, presentes: ReadonlySet<Alvo>): { atual: number; total: number } {
  const pulados = PASSOS.slice(0, passo).filter((p) => !presentes.has(p.alvo)).length
  return { atual: passo + 1 - pulados, total: PASSOS.length - pulados }
}

// Slides de boas-vindas: título curto e uma frase cada.
export interface Slide {
  id: 'problema' | 'foto' | 'resolvido'
  titulo: string
  frase: string
}

export const SLIDES: readonly Slide[] = [
  { id: 'problema', titulo: 'Viu um problema na rua?', frase: 'Cano vazando, buraco, poste apagado, lixo na calçada.' },
  { id: 'foto', titulo: 'Tire uma foto', frase: 'O MOGI marca o lugar no mapa e manda para a prefeitura.' },
  { id: 'resolvido', titulo: 'A prefeitura resolve e te avisa', frase: 'Você acompanha até a foto do serviço feito.' },
]

// O que já foi visto neste aparelho. A Ajuda antiga ("mogi.ajuda" = "vista")
// conta como boas-vindas vistas; o tour é novo e aparece uma vez para todos.
export const CHAVE_BOAS_VINDAS = 'mogi.ajuda'
export const CHAVE_TOUR = 'mogi.tour'

export interface Vistos {
  boasVindas: boolean
  tour: boolean
}

export function lerVistos(ler: (chave: string) => string | null): Vistos {
  try {
    return { boasVindas: ler(CHAVE_BOAS_VINDAS) === 'vista', tour: ler(CHAVE_TOUR) === 'visto' }
  } catch {
    // Sem armazenamento (aba privada): mostra tudo nesta visita.
    return { boasVindas: false, tour: false }
  }
}

// Ordem do primeiro contato: slides, cadastro (se a cidade pede e não há
// conta), tour. Devolve o que deve aparecer agora.
export type Etapa = 'boas_vindas' | 'cadastro' | 'tour' | null

export function etapaInicial(v: Vistos, pedeCadastro: boolean, temConta: boolean, cadastroOferecido: boolean): Etapa {
  if (!v.boasVindas) return 'boas_vindas'
  if (pedeCadastro && !temConta && !cadastroOferecido) return 'cadastro'
  if (!v.tour) return 'tour'
  return null
}
