import { caminhoDaForma, formaDoNivel } from './marca'

// Pino dos relatos, em texto, para os marcadores que o MapLibre desenha fora do
// React. No miolo vai a forma do nível, para a urgência não depender só da cor.
export function pinoEmSvg(cor: string, nivel: number | null = null): string {
  const forma = caminhoDaForma(formaDoNivel(nivel))
  return `<svg width="34" height="44" viewBox="0 0 44 56" aria-hidden="true" focusable="false"><path d="M22 54S40 34.5 40 21a18 18 0 1 0-36 0c0 13.5 18 33 18 33z" fill="${cor}" stroke="#1F4D2B" stroke-width="3"/><circle cx="22" cy="21" r="9.5" fill="#FFFDF7" stroke="#1F4D2B" stroke-width="2"/><path transform="translate(15.5 14.5) scale(0.54)" fill="#1F4D2B" d="${forma}"/></svg>`
}
