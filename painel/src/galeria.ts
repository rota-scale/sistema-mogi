import type { Midia, Ocorrencia } from './tipos'

// Item da galeria do chamado. O quadro do vídeo não vira item: é a capa dele.
export interface ItemGaleria {
  // Id da mídia; no vídeo é o que vai para a rota de abertura.
  id: string
  tipo: 'foto' | 'video' | 'depois'
  // Imagem da foto ou capa do vídeo. Ausente: bloco neutro.
  url?: string
  duracao: string | null
  // Vídeo: false quando a retenção de 90 dias já apagou o original.
  disponivel: boolean
  relatoId: string | null
  // Só quando o chamado tem mais de um relato.
  legenda: string | null
}

type Chamado = Pick<Ocorrencia, 'midias' | 'midia_url' | 'relatos_lista'>

// "0:05". Vídeo sem duração conhecida fica sem o selo.
export function formatarDuracao(ms: number | null | undefined): string | null {
  if (ms == null || !(ms > 0)) return null
  const s = Math.max(1, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function diaEHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} às ${hora}`
}

export function legendaDoRelato(posicao: number, total: number, criadoEm?: string | null): string {
  const quando = criadoEm ? diaEHora(criadoEm) : ''
  return `Relato ${posicao} de ${total}` + (quando ? `, ${quando}` : '')
}

// Capa do vídeo: o primeiro quadro do mesmo relato; sem quadro, a primeira
// foto do mesmo relato; sem nenhum, fica sem capa.
export function capaDoVideo(video: Midia, midias: Midia[]): string | undefined {
  const doRelato = midias
    .filter((m) => m.relato_id === video.relato_id && m.url)
    .sort((a, b) => a.ordem - b.ordem)
  return (doRelato.find((m) => m.tipo === 'quadro') ?? doRelato.find((m) => m.tipo === 'foto'))?.url
}

// Chamado antigo, sem a lista de mídias: uma foto por relato ou só a capa.
function itensAntigos(o: Chamado): ItemGaleria[] {
  const lista = o.relatos_lista ?? []
  const base = { tipo: 'foto' as const, duracao: null, disponivel: true }
  const comFoto = lista.filter((r) => r.midia_url)
  if (comFoto.length === 0) {
    return o.midia_url ? [{ ...base, id: 'capa', url: o.midia_url, relatoId: null, legenda: null }] : []
  }
  return comFoto.map((r) => ({
    ...base,
    id: `relato:${r.id}`,
    url: r.midia_url,
    relatoId: r.id,
    legenda: lista.length > 1 ? legendaDoRelato(lista.indexOf(r) + 1, lista.length, r.criado_em) : null,
  }))
}

// Monta os itens da galeria: as mídias de um mesmo relato ficam juntas, os
// relatos na ordem em que chegaram e a foto do depois por último.
export function montarGaleria(o: Chamado): ItemGaleria[] {
  const midias = o.midias ?? []
  if (midias.length === 0) return itensAntigos(o)

  const relatos = o.relatos_lista ?? []
  const grupos = new Map<string | null, Midia[]>()
  const depois: Midia[] = []
  for (const m of midias) {
    if (m.tipo === 'quadro') continue
    if (m.tipo === 'depois') {
      depois.push(m)
      continue
    }
    const g = grupos.get(m.relato_id)
    if (g) g.push(m)
    else grupos.set(m.relato_id, [m])
  }

  const naOrdem = (a: Midia, b: Midia) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em)
  const chegada = (id: string | null, g: Midia[]) =>
    relatos.find((r) => r.id === id)?.criado_em ?? g.reduce((min, m) => (m.criado_em < min ? m.criado_em : min), g[0].criado_em)
  const ordenados = [...grupos.entries()]
    .map(([id, g]) => ({ id, g: g.sort(naOrdem), quando: chegada(id, g) }))
    .sort((a, b) => a.quando.localeCompare(b.quando))

  const comRelato = ordenados.filter((x) => x.id != null)
  const total = relatos.length || comRelato.length
  const legenda = (id: string | null, quando: string): string | null => {
    if (id == null || total < 2) return null
    const i = relatos.findIndex((r) => r.id === id)
    const posicao = i >= 0 ? i + 1 : comRelato.findIndex((x) => x.id === id) + 1
    return legendaDoRelato(posicao, total, quando)
  }

  const itens: ItemGaleria[] = []
  for (const { id, g, quando } of ordenados) {
    const texto = legenda(id, quando)
    for (const m of g) {
      const video = m.tipo === 'video'
      itens.push({
        id: m.id,
        tipo: video ? 'video' : 'foto',
        url: video ? capaDoVideo(m, midias) : m.url,
        duracao: video ? formatarDuracao(m.duracao_ms) : null,
        disponivel: m.disponivel,
        relatoId: m.relato_id,
        legenda: texto,
      })
    }
  }
  for (const m of depois.sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.ordem - b.ordem)) {
    itens.push({ id: m.id, tipo: 'depois', url: m.url, duracao: null, disponivel: m.disponivel, relatoId: null, legenda: null })
  }
  return itens
}

// Nome do item para o leitor de tela, na miniatura e na tela cheia.
export function rotuloDoItem(item: ItemGaleria, posicao: number, total: number): string {
  const nome =
    item.tipo === 'video' ? (item.duracao ? `Vídeo de ${item.duracao}` : 'Vídeo')
    : item.tipo === 'depois' ? 'Foto do depois'
    : 'Foto'
  return total > 1 ? `${nome}, ${posicao} de ${total}` : nome
}

// Anterior e próxima dão a volta: nenhum botão da tela cheia fica desativado.
export function vizinho(indice: number, passo: number, total: number): number {
  return total > 0 ? (((indice + passo) % total) + total) % total : 0
}

// Deslize na tela cheia: só conta o gesto longo e bem mais horizontal que
// vertical. Para a esquerda vai à próxima (1); para a direita, à anterior (-1).
export function direcaoDoGesto(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}
