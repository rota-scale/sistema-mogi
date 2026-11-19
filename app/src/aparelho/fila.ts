import { Directory, File, Paths } from 'expo-file-system'
import { enviarRelato, FalhaDeEnvio } from '@/api/envio'
import { destinoNaFila, entrarNaFila, lerFila, sairDaFila } from '@/logica/fila'
import type { ItemDaFila } from '@/logica/fila'
import { acaoDoErro } from '@/logica/web'
import type { Resposta } from '@/logica/web'
import { gravar, ler } from './guardado'
import { novoUuid } from './identidade'

const CHAVE_FILA = 'mogi.fila'

const pastaDaFila = () => new Directory(Paths.document, 'fila')
const pastaDoItem = (chave: string) => new Directory(pastaDaFila(), chave)

export async function filaGuardada(): Promise<ItemDaFila[]> {
  return lerFila(await ler(CHAVE_FILA))
}

// A câmera grava na pasta temporária, que o sistema pode limpar. O relato
// que vai esperar a internet é copiado para a pasta de documentos do app.
function copiar(uri: string, pasta: Directory, nome: string): string {
  const destino = new File(pasta, nome)
  if (destino.exists) destino.delete()
  new File(uri).copySync(destino)
  return destino.uri
}

const extensao = (uri: string, padrao: string) => /\.([a-z0-9]{2,4})($|\?)/i.exec(uri)?.[1]?.toLowerCase() ?? padrao

// Guarda o relato para enviar depois. Rejeita se os arquivos não puderem
// ser copiados: nesse caso o relato continua na tela.
export async function guardarNaFila(item: ItemDaFila): Promise<ItemDaFila[]> {
  const pasta = pastaDoItem(item.chave)
  if (!pasta.exists) pasta.create({ intermediates: true })
  const guardado: ItemDaFila = {
    ...item,
    fotos: item.fotos.map((uri, i) => copiar(uri, pasta, `foto-${i + 1}.jpg`)),
    video: item.video && {
      ...item.video,
      uri: copiar(item.video.uri, pasta, `video.${extensao(item.video.uri, 'mp4')}`),
      quadros: item.video.quadros.map((uri, i) => copiar(uri, pasta, `quadro-${i + 1}.jpg`)),
    },
  }
  const fila = entrarNaFila(await filaGuardada(), guardado)
  await gravar(CHAVE_FILA, fila)
  return fila
}

export async function tirarDaFila(chave: string): Promise<ItemDaFila[]> {
  try {
    const pasta = pastaDoItem(chave)
    if (pasta.exists) pasta.delete()
  } catch {
    /* sobra de arquivo não impede a fila de andar */
  }
  const fila = sairDaFila(await filaGuardada(), chave)
  await gravar(CHAVE_FILA, fila)
  return fila
}

export interface ResultadoDaFila {
  fila: ItemDaFila[]
  enviados: { item: ItemDaFila; resposta: Resposta }[]
  recusados: number
}

// Vídeo recusado pelo servidor não derruba o relato: vai de novo só com as
// fotos, com outra chave, porque o conteúdo mudou.
async function enviarSemPerderAsFotos(item: ItemDaFila): Promise<Resposta> {
  try {
    return await enviarRelato({ fotos: item.fotos, video: item.video, campos: item.campos, chave: item.chave })
  } catch (e) {
    if (!(e instanceof FalhaDeEnvio) || !item.video || acaoDoErro(e.codigo) !== 'sem_video') throw e
    return enviarRelato({ fotos: item.fotos, video: null, campos: item.campos, chave: novoUuid() })
  }
}

let emAndamento: Promise<ResultadoDaFila> | null = null

// Tenta enviar tudo o que está esperando, um por vez, com a mesma chave da
// primeira tentativa: se o servidor já tinha recebido, devolve o mesmo
// recibo sem duplicar. Uma chamada por vez.
export function tentarFila(): Promise<ResultadoDaFila> {
  emAndamento ??= (async () => {
    const resultado: ResultadoDaFila = { fila: await filaGuardada(), enviados: [], recusados: 0 }
    for (const item of [...resultado.fila]) {
      try {
        const semArquivo = item.fotos.some((uri) => !new File(uri).exists)
        if (semArquivo) throw new FalhaDeEnvio('foto_ausente')
        const resposta = await enviarSemPerderAsFotos(item)
        resultado.enviados.push({ item, resposta })
        resultado.fila = await tirarDaFila(item.chave)
      } catch (e) {
        const codigo = e instanceof FalhaDeEnvio ? e.codigo : 'desconhecido'
        if (destinoNaFila(codigo) === 'descartar') {
          resultado.recusados++
          resultado.fila = await tirarDaFila(item.chave)
        } else if (codigo === 'sem_conexao' || codigo === 'tempo_esgotado') {
          // Sem rede não adianta tentar os próximos agora.
          break
        }
      }
    }
    return resultado
  })().finally(() => {
    emAndamento = null
  })
  return emAndamento
}
