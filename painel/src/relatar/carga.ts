// Só os endereços entram no pacote do morador: o MapLibre fica num arquivo
// à parte, pedido logo na abertura, em paralelo com o resto da página.
import urlDoCss from 'maplibre-gl/dist/maplibre-gl.css?url'
import urlDoMapLibre from 'maplibre-gl/dist/maplibre-gl.mjs?url'
import urlDoWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url&morador'

export type MapLibre = typeof import('maplibre-gl')

let carga: Promise<MapLibre> | null = null
let falhas = 0

function carregarCss(href: string): Promise<void> {
  return new Promise((ok, falha) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => ok()
    link.onerror = () => {
      link.remove()
      falha(new Error('css do mapa'))
    }
    document.head.append(link)
  })
}

// O navegador guarda a falha de um import() pelo endereço e não pede de
// novo. Por isso, depois de uma falha, o endereço ganha um sufixo diferente.
export function carregarMapLibre(): Promise<MapLibre> {
  if (carga) return carga
  const novo = (url: string) => (falhas > 0 ? `${url}${url.includes('?') ? '&' : '?'}t=${falhas}` : url)
  const esta = Promise.all([
    import(/* @vite-ignore */ novo(urlDoMapLibre)) as Promise<MapLibre>,
    carregarCss(novo(urlDoCss)),
  ]).then(
    ([gl]) => {
      gl.setWorkerUrl(novo(urlDoWorker))
      return gl
    },
    (e: unknown) => {
      falhas++
      carga = null
      throw e
    },
  )
  carga = esta
  return esta
}

