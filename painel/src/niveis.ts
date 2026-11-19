import type { Evento, Ocorrencia, Status } from './tipos'

// Escala da Triagem Urbana (docs/escala-de-prioridade.md) nas cores do brand
// kit. Cor sempre acompanhada do nome. "claro" diz se o texto sobre a cor deve
// ser escuro.
export const NIVEIS = [
  { nivel: 1, nome: 'Não urgente', cor: '#3B6EA5', claro: false },
  { nivel: 2, nome: 'Padrão', cor: '#3E7B3A', claro: false },
  { nivel: 3, nome: 'Urgente', cor: '#E9B526', claro: true },
  { nivel: 4, nome: 'Muito urgente', cor: '#D9822B', claro: true },
  { nivel: 5, nome: 'Crítico', cor: '#B3261E', claro: false },
] as const

// Cinza quente com contraste de 5,3:1 para o texto branco do selo.
export const COR_SEM_NIVEL = '#716B60'

export function corDoNivel(nivel: number | null): string {
  return NIVEIS.find((n) => n.nivel === nivel)?.cor ?? COR_SEM_NIVEL
}

// Contraste WCAG entre duas cores em hexadecimal (#RRGGBB): 1 a 21.
export function contraste(a: string, b: string): number {
  const luz = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

export function textoSobreNivel(nivel: number | null): string {
  return NIVEIS.find((n) => n.nivel === nivel)?.claro ? '#2B1A10' : '#FFFFFF'
}

export function nomeDoNivel(nivel: number | null): string {
  return NIVEIS.find((n) => n.nivel === nivel)?.nome ?? 'Sem avaliação'
}

// Situação do chamado na língua de quem opera. Os rótulos são distintos
// porque os indicadores mostram os cinco lado a lado.
export const NOME_STATUS: Record<Status, string> = {
  a_classificar: 'Para conferir (sem avaliação)',
  revisao: 'Para conferir',
  aberta: 'Aguardando equipe',
  em_atendimento: 'Equipe a caminho',
  resolvida: 'Resolvido',
}

// Nome da situação para a fila e o detalhe: quem opera não distingue
// "a classificar" de "revisão", os dois são chamados para conferir.
export function nomeDoStatus(status: Status): string {
  return status === 'a_classificar' ? NOME_STATUS.revisao : (NOME_STATUS[status] ?? 'Em andamento')
}

export const NOME_CATEGORIA: Record<string, string> = {
  agua: 'Água e esgoto',
  iluminacao: 'Iluminação',
  limpeza: 'Limpeza urbana',
  vias: 'Vias e buracos',
  arvores: 'Árvores',
  sinalizacao: 'Sinalização',
  calcadas: 'Calçadas e praças',
  animais: 'Animais',
  outros: 'Outros',
}

// Símbolo de cada categoria dentro do pin do mapa.
export const SIMBOLO_CATEGORIA: Record<string, string> = {
  agua: '💧',
  iluminacao: '💡',
  limpeza: '🗑️',
  vias: '🚧',
  arvores: '🌳',
  sinalizacao: '🚦',
  calcadas: '🚶',
  animais: '🐾',
  outros: '❗',
}

export const NOME_SINAL: Record<string, string> = {
  agua_jorrando: 'Água jorrando',
  alagamento: 'Alagamento',
  perto_de_escola: 'Perto de escola ou creche',
  fio_exposto: 'Fio exposto',
  bloqueio_calcada: 'Calçada bloqueada',
  risco_moto: 'Risco para moto',
  via_bloqueada: 'Via bloqueada',
  sobre_fios: 'Sobre fios',
  cruzamento_movimentado: 'Cruzamento movimentado',
  acessibilidade: 'Acessibilidade',
}

export const NOME_ETAPA: Record<string, string> = {
  borrao: 'Borrão de rostos e placas',
  armazenamento: 'Gravação da mídia',
  geocodigo: 'Endereço pelo GPS',
  visao: 'Visão sobre a foto',
  classificacao: 'Classificação G, U e T',
  regra_lua: 'Regra da prefeitura (Lua)',
  contexto: 'Contexto: base da prefeitura e histórico',
}

// Nome de cada função que a IA pode chamar na triagem (ADR 0023).
export const NOME_FERRAMENTA: Record<string, string> = {
  chamados_abertos_perto: 'Chamados abertos perto',
  buscar_casos_parecidos: 'Casos parecidos no histórico',
  consultar_orientacao: 'Orientação da prefeitura',
}

// Resumo de uma linha do que a IA consultou: "2 orientações · 3 casos
// parecidos · 1 consulta da IA". Vazio quando não houve contexto.
export function resumoDoContexto(c: { orientacoes?: unknown[]; casos?: unknown[]; ferramentas?: unknown[] } | undefined): string {
  if (!c) return ''
  const partes: string[] = []
  const n = (l: unknown[] | undefined) => l?.length ?? 0
  const plural = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`
  if (n(c.orientacoes)) partes.push(plural(n(c.orientacoes), 'orientação', 'orientações'))
  if (n(c.casos)) partes.push(plural(n(c.casos), 'caso parecido', 'casos parecidos'))
  if (n(c.ferramentas)) partes.push(plural(n(c.ferramentas), 'consulta da IA', 'consultas da IA'))
  return partes.join(' · ')
}

export function precisaRevisao(o: Ocorrencia): boolean {
  return o.status === 'revisao' || o.status === 'a_classificar'
}

export type Aba = 'revisao' | 'abertas' | 'atendimento' | 'resolvidas'

export const ABAS: { id: Aba; nome: string }[] = [
  { id: 'revisao', nome: 'Para conferir' },
  { id: 'abertas', nome: 'Aguardando equipe' },
  { id: 'atendimento', nome: 'Equipe a caminho' },
  { id: 'resolvidas', nome: 'Resolvidos' },
]

export function naAba(o: Ocorrencia, aba: Aba): boolean {
  switch (aba) {
    case 'revisao':
      return precisaRevisao(o)
    case 'abertas':
      return o.status === 'aberta'
    case 'atendimento':
      return o.status === 'em_atendimento'
    default:
      return o.status === 'resolvida'
  }
}

// Fila: a classificar primeiro, depois nível e GUT esperada (ADR 0010).
function porPrioridade(a: Ocorrencia, b: Ocorrencia): number {
  const na = a.nivel ?? 6
  const nb = b.nivel ?? 6
  if (na !== nb) return nb - na
  const ga = a.triagem?.gut_esperada ?? 0
  const gb = b.triagem?.gut_esperada ?? 0
  if (ga !== gb) return gb - ga
  return a.criado_em.localeCompare(b.criado_em)
}

export type Ordem = 'urgencia' | 'prazo'

// Prazo mais perto primeiro: o vencido há mais tempo no topo, sem prazo no fim.
function porPrazo(a: Ocorrencia, b: Ocorrencia): number {
  const pa = a.prazo_ate ? Date.parse(a.prazo_ate) : Infinity
  const pb = b.prazo_ate ? Date.parse(b.prazo_ate) : Infinity
  if (pa !== pb) return pa < pb ? -1 : 1
  return porPrioridade(a, b)
}

export function ordenarFila(lista: Ocorrencia[], aba: Aba = 'revisao', ordem: Ordem = 'urgencia'): Ocorrencia[] {
  const l = lista.filter((o) => naAba(o, aba))
  if (aba === 'resolvidas') {
    return l.sort((a, b) => (b.resolvido_em ?? '').localeCompare(a.resolvido_em ?? ''))
  }
  return l.sort(ordem === 'prazo' ? porPrazo : porPrioridade)
}

export function contarPorAba(lista: Ocorrencia[]): Record<Aba, number> {
  const n: Record<Aba, number> = { revisao: 0, abertas: 0, atendimento: 0, resolvidas: 0 }
  for (const o of lista) {
    const aba = ABAS.find((a) => naAba(o, a.id))
    if (aba) n[aba.id]++
  }
  return n
}

// O servidor corta os zeros do fim dos microssegundos ("08.7Z" e "08.715Z"),
// então comparar o texto erra; compara-se o segundo e depois a fração.
function instante(iso: string): [number, number] {
  const fracao = /\.(\d+)/.exec(iso)?.[1] ?? ''
  return [Math.floor(Date.parse(iso) / 1000), Number((fracao + '000000000').slice(0, 9))]
}

// Verdadeiro quando "a" é mais novo que "b".
export function maisNovo(a: string, b: string): boolean {
  const [sa, fa] = instante(a)
  const [sb, fb] = instante(b)
  return sa !== sb ? sa > sb : fa > fb
}

const maisRecentePrimeiro = (a: Ocorrencia, b: Ocorrencia) => b.criado_em.localeCompare(a.criado_em)

// Mescla um evento ao vivo na lista local, mais recente primeiro. Uma versão
// mais velha que a que já está na lista é ignorada.
export function mesclar(lista: Ocorrencia[], o: Ocorrencia): Ocorrencia[] {
  const atual = lista.find((x) => x.id === o.id)
  if (atual && maisNovo(atual.atualizado_em, o.atualizado_em)) return lista
  const sem = lista.filter((x) => x.id !== o.id)
  return [o, ...sem].sort(maisRecentePrimeiro)
}

// Junta a resposta de uma recarga com a lista local. Em cada chamado vence a
// versão mais nova por atualizado_em, para a recarga não apagar o que chegou
// ao vivo enquanto ela viajava. Quem só existe na lista local fica se chegou
// durante a recarga ("chegaram"); o resto saiu do servidor.
export function mesclarRecarga(local: Ocorrencia[], recebida: Ocorrencia[], chegaram: ReadonlySet<string> = new Set()): Ocorrencia[] {
  const daqui = new Map(local.map((o) => [o.id, o]))
  const vistos = new Set<string>()
  const junta = recebida.map((r) => {
    vistos.add(r.id)
    const l = daqui.get(r.id)
    return l && maisNovo(l.atualizado_em, r.atualizado_em) ? l : r
  })
  for (const l of local) {
    if (!vistos.has(l.id) && chegaram.has(l.id)) junta.push(l)
  }
  return junta.sort(maisRecentePrimeiro)
}

// Junta o resumo da lista com o detalhe. O resumo é o mais fresco (tempo
// real), mas as URLs de mídia do detalhe acabaram de ser assinadas e as da
// lista podem ter vencido.
export function juntarDetalhe(resumo: Ocorrencia, completo: Ocorrencia | null): Ocorrencia {
  if (!completo || completo.id !== resumo.id) return resumo
  return {
    ...completo,
    ...resumo,
    midia_url: completo.midia_url ?? resumo.midia_url,
    midias: completo.midias,
    relatos_lista: completo.relatos_lista,
    etapas: completo.etapas,
    eventos: completo.eventos,
  }
}

// Texto lido pelo leitor de tela no filtro de urgência da legenda. Nível 0 é
// o chamado que a triagem não conseguiu avaliar.
export function rotuloDoFiltro(nivel: number, abertos: number): string {
  return `${nomeDoNivel(nivel || null)}: ${abertos} ${abertos === 1 ? 'chamado' : 'chamados'} em aberto`
}

export function contarAbertosPorNivel(lista: Ocorrencia[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const o of lista) {
    if (o.status !== 'resolvida') m.set(o.nivel ?? 0, (m.get(o.nivel ?? 0) ?? 0) + 1)
  }
  return m
}

export const NOME_EVENTO: Record<string, string> = {
  criada: 'Chamado criado',
  relato: 'Novo relato do mesmo problema',
  tambem_vi: 'Mais uma pessoa confirmou',
  revisada: 'Urgência conferida',
  despachada: 'Equipe enviada',
  nao_encontrada: 'A equipe não encontrou o problema',
  resolvida: 'Resolvido',
  reaberta: 'Reaberto',
  video_visto: 'Vídeo aberto',
  documento_visto: 'Documento aberto',
  cadastro_apagado: 'Cadastro liberado pelo gestor',
}

const textoDe = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// Evento que o painel ainda não conhece ganha um nome neutro: o nome do banco
// não diz nada a quem opera.
export function rotuloDoEvento(e: Evento): string {
  const nome = NOME_EVENTO[e.tipo] ?? 'Atualização do chamado'
  if (e.tipo === 'revisada' && typeof e.dados?.nivel === 'number') return `${nome}: ${nomeDoNivel(e.dados.nivel)}`
  const secretaria = e.tipo === 'despachada' ? textoDe(e.dados?.secretaria) : null
  return secretaria ? `${nome}: ${secretaria}` : nome
}

// Recado do despacho, motivo da resolução, da reabertura ou do "não
// encontrei" e, na conferência, a urgência que a triagem tinha sugerido
// quando o servidor mudou.
export function notaDoEvento(e: Evento, nivelIa: number | null): string | null {
  switch (e.tipo) {
    case 'revisada': {
      const nivel = e.dados?.nivel
      return typeof nivel === 'number' && nivelIa != null && nivel !== nivelIa ? `a triagem tinha sugerido ${nomeDoNivel(nivelIa)}` : null
    }
    case 'despachada':
      return textoDe(e.dados?.observacao)
    case 'resolvida':
    case 'reaberta':
    case 'nao_encontrada':
      return textoDe(e.dados?.motivo)
    default:
      return null
  }
}

// O que a equipe escreveu ao resolver pela última vez.
export function oQueFoiFeito(eventos: Evento[] | undefined): string | null {
  const e = eventos?.findLast((x) => x.tipo === 'resolvida')
  return e ? textoDe(e.dados?.motivo) : null
}

export function contarPorBairro(lista: Ocorrencia[]): [string, number][] {
  const m = new Map<string, number>()
  for (const o of lista) {
    if (o.status === 'resolvida') continue
    const b = o.bairro ?? 'Sem bairro'
    m.set(b, (m.get(b) ?? 0) + 1)
  }
  // "Sem bairro" não é lugar: vai para o fim, para o bairro de verdade aparecer.
  const sem = (b: string) => (b === 'Sem bairro' ? 1 : 0)
  return [...m.entries()].sort((a, b) => sem(a[0]) - sem(b[0]) || b[1] - a[1])
}

// Situação do prazo de um chamado ainda não resolvido.
export function situacaoDoPrazo(o: Ocorrencia, agora: Date): 'sem' | 'no_prazo' | 'perto' | 'vencido' {
  if (!o.prazo_ate || o.status === 'resolvida') return 'sem'
  const falta = new Date(o.prazo_ate).getTime() - agora.getTime()
  if (falta < 0) return 'vencido'
  const total = new Date(o.prazo_ate).getTime() - new Date(o.criado_em).getTime()
  return falta < total * 0.25 ? 'perto' : 'no_prazo'
}

export function duracao(minutos: number | null): string {
  if (minutos == null) return 'sem dados'
  if (minutos < 60) return `${Math.round(minutos)} min`
  if (minutos < 48 * 60) return `${(minutos / 60).toFixed(1).replace('.', ',')} h`
  return `${(minutos / 1440).toFixed(1).replace('.', ',')} dias`
}

export function reais(v: number | null): string {
  if (v == null) return 'sem dados'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v < 1 ? 4 : 2 })
}

export function hora(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// "18h" ou "18h30", como se fala.
export function horaFalada(d: Date): string {
  const m = d.getMinutes()
  return m === 0 ? `${d.getHours()}h` : `${d.getHours()}h${String(m).padStart(2, '0')}`
}

function diaEMes(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface PrazoEmPalavras {
  // Para a fila: "até hoje às 18h", "atrasado há 2 h", "sem prazo".
  curto: string
  // Para o detalhe: "resolver até hoje às 18h", "sem prazo: entra na rotina da equipe".
  longo: string
  atrasado: boolean
}

const SEM_PRAZO: PrazoEmPalavras = { curto: 'sem prazo', longo: 'sem prazo: entra na rotina da equipe', atrasado: false }

// Prazo do jeito que se fala, na hora local de quem está olhando.
export function prazoEmPalavras(prazoAte: string | null, agora: Date): PrazoEmPalavras {
  if (!prazoAte) return SEM_PRAZO
  const prazo = new Date(prazoAte)
  if (Number.isNaN(prazo.getTime())) return SEM_PRAZO
  const falta = prazo.getTime() - agora.getTime()
  if (falta < 0) {
    const passou = -falta
    const dias = Math.floor(passou / DIA)
    const texto =
      passou < HORA ? `atrasado há ${Math.max(1, Math.floor(passou / MINUTO))} min`
      : passou < DIA ? `atrasado há ${Math.floor(passou / HORA)} h`
      : `atrasado há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
    return { curto: texto, longo: texto, atrasado: true }
  }
  const dias = Math.round((inicioDoDia(prazo) - inicioDoDia(agora)) / DIA)
  const curto =
    dias === 0 ? `até hoje às ${horaFalada(prazo)}`
    : dias === 1 ? `até amanhã às ${horaFalada(prazo)}`
    : `até ${diaEMes(prazo)}`
  return { curto, longo: `resolver ${curto}`, atrasado: false }
}

// "hoje às 14h32", "ontem às 9h", "14/11 às 9h".
export function quandoEmPalavras(iso: string | null, agora: Date): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(d)) / DIA)
  const dia = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : diaEMes(d)
  return `${dia} às ${horaFalada(d)}`
}

// Sinal de risco entra na frase quando a triagem tem pelo menos esta certeza.
const SINAL_CERTO = 0.7
// Abaixo disto a triagem manda conferir (LimiarConfianca e limiarNao do backend).
const CONFIANCA_MINIMA = 0.6
const PROBLEMA_MINIMO = 0.3
const SINAIS_NA_FRASE = 3

// Verdadeiro quando o chamado está para conferir porque a triagem não teve
// certeza, e não só por ser de urgência alta.
export function triagemEmDuvida(o: Ocorrencia): boolean {
  if (!precisaRevisao(o) || o.revisado_por) return false
  const c = o.triagem?.classificacao
  if (!c) return false
  return c.confianca < CONFIANCA_MINIMA || o.triagem?.descricao?.foto_util === false || (c.problema_urbano ?? 1) < PROBLEMA_MINIMO
}

// A equipe foi ao local, não achou o problema e ninguém conferiu depois.
export function equipeNaoEncontrou(o: Ocorrencia): boolean {
  if (!precisaRevisao(o)) return false
  const ultimo = o.eventos?.findLast((e) => e.tipo === 'nao_encontrada' || e.tipo === 'revisada')
  return ultimo?.tipo === 'nao_encontrada'
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

// "Por que essa urgência", em uma frase e sem número: os sinais de risco que a
// triagem achou, quantas pessoas relataram e se é perto de escola.
export function porQueEssaUrgencia(o: Ocorrencia): string {
  if (equipeNaoEncontrou(o)) return 'A equipe não encontrou o problema no local: confira antes de mandar de novo.'
  if (o.status === 'a_classificar' || (o.nivel == null && precisaRevisao(o))) return 'A triagem não conseguiu avaliar: veja a foto e escolha a urgência.'
  if (triagemEmDuvida(o)) return 'A triagem ficou em dúvida: confira a foto.'
  const certos = Object.entries(o.triagem?.classificacao?.sinais ?? {})
    .filter(([, p]) => p >= SINAL_CERTO)
    .sort((a, b) => b[1] - a[1])
  const partes = certos
    .filter(([nome]) => nome !== 'perto_de_escola')
    .slice(0, SINAIS_NA_FRASE)
    .map(([nome]) => (NOME_SINAL[nome] ?? nome.replaceAll('_', ' ')).toLowerCase())
  if (o.relatos > 1) partes.push(`${o.relatos} pessoas relataram`)
  if (certos.some(([nome]) => nome === 'perto_de_escola')) partes.push('perto de escola')
  if (o.revisado_por) partes.push(`urgência conferida por ${o.revisado_por}`)
  return partes.length > 0 ? maiuscula(partes.join(' · ')) : 'Avaliado pelo tipo do problema.'
}

// Pergunta da conferência, conforme o que trouxe o chamado para cá.
export function perguntaDaConferencia(o: Ocorrencia): string {
  if (o.nivel == null) return 'A triagem não conseguiu avaliar. Qual a urgência?'
  const nome = nomeDoNivel(o.nivel)
  if (equipeNaoEncontrou(o)) return `A equipe não encontrou o problema. A urgência continua ${nome}?`
  if (o.revisado_por) return `A urgência está como ${nome}. Está certo?`
  return `A triagem sugere: ${nome}. Está certo?`
}
