// Lógica pura das telas do gestor (Operação, Usuários e Parâmetros): nada
// aqui toca em rede nem em React, para poder ser testado sozinho.

// ---------- Formas das respostas do servidor ----------

export interface EtapaDaOperacao {
  etapa: string
  provedor: string
  chamadas: number
  falhas: number
  media_ms: number
  p95_ms: number
  ultima_falha: string | null
  ultimo_erro?: string
}

export interface HoraDeRelatos {
  hora: string
  relatos: number
  tambem_vi: number
}

export interface MinutoDoServidor {
  minuto: string
  pedidos: number
  erros_5xx: number
  recusas_4xx: number
}

export interface RotaDoServidor {
  rota: string
  pedidos: number
  media_ms: number
  p95_ms: number
  erros_5xx: number
  recusas_4xx: number
}

export interface FalhaDoServidor {
  quando: string
  metodo: string
  rota: string
  status: number
  ms: number
  id: string
}

export interface SinalDeAparelho {
  quando: string
  tipo: string
  detalhe: string | null
  tela: string | null
  navegador: string | null
}

export interface DadosDaOperacao {
  agora: string
  saude: { banco: string; midia: string }
  banco: { conexoes_em_uso: number; conexoes_max: number }
  fila: {
    revisao: number
    a_classificar: number
    abertas: number
    em_atendimento: number
    nivel5_em_revisao: number
    prazo_vencido: number
  }
  relatos: { ultima_hora: number; ultimas_24h: number; ultimo_em: string | null; por_hora: HoraDeRelatos[] }
  triagem: EtapaDaOperacao[]
  servidor: {
    no_ar_desde: string
    pedidos: number
    erros_5xx: number
    recusas_4xx: number
    rotas: RotaDoServidor[]
    por_minuto: MinutoDoServidor[]
    falhas: FalhaDoServidor[]
  }
  aparelhos: { por_tipo: { chave: string; n: number }[]; recentes: SinalDeAparelho[] }
  // Funil do relato nos últimos 7 dias, na ordem (contagem de eventos).
  funil?: { chave: string; n: number }[]
  // Alertas abertos pelo vigia do servidor (banco, mídia, triagem parada, erros).
  alertas?: { chave: string; texto: string; desde: string }[]
}

const NOMES_DO_FUNIL: Record<string, string> = {
  funil_abriu: 'Abriu o app',
  funil_cadastro: 'Fez o cadastro',
  funil_foto: 'Tirou a foto',
  funil_enviou: 'Enviou o relato',
}

export interface EtapaDoFunil {
  chave: string
  nome: string
  n: number
  // Parte do começo do funil, de 0 a 100 (para a largura da barra).
  doInicio: number
  // Quantos desistiram desde a etapa anterior, em %; null na primeira.
  queda: number | null
}

// Monta as barras do funil. O cadastro é uma vez só por pessoa, então pode
// ficar abaixo da foto e do envio: a queda nunca aparece negativa.
export function etapasDoFunil(funil: { chave: string; n: number }[] | undefined): EtapaDoFunil[] {
  if (!funil || funil.length === 0) return []
  const inicio = funil[0].n
  return funil.map((e, i) => {
    const anterior = i > 0 ? funil[i - 1].n : null
    const queda = anterior === null ? null : anterior > 0 ? Math.max(0, Math.round((1 - e.n / anterior) * 100)) : 0
    return {
      chave: e.chave,
      nome: NOMES_DO_FUNIL[e.chave] ?? e.chave.replaceAll('_', ' '),
      n: e.n,
      doInicio: inicio > 0 ? Math.min(100, Math.round((e.n / inicio) * 100)) : 0,
      queda,
    }
  })
}

export type Papel = 'gestor' | 'operador' | 'campo' | 'prefeito'

export interface Cadastro {
  login: string
  nome: string
  papel: Papel
  secretaria: string
  ativo: boolean
  criado_em: string
}

export interface Modulos {
  video: boolean
  perto: boolean
  campo: boolean
  voz: boolean
  recuperacao: boolean
}

export interface Parametros {
  raio_agrupamento_m: number
  janela_agrupamento_dias: number
  raio_perto_m: number
  envios_por_aparelho: number
  envios_por_ip: number
  retencao_dias: number
  modulos: Modulos
}

export interface RespostaDeParametros {
  cidade: { slug: string; nome: string; centro_lat: number; centro_lng: number; caixa: string }
  parametros: Parametros
  padrao: Parametros
}

// ---------- Tempo em palavras ----------

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

function ms(t: string | number): number {
  return typeof t === 'number' ? t : new Date(t).getTime()
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

// "5 min", "2 h 10 min", "3 dias 4 h": no máximo duas unidades.
export function duracaoEmPalavras(intervaloMs: number): string {
  const t = Math.max(0, intervaloMs)
  if (t < MIN) return 'menos de 1 min'
  if (t < HORA) return `${Math.floor(t / MIN)} min`
  if (t < DIA) {
    const h = Math.floor(t / HORA)
    const m = Math.floor((t % HORA) / MIN)
    return m > 0 ? `${h} h ${m} min` : `${h} h`
  }
  const d = Math.floor(t / DIA)
  const h = Math.floor((t % DIA) / HORA)
  return h > 0 ? `${plural(d, 'dia', 'dias')} ${h} h` : plural(d, 'dia', 'dias')
}

// "há 3 min", "há 2 h 10 min"; menos de um minuto vira "agora há pouco".
export function haQuanto(desde: string | number, agora: string | number): string {
  const t = ms(agora) - ms(desde)
  if (!Number.isFinite(t)) return 'sem registro'
  if (t < MIN) return 'agora há pouco'
  return `há ${duracaoEmPalavras(t)}`
}

export function noArHa(desde: string | number, agora: string | number): string {
  return `no ar há ${duracaoEmPalavras(ms(agora) - ms(desde))}`
}

// Tempo de uma etapa: "menos de 1 s", "1,2 s", "12 s", "1 min 5 s".
export function tempoEmPalavras(milissegundos: number): string {
  const t = Math.max(0, milissegundos)
  if (t < 1000) return 'menos de 1 s'
  if (t < 10_000) return `${(t / 1000).toFixed(1).replace('.', ',')} s`
  if (t < MIN) return `${Math.round(t / 1000)} s`
  const s = Math.round((t % MIN) / 1000)
  return s > 0 ? `${Math.floor(t / MIN)} min ${s} s` : `${Math.floor(t / MIN)} min`
}

// Só avisa da falta de relato de dia: de madrugada o silêncio é o normal.
const SILENCIO_MS = 30 * MIN
const DIA_COMECA = 7
const DIA_TERMINA = 22

export function avisoSemRelato(ultimoEm: string | null, agora: string | number, horaLocal: number): string | null {
  if (horaLocal < DIA_COMECA || horaLocal >= DIA_TERMINA) return null
  if (!ultimoEm) return 'Nenhum relato real chegou ainda'
  const t = ms(agora) - ms(ultimoEm)
  if (t <= SILENCIO_MS) return null
  return `Nenhum relato há ${duracaoEmPalavras(t)}`
}

// ---------- Nomes em português comum ----------

const ETAPAS: Record<string, string> = {
  borrao: 'Borrar rostos e placas',
  armazenamento: 'Guardar as fotos',
  geocodigo: 'Descobrir o endereço',
  visao: 'Olhar a foto (IA)',
  classificacao: 'Avaliar a urgência',
  regra_lua: 'Regra da prefeitura',
}

// Ordem em que as etapas acontecem com o relato.
const ORDEM_DAS_ETAPAS = ['borrao', 'armazenamento', 'geocodigo', 'visao', 'classificacao', 'regra_lua']
const ESSENCIAIS = new Set(['borrao', 'armazenamento', 'regra_lua'])

export function nomeDaEtapa(etapa: string): string {
  return ETAPAS[etapa] ?? etapa.replaceAll('_', ' ')
}

// Quem avaliou a urgência. Só a classificação mostra o provedor traduzido.
export function nomeDoProvedor(provedor: string): string {
  const p = provedor.trim().toLowerCase()
  if (p.startsWith('jev')) return 'Jev'
  if (p.startsWith('local')) return 'regra local, sem IA'
  if (p.includes('claude')) return 'IA de reserva'
  return provedor.trim()
}

const SINAIS: Record<string, string> = {
  gps_negado: 'Localização negada',
  gps_impreciso: 'Localização imprecisa',
  foto_ilegivel: 'Foto que não abriu',
  envio_falhou: 'Envio que não saiu',
  video_falhou: 'Vídeo que não gravou',
  camera_negada: 'Câmera negada',
  campo_envio_falhou: 'Equipe: envio que não saiu',
  campo_foto_ilegivel: 'Equipe: foto que não abriu',
  campo_gps_negado: 'Equipe: localização negada',
}

export function nomeDoSinal(tipo: string): string {
  return SINAIS[tipo] ?? tipo.replaceAll('_', ' ')
}

const ROTAS: Record<string, string> = {
  'POST /ocorrencias': 'Envio de relato',
  'GET /ocorrencias': 'Lista de chamados',
  'GET /midia': 'Fotos e vídeos',
  'POST /auth/login': 'Entrar no painel',
}

export function nomeDaRota(rota: string): string {
  return ROTAS[rota] ?? rota
}

const PAPEIS: Record<Papel, string> = {
  gestor: 'Gestor: vê e muda tudo',
  operador: 'Central: confere e manda as equipes',
  campo: 'Equipe de campo: vai à rua resolver',
  prefeito: 'Prefeito: acompanha a cidade pelo Gabinete, sem alterar nada',
}

// Papel em palavras; a equipe de campo aparece com a secretaria dela.
export function rotuloDoPapel(papel: string, secretaria?: string | null): string {
  if (papel === 'campo') return `Equipe de campo: ${secretaria?.trim() || 'sem secretaria'}`
  return PAPEIS[papel as Papel] ?? papel
}

export function explicacaoDoPapel(papel: Papel): string {
  return PAPEIS[papel]
}

// Mensagem do servidor (minúscula, sem ponto) como frase para a tela.
export function comoFrase(msg: string): string {
  const t = msg.trim()
  if (!t) return 'Algo deu errado.'
  const frase = t[0].toUpperCase() + t.slice(1)
  return /[.!?]$/.test(frase) ? frase : frase + '.'
}

// ---------- Triagem: uma linha por etapa ----------

export type SeloDaEtapa = 'ok' | 'instável' | 'falhando'

export interface LinhaDaTriagem {
  chave: string
  etapa: string
  nome: string
  // Só na classificação: quem avaliou.
  quem: string | null
  chamadas: number
  falhas: number
  media_ms: number
  selo: SeloDaEtapa
  ultima_falha: string | null
  ultimo_erro: string | null
}

// Mais da metade falhando é "falhando"; alguma falha é "instável".
export function seloDaEtapa(chamadas: number, falhas: number): SeloDaEtapa {
  if (falhas <= 0 || chamadas <= 0) return 'ok'
  return falhas / chamadas > 0.5 ? 'falhando' : 'instável'
}

// O servidor manda uma linha por etapa e provedor. Para o gestor, as regras
// da prefeitura (um arquivo por categoria) viram uma linha só; a
// classificação fica separada por quem avaliou, que é o que ele precisa ver.
export function linhasDaTriagem(etapas: EtapaDaOperacao[]): LinhaDaTriagem[] {
  const grupos = new Map<string, EtapaDaOperacao[]>()
  for (const e of etapas) {
    const chave = e.etapa === 'classificacao' ? `${e.etapa}:${nomeDoProvedor(e.provedor)}` : e.etapa
    grupos.set(chave, [...(grupos.get(chave) ?? []), e])
  }
  const linhas = [...grupos.entries()].map(([chave, grupo]): LinhaDaTriagem => {
    const chamadas = grupo.reduce((s, e) => s + e.chamadas, 0)
    const falhas = grupo.reduce((s, e) => s + e.falhas, 0)
    const soma = grupo.reduce((s, e) => s + e.media_ms * e.chamadas, 0)
    const comFalha = grupo
      .filter((e) => e.ultima_falha)
      .sort((a, b) => ms(b.ultima_falha as string) - ms(a.ultima_falha as string))[0]
    const etapa = grupo[0].etapa
    return {
      chave,
      etapa,
      nome: nomeDaEtapa(etapa),
      quem: etapa === 'classificacao' ? nomeDoProvedor(grupo[0].provedor) || null : null,
      chamadas,
      falhas,
      media_ms: chamadas > 0 ? soma / chamadas : 0,
      selo: seloDaEtapa(chamadas, falhas),
      ultima_falha: comFalha?.ultima_falha ?? null,
      ultimo_erro: comFalha?.ultimo_erro?.trim() || null,
    }
  })
  const posicao = (e: string) => {
    const i = ORDEM_DAS_ETAPAS.indexOf(e)
    return i < 0 ? ORDEM_DAS_ETAPAS.length : i
  }
  return linhas.sort((a, b) => posicao(a.etapa) - posicao(b.etapa) || a.chave.localeCompare(b.chave))
}

// ---------- Veredito ----------

export type NivelDoVeredito = 'ok' | 'atencao' | 'problema'

export interface Motivo {
  gravidade: 'problema' | 'atencao'
  // O que está acontecendo, sem ponto final.
  texto: string
  // O que fazer, quando houver; começa com minúscula e completa o texto.
  acao?: string
}

export interface Veredito {
  nivel: NivelDoVeredito
  titulo: string
  frase: string
  motivos: Motivo[]
}

export const TITULO_DO_VEREDITO: Record<NivelDoVeredito, string> = {
  ok: 'Tudo funcionando',
  atencao: 'Atenção',
  problema: 'Com problema',
}

export function fraseDoMotivo(m: Motivo): string {
  return m.acao ? `${m.texto}: ${m.acao}.` : `${m.texto}.`
}

const AVISAR = 'avise quem cuida do servidor'
const JANELA_DE_ERROS_MIN = 10
const LIMITE_DE_FALHA = 0.2

// Como dizer que uma etapa falhou. As etapas de mídia rodam uma vez por
// foto, então a conta é em vezes; as outras rodam uma vez por relato.
const FALHA_DA_ETAPA: Record<string, { sujeito: string; unidade: 'relatos' | 'vezes'; acao: string }> = {
  borrao: { sujeito: 'O borrão de rostos e placas', unidade: 'vezes', acao: AVISAR },
  armazenamento: { sujeito: 'A gravação das fotos', unidade: 'vezes', acao: AVISAR },
  regra_lua: {
    sujeito: 'A regra da prefeitura',
    unidade: 'relatos',
    acao: 'confira a última mudança em Regras da triagem ou ' + AVISAR,
  },
  geocodigo: {
    sujeito: 'A leitura de endereço',
    unidade: 'relatos',
    acao: 'os chamados chegam sem rua e bairro, use o ponto no mapa',
  },
  visao: {
    sujeito: 'A leitura da foto pela IA',
    unidade: 'relatos',
    acao: 'a urgência sai só pelo texto e pela categoria, confira os chamados com mais cuidado',
  },
}

function textoDaFalha(sujeito: string, unidade: 'relatos' | 'vezes', falhas: number, chamadas: number): string {
  const conta = unidade === 'relatos' ? `em ${falhas} de ${chamadas} relatos` : `${falhas} de ${chamadas} vezes`
  return `${sujeito} falhou ${conta} na última hora`
}

export function sinaisNaUltimaHora(recentes: SinalDeAparelho[], agora: string | number): number {
  const limite = ms(agora) - HORA
  return recentes.filter((s) => ms(s.quando) > limite).length
}

// Responde "o sistema está funcionando agora?" com uma palavra e os motivos.
// Os motivos saem em ordem de gravidade; o primeiro vira a frase do topo.
export function veredito(d: DadosDaOperacao): Veredito {
  const problemas: Motivo[] = []
  const atencoes: Motivo[] = []

  if (d.saude.banco !== 'ok') {
    problemas.push({ gravidade: 'problema', texto: 'O banco de dados não respondeu', acao: AVISAR })
  }
  if (d.saude.midia !== 'ok') {
    problemas.push({ gravidade: 'problema', texto: 'O lugar onde as fotos ficam guardadas não respondeu', acao: AVISAR })
  }

  const linhas = linhasDaTriagem(d.triagem)
  for (const l of linhas) {
    if (l.etapa === 'classificacao' || l.falhas <= 0) continue
    const como = FALHA_DA_ETAPA[l.etapa] ?? { sujeito: `A etapa "${l.nome}"`, unidade: 'vezes' as const, acao: AVISAR }
    const motivo = { texto: textoDaFalha(como.sujeito, como.unidade, l.falhas, l.chamadas), acao: como.acao }
    if (ESSENCIAIS.has(l.etapa)) problemas.push({ gravidade: 'problema', ...motivo })
    else if (l.falhas / l.chamadas > LIMITE_DE_FALHA) atencoes.push({ gravidade: 'atencao', ...motivo })
  }

  const classificadores = linhas.filter((l) => l.etapa === 'classificacao' && l.chamadas > 0)
  if (classificadores.length > 0 && classificadores.every((l) => l.falhas >= l.chamadas)) {
    problemas.push({
      gravidade: 'problema',
      texto: 'A avaliação de urgência falhou em todos os relatos da última hora',
      acao: 'os relatos chegam sem nível, confira um a um na fila e ' + AVISAR,
    })
  } else {
    for (const l of classificadores) {
      if (l.falhas / l.chamadas <= LIMITE_DE_FALHA) continue
      atencoes.push({
        gravidade: 'atencao',
        texto: textoDaFalha(`A avaliação de urgência (${l.quem})`, 'relatos', l.falhas, l.chamadas),
        acao: 'o MOGI passou para a reserva, confira os níveis com mais cuidado',
      })
    }
  }

  const erros = d.servidor.por_minuto.slice(-JANELA_DE_ERROS_MIN).reduce((s, m) => s + m.erros_5xx, 0)
  if (erros > 0) {
    problemas.push({
      gravidade: 'problema',
      texto: `O sistema deu erro em ${plural(erros, 'pedido', 'pedidos')} nos últimos ${JANELA_DE_ERROS_MIN} minutos`,
      acao: 'veja os detalhes técnicos em Servidor e ' + AVISAR,
    })
  }

  const criticos = d.fila.nivel5_em_revisao
  if (criticos > 0) {
    atencoes.push({
      gravidade: 'atencao',
      texto: `${plural(criticos, 'chamado crítico', 'chamados críticos')} esperando alguém conferir`,
      acao: 'abra o Mapa',
    })
  }
  const vencidos = d.fila.prazo_vencido
  if (vencidos > 0) {
    atencoes.push({
      gravidade: 'atencao',
      texto: `${plural(vencidos, 'chamado', 'chamados')} com o prazo vencido`,
      acao: 'abra o Mapa e cobre a equipe responsável',
    })
  }
  const sinais = sinaisNaUltimaHora(d.aparelhos.recentes, d.agora)
  if (sinais > 0) {
    atencoes.push({
      gravidade: 'atencao',
      texto: `${plural(sinais, 'problema avisado', 'problemas avisados')} pelos celulares na última hora`,
      acao: 'veja a lista em Problemas nos celulares',
    })
  }

  const motivos = [...problemas, ...atencoes]
  const nivel: NivelDoVeredito = problemas.length > 0 ? 'problema' : atencoes.length > 0 ? 'atencao' : 'ok'
  const frase =
    motivos.length > 0
      ? `${motivos[0].texto}.`
      : 'Banco de dados, fotos e triagem respondendo, sem erro do sistema nos últimos 10 minutos.'
  return { nivel, titulo: TITULO_DO_VEREDITO[nivel], frase, motivos }
}

// ---------- Gráficos: texto alternativo ----------

export function textoDoGraficoDeRelatos(porHora: HoraDeRelatos[], rotuloDaHora: (iso: string) => string): string {
  const relatos = porHora.reduce((s, h) => s + h.relatos, 0)
  const tambem = porHora.reduce((s, h) => s + h.tambem_vi, 0)
  if (relatos + tambem === 0) return 'Relatos por hora nas últimas 24 horas: nenhum relato.'
  const horas = porHora
    .filter((h) => h.relatos + h.tambem_vi > 0)
    .map((h) => `${rotuloDaHora(h.hora)}: ${leituraDaHora(h)}`)
  return `Relatos por hora nas últimas 24 horas: ${leituraDaHora({ relatos, tambem_vi: tambem })} no total. ${horas.join('; ')}.`
}

export function leituraDaHora(h: { relatos: number; tambem_vi: number }): string {
  const r = plural(h.relatos, 'relato', 'relatos')
  return h.tambem_vi > 0 ? `${r} e ${h.tambem_vi} "também vi"` : r
}

export function textoDoGraficoDoServidor(porMinuto: MinutoDoServidor[]): string {
  const pedidos = porMinuto.reduce((s, m) => s + m.pedidos, 0)
  const erros = porMinuto.reduce((s, m) => s + m.erros_5xx, 0)
  const recusas = porMinuto.reduce((s, m) => s + m.recusas_4xx, 0)
  const pico = Math.max(0, ...porMinuto.map((m) => m.pedidos))
  return (
    `Pedidos por minuto nos últimos 60 minutos: ${plural(pedidos, 'pedido', 'pedidos')}, ` +
    `${plural(erros, 'erro do sistema', 'erros do sistema')} e ${plural(recusas, 'recusado', 'recusados')}. ` +
    `No minuto mais cheio, ${plural(pico, 'pedido', 'pedidos')}.`
  )
}

// ---------- Senha fácil de ditar ----------

// Minúsculas e números, sem os que se confundem ao ler em voz alta ou no
// papel: 0 e o, 1, l e i.
export const ALFABETO_DA_SENHA = 'abcdefghjkmnpqrstuvwxyz23456789'
export const TAMANHO_DA_SENHA = 12

export function gerarSenha(
  tamanho: number = TAMANHO_DA_SENHA,
  sortear: (quantos: number) => Uint8Array = (quantos) => crypto.getRandomValues(new Uint8Array(quantos)),
): string {
  const n = ALFABETO_DA_SENHA.length
  // Descarta os bytes do fim da faixa para todo caractere ter a mesma chance.
  const teto = 256 - (256 % n)
  let senha = ''
  while (senha.length < tamanho) {
    for (const b of sortear(tamanho * 2)) {
      if (b < teto && senha.length < tamanho) senha += ALFABETO_DA_SENHA[b % n]
    }
  }
  return senha
}

// Em blocos de quatro, só para ler e ditar: a senha não tem espaço.
export function senhaEmBlocos(senha: string): string[] {
  return senha.match(/.{1,4}/g) ?? []
}

// ---------- Parâmetros ----------

export type ChaveDeAjuste = Exclude<keyof Parametros, 'modulos'>

export interface Ajuste {
  chave: ChaveDeAjuste
  pergunta: string
  unidade: [string, string]
  min: number
  max: number
  passo: number
  efeito: string
}

export const AJUSTES: Ajuste[] = [
  {
    chave: 'raio_agrupamento_m',
    pergunta: 'A que distância dois relatos viram o mesmo chamado?',
    unidade: ['metro', 'metros'],
    min: 5,
    max: 500,
    passo: 10,
    efeito: 'Maior junta mais relatos num chamado só; menor abre mais chamados separados.',
  },
  {
    chave: 'janela_agrupamento_dias',
    pergunta: 'Por quantos dias um chamado aberto ainda junta relatos novos?',
    unidade: ['dia', 'dias'],
    min: 1,
    max: 365,
    passo: 5,
    efeito: 'Passado esse tempo, um relato no mesmo lugar abre um chamado novo.',
  },
  {
    chave: 'raio_perto_m',
    pergunta: 'Até que distância o morador vê problemas já relatados?',
    unidade: ['metro', 'metros'],
    min: 10,
    max: 500,
    passo: 10,
    efeito: 'É a lista "Perto de você" no app do morador.',
  },
  {
    chave: 'envios_por_aparelho',
    pergunta: 'Quantos relatos um mesmo celular pode mandar a cada 10 minutos?',
    unidade: ['relato', 'relatos'],
    min: 1,
    max: 200,
    passo: 1,
    efeito: 'Segura quem tenta encher o sistema de relatos repetidos.',
  },
  {
    chave: 'envios_por_ip',
    pergunta: 'Quantos relatos podem vir da mesma rede a cada 10 minutos?',
    unidade: ['relato', 'relatos'],
    min: 1,
    max: 5000,
    passo: 10,
    efeito: 'Vizinhos na mesma operadora de celular saem pela mesma rede: mantenha bem acima do limite por celular.',
  },
  {
    chave: 'retencao_dias',
    pergunta: 'Por quantos dias guardar a foto sem borrão e o vídeo?',
    unidade: ['dia', 'dias'],
    min: 0,
    max: 3650,
    passo: 30,
    efeito: '0 guarda para sempre. A versão borrada nunca é apagada.',
  },
]

// Cada módulo ligável é uma feature flag: tem dono e data para rever se
// continua, sai ou vira padrão (ADR 0018). Sem isso, as chaves se acumulam.
export const MODULOS: { chave: keyof Modulos; nome: string; frase: string; dono: string; revisarEm: string }[] = [
  { chave: 'video', nome: 'Vídeo no relato', frase: 'o morador pode gravar até 15 s, sem som', dono: 'Russo', revisarEm: 'fim do piloto' },
  {
    chave: 'perto',
    nome: 'Perto de você',
    frase: 'o morador vê os problemas já relatados por perto e confirma com um toque',
    dono: 'Russo',
    revisarEm: 'fim do piloto',
  },
  { chave: 'campo', nome: 'Equipe de campo', frase: 'tela para quem vai à rua resolver', dono: 'Russo', revisarEm: 'fim do piloto' },
  { chave: 'voz', nome: 'Falar em vez de escrever', frase: 'ditado no app do morador', dono: 'Russo', revisarEm: 'fim do piloto' },
  {
    chave: 'recuperacao',
    nome: 'Código de recuperação',
    frase: 'o morador anota um código para entrar em outro celular; desligado, o gestor libera o CPF',
    dono: 'Russo',
    revisarEm: 'quando o Face ID entrar (#40)',
  },
]

export function valorComUnidade(a: Ajuste, valor: number): string {
  const curta = a.unidade[1] === 'metros' ? 'm' : valor === 1 ? a.unidade[0] : a.unidade[1]
  return `${valor} ${curta}`
}

const entre = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max

// As mesmas frases e a mesma ordem de cidade.Conferir, no servidor.
export function errosDosParametros(p: Parametros): Partial<Record<ChaveDeAjuste, string>> {
  const e: Partial<Record<ChaveDeAjuste, string>> = {}
  if (!entre(p.raio_agrupamento_m, 5, 500)) e.raio_agrupamento_m = 'raio de agrupamento entre 5 e 500 metros'
  if (!entre(p.janela_agrupamento_dias, 1, 365)) e.janela_agrupamento_dias = 'janela de agrupamento entre 1 e 365 dias'
  if (!entre(p.raio_perto_m, 10, 500)) e.raio_perto_m = 'raio de perto de você entre 10 e 500 metros'
  if (!entre(p.envios_por_aparelho, 1, 200)) e.envios_por_aparelho = 'envios por aparelho entre 1 e 200 a cada 10 minutos'
  const pisoDaRede = Number.isInteger(p.envios_por_aparelho) ? p.envios_por_aparelho : 1
  if (!entre(p.envios_por_ip, pisoDaRede, 5000)) {
    e.envios_por_ip = 'envios por IP entre o limite por aparelho e 5000 a cada 10 minutos'
  }
  if (!entre(p.retencao_dias, 0, 3650)) e.retencao_dias = 'retenção entre 0 e 3650 dias'
  return e
}

export function conferirParametros(p: Parametros): string | null {
  const erros = errosDosParametros(p)
  for (const a of AJUSTES) {
    const msg = erros[a.chave]
    if (msg) return msg
  }
  return null
}

// Quais itens diferem entre dois conjuntos; módulo conta como item.
export function diferencas(a: Parametros, b: Parametros): string[] {
  const mudou: string[] = AJUSTES.filter((x) => a[x.chave] !== b[x.chave]).map((x) => x.chave)
  for (const m of MODULOS) {
    if (a.modulos[m.chave] !== b.modulos[m.chave]) mudou.push(`modulos.${m.chave}`)
  }
  return mudou
}

export function resumoDasMudancas(n: number): string {
  if (n === 0) return 'Nada alterado'
  return n === 1 ? '1 ajuste alterado' : `${n} ajustes alterados`
}

// ---------- Atualização sozinha, só com a aba à vista ----------

// Chama fn a cada intervalo enquanto a aba do navegador está visível. Com a
// aba oculta o relógio para; ao voltar, atualiza na hora. Devolve o desligar.
export function repetirComAbaVisivel(fn: () => void, intervaloMs: number): () => void {
  let timer: ReturnType<typeof setInterval> | undefined
  const ligar = () => {
    if (timer === undefined) timer = setInterval(fn, intervaloMs)
  }
  const desligar = () => {
    clearInterval(timer)
    timer = undefined
  }
  const aoMudar = () => {
    if (document.visibilityState === 'visible') {
      fn()
      ligar()
    } else {
      desligar()
    }
  }
  if (document.visibilityState === 'visible') ligar()
  document.addEventListener('visibilitychange', aoMudar)
  return () => {
    desligar()
    document.removeEventListener('visibilitychange', aoMudar)
  }
}

// ---------- Usuários ----------

const ORDEM_DOS_PAPEIS: Papel[] = ['prefeito', 'gestor', 'operador', 'campo']

// Ativos primeiro, por papel e nome; desligados no fim.
export function ordenarUsuarios(lista: Cadastro[]): Cadastro[] {
  const nome = (u: Cadastro) => (u.nome || u.login).toLocaleLowerCase('pt-BR')
  return [...lista].sort(
    (a, b) =>
      Number(b.ativo) - Number(a.ativo) ||
      ORDEM_DOS_PAPEIS.indexOf(a.papel) - ORDEM_DOS_PAPEIS.indexOf(b.papel) ||
      nome(a).localeCompare(nome(b), 'pt-BR'),
  )
}

const LOGIN_VALIDO = /^[a-z0-9][a-z0-9._-]{2,31}$/

// As mesmas frases do servidor (auth.CriarUsuario), para barrar antes de enviar.
export function conferirNovoUsuario(u: { login: string; senha: string; papel: Papel | ''; secretaria: string }): string | null {
  if (!LOGIN_VALIDO.test(u.login.trim())) return 'login de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado'
  if (!u.papel) return 'escolha o que a pessoa faz no sistema'
  if (u.papel === 'campo' && !u.secretaria.trim()) return 'usuário de campo precisa de uma secretaria'
  if (u.senha.length < 8) return 'gere uma senha para a pessoa'
  return null
}

// Botões de menos e de mais: anda até o próximo múltiplo do passo, sem sair
// da faixa. Valor vazio ou inválido começa do piso.
export function passoDoAjuste(valor: number, passo: number, min: number, max: number, sentido: 1 | -1): number {
  if (!Number.isFinite(valor)) return min
  const proximo = sentido > 0 ? Math.floor(valor / passo) * passo + passo : Math.ceil(valor / passo) * passo - passo
  return Math.min(max, Math.max(min, proximo))
}

// O topo da Operação sem repetir a mesma frase duas vezes: com um motivo só,
// ele vira a frase; com vários, a frase conta quantos e a lista traz cada um,
// com a marca de gravidade só quando há gravidades diferentes.
export function resumoDoVeredito(v: Veredito): { frase: string; motivos: Motivo[]; marcarGravidade: boolean } {
  if (v.motivos.length <= 1) return { frase: v.motivos[0] ? fraseDoMotivo(v.motivos[0]) : v.frase, motivos: [], marcarGravidade: false }
  const problemas = v.motivos.filter((m) => m.gravidade === 'problema').length
  const frase =
    problemas === 0 ? `${v.motivos.length} pontos pedem atenção.`
    : problemas === v.motivos.length ? `${v.motivos.length} problemas agora.`
    : `${plural(problemas, 'problema', 'problemas')} e ${plural(v.motivos.length - problemas, 'ponto de atenção', 'pontos de atenção')}.`
  return { frase, motivos: v.motivos, marcarGravidade: problemas > 0 && problemas < v.motivos.length }
}

// O detalhe que o celular manda vem como código ("sem_conexao"); aqui vira
// palavra. Código desconhecido perde os sublinhados.
const DETALHE_DO_SINAL: Record<string, string> = {
  sem_conexao: 'sem conexão',
  sem_rede: 'sem rede',
  sem_sinal: 'sem sinal',
  tempo_esgotado: 'demorou demais',
  foto_grande: 'foto grande demais',
  fotos_demais: 'fotos demais',
  foto_formato: 'formato de foto não aceito',
  foto_ausente: 'sem foto',
  video_grande: 'vídeo grande demais',
  video_longo: 'vídeo longo demais',
  video_formato: 'formato de vídeo não aceito',
  video_com_audio: 'vídeo com som',
  muitos_envios: 'envios demais seguidos',
  fora_da_cidade: 'fora da cidade',
  local_invalido: 'local inválido',
  longe_demais: 'longe demais',
  sem_camera: 'sem câmera',
  sem_suporte: 'navegador sem suporte',
  midia_indisponivel: 'foto ou vídeo indisponível',
}

export function detalheDoSinal(detalhe: string): string {
  const d = detalhe.trim()
  return DETALHE_DO_SINAL[d] ?? d.replaceAll('_', ' ')
}
