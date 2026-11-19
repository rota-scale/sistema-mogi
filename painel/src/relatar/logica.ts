// Regras puras do relato do morador: sem DOM, para testar no Node.

export type Status = 'a_classificar' | 'revisao' | 'aberta' | 'em_atendimento' | 'resolvida'

const STATUS: readonly Status[] = ['a_classificar', 'revisao', 'aberta', 'em_atendimento', 'resolvida']

// Corpo de sucesso do POST /api/ocorrencias. A chave é o segredo para
// acompanhar o protocolo depois.
export interface Resposta {
  protocolo: string
  chave: string
  status: Status
  nivel: number | null
  categoria: string
  secretaria: string | null
  prazo_ate: string | null
  prazo_fonte: string | null
  endereco: string | null
  bairro: string | null
  agrupada: boolean
  relatos: number
  criado_em: string
  repetido: boolean
  // A triagem achou que a foto é de dentro de um imóvel: foi para a conferência.
  fora_do_escopo?: boolean
}

export interface Categoria {
  id: string
  nome: string
}

// Limites de fotos e vídeo que o servidor informa em /api/config.
export interface LimitesDeMidia {
  fotos_max: number
  foto_mb: number
  video: boolean
  video_segundos: number
  video_mb: number
  quadros_max: number
}

export interface Ponto {
  lat: number
  lng: number
}

// Partes do sistema que a prefeitura liga ou desliga.
export interface Modulos {
  video: boolean
  perto: boolean
  campo: boolean
  voz: boolean
  // Ligado: relatar pede o cadastro do morador (token).
  cadastro: boolean
  // Ligado: código de recuperação e "Já tenho cadastro". Desligado no
  // protótipo: o cadastro fica no celular e o gestor libera um CPF repetido.
  recuperacao: boolean
}

export interface Config {
  cidade: string
  ia_ativa: boolean
  categorias: Categoria[]
  midia: LimitesDeMidia
  centro: Ponto
  modulos: Modulos
  // Cerca do município; null aceita relato de qualquer lugar.
  caixa: CaixaDaCidade | null
}

export interface CaixaDaCidade {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export function lerCaixa(bruto: unknown): CaixaDaCidade | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const b = bruto as Record<string, unknown>
  const n = [b.min_lng, b.min_lat, b.max_lng, b.max_lat]
  if (!n.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  // Sem desestruturar o array: o app Expo também compila este arquivo.
  const v = n as number[]
  const minLng = v[0], minLat = v[1], maxLng = v[2], maxLat = v[3]
  return minLng < maxLng && minLat < maxLat ? { minLng, minLat, maxLng, maxLat } : null
}

// O GPS mostra a pessoa em qualquer lugar do mundo; fora da cerca, o app só
// avisa que os avisos chegam à prefeitura da cidade.
export function foraDaCidade(caixa: CaixaDaCidade | null, p: Ponto | null): boolean {
  if (!caixa || !p) return false
  return p.lng < caixa.minLng || p.lng > caixa.maxLng || p.lat < caixa.minLat || p.lat > caixa.maxLat
}

export interface Posicao {
  lat: number
  lng: number
  precisao: number | null
  // true quando o morador marcou o ponto no mapa.
  manual?: boolean
  // Hora da leitura (ms) e velocidade do GPS em m/s, quando vierem.
  em?: number
  velocidade?: number | null
}

export interface Recente {
  protocolo: string
  nivel: number | null
  criado_em: string
  // Relatos guardados antes da chave existir ficam com null.
  chave: string | null
  status: Status | null
  // Onde o relato foi feito. Relatos antigos não têm: ficam só na lista.
  lat: number | null
  lng: number | null
  categoria: string | null
  // O aparelho já mostrou este relato resolvido: o som de resolvido não repete.
  viuResolvido?: boolean
}

// Servidor antigo, que não manda "midia" na config: uma foto e nada de vídeo.
export const MIDIA_PADRAO: LimitesDeMidia = {
  fotos_max: 1,
  foto_mb: 12,
  video: false,
  video_segundos: 15,
  video_mb: 25,
  quadros_max: 3,
}

// Centro de Itamogi, usado antes do GPS e quando o servidor não informa.
export const CENTRO_PADRAO: Ponto = { lat: -21.0793, lng: -47.0486 }

// Servidor antigo, sem "modulos": nada de vídeo nem de "perto"; a voz fica.
export const MODULOS_PADRAO: Modulos = { video: false, perto: false, campo: false, voz: true, cadastro: false, recuperacao: false }

// Usada quando /api/config não responde: sem IA, o morador escolhe o tipo.
export const CONFIG_PADRAO: Config = {
  cidade: 'Itamogi',
  ia_ativa: false,
  midia: MIDIA_PADRAO,
  centro: CENTRO_PADRAO,
  modulos: MODULOS_PADRAO,
  categorias: [
    { id: 'agua', nome: 'Água e esgoto' },
    { id: 'iluminacao', nome: 'Iluminação' },
    { id: 'vias', nome: 'Buraco na via' },
    { id: 'limpeza', nome: 'Lixo e entulho' },
    { id: 'arvores', nome: 'Árvore' },
    { id: 'sinalizacao', nome: 'Sinalização' },
    { id: 'calcadas', nome: 'Calçada' },
    { id: 'animais', nome: 'Animal' },
    { id: 'outros', nome: 'Outro' },
  ],
  caixa: null,
}

const inteiro = (v: unknown, padrao: number, minimo: number, maximo: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(minimo, Math.min(maximo, Math.floor(v))) : padrao

// Número fora do esperado cai no padrão; vídeo só vale com "true" explícito.
export function lerMidia(bruto: unknown): LimitesDeMidia {
  if (typeof bruto !== 'object' || bruto === null) return MIDIA_PADRAO
  const b = bruto as Record<string, unknown>
  return {
    fotos_max: inteiro(b.fotos_max, MIDIA_PADRAO.fotos_max, 1, 10),
    foto_mb: inteiro(b.foto_mb, MIDIA_PADRAO.foto_mb, 1, 100),
    video: b.video === true,
    video_segundos: inteiro(b.video_segundos, MIDIA_PADRAO.video_segundos, 2, 120),
    video_mb: inteiro(b.video_mb, MIDIA_PADRAO.video_mb, 1, 500),
    quadros_max: inteiro(b.quadros_max, MIDIA_PADRAO.quadros_max, 0, 10),
  }
}

const numeroEntre = (v: unknown, minimo: number, maximo: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= minimo && v <= maximo

export function lerCentro(bruto: unknown): Ponto {
  if (typeof bruto !== 'object' || bruto === null) return CENTRO_PADRAO
  const b = bruto as Record<string, unknown>
  return numeroEntre(b.lat, -90, 90) && numeroEntre(b.lng, -180, 180) ? { lat: b.lat, lng: b.lng } : CENTRO_PADRAO
}

// Sem "modulos", o vídeo segue o que "midia" diz. A voz só sai com false.
export function lerModulos(bruto: unknown, midia: LimitesDeMidia): Modulos {
  if (typeof bruto !== 'object' || bruto === null) return { ...MODULOS_PADRAO, video: midia.video }
  const b = bruto as Record<string, unknown>
  return {
    video: b.video === true && midia.video,
    perto: b.perto === true,
    campo: b.campo === true,
    voz: b.voz !== false,
    cadastro: b.cadastro === true,
    recuperacao: b.recuperacao === true,
  }
}

// Aceita só o formato esperado; qualquer coisa fora dele cai na lista padrão.
export function lerConfig(bruto: unknown): Config {
  if (typeof bruto !== 'object' || bruto === null) return CONFIG_PADRAO
  const b = bruto as Record<string, unknown>
  const categorias = Array.isArray(b.categorias)
    ? b.categorias.filter(
        (c): c is Categoria =>
          typeof c === 'object' && c !== null && typeof c.id === 'string' && c.id !== '' && typeof c.nome === 'string',
      )
    : []
  if (categorias.length === 0) return CONFIG_PADRAO
  const midia = lerMidia(b.midia)
  return {
    cidade: typeof b.cidade === 'string' && b.cidade !== '' ? b.cidade : CONFIG_PADRAO.cidade,
    ia_ativa: b.ia_ativa === true,
    categorias,
    midia,
    centro: lerCentro(b.centro),
    modulos: lerModulos(b.modulos, midia),
    caixa: lerCaixa(b.caixa),
  }
}

// Enquanto /api/config não respondeu (config null), o tipo aparece como
// opcional. Só passa a ser exigido quando a resposta diz que não há IA.
export function tipoOpcional(config: Config | null): boolean {
  return config === null || config.ia_ativa
}

// Quando a config chega depois de o morador já ter tocado num tipo, a
// escolha só continua valendo se existir na lista que veio do servidor.
export function escolhaAposConfig(escolha: string | null, config: Config): string | null {
  if (escolha === null) return null
  if (escolha === '') return config.ia_ativa ? '' : null
  return config.categorias.some((c) => c.id === escolha) ? escolha : null
}

// Escala da Triagem Urbana nas cores da marca. A cor nunca vai sozinha:
// o selo sempre mostra o número e o nome.
export const NIVEIS = [
  { nivel: 1, nome: 'Não urgente', cor: '#3B6EA5', texto: '#FFFFFF' },
  { nivel: 2, nome: 'Padrão', cor: '#3E7B3A', texto: '#FFFFFF' },
  { nivel: 3, nome: 'Urgente', cor: '#E9B526', texto: '#2A1A10' },
  { nivel: 4, nome: 'Muito urgente', cor: '#D9822B', texto: '#2A1A10' },
  { nivel: 5, nome: 'Crítico', cor: '#B3261E', texto: '#FFFFFF' },
] as const

export const COR_SEM_NIVEL = '#E4DCCB'
export const TEXTO_SEM_NIVEL = '#4A2C1D'

const achar = (nivel: number | null) => NIVEIS.find((n) => n.nivel === nivel)

export function nomeDoNivel(nivel: number | null): string {
  return achar(nivel)?.nome ?? 'A classificar'
}

export function corDoNivel(nivel: number | null): string {
  return achar(nivel)?.cor ?? COR_SEM_NIVEL
}

// Cor do texto que dá contraste sobre a cor do nível.
export function textoSobreNivel(nivel: number | null): string {
  return achar(nivel)?.texto ?? TEXTO_SEM_NIVEL
}

export function rotuloDoNivel(nivel: number | null): string {
  const n = achar(nivel)
  return n ? `Nível ${n.nivel} · ${n.nome}` : 'A classificar'
}

function partesDaData(iso: string, fuso?: string): Record<string, string> | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const partes = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: fuso,
  }).formatToParts(d)
  return Object.fromEntries(partes.map((p) => [p.type, p.value]))
}

// "12/11 às 14:30", ou vazio quando a data não serve.
// O fuso só é passado nos testes; no aparelho vale o fuso local.
export function formatarDataHora(iso: string, fuso?: string): string {
  const p = partesDaData(iso, fuso)
  return p ? `${p.day}/${p.month} às ${p.hour}:${p.minute}` : ''
}

// Como formatarDataHora, mas sem prazo vira "rotina da equipe".
export function formatarPrazo(iso: string | null, fuso?: string): string {
  return (iso && formatarDataHora(iso, fuso)) || 'rotina da equipe'
}

export function precisaConferencia(status: Status): boolean {
  return status === 'revisao' || status === 'a_classificar'
}

export function linhaDeStatus(r: Pick<Resposta, 'status' | 'secretaria'>): string {
  if (precisaConferencia(r.status)) return 'Um servidor da prefeitura vai conferir agora.'
  const secretaria = r.secretaria?.trim()
  return secretaria ? `Chamado aberto na secretaria responsável: ${secretaria}.` : 'Chamado aberto na secretaria responsável.'
}

export function linhaDeLocal(r: Pick<Resposta, 'endereco' | 'bairro'>): string {
  return [r.endereco, r.bairro].map((x) => x?.trim()).filter(Boolean).join(' · ')
}

export interface EstadoDoRelato {
  // Fotos já reduzidas, prontas para ir. Basta uma para enviar.
  fotos: number
  // Ainda há foto sendo reduzida: o envio espera ela ficar pronta.
  preparando?: boolean
  posicao: Posicao | null
  // null: nada escolhido. '': deixar a IA decidir. Outro valor: id da categoria.
  categoria: string | null
  iaAtiva: boolean
  // O GPS não serviu: o que falta é marcar o lugar no mapa.
  pedeMapa?: boolean
}

// Sem IA, o tipo do problema é obrigatório; com IA, é opcional.
export function categoriaValida(categoria: string | null, iaAtiva: boolean): boolean {
  if (categoria === null) return false
  return categoria !== '' || iaAtiva
}

// A escolha explícita vale; sem escolha, a IA decide quando está ativa.
export function categoriaEfetiva(escolha: string | null, iaAtiva: boolean): string | null {
  if (escolha === '' && !iaAtiva) return null
  return escolha ?? (iaAtiva ? '' : null)
}

export function podeEnviar(e: EstadoDoRelato): boolean {
  return e.fotos > 0 && !e.preparando && e.posicao !== null && categoriaValida(e.categoria, e.iaAtiva)
}

// O que falta para liberar o envio, em uma frase; null quando está tudo certo.
export function oQueFalta(e: EstadoDoRelato): string | null {
  if (e.fotos <= 0) return e.preparando ? 'Preparando a foto…' : 'Falta a foto do problema.'
  if (e.preparando) return 'Preparando a foto…'
  if (e.posicao === null) return e.pedeMapa ? 'Falta marcar o lugar no mapa.' : 'Falta a localização para enviar.'
  if (!categoriaValida(e.categoria, e.iaAtiva)) return 'Toque no tipo de problema para enviar'
  return null
}

export const LIMITE_TEXTO = 500

export interface DadosDoRelato {
  posicao: Posicao
  categoria: string | null
  texto: string
}

// Campos de texto do multipart (a foto entra à parte). Categoria vazia
// e texto vazio ficam de fora: o backend trata a ausência. Ponto marcado
// à mão leva local_manual e não leva precisão.
export function camposDoRelato(d: DadosDoRelato): Record<string, string> {
  const campos: Record<string, string> = {
    lat: d.posicao.lat.toFixed(6),
    lng: d.posicao.lng.toFixed(6),
  }
  if (d.posicao.manual) {
    campos.local_manual = '1'
  } else if (d.posicao.precisao !== null && Number.isFinite(d.posicao.precisao)) {
    campos.precisao = String(Math.round(d.posicao.precisao))
  }
  if (d.categoria) campos.categoria = d.categoria
  const texto = d.texto.trim().slice(0, LIMITE_TEXTO)
  if (texto) campos.texto = texto
  return campos
}

// Junta um trecho falado ao texto já escrito, respeitando o limite.
export function juntarFala(texto: string, fala: string): string {
  const novo = fala.trim()
  if (!novo) return texto
  const base = texto.trimEnd()
  return (base ? `${base} ${novo}` : novo).slice(0, LIMITE_TEXTO)
}

// Fica com a leitura mais precisa do GPS; leitura sem precisão só entra
// quando ainda não há nenhuma.
export function melhorPosicao(atual: Posicao | null, nova: Posicao): Posicao {
  if (atual === null) return nova
  if (nova.precisao === null) return atual
  if (atual.precisao === null || nova.precisao <= atual.precisao) return nova
  return atual
}

// Acima disso o GPS pode estar apontando outra rua: o morador marca no mapa.
export const LIMITE_PRECISAO = 100

export function precisaoAceita(p: Posicao): boolean {
  if (p.manual) return true
  return p.precisao !== null && Number.isFinite(p.precisao) && p.precisao <= LIMITE_PRECISAO
}

// Posição que vai no envio. O ponto marcado à mão sempre vence o GPS;
// o GPS só vale quando a precisão é aceita.
export function posicaoEscolhida(gps: Posicao | null, manual: Posicao | null): Posicao | null {
  if (manual) return manual
  return gps && precisaoAceita(gps) ? gps : null
}

export function posicaoManual(lat: number, lng: number): Posicao {
  // O mapa pode devolver longitude fora de -180..180 depois de muito arrasto.
  const volta = lng >= -180 && lng <= 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180
  return { lat: Math.max(-90, Math.min(90, lat)), lng: volta, precisao: null, manual: true }
}

export type FalhaDoGps = 'negado' | 'sem_sinal' | 'sem_suporte'

export type SituacaoDoLocal = 'parada' | 'buscando' | 'ok' | 'impreciso' | 'manual' | FalhaDoGps

export interface LeituraDoLocal {
  gps: Posicao | null
  manual: Posicao | null
  falha: FalhaDoGps | null
  buscando: boolean
}

export function situacaoDoLocal(l: LeituraDoLocal): SituacaoDoLocal {
  if (l.manual) return 'manual'
  if (l.gps) return precisaoAceita(l.gps) ? 'ok' : 'impreciso'
  if (l.falha) return l.falha
  return l.buscando ? 'buscando' : 'parada'
}

// Situações em que o envio depende de o morador marcar o lugar no mapa.
export function pedeMapa(s: SituacaoDoLocal): boolean {
  return s === 'impreciso' || s === 'negado' || s === 'sem_sinal' || s === 'sem_suporte'
}

// "250 m" ou "1,5 km", arredondado para não parecer medida exata.
export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.max(10, Math.round(metros / 10) * 10)} m`
  const km = Math.round(metros / 100) / 10
  return `${String(km).replace('.', ',')} km`
}

// Aviso mostrado junto do botão "Marcar no mapa"; null quando não precisa.
export function avisoDoLocal(s: SituacaoDoLocal, gps: Posicao | null): string | null {
  switch (s) {
    case 'impreciso':
      return gps?.precisao != null && Number.isFinite(gps.precisao)
        ? `O GPS está impreciso: pode errar por ${formatarDistancia(gps.precisao)}. Marque no mapa o lugar do problema.`
        : 'O GPS está impreciso. Marque no mapa o lugar do problema.'
    case 'negado':
      return 'A localização está bloqueada. No cadeado ao lado do endereço do site, permita Localização. Ou marque o lugar no mapa.'
    case 'sem_sinal':
      return 'Não deu para pegar a localização. Marque no mapa o lugar do problema.'
    case 'sem_suporte':
      return 'Este aparelho não informou a localização. Marque no mapa o lugar do problema.'
    default:
      return null
  }
}

export function linhaDePrecisao(p: Posicao): string {
  if (p.manual) return 'Lugar marcado no mapa'
  if (p.precisao === null || !Number.isFinite(p.precisao)) return 'Localização ok'
  return `Localização ok · precisão de ${Math.max(1, Math.round(p.precisao))} m`
}

export interface VistaDoMapa {
  lat: number
  lng: number
  zoom: number
}

// Onde o mapa abre: no ponto já marcado, senão na leitura do GPS (mesmo
// imprecisa), senão no centro da cidade. Ponto confiável abre mais perto.
export function vistaInicialDoMapa(gps: Posicao | null, manual: Posicao | null): VistaDoMapa {
  const p = manual ?? gps
  if (!p) return { ...CENTRO_PADRAO, zoom: 15 }
  return { lat: p.lat, lng: p.lng, zoom: precisaoAceita(p) ? 17 : 15 }
}

export const MAX_RECENTES = 5

// Mais novo primeiro, sem repetir protocolo, no máximo cinco.
export function mesclarRecentes(lista: Recente[], novo: Recente): Recente[] {
  return [novo, ...lista.filter((r) => r.protocolo !== novo.protocolo)].slice(0, MAX_RECENTES)
}

const ehStatus = (s: unknown): s is Status => STATUS.includes(s as Status)

// Lê o que estava guardado no aparelho, descartando o que não tem o formato.
// Item antigo, sem chave nem status, continua valendo.
export function lerRecentes(bruto: unknown): Recente[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter(
      (r): r is Recente =>
        typeof r === 'object' &&
        r !== null &&
        typeof r.protocolo === 'string' &&
        r.protocolo !== '' &&
        (r.nivel === null || typeof r.nivel === 'number') &&
        typeof r.criado_em === 'string',
    )
    .map((r) => {
      const ponto = numeroEntre(r.lat, -90, 90) && numeroEntre(r.lng, -180, 180)
      return {
        protocolo: r.protocolo,
        nivel: r.nivel,
        criado_em: r.criado_em,
        chave: typeof r.chave === 'string' && r.chave !== '' ? r.chave : null,
        status: ehStatus(r.status) ? r.status : null,
        lat: ponto ? r.lat : null,
        lng: ponto ? r.lng : null,
        categoria: typeof r.categoria === 'string' && r.categoria !== '' ? r.categoria : null,
        ...(r.viuResolvido === true ? { viuResolvido: true } : {}),
      }
    })
    .slice(0, MAX_RECENTES)
}

// O ponto é o do envio: vira o pino do relato no mapa deste aparelho.
export function recenteDaResposta(r: Resposta, ponto: Ponto | null = null): Recente {
  return {
    protocolo: r.protocolo,
    nivel: r.nivel,
    criado_em: r.criado_em,
    chave: r.chave || null,
    status: r.status,
    lat: ponto?.lat ?? null,
    lng: ponto?.lng ?? null,
    categoria: r.categoria || null,
  }
}

export const LADO_MAXIMO = 1600

// Dimensões da foto reduzida: o lado maior cai para o máximo, mantendo a
// proporção. Foto pequena não é ampliada.
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  maximo: number = LADO_MAXIMO,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (!(maior > 0)) return { largura: 0, altura: 0 }
  const escala = Math.min(1, maximo / maior)
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  }
}

// Limite do servidor para a foto já reduzida.
export const LIMITE_FOTO_BYTES = 12 * 1024 * 1024

export function fotoCabe(bytes: number): boolean {
  return bytes > 0 && bytes <= LIMITE_FOTO_BYTES
}

export const FOTO_ILEGIVEL = 'Não consegui ler essa foto. Tire outra pela câmera.'

// Monta um UUID v4 a partir de 16 bytes aleatórios, para navegador sem
// crypto.randomUUID.
export function uuidDeBytes(bytes: ArrayLike<number>): string {
  const b = Array.from({ length: 16 }, (_, i) => (bytes[i] ?? 0) & 0xff)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function ehUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

// Códigos do servidor e mais três que nascem no aparelho.
const CODIGOS = [
  'foto_ausente',
  'foto_formato',
  'foto_grande',
  'foto_nao_aceita',
  'foto_nao_verificada',
  'fotos_demais',
  'video_formato',
  'video_grande',
  'video_longo',
  'video_com_audio',
  'local_invalido',
  'fora_da_cidade',
  'muitos_envios',
  'cadastro_obrigatorio',
  'midia_indisponivel',
  'interno',
  'sem_conexao',
  'tempo_esgotado',
  'desconhecido',
] as const

export type CodigoDeErro = (typeof CODIGOS)[number]

// Vale o código do servidor; sem ele, o status HTTP dá a melhor pista.
// Pedido recusado por tamanho sem dizer o motivo: com vídeo junto, o mais
// provável é que seja ele.
export function codigoDoErro(status: number, codigo: unknown, temVideo: boolean = false): CodigoDeErro {
  if (typeof codigo === 'string' && (CODIGOS as readonly string[]).includes(codigo)) return codigo as CodigoDeErro
  if (status === 401) return 'cadastro_obrigatorio'
  if (status === 413) return temVideo ? 'video_grande' : 'foto_grande'
  if (status === 415) return 'foto_formato'
  if (status === 422) return 'fora_da_cidade'
  if (status === 429) return 'muitos_envios'
  if (status === 502 || status === 503) return 'midia_indisponivel'
  if (status >= 500) return 'interno'
  return 'desconhecido'
}

// Fim das frases de vídeo recusado: o app já tirou o vídeo e o botão de
// enviar fica logo abaixo.
const SEM_O_VIDEO = 'Tirei o vídeo do relato. Toque no botão para enviar sem ele.'

// Frase para o morador quando o envio falha. Nunca mostra o texto técnico
// do servidor nem o número do erro.
export function mensagemDeErro(
  codigo: CodigoDeErro,
  cidade: string = CONFIG_PADRAO.cidade,
  midia: LimitesDeMidia = MIDIA_PADRAO,
): string {
  switch (codigo) {
    case 'fotos_demais':
      return midia.fotos_max > 1
        ? `São no máximo ${midia.fotos_max} fotos. Remova uma e envie de novo.`
        : 'Só cabe uma foto por relato. Remova as outras e envie de novo.'
    case 'video_com_audio':
      return `O vídeo veio com som e o MOGI só recebe vídeo sem som. ${SEM_O_VIDEO}`
    case 'video_formato':
      return `O MOGI não conseguiu abrir o vídeo. ${SEM_O_VIDEO}`
    case 'video_grande':
      return `O vídeo ficou grande demais. ${SEM_O_VIDEO}`
    case 'video_longo':
      return `O vídeo passou de ${midia.video_segundos} segundos. ${SEM_O_VIDEO}`
    case 'foto_ausente':
      return 'A foto não chegou. Tire outra pela câmera.'
    case 'foto_formato':
      return FOTO_ILEGIVEL
    case 'foto_nao_aceita':
      return 'Não aceitamos foto de dentro de casa, nem foto pessoal ou íntima. Fotografe o problema na rua, sem pessoas em destaque.'
    case 'foto_nao_verificada':
      return 'Não consegui conferir a foto agora. Tente de novo em instantes.'
    case 'foto_grande':
      return 'A foto ficou pesada demais. Tire outra pela câmera.'
    case 'local_invalido':
      return 'Não entendi o lugar do problema. Marque no mapa onde ele fica.'
    case 'fora_da_cidade':
      return `Este ponto fica fora de ${cidade}. O MOGI só recebe relatos da cidade.`
    case 'muitos_envios':
      return 'Muitos relatos em pouco tempo. Espere alguns minutos e tente de novo.'
    case 'cadastro_obrigatorio':
      return 'Para enviar, faça seu cadastro. Seu relato continua aqui.'
    case 'midia_indisponivel':
      return 'O MOGI não conseguiu guardar a foto agora. Espere um pouco e toque em Tentar de novo.'
    case 'interno':
      return 'O MOGI teve um problema ao receber o relato. Toque em Tentar de novo.'
    case 'sem_conexao':
      return 'Sem internet agora. Seu relato continua aqui: toque em Tentar de novo quando o sinal voltar.'
    case 'tempo_esgotado':
      return 'O envio demorou demais. Seu relato continua aqui: toque em Tentar de novo.'
    default:
      return 'Não foi possível enviar agora. Toque em Tentar de novo.'
  }
}

export type AcaoDoErro = 'repetir' | 'outra_foto' | 'mapa' | 'sem_video' | 'menos_fotos' | 'cadastro'

// O que o morador faz depois da falha. Só "repetir" reenvia o mesmo relato
// com a mesma chave; nos outros casos o relato muda antes de ir de novo.
// Vídeo recusado sai do relato sozinho: com as fotos o relato já vale.
export function acaoDoErro(codigo: CodigoDeErro): AcaoDoErro {
  if (codigo === 'video_com_audio' || codigo === 'video_formato' || codigo === 'video_grande' || codigo === 'video_longo') {
    return 'sem_video'
  }
  if (codigo === 'fotos_demais') return 'menos_fotos'
  if (codigo === 'cadastro_obrigatorio') return 'cadastro'
  if (codigo === 'foto_ausente' || codigo === 'foto_formato' || codigo === 'foto_grande') return 'outra_foto'
  if (codigo === 'local_invalido' || codigo === 'fora_da_cidade') return 'mapa'
  return 'repetir'
}

export const NAO_DUPLICA = 'Pode tentar à vontade: o relato não é enviado em dobro.'

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

// Lê a resposta do POST /api/ocorrencias: 200 (repetição) e 201 (novo) com
// protocolo são sucesso; o resto vira um código de erro.
export function interpretarEnvio(
  status: number,
  corpo: unknown,
  temVideo: boolean = false,
): { resposta: Resposta } | { codigo: CodigoDeErro } {
  const d = typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : {}
  if (status !== 200 && status !== 201) return { codigo: codigoDoErro(status, d.codigo, temVideo) }
  const protocolo = texto(d.protocolo)
  if (!protocolo) return { codigo: 'desconhecido' }
  return {
    resposta: {
      protocolo,
      chave: texto(d.chave) ?? '',
      status: ehStatus(d.status) ? d.status : 'a_classificar',
      nivel: typeof d.nivel === 'number' ? d.nivel : null,
      categoria: texto(d.categoria) ?? '',
      secretaria: texto(d.secretaria),
      prazo_ate: texto(d.prazo_ate),
      prazo_fonte: texto(d.prazo_fonte),
      endereco: texto(d.endereco),
      bairro: texto(d.bairro),
      agrupada: d.agrupada === true,
      relatos: typeof d.relatos === 'number' && d.relatos > 0 ? d.relatos : 1,
      criado_em: texto(d.criado_em) ?? new Date().toISOString(),
      repetido: d.repetido === true || status === 200,
      ...(d.fora_do_escopo === true ? { fora_do_escopo: true } : {}),
    },
  }
}

export type Progresso = { fase: 'preparando' } | { fase: 'enviando'; fracao: number } | { fase: 'analisando' }

export function porcentagem(p: Progresso): number {
  if (p.fase === 'preparando') return 0
  if (p.fase === 'analisando') return 100
  return Math.max(0, Math.min(100, Math.round(p.fracao * 100)))
}

// O que vai no relato, para os textos do envio.
export interface Midias {
  fotos: number
  video: boolean
}

const UMA_FOTO: Midias = { fotos: 1, video: false }

// "a foto", "3 fotos", "a foto e o vídeo", "3 fotos e o vídeo".
export function oQueVai(m: Midias): string {
  const fotos = m.fotos > 1 ? `${m.fotos} fotos` : 'a foto'
  return m.video ? `${fotos} e o vídeo` : fotos
}

export function textoDoProgresso(p: Progresso, m: Midias = UMA_FOTO): string {
  if (p.fase === 'preparando') return 'Preparando o envio…'
  if (p.fase === 'analisando') return 'Analisando o relato…'
  return `Enviando ${oQueVai(m)}… ${porcentagem(p)}%`
}

// Texto do botão principal do formulário, conforme a última falha.
export function rotuloDoEnvio(acao: AcaoDoErro | null, fotos: number): string {
  if (acao === 'repetir') return 'Tentar de novo'
  if (acao === 'sem_video') return fotos > 1 ? 'Enviar só com as fotos' : 'Enviar só com a foto'
  return 'Enviar relato'
}

// Vídeo pesa mais e sobe devagar no 4G: ganha o dobro do prazo.
export function prazoDeEnvio(temVideo: boolean): number {
  return temVideo ? 180_000 : 90_000
}

// Quantas fotos ainda cabem no relato, contando as que estão sendo preparadas.
export function vagasDeFoto(usadas: number, midia: LimitesDeMidia): number {
  return Math.max(0, midia.fotos_max - Math.max(0, usadas))
}

export function apoioDasFotos(midia: LimitesDeMidia): string | null {
  return midia.fotos_max > 1 ? `Até ${midia.fotos_max} fotos. A primeira é a principal.` : null
}

// Vídeo curto

// Do mais aceito pelo servidor e pelos celulares ao menos aceito.
export const TIPOS_DE_VIDEO = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

// Primeiro tipo que o gravador do navegador aceita; null deixa o navegador
// escolher. "suporta" é o MediaRecorder.isTypeSupported.
export function tipoDeGravacao(suporta: (tipo: string) => boolean): string | null {
  for (const tipo of TIPOS_DE_VIDEO) {
    try {
      if (suporta(tipo)) return tipo
    } catch {
      /* navegador que estoura em tipo desconhecido: tenta o próximo */
    }
  }
  return null
}

// "video/webm;codecs=vp9" vira "video/webm".
export function tipoSemCodec(tipo: string): string {
  return tipo.split(';')[0].trim().toLowerCase()
}

export function extensaoDoVideo(tipo: string): 'mp4' | 'mov' | 'webm' {
  const base = tipoSemCodec(tipo)
  if (base.includes('webm') || base.includes('matroska')) return 'webm'
  if (base.includes('quicktime')) return 'mov'
  return 'mp4'
}

export const VIDEO_MINIMO_MS = 1000
export const LADO_DO_QUADRO = 1280

// Durante a gravação, um quadro da prévia é guardado a cada segundo; no
// fim ficam os mais próximos de 15%, 50% e 85% da duração.
export const PRIMEIRO_QUADRO_MS = 500
export const INTERVALO_DOS_QUADROS_MS = 1000
const QUADROS_GUARDADOS = 15

// Um quadro por segundo; em limite mais longo o intervalo cresce, para a
// memória do aparelho não encher de quadros.
export function intervaloDosQuadros(limiteSegundos: number): number {
  return Math.max(INTERVALO_DOS_QUADROS_MS, Math.ceil((limiteSegundos * 1000) / QUADROS_GUARDADOS))
}
const FRACOES_DOS_QUADROS = [0.15, 0.5, 0.85]

// Instantes (em ms) dos quadros que representam o vídeo.
export function instantesDosQuadros(duracaoMs: number, maximo: number = 3): number[] {
  if (!Number.isFinite(duracaoMs) || duracaoMs <= 0 || maximo < 1) return []
  const fracoes = maximo === 1 ? [0.5] : maximo === 2 ? [0.15, 0.85] : FRACOES_DOS_QUADROS
  return fracoes.map((f) => Math.round(duracaoMs * f))
}

// Entre os quadros guardados na gravação (cada um com seu instante em ms),
// devolve os índices dos que ficam, em ordem, sem repetir.
export function escolherQuadros(capturados: readonly number[], duracaoMs: number, maximo: number = 3): number[] {
  if (maximo < 1) return []
  const livres = capturados.map((_, i) => i)
  if (livres.length <= maximo) return livres
  const fim = Number.isFinite(duracaoMs) && duracaoMs > 0 ? duracaoMs : Math.max(...capturados)
  const escolhidos: number[] = []
  for (const alvo of instantesDosQuadros(fim, maximo)) {
    let melhor = 0
    for (let i = 1; i < livres.length; i++) {
      if (Math.abs(capturados[livres[i]] - alvo) < Math.abs(capturados[livres[melhor]] - alvo)) melhor = i
    }
    escolhidos.push(...livres.splice(melhor, 1))
  }
  return escolhidos.sort((a, b) => a - b)
}

// "0:07", "1:05".
export function formatarDuracao(ms: number): string {
  const s = Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// "7 segundos", para o leitor de tela.
export function duracaoPorExtenso(ms: number): string {
  const s = Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.round(ms / 1000)) : 0
  return s === 1 ? '1 segundo' : `${s} segundos`
}

export function segundosRestantes(decorridoMs: number, limiteSegundos: number): number {
  return Math.max(0, Math.min(limiteSegundos, Math.ceil(limiteSegundos - decorridoMs / 1000)))
}

// Fala do leitor de tela durante a gravação: no começo e de 5 em 5
// segundos, não a cada segundo. null: nada novo para anunciar.
export function anuncioDaGravacao(restantes: number, limiteSegundos: number): string | null {
  if (restantes <= 0 || (restantes !== limiteSegundos && restantes % 5 !== 0)) return null
  return restantes === 1 ? 'Gravando, falta 1 segundo' : `Gravando, faltam ${restantes} segundos`
}

export type DefeitoDoVideo = 'vazio' | 'curto' | 'grande'

// O que impede o vídeo recém-gravado de entrar no relato; null: serve.
export function defeitoDoVideo(bytes: number, duracaoMs: number, midia: LimitesDeMidia): DefeitoDoVideo | null {
  if (!(bytes > 0)) return 'vazio'
  if (!(duracaoMs >= VIDEO_MINIMO_MS)) return 'curto'
  if (bytes > midia.video_mb * 1024 * 1024) return 'grande'
  return null
}

export const AVISO_DO_VIDEO = 'O vídeo é gravado sem som. Evite filmar rostos e placas.'
export const SEM_CAMERA = 'Sem acesso à câmera para vídeo. Você pode enviar só com as fotos.'
export const CAMERA_FALHOU = 'Não consegui abrir a câmera para vídeo. Você pode enviar só com as fotos.'
export const CAMERA_PAROU = 'A câmera parou no meio do vídeo. Você pode enviar só com as fotos.'
export const SEM_GRAVACAO = 'Não consegui gravar o vídeo. Você pode enviar só com as fotos.'

export const GRAVADOR_NAO_ABRIU = 'Não consegui abrir a gravação de vídeo. Confira a internet. Você pode enviar só com as fotos.'

// Só há vídeo quando o navegador grava direto da câmera. O vídeo da câmera
// nativa (campo de arquivo) vem com som, e o servidor recusa.
export function suportaGravacao(
  navegador: { mediaDevices?: { getUserMedia?: unknown } } | undefined,
  janela: { MediaRecorder?: unknown } | undefined,
): boolean {
  return typeof navegador?.mediaDevices?.getUserMedia === 'function' && typeof janela?.MediaRecorder === 'function'
}

export function avisoDoDefeito(defeito: DefeitoDoVideo): string {
  if (defeito === 'curto') return 'O vídeo ficou curto demais. Grave por pelo menos 1 segundo.'
  if (defeito === 'grande') return 'O vídeo ficou grande demais. Grave um mais curto.'
  return SEM_GRAVACAO
}

// "nome" é o name do erro do getUserMedia.
export function avisoDaCamera(nome: unknown): string {
  return nome === 'NotAllowedError' || nome === 'SecurityError' || nome === 'PermissionDeniedError' ? SEM_CAMERA : CAMERA_FALHOU
}

export function rotuloDoVideo(midia: LimitesDeMidia): string {
  return `Gravar vídeo (até ${midia.video_segundos} s)`
}

// Mapa ao vivo e boneco

const RAIO_DA_TERRA_M = 6_371_008.8
const rad = (g: number) => (g * Math.PI) / 180

// Distância em metros entre dois pontos (haversine).
export function distanciaM(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * RAIO_DA_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Rumo de a para b em graus: 0 é norte, 90 é leste.
export function rumoEntre(a: Ponto, b: Ponto): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng))
  const g = (Math.atan2(y, x) * 180) / Math.PI
  return (g + 360) % 360
}

// Ponto no caminho de a até b; t vai de 0 (a) a 1 (b).
export function interpolar(a: Ponto, b: Ponto, t: number): Ponto {
  const f = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }
}

// Abaixo disso a pessoa está parada; o tremor do GPS não conta como passo.
export const VELOCIDADE_DE_ANDAR = 0.5
const PASSO_MINIMO_M = 2
// Acima desta precisão (metros) a leitura não basta para dizer que a pessoa andou.
const PRECISAO_PARA_ANDAR_M = 25
const DURACAO_MINIMA_MS = 300
const DURACAO_MAXIMA_MS = 1500

export interface PassoDoBoneco {
  andando: boolean
  // Rumo do movimento; null quando parado.
  rumo: number | null
  // Tempo da animação entre a leitura anterior e a nova.
  duracaoMs: number
}

// Decide se o boneco anda até a nova leitura e para que lado. Vale a
// velocidade do GPS quando vem; senão, a distância pelo tempo. Um salto
// menor que metade da precisão é tremor do GPS, não passo.
export function passoDoBoneco(anterior: Posicao | null, nova: Posicao): PassoDoBoneco {
  if (!anterior) return { andando: false, rumo: null, duracaoMs: 0 }
  const metros = distanciaM(anterior, nova)
  const ms = anterior.em != null && nova.em != null ? nova.em - anterior.em : 1000
  const duracaoMs = Math.max(DURACAO_MINIMA_MS, Math.min(DURACAO_MAXIMA_MS, ms > 0 ? ms : 1000))
  const tremor = Math.max(PASSO_MINIMO_M, Math.min(nova.precisao ?? 0, 30) * 0.5)
  if (metros < tremor) return { andando: false, rumo: null, duracaoMs }
  // Leitura fraca (Wi-Fi, dentro de prédio) acusa deslocamento e velocidade
  // que não existem: com ela, o boneco fica parado. A posição ainda acompanha.
  if (nova.precisao != null && nova.precisao > PRECISAO_PARA_ANDAR_M) {
    return { andando: false, rumo: null, duracaoMs }
  }
  const v =
    typeof nova.velocidade === 'number' && Number.isFinite(nova.velocidade) && nova.velocidade >= 0
      ? nova.velocidade
      : ms > 0
        ? metros / (ms / 1000)
        : 0
  const andando = v >= VELOCIDADE_DE_ANDAR
  return { andando, rumo: andando ? rumoEntre(anterior, nova) : null, duracaoMs }
}

export type Lado = 'direita' | 'esquerda'

// O boneco olha para a direita ou para a esquerda da tela. Andando quase
// reto para cima ou para baixo, fica como estava.
export function ladoNaTela(rumo: number | null, rumoDoMapa: number, anterior: Lado): Lado {
  if (rumo === null) return anterior
  const s = Math.sin(rad(rumo - rumoDoMapa))
  if (Math.abs(s) < 0.2) return anterior
  return s > 0 ? 'direita' : 'esquerda'
}

// Metros por pixel no MapLibre (tiles de 512) na latitude e no zoom.
export function metrosPorPixel(lat: number, zoom: number): number {
  return (2 * Math.PI * 6_378_137 * Math.cos(rad(lat))) / (512 * 2 ** zoom)
}

// Diâmetro do círculo de precisão, discreto: nunca some nem cobre a tela.
export function diametroDaPrecisao(precisao: number | null, lat: number, zoom: number): number {
  if (precisao === null || !Number.isFinite(precisao) || precisao <= 0) return 0
  return Math.round(Math.max(24, Math.min(320, (2 * precisao) / metrosPorPixel(lat, zoom))))
}

export interface MemoriaDoGps {
  // Última leitura, boa ou não: é onde o boneco fica.
  atual: Posicao | null
  // Última leitura com precisão aceita, enquanto não for velha.
  boa: Posicao | null
}

// Uma leitura imprecisa no meio de várias boas não tira a localização:
// a última boa vale por um minuto.
export const VALIDADE_DA_BOA_MS = 60_000

export function guardarLeitura(m: MemoriaDoGps, nova: Posicao, agora: number): MemoriaDoGps {
  if (precisaoAceita(nova)) return { atual: nova, boa: nova }
  const boa = m.boa && agora - (m.boa.em ?? 0) <= VALIDADE_DA_BOA_MS ? m.boa : null
  return { atual: nova, boa }
}

// Leitura do GPS que vale para o envio e para a situação do lugar.
export function gpsDaMemoria(m: MemoriaDoGps): Posicao | null {
  if (m.atual && precisaoAceita(m.atual)) return m.atual
  return m.boa ?? m.atual
}

// Segurar o disparador por mais que isso começa o vídeo.
export const SEGURAR_MS = 400

// "Enviando 62%", para o leitor de tela e o rótulo do botão.
export function falaDoEnvio(p: Progresso): string {
  if (p.fase === 'preparando') return 'Preparando o envio'
  if (p.fase === 'analisando') return 'Enviando 100%'
  return `Enviando ${porcentagem(p)}%`
}

// O leitor de tela ouve o envio de quarto em quarto, não a cada número.
export function marcoDoEnvio(p: Progresso): string {
  if (p.fase === 'preparando') return 'Enviando'
  if (p.fase === 'analisando') return 'Enviando 100%'
  return `Enviando ${Math.floor(porcentagem(p) / 25) * 25}%`
}

// Pinos no mapa: só os relatos deste aparelho que guardaram o lugar.
export function pinosDosRecentes(recentes: readonly Recente[]): (Recente & Ponto)[] {
  return recentes.filter((r): r is Recente & Ponto => r.lat !== null && r.lng !== null)
}

// Tipos do problema

// Uma palavra por tipo, para a grade e o cartão.
const NOMES_CURTOS: Record<string, string> = {
  agua: 'Água',
  iluminacao: 'Luz',
  vias: 'Buraco',
  limpeza: 'Lixo',
  arvores: 'Árvore',
  sinalizacao: 'Placa',
  calcadas: 'Calçada',
  animais: 'Animal',
  outros: 'Outro',
}

export function nomeCurto(id: string, nome: string = ''): string {
  return NOMES_CURTOS[id] ?? (nome.trim().split(/\s+/)[0] || 'Outro')
}

// Perto de você

export interface Proximo {
  ref: string
  categoria: string
  categoria_nome: string
  distancia_m: number
  desde: string
  relatos: number
  status: string
}

export function lerPerto(bruto: unknown): Proximo[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter(
      (p): p is Proximo =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.ref === 'string' &&
        p.ref !== '' &&
        typeof p.categoria === 'string' &&
        typeof p.distancia_m === 'number' &&
        Number.isFinite(p.distancia_m),
    )
    .map((p) => ({
      ref: p.ref,
      categoria: p.categoria,
      categoria_nome: typeof p.categoria_nome === 'string' ? p.categoria_nome : '',
      distancia_m: Math.max(0, p.distancia_m),
      desde: typeof p.desde === 'string' ? p.desde : '',
      relatos: typeof p.relatos === 'number' && p.relatos > 0 ? Math.floor(p.relatos) : 1,
      status: typeof p.status === 'string' ? p.status : '',
    }))
}

// Só oferece "Também vi" para o chamado mais perto, até 80 m.
export const RAIO_DO_CARTAO_M = 80

export function escolherPerto(itens: readonly Proximo[], limite: number = RAIO_DO_CARTAO_M): Proximo | null {
  let melhor: Proximo | null = null
  for (const p of itens) if (p.distancia_m <= limite && (!melhor || p.distancia_m < melhor.distancia_m)) melhor = p
  return melhor
}

// "a 30 m", "a 1,2 km".
export function distanciaCurta(metros: number): string {
  return `a ${formatarDistancia(metros)}`
}

export function pessoas(n: number): string {
  return n === 1 ? '1 pessoa' : `${Math.max(0, Math.floor(n))} pessoas`
}

// "Buraco · a 30 m · 3 pessoas".
export function linhaDoPerto(p: Proximo): string {
  return [nomeCurto(p.categoria, p.categoria_nome), distanciaCurta(p.distancia_m), pessoas(p.relatos)].join(' · ')
}

export interface ConsultaPerto extends Ponto {
  em: number
  itens: Proximo[]
}

// A lista já buscada ainda serve se a pessoa andou pouco e faz pouco tempo.
export function consultaServe(c: ConsultaPerto | null, aqui: Ponto, agora: number): boolean {
  return c !== null && agora - c.em <= 60_000 && distanciaM(c, aqui) <= 25
}

export type CodigoDaConfirmacao =
  | 'ja_confirmou'
  | 'longe_demais'
  | 'ref_invalida'
  | 'muitos_envios'
  | 'cadastro_obrigatorio'
  | 'sem_conexao'
  | 'desconhecido'

// Resposta do POST /api/perto/confirmacao: 201 (ou 200, repetição) é o recibo.
export function interpretarConfirmacao(
  status: number,
  corpo: unknown,
): { resposta: Resposta } | { codigo: CodigoDaConfirmacao } {
  if (status === 200 || status === 201) {
    const r = interpretarEnvio(201, corpo)
    return 'resposta' in r ? r : { codigo: 'desconhecido' }
  }
  const d = typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : {}
  const conhecidos: CodigoDaConfirmacao[] = ['ja_confirmou', 'longe_demais', 'ref_invalida', 'muitos_envios', 'cadastro_obrigatorio']
  if (conhecidos.includes(d.codigo as CodigoDaConfirmacao)) return { codigo: d.codigo as CodigoDaConfirmacao }
  if (status === 401) return { codigo: 'cadastro_obrigatorio' }
  if (status === 409) return { codigo: 'ja_confirmou' }
  if (status === 422) return { codigo: 'longe_demais' }
  if (status === 400) return { codigo: 'ref_invalida' }
  if (status === 429) return { codigo: 'muitos_envios' }
  return { codigo: 'desconhecido' }
}

// Depois da falha: avisar e fechar o cartão, ou seguir para a câmera.
export function depoisDaConfirmacao(c: CodigoDaConfirmacao): 'avisar' | 'camera' | 'tentar' | 'cadastro' {
  if (c === 'cadastro_obrigatorio') return 'cadastro'
  if (c === 'longe_demais' || c === 'ref_invalida') return 'camera'
  if (c === 'sem_conexao' || c === 'desconhecido') return 'tentar'
  return 'avisar'
}

export function mensagemDaConfirmacao(c: CodigoDaConfirmacao): string {
  switch (c) {
    case 'ja_confirmou':
      return 'Você já avisou deste problema.'
    case 'muitos_envios':
      return 'Muitos envios em pouco tempo. Espere alguns minutos.'
    case 'sem_conexao':
      return 'Sem internet agora. Tente de novo.'
    case 'cadastro_obrigatorio':
      return 'Para confirmar, faça seu cadastro.'
    default:
      return 'Não deu para confirmar agora. Tente de novo.'
  }
}

// Acompanhamento

export type TipoDoPasso = 'recebido' | 'conferido' | 'a_caminho' | 'resolvido'

const TIPOS_DE_PASSO: readonly TipoDoPasso[] = ['recebido', 'conferido', 'a_caminho', 'resolvido']

export const ROTULO_DO_PASSO: Record<TipoDoPasso, string> = {
  recebido: 'Recebido',
  conferido: 'Prefeitura conferiu',
  a_caminho: 'Equipe a caminho',
  resolvido: 'Resolvido',
}

export interface Acompanhamento {
  protocolo: string
  categoria: string
  categoria_nome: string
  status: Status
  nivel: number | null
  prazo_ate: string | null
  relatos: number
  enviado_em: string
  passos: { tipo: TipoDoPasso; feito: boolean; quando: string | null }[]
  o_que_foi_feito: string | null
  fotos_do_depois: string[]
}

// Sempre os quatro passos, na ordem; o que faltar fica por fazer.
export function lerAcompanhamento(bruto: unknown): Acompanhamento | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const b = bruto as Record<string, unknown>
  const protocolo = texto(b.protocolo)
  if (!protocolo) return null
  const lidos = Array.isArray(b.passos) ? (b.passos as unknown[]) : []
  const passos = TIPOS_DE_PASSO.map((tipo) => {
    const p = lidos.find((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && (x as { tipo?: unknown }).tipo === tipo)
    return { tipo, feito: p?.feito === true || (tipo === 'recebido' && !p), quando: p?.feito === true ? texto(p.quando) : null }
  })
  const fotos = Array.isArray(b.fotos_do_depois) ? b.fotos_do_depois.filter((f): f is string => typeof f === 'string' && f !== '') : []
  return {
    protocolo,
    categoria: texto(b.categoria) ?? '',
    categoria_nome: texto(b.categoria_nome) ?? '',
    status: ehStatus(b.status) ? b.status : 'a_classificar',
    nivel: typeof b.nivel === 'number' ? b.nivel : null,
    prazo_ate: texto(b.prazo_ate),
    relatos: typeof b.relatos === 'number' && b.relatos > 0 ? b.relatos : 1,
    enviado_em: texto(b.enviado_em) ?? '',
    passos,
    o_que_foi_feito: texto(b.o_que_foi_feito),
    fotos_do_depois: fotos,
  }
}

export interface PassoNaTela {
  tipo: TipoDoPasso
  rotulo: string
  feito: boolean
  // "12/11 às 14:30" nos feitos; vazio nos que faltam.
  quando: string
  // O próximo a acontecer: o primeiro ainda não feito.
  agora: boolean
}

export function passosNaTela(a: Pick<Acompanhamento, 'passos'>, fuso?: string): PassoNaTela[] {
  const proximo = a.passos.findIndex((p) => !p.feito)
  return a.passos.map((p, i) => ({
    tipo: p.tipo,
    rotulo: ROTULO_DO_PASSO[p.tipo],
    feito: p.feito,
    quando: p.feito && p.quando ? formatarDataHora(p.quando, fuso) : '',
    agora: i === proximo,
  }))
}

function diaNoFuso(d: Date, fuso?: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: fuso })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86_400_000
}

// Prazo em palavras: "Até hoje, 18:00", "Até amanhã, 09:00", "Até sexta-feira",
// "Até 28/11". Resolvido não tem prazo.
export function prazoEmPalavras(iso: string | null, status: Status, agora: Date, fuso?: string): string | null {
  if (status === 'resolvida') return null
  if (!iso) return 'Na rotina da equipe'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Na rotina da equipe'
  if (d.getTime() < agora.getTime()) return 'Prazo vencido'
  const dias = diaNoFuso(d, fuso) - diaNoFuso(agora, fuso)
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: fuso }).format(d)
  if (dias <= 0) return `Até hoje, ${hora}`
  if (dias === 1) return `Até amanhã, ${hora}`
  if (dias < 7) return `Até ${new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: fuso }).format(d)}`
  const p = partesDaData(iso, fuso)
  return p ? `Até ${p.day}/${p.month}` : 'Na rotina da equipe'
}

// O que o acompanhamento traz de novo para o pino guardado no aparelho.
export function recenteAtualizado(r: Recente, a: Pick<Acompanhamento, 'nivel' | 'status' | 'categoria'>): Recente {
  return { ...r, nivel: a.nivel, status: a.status, categoria: a.categoria || r.categoria }
}

// Toca o som de resolvido só na primeira vez que o aparelho vê o relato resolvido.
export function estreiaResolvido(r: Recente, a: Pick<Acompanhamento, 'status'>): boolean {
  return a.status === 'resolvida' && r.viuResolvido !== true
}

// Telemetria: o que o aparelho avisa quando algo falha, sem dado pessoal.
export const TIPOS_DE_TELEMETRIA = [
  'gps_negado',
  'gps_impreciso',
  'camera_negada',
  'foto_ilegivel',
  'video_falhou',
  'envio_falhou',
  'mapa_falhou',
  // Funil do relato (uma vez por visita): abriu, cadastrou, fotografou, enviou.
  'funil_abriu',
  'funil_cadastro',
  'funil_foto',
  'funil_enviou',
] as const

export type TipoDeTelemetria = (typeof TIPOS_DE_TELEMETRIA)[number]

// Detalhe curto: só letras, números e sinais simples, até 60 caracteres.
export function detalheDaTelemetria(bruto: unknown): string {
  const s = typeof bruto === 'string' ? bruto : bruto instanceof Error ? bruto.name : ''
  return s.replace(/[^\w .:/-]/g, '').trim().slice(0, 60)
}
