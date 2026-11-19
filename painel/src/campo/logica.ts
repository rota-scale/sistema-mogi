import { NIVEIS, NOME_CATEGORIA, SIMBOLO_CATEGORIA } from '../niveis'
import type { Evento, EventoAoVivo, Midia, Ocorrencia, Status } from '../tipos'

export interface Ponto {
  lat: number
  lng: number
}

const RAIO_DA_TERRA_M = 6371000

// Distância em metros pela fórmula de haversine.
export function distanciaM(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * RAIO_DA_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// "a 350 m", "a 2,1 km", "a 12 km". Abaixo de 1 km arredonda de 10 em 10 m:
// o GPS do celular não acerta mais que isso.
export function formatarDistancia(metros: number): string {
  if (!Number.isFinite(metros) || metros < 0) return ''
  const dezenas = Math.max(10, Math.round(metros / 10) * 10)
  if (dezenas < 1000) return `a ${dezenas} m`
  const km = metros / 1000
  if (km < 9.95) return `a ${km.toFixed(1).replace('.', ',')} km`
  return `a ${Math.round(km)} km`
}

export function distanciaAte(o: Ponto, aqui: Ponto | null): string | null {
  return aqui ? formatarDistancia(distanciaM(aqui, o)) : null
}

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

export interface Prazo {
  texto: string
  atrasado: boolean
}

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

// Prazo do jeito que a equipe fala: "até hoje às 18h", "atrasado há 2 h".
export function prazoEmPalavras(prazoAte: string | null, agora: Date): Prazo {
  if (!prazoAte) return { texto: 'sem prazo', atrasado: false }
  const prazo = new Date(prazoAte)
  if (Number.isNaN(prazo.getTime())) return { texto: 'sem prazo', atrasado: false }
  const falta = prazo.getTime() - agora.getTime()
  if (falta < 0) {
    const passou = -falta
    if (passou < HORA) return { texto: `atrasado há ${Math.max(1, Math.floor(passou / MINUTO))} min`, atrasado: true }
    if (passou < DIA) return { texto: `atrasado há ${Math.floor(passou / HORA)} h`, atrasado: true }
    const dias = Math.floor(passou / DIA)
    return { texto: `atrasado há ${dias} ${dias === 1 ? 'dia' : 'dias'}`, atrasado: true }
  }
  const dias = Math.round((inicioDoDia(prazo) - inicioDoDia(agora)) / DIA)
  if (dias === 0) return { texto: `até hoje às ${horaFalada(prazo)}`, atrasado: false }
  if (dias === 1) return { texto: `até amanhã às ${horaFalada(prazo)}`, atrasado: false }
  return { texto: `até ${diaEMes(prazo)}`, atrasado: false }
}

function tempo(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

// Mesma ordem do servidor: nível maior primeiro. No empate, o prazo que vence
// antes e depois o chamado mais antigo.
function porUrgencia(a: Ocorrencia, b: Ocorrencia): number {
  const na = a.nivel ?? 0
  const nb = b.nivel ?? 0
  if (na !== nb) return nb - na
  const pa = tempo(a.prazo_ate)
  const pb = tempo(b.prazo_ate)
  if (pa !== pb) return pa < pb ? -1 : 1
  return a.criado_em.localeCompare(b.criado_em)
}

export function ordenarPorUrgencia(lista: Ocorrencia[]): Ocorrencia[] {
  return [...lista].sort(porUrgencia)
}

// O mais perto primeiro; no empate (mesmo quarteirão), o mais urgente.
export function ordenarPorDistancia(lista: Ocorrencia[], aqui: Ponto): Ocorrencia[] {
  return lista
    .map((o) => ({ o, d: Math.round(distanciaM(aqui, o) / 10) }))
    .sort((a, b) => a.d - b.d || porUrgencia(a.o, b.o))
    .map((x) => x.o)
}

export type Ordem = 'urgencia' | 'perto'

export function ordenar(lista: Ocorrencia[], ordem: Ordem, aqui: Ponto | null): Ocorrencia[] {
  return ordem === 'perto' && aqui ? ordenarPorDistancia(lista, aqui) : ordenarPorUrgencia(lista)
}

export function nomeDaCategoria(categoria: string): string {
  return NOME_CATEGORIA[categoria] ?? NOME_CATEGORIA.outros
}

export function simboloDaCategoria(categoria: string): string {
  return SIMBOLO_CATEGORIA[categoria] ?? SIMBOLO_CATEGORIA.outros
}

// Urgência em palavras, com os mesmos nomes do painel da central. Chamado sem
// nível não deveria chegar à equipe; se chegar, a tela não inventa um.
export function urgenciaEmPalavras(nivel: number | null): string {
  return NIVEIS.find((n) => n.nivel === nivel)?.nome ?? 'Sem urgência definida'
}

// Onde é: endereço, senão o bairro. Sem nenhum dos dois, a rota resolve.
export function ondeFica(o: Pick<Ocorrencia, 'endereco' | 'bairro'>): string {
  return o.endereco?.trim() || o.bairro?.trim() || 'Ver no mapa'
}

export function quantasPessoas(relatos: number): string | null {
  return relatos > 1 ? `${relatos} pessoas relataram` : null
}

const SERVICO_FEITO = 'Serviço feito'

const RESPOSTAS: Record<string, string[]> = {
  vias: ['Buraco tapado', 'Sinalizado, volta depois', 'Via liberada'],
  calcadas: ['Calçada consertada', 'Sinalizado, volta depois', 'Entulho removido'],
  iluminacao: ['Lâmpada trocada', 'Fiação refeita', 'Poste religado'],
  limpeza: ['Lixo recolhido', 'Entulho removido', 'Mato cortado'],
  agua: ['Vazamento consertado', 'Bueiro desentupido', 'Tampa recolocada'],
  arvores: ['Árvore podada', 'Galhos recolhidos', 'Árvore removida'],
  sinalizacao: ['Placa recolocada', 'Semáforo consertado', 'Faixa repintada'],
  animais: ['Animal recolhido', 'Animal não estava mais lá'],
}

// Respostas prontas de "o que foi feito": um toque em vez de digitar de luva.
export function respostasRapidas(categoria: string): string[] {
  return [...(RESPOSTAS[categoria] ?? []), SERVICO_FEITO]
}

export const MOTIVOS_NAO_ENCONTREI = ['Já estava consertado', 'Não achei o endereço', 'O problema é outro']

export type AppDeRota = 'waze' | 'google'

export const NOME_DO_APP: Record<AppDeRota, string> = { waze: 'Waze', google: 'Google Maps' }

export function linksDeRota(p: Ponto): Record<AppDeRota, string> {
  const destino = `${p.lat},${p.lng}`
  return {
    waze: `https://waze.com/ul?ll=${destino}&navigate=yes`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`,
  }
}

export function lerAppDeRota(v: unknown): AppDeRota | null {
  return v === 'waze' || v === 'google' ? v : null
}

function mesmoDia(a: Date, b: Date): boolean {
  return inicioDoDia(a) === inicioDoDia(b)
}

// Resolvidos no dia de hoje (no relógio do aparelho), o mais recente primeiro.
export function feitosHoje(lista: Ocorrencia[], agora: Date): Ocorrencia[] {
  return lista
    .filter((o) => {
      if (o.status !== 'resolvida' || !o.resolvido_em) return false
      const quando = new Date(o.resolvido_em)
      return !Number.isNaN(quando.getTime()) && mesmoDia(quando, agora)
    })
    .sort((a, b) => tempo(b.resolvido_em) - tempo(a.resolvido_em))
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function ultimoEvento(eventos: Evento[] | undefined, tipo: string): Evento | null {
  const doTipo = (eventos ?? []).filter((e) => e.tipo === tipo)
  if (doTipo.length === 0) return null
  return doTipo.reduce((a, b) => (new Date(b.criado_em).getTime() >= new Date(a.criado_em).getTime() ? b : a))
}

// Recado da central: a observação do despacho mais recente. Chamado reaberto
// e despachado de novo vale o recado novo, mesmo vazio.
export function recadoDaCentral(eventos: Evento[] | undefined): string | null {
  return texto(ultimoEvento(eventos, 'despachada')?.dados?.observacao)
}

// O que a equipe escreveu ao concluir.
export function oQueFoiFeito(eventos: Evento[] | undefined): string | null {
  return texto(ultimoEvento(eventos, 'resolvida')?.dados?.motivo)
}

export interface Fotos {
  // Fotos do morador (e quadros do vídeo), já borradas.
  antes: string[]
  // Fotos do serviço pronto, tiradas pela equipe.
  depois: string[]
  temVideo: boolean
}

export function fotosDoChamado(o: Pick<Ocorrencia, 'midias' | 'midia_url'>): Fotos {
  const midias: Midia[] = [...(o.midias ?? [])].sort((a, b) => a.ordem - b.ordem)
  const urls = (tipos: Midia['tipo'][]) => midias.filter((m) => tipos.includes(m.tipo) && m.url).map((m) => m.url as string)
  const antes = urls(['foto', 'quadro'])
  if (antes.length === 0 && o.midia_url) antes.push(o.midia_url)
  return { antes, depois: urls(['depois']), temVideo: midias.some((m) => m.tipo === 'video') }
}

// Aplica um evento do tempo real sobre uma lista que guarda só os chamados de
// um status: o que está nesse status entra ou é atualizado, o resto sai.
// Devolve a mesma lista quando nada muda, para a tela não redesenhar à toa.
export function aplicarEvento(lista: Ocorrencia[], e: EventoAoVivo, status: Status = 'em_atendimento'): Ocorrencia[] {
  const o = e.ocorrencia
  if (!o || (e.tipo !== 'OcorrenciaCriada' && e.tipo !== 'OcorrenciaAtualizada')) return lista
  const i = lista.findIndex((x) => x.id === o.id)
  if (o.status !== status) return i < 0 ? lista : lista.filter((x) => x.id !== o.id)
  if (i < 0) return [...lista, o]
  // O evento nem sempre traz o link da foto; o que a lista já tinha continua valendo.
  const novo = { ...o, midia_url: o.midia_url ?? lista[i].midia_url }
  return lista.map((x, j) => (j === i ? novo : x))
}

// Junta o item da lista (mais fresco, vem do tempo real) com o detalhe (que
// tem fotos, eventos e links recém-assinados).
export function juntar(resumo: Ocorrencia | null, detalhe: Ocorrencia | null): Ocorrencia | null {
  if (!resumo) return detalhe
  if (!detalhe || detalhe.id !== resumo.id) return resumo
  const maisNovo = new Date(resumo.atualizado_em).getTime() >= new Date(detalhe.atualizado_em).getTime() ? resumo : detalhe
  return {
    ...detalhe,
    ...maisNovo,
    midia_url: detalhe.midia_url ?? resumo.midia_url,
    midias: detalhe.midias,
    relatos_lista: detalhe.relatos_lista,
    eventos: detalhe.eventos,
  }
}

export const LIMITE_DE_FOTOS = 3
export const LIMITE_DO_MOTIVO = 300

export type CodigoDeFalha =
  | 'sem_rede'
  | 'sessao'
  | 'ja_resolvido'
  | 'nao_e_da_equipe'
  | 'foto_formato'
  | 'foto_grande'
  | 'fotos_demais'
  | 'muitos_envios'
  | 'servidor'

// Traduz a resposta de erro do servidor para o que a tela sabe tratar.
export function codigoDaFalha(status: number, codigo?: string): CodigoDeFalha {
  if (status === 0) return 'sem_rede'
  if (status === 401) return 'sessao'
  if (status === 404) return 'nao_e_da_equipe'
  if (status === 409) return 'ja_resolvido'
  if (status === 429) return 'muitos_envios'
  if (codigo === 'foto_formato' || codigo === 'foto_grande' || codigo === 'fotos_demais') return codigo
  if (status === 413) return 'foto_grande'
  return 'servidor'
}

export const SESSAO_EXPIROU = 'Sua sessão expirou. Entre de novo.'

// Toda mensagem de falha diz o que fazer (ADR 0017, sem beco sem saída).
export function mensagemDaFalha(codigo: CodigoDeFalha, comFotos = false): string {
  switch (codigo) {
    case 'sem_rede':
      return comFotos
        ? 'Sem internet. Suas fotos continuam aqui: toque em Tentar de novo.'
        : 'Sem internet. Confira a conexão e toque em Tentar de novo.'
    case 'sessao':
      return SESSAO_EXPIROU
    case 'ja_resolvido':
      return 'Este chamado já foi concluído por outra pessoa.'
    case 'nao_e_da_equipe':
      return 'Este chamado não está mais com a sua equipe.'
    case 'foto_formato':
      return 'Uma das fotos não pôde ser lida. Tire a foto de novo pela câmera.'
    case 'foto_grande':
      return 'Uma das fotos ficou grande demais. Tire a foto de novo.'
    case 'fotos_demais':
      return 'São no máximo 3 fotos. Remova uma e tente de novo.'
    case 'muitos_envios':
      return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
    default:
      return 'Não deu certo agora. Espere um pouco e toque em Tentar de novo.'
  }
}

// Rótulo do botão final do passo de concluir.
export function rotuloDeConcluir(fotos: number, falhou: boolean): string {
  if (falhou) return 'Tentar de novo'
  return fotos > 0 ? 'Concluir chamado' : 'Concluir sem foto'
}

export function rotuloDeFotos(n: number): string {
  if (n === 0) return 'Tirar foto'
  if (n >= LIMITE_DE_FOTOS) return 'Já tem 3 fotos'
  return 'Tirar outra foto'
}

export function contagemParaAtender(n: number): string {
  return n === 0 ? 'Nada para atender' : `${n} para atender`
}

// Toque numa resposta rápida: troca o texto se ele está vazio ou é outra
// resposta pronta; se a pessoa já escreveu algo dela, acrescenta no fim.
export function comResposta(textoAtual: string, resposta: string, prontas: string[] = []): string {
  const atual = textoAtual.trim()
  if (!atual || prontas.includes(atual)) return resposta
  if (atual.toLowerCase().includes(resposta.toLowerCase())) return atual
  return `${atual.replace(/[.;,]+$/, '')}. ${resposta}`.slice(0, LIMITE_DO_MOTIVO)
}

// Espera até a próxima tentativa de reconexão, com variação de até 30% para
// os aparelhos não voltarem todos no mesmo instante.
export function esperaDeReconexao(tentativa: number, sorteio: number = Math.random()): number {
  const base = Math.min(1000 * 2 ** Math.max(0, tentativa), 30_000)
  return Math.round(base * (0.7 + 0.6 * sorteio))
}

export type Passo = 'concluir' | 'nao-encontrei'

// Onde a pessoa está, guardado no histórico do navegador para o voltar do
// aparelho funcionar. "n" conta quantos passos há até a lista.
export interface Rota {
  chamado?: string
  passo?: Passo
  foto?: number
  n: number
}

export const NA_LISTA: Rota = { n: 0 }

export function lerRota(estado: unknown): Rota {
  if (!estado || typeof estado !== 'object') return NA_LISTA
  const e = estado as Record<string, unknown>
  if (typeof e.chamado !== 'string' || !e.chamado) return NA_LISTA
  const n = typeof e.n === 'number' && Number.isInteger(e.n) && e.n > 0 ? e.n : 1
  const rota: Rota = { chamado: e.chamado, n }
  if (e.passo === 'concluir' || e.passo === 'nao-encontrei') rota.passo = e.passo
  if (typeof e.foto === 'number' && Number.isInteger(e.foto) && e.foto >= 0) rota.foto = e.foto
  return rota
}

// Um passo para trás: a foto fecha, o passo volta ao chamado, o chamado volta à lista.
export function rotaAcima(r: Rota): Rota {
  const n = Math.max(1, r.n - 1)
  if (r.foto != null) return r.passo ? { chamado: r.chamado, passo: r.passo, n } : { chamado: r.chamado, n }
  if (r.passo) return { chamado: r.chamado, n }
  return NA_LISTA
}

// Só atualiza a posição quando a pessoa andou de verdade: o GPS parado oscila
// alguns metros e redesenharia a lista sem parar.
export function mudouDeLugar(antes: Ponto | null, agora: Ponto, minimoM = 15): boolean {
  return !antes || distanciaM(antes, agora) >= minimoM
}
