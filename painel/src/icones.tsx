import { caminhoDoIcone } from './formas'

const TRACOS = {
  camadas: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  fechar: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  busca: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.8-3.8',
  filtro: 'M4 6h16M7 12h10M10 18h4',
  rota: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7.3a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z',
  copiar: 'M9 9h10v11H9zM5 15V4h10',
  abaixo: 'M6 9l6 6 6-6',
  acima: 'M6 15l6-6 6 6',
  pessoa: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20a7.5 7.5 0 0 1 15 0',
  alerta: 'M12 4l9.5 16h-19L12 4zM12 10v4.5M12 17.3v.2',
  certo: 'M5 12.5l4.5 4.5L19 7.5',
}

export type NomeDoIcone = keyof typeof TRACOS

export function Icone({ nome, tamanho = 22 }: { nome: NomeDoIcone; tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={TRACOS[nome]} />
    </svg>
  )
}

// Forma do nível de urgência (formas.ts), na cor do nível ou na cor do texto.
export function FormaDoNivel({ nivel, cor = 'currentColor', tamanho = 14, contorno }: { nivel: number | null; cor?: string; tamanho?: number; contorno?: string }) {
  return (
    <svg className="forma-nivel" viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden="true">
      <path d={caminhoDoIcone(nivel)} fill={cor} stroke={contorno ?? 'none'} strokeWidth={contorno ? 2 : 0} strokeLinejoin="round" />
    </svg>
  )
}

// Check que se desenha em 320 ms quando a ação dá certo (sem animação com
// movimento reduzido). Acompanha o som "confirmado".
export function CheckDesenhado({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg className="check-desenhado" viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.35" />
      <path d="M7 12.5l3.5 3.5L17 9" pathLength={1} />
    </svg>
  )
}
