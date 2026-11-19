import { ehUuid } from './web'
import type { CodigoDeErro } from './web'

export interface VideoNaFila {
  uri: string
  tipo: string
  duracaoMs: number
  quadros: string[]
}

// Um relato esperando a internet: os arquivos já reduzidos, os campos e a
// mesma chave de idempotência da primeira tentativa.
export interface ItemDaFila {
  chave: string
  campos: Record<string, string>
  fotos: string[]
  video: VideoNaFila | null
  guardadoEm: string
}

export const MAX_FILA = 5

const textos = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string' && x !== '')

function lerVideo(v: unknown): VideoNaFila | null {
  if (typeof v !== 'object' || v === null) return null
  const b = v as Record<string, unknown>
  if (typeof b.uri !== 'string' || b.uri === '') return null
  return {
    uri: b.uri,
    tipo: typeof b.tipo === 'string' && b.tipo ? b.tipo : 'video/mp4',
    duracaoMs: typeof b.duracaoMs === 'number' && b.duracaoMs > 0 ? b.duracaoMs : 0,
    quadros: textos(b.quadros) ? b.quadros : [],
  }
}

// Lê a fila guardada, descartando o que não tem o formato.
export function lerFila(bruto: unknown): ItemDaFila[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .filter((i) => ehUuid(i.chave) && textos(i.fotos) && i.fotos.length > 0)
    .filter((i) => typeof i.campos === 'object' && i.campos !== null)
    .map((i) => ({
      chave: i.chave as string,
      campos: Object.fromEntries(
        Object.entries(i.campos as Record<string, unknown>).filter((par): par is [string, string] => typeof par[1] === 'string'),
      ),
      fotos: i.fotos as string[],
      video: lerVideo(i.video),
      guardadoEm: typeof i.guardadoEm === 'string' ? i.guardadoEm : '',
    }))
    .slice(0, MAX_FILA)
}

export function cabeNaFila(fila: ItemDaFila[]): boolean {
  return fila.length < MAX_FILA
}

// A mesma chave nunca entra duas vezes: é o mesmo relato.
export function entrarNaFila(fila: ItemDaFila[], item: ItemDaFila): ItemDaFila[] {
  return [...fila.filter((i) => i.chave !== item.chave), item].slice(-MAX_FILA)
}

export function sairDaFila(fila: ItemDaFila[], chave: string): ItemDaFila[] {
  return fila.filter((i) => i.chave !== chave)
}

// "1 relato esperando a internet"
export function textoDaFila(quantos: number): string | null {
  if (quantos <= 0) return null
  return quantos === 1 ? '1 relato esperando a internet' : `${quantos} relatos esperando a internet`
}

// Só falha de conexão oferece "Enviar quando a internet voltar".
export function podeEsperarInternet(codigo: CodigoDeErro): boolean {
  return codigo === 'sem_conexao' || codigo === 'tempo_esgotado'
}

export type DestinoNaFila = 'esperar' | 'descartar'

// Depois de uma nova tentativa que falhou: rede ruim e servidor ocupado
// esperam a próxima; recusa do conteúdo não muda com o tempo, então sai.
export function destinoNaFila(codigo: CodigoDeErro): DestinoNaFila {
  switch (codigo) {
    case 'sem_conexao':
    case 'tempo_esgotado':
    case 'muitos_envios':
    case 'midia_indisponivel':
    case 'interno':
    case 'desconhecido':
    // Falta o cadastro (feito pelo app web): o relato espera, não se perde.
    case 'cadastro_obrigatorio':
      return 'esperar'
    default:
      return 'descartar'
  }
}

export const GUARDADO_NA_FILA = 'Guardado. Vai quando a internet voltar.'
export const FILA_CHEIA = 'Já há relatos demais esperando a internet.'
export const RECUSADO_NA_FILA = 'Um relato guardado não foi aceito.'
