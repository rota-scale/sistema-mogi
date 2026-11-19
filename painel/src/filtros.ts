import { NOME_CATEGORIA } from './niveis'
import type { Ocorrencia } from './tipos'

// Filtros que valem ao mesmo tempo para a fila e para o mapa. Lista vazia
// quer dizer "todos". Em "niveis", 0 é o chamado sem avaliação.
export interface Filtros {
  busca: string
  niveis: number[]
  categorias: string[]
  secretarias: string[]
  bairros: string[]
}

export const SEM_FILTROS: Filtros = { busca: '', niveis: [], categorias: [], secretarias: [], bairros: [] }

// Chamado sem bairro ou sem secretaria entra no filtro com a chave vazia.
export const SEM_VALOR = ''

// Minúsculas e sem acento, para "agua" achar "Água".
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Todas as palavras da busca precisam aparecer em algum dos campos: protocolo,
// endereço, bairro, texto do morador ou nome do tipo.
export function combinaComBusca(o: Ocorrencia, busca: string): boolean {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return true
  const onde = semAcento([o.protocolo, o.endereco, o.bairro, o.texto, NOME_CATEGORIA[o.categoria] ?? o.categoria].filter(Boolean).join(' '))
  return palavras.every((p) => onde.includes(p))
}

const dentro = (escolhidos: readonly (string | number)[], valor: string | number) => escolhidos.length === 0 || escolhidos.includes(valor)

export function passaNosFiltros(o: Ocorrencia, f: Filtros): boolean {
  return (
    dentro(f.niveis, o.nivel ?? 0) &&
    dentro(f.categorias, o.categoria) &&
    dentro(f.secretarias, o.secretaria ?? SEM_VALOR) &&
    dentro(f.bairros, o.bairro ?? SEM_VALOR) &&
    combinaComBusca(o, f.busca)
  )
}

export function filtrar(lista: Ocorrencia[], f: Filtros): Ocorrencia[] {
  return temFiltro(f) ? lista.filter((o) => passaNosFiltros(o, f)) : lista
}

// Quantas fichas estão marcadas atrás do botão "Filtrar".
export function fichasAtivas(f: Filtros): number {
  return f.categorias.length + f.secretarias.length + f.bairros.length
}

// Algum filtro escondendo chamados, contando a busca e a urgência.
export function temFiltro(f: Filtros): boolean {
  return f.busca.trim() !== '' || f.niveis.length > 0 || fichasAtivas(f) > 0
}

// Liga ou desliga um valor numa lista de escolhidos.
export function alternar<T>(escolhidos: readonly T[], valor: T): T[] {
  return escolhidos.includes(valor) ? escolhidos.filter((v) => v !== valor) : [...escolhidos, valor]
}

export interface Opcao {
  valor: string
  nome: string
}

const emOrdem = (a: Opcao, b: Opcao) => {
  // "Sem bairro" e "Sem secretaria" ficam no fim.
  if ((a.valor === SEM_VALOR) !== (b.valor === SEM_VALOR)) return a.valor === SEM_VALOR ? 1 : -1
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

function opcoes(valores: Iterable<string>, nome: (v: string) => string): Opcao[] {
  return [...new Set(valores)].map((valor) => ({ valor, nome: nome(valor) })).sort(emOrdem)
}

// Fichas de filtro: só o que existe nos chamados carregados.
export function opcoesDeFiltro(lista: Ocorrencia[]): { categorias: Opcao[]; secretarias: Opcao[]; bairros: Opcao[] } {
  return {
    categorias: opcoes(lista.map((o) => o.categoria), (v) => NOME_CATEGORIA[v] ?? v),
    secretarias: opcoes(lista.map((o) => o.secretaria ?? SEM_VALOR), (v) => v || 'Sem secretaria'),
    bairros: opcoes(lista.map((o) => o.bairro ?? SEM_VALOR), (v) => v || 'Sem bairro'),
  }
}

export type CargaDaLista = 'carregando' | 'pronta' | 'falhou'

export interface EstadoDaLista {
  tipo: 'calmo' | 'carregando' | 'erro'
  titulo: string
  texto?: string
  // Mostrar o botão "Limpar filtros".
  limpar: boolean
}

const VAZIO_DA_SITUACAO: Record<string, { titulo: string; texto?: string }> = {
  revisao: { titulo: 'Nada para conferir agora', texto: 'Chamado novo aparece aqui sozinho.' },
  abertas: { titulo: 'Nenhum chamado esperando equipe' },
  atendimento: { titulo: 'Nenhuma equipe a caminho agora' },
  resolvidas: { titulo: 'Nenhum chamado resolvido ainda' },
}

// O que a fila diz quando não há chamado para mostrar: carregando, sem
// conexão, tudo escondido pelos filtros ou a lista realmente vazia.
export function estadoDaListaVazia(carga: CargaDaLista, aba: string, totalDaAba: number): EstadoDaLista {
  if (carga === 'carregando') return { tipo: 'carregando', titulo: 'Carregando chamados…', limpar: false }
  if (carga === 'falhou') return { tipo: 'erro', titulo: 'Sem conexão com o servidor', texto: 'Confira a internet. O painel tenta de novo sozinho.', limpar: false }
  if (totalDaAba > 0) {
    const n = totalDaAba === 1 ? 'o chamado' : `os ${totalDaAba} chamados`
    return { tipo: 'calmo', titulo: 'Nenhum chamado passa na busca e nos filtros', texto: `Limpe os filtros para ver ${n} desta lista.`, limpar: true }
  }
  return { tipo: 'calmo', ...(VAZIO_DA_SITUACAO[aba] ?? { titulo: 'Nenhum chamado aqui' }), limpar: false }
}
