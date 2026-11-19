import { idDoAparelho } from '@/aparelho/identidade'
import { partesDoRelato } from '@/logica/corpo'
import type { VideoNaFila } from '@/logica/fila'
import { interpretarEnvio, prazoDeEnvio } from '@/logica/web'
import type { CodigoDeErro, Progresso, Resposta } from '@/logica/web'
import { endereco } from './base'

export class FalhaDeEnvio extends Error {
  readonly codigo: CodigoDeErro
  constructor(codigo: CodigoDeErro) {
    super(codigo)
    this.name = 'FalhaDeEnvio'
    this.codigo = codigo
  }
}

export interface Envio {
  // Endereços dos JPEGs já reduzidos. A primeira foto é a principal.
  fotos: string[]
  video: VideoNaFila | null
  campos: Record<string, string>
  // Chave de idempotência: a mesma em toda tentativa do mesmo relato.
  chave: string
  aoProgredir?: (p: Progresso) => void
}

// Envia o relato como multipart. XMLHttpRequest em vez de fetch porque só
// ele informa o progresso do upload no React Native.
export async function enviarRelato({ fotos, video, campos, chave, aoProgredir = () => {} }: Envio): Promise<Resposta> {
  const url = endereco('/ocorrencias')
  if (!url) throw new FalhaDeEnvio('sem_conexao')
  const aparelho = await idDoAparelho()
  const corpo = new FormData()
  for (const parte of partesDoRelato(fotos, video, campos)) {
    // No React Native o arquivo entra no FormData como { uri, name, type }.
    if ('arquivo' in parte) corpo.append(parte.nome, parte.arquivo as unknown as Blob)
    else corpo.append(parte.nome, parte.valor)
  }
  const temVideo = video !== null

  return new Promise((ok, falha) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.responseType = 'text'
    xhr.timeout = prazoDeEnvio(temVideo)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('Idempotency-Key', chave)
    xhr.setRequestHeader('X-Mogi-Aparelho', aparelho)

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return
      aoProgredir(e.loaded >= e.total ? { fase: 'analisando' } : { fase: 'enviando', fracao: e.loaded / e.total })
    }
    xhr.onload = () => {
      let json: unknown = null
      try {
        json = JSON.parse(xhr.responseText)
      } catch {
        /* corpo que não é JSON: decide só pelo status */
      }
      const r = interpretarEnvio(xhr.status, json, temVideo)
      if ('resposta' in r) ok(r.resposta)
      else falha(new FalhaDeEnvio(r.codigo))
    }
    xhr.onerror = () => falha(new FalhaDeEnvio('sem_conexao'))
    xhr.onabort = () => falha(new FalhaDeEnvio('sem_conexao'))
    xhr.ontimeout = () => falha(new FalhaDeEnvio('tempo_esgotado'))

    aoProgredir({ fase: 'enviando', fracao: 0 })
    xhr.send(corpo)
  })
}
