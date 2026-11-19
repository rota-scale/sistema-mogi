import { dimensoesReduzidas, FOTO_ILEGIVEL, fotoCabe } from './logica'

const QUALIDADE = 0.82

interface Fonte {
  imagem: CanvasImageSource
  largura: number
  altura: number
  soltar: () => void
}

async function abrir(arquivo: Blob): Promise<Fonte> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      return { imagem: bitmap, largura: bitmap.width, altura: bitmap.height, soltar: () => bitmap.close() }
    } catch {
      /* formato que o bitmap não abre: tenta pela tag img */
    }
  }
  const url = URL.createObjectURL(arquivo)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((ok, falha) => {
      img.onload = () => ok()
      img.onerror = () => falha(new Error(FOTO_ILEGIVEL))
      img.src = url
    })
    return { imagem: img, largura: img.naturalWidth, altura: img.naturalHeight, soltar: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

// Reduz a foto para no máximo 1600 px no lado maior e regrava em JPEG.
// Regravar pelo canvas tira o EXIF (inclusive o GPS embutido) e deixa o
// envio leve no 4G. Se o navegador não abre o arquivo (HEIC, por exemplo),
// rejeita: mandar o original só faria o servidor recusar depois.
export async function reduzirFoto(arquivo: Blob): Promise<Blob> {
  const fonte = await abrir(arquivo)
  const tela = document.createElement('canvas')
  try {
    const { largura, altura } = dimensoesReduzidas(fonte.largura, fonte.altura)
    if (largura === 0 || altura === 0) throw new Error(FOTO_ILEGIVEL)
    tela.width = largura
    tela.height = altura
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error(FOTO_ILEGIVEL)
    ctx.drawImage(fonte.imagem, 0, 0, largura, altura)
    const jpeg = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', QUALIDADE))
    if (!jpeg || !fotoCabe(jpeg.size)) throw new Error(FOTO_ILEGIVEL)
    return jpeg
  } finally {
    fonte.soltar()
    // Canvas zerado devolve a memória na hora: celular de 2 GB não espera o
    // coletor de lixo, ainda mais com várias fotos seguidas.
    tela.width = tela.height = 0
  }
}
