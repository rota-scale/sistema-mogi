import type { ReactNode } from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { cores } from '@/tema'

interface Icone {
  tamanho?: number
  cor?: string
}

// Ícones de traço, iguais aos do app web. São decoração: quem fala com o
// leitor de tela é o botão em volta.
function Traco({ tamanho = 24, cor = cores.cafezal, grosso = 2.2, children }: Icone & { grosso?: number; children: ReactNode }) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth={grosso}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  )
}

export const IconeCamera = (p: Icone) => (
  <Traco {...p}>
    <Path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <Circle cx="12" cy="13" r="3.6" />
  </Traco>
)

export const IconeFechar = (p: Icone) => (
  <Traco {...p} grosso={3}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Traco>
)

export const IconeCerto = (p: Icone) => (
  <Traco {...p} grosso={3}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Traco>
)

export const IconeLocal = (p: Icone) => (
  <Traco {...p}>
    <Path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21z" />
    <Circle cx="12" cy="10.5" r="2.3" />
  </Traco>
)

export const IconeMira = (p: Icone) => (
  <Traco {...p}>
    <Circle cx="12" cy="12" r="6.5" />
    <Path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
  </Traco>
)

export const IconeLista = (p: Icone) => (
  <Traco {...p} grosso={2.6}>
    <Path d="M9 6.5h11M9 12h11M9 17.5h11M4.2 6.5h.1M4.2 12h.1M4.2 17.5h.1" />
  </Traco>
)

export const IconeTeclado = (p: Icone) => (
  <Traco {...p}>
    <Rect x="2.5" y="6" width="19" height="12" rx="2.2" />
    <Path d="M6.5 10h.1M10 10h.1M13.5 10h.1M17.5 10h.1M8 14.5h8" />
  </Traco>
)

export const IconeCompartilhar = (p: Icone) => (
  <Traco {...p}>
    <Path d="M12 15V3.5M7.5 7.5L12 3l4.5 4.5M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" />
  </Traco>
)

export const IconeSemRede = (p: Icone) => (
  <Traco {...p}>
    <Path d="M3 9.5a13 13 0 0 1 18 0M6.5 13a8 8 0 0 1 11 0M10 16.5a3 3 0 0 1 4 0M12 20h.1M4 4l16 16" />
  </Traco>
)

export const IconeSom = ({ ligado, ...p }: Icone & { ligado: boolean }) => (
  <Traco {...p}>
    <Path d="M4 9.5h3l4.5-4v13l-4.5-4H4z" />
    {ligado ? <Path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" /> : <Path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />}
  </Traco>
)

export const IconeTocar = ({ tamanho = 24, cor = cores.creme }: Icone) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
    <Path d="M8 5.5v13l11-6.5z" fill={cor} />
  </Svg>
)

// Um desenho por tipo de problema conhecido; tipo novo cai nas reticências.
export function IconeDoTipo({ id, ...p }: Icone & { id: string }) {
  switch (id) {
    case 'agua':
      return (
        <Traco {...p}>
          <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
        </Traco>
      )
    case 'iluminacao':
      return (
        <Traco {...p}>
          <Path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
        </Traco>
      )
    case 'vias':
      return (
        <Traco {...p}>
          <Path d="M10.2 4h3.6l3.7 14h-11zM3.5 20.5h17M8.7 12.5h6.6" />
        </Traco>
      )
    case 'limpeza':
      return (
        <Traco {...p}>
          <Path d="M4 7h16M9 7V4h6v3M6 7l1 13.5h10L18 7M10 11v6M14 11v6" />
        </Traco>
      )
    case 'arvores':
      return (
        <Traco {...p}>
          <Path d="M12 21.5V13M12 15.5a5.5 5.5 0 0 1-4.8-8.2 4.8 4.8 0 0 1 9.6 0A5.5 5.5 0 0 1 12 15.5zM8.5 21.5h7" />
        </Traco>
      )
    case 'sinalizacao':
      return (
        <Traco {...p}>
          <Path d="M12 2.5l7 7-7 7-7-7zM12 16.5v5M12 7v3.5M12 13h.1" />
        </Traco>
      )
    case 'calcadas':
      return (
        <Traco {...p}>
          <Path d="M3 8h18v8H3zM9 8v8M15 8v8M3 12h6M15 12h6" />
        </Traco>
      )
    case 'animais':
      return (
        <Traco {...p}>
          <Circle cx="6.5" cy="11" r="1.7" />
          <Circle cx="10" cy="6.5" r="1.7" />
          <Circle cx="14" cy="6.5" r="1.7" />
          <Circle cx="17.5" cy="11" r="1.7" />
          <Path d="M12 12c-2.5 0-4.5 2.3-4.5 4.5 0 1.5 1.2 2.5 2.5 2.5 1 0 1.3-.5 2-.5s1 .5 2 .5c1.3 0 2.5-1 2.5-2.5 0-2.2-2-4.5-4.5-4.5z" />
        </Traco>
      )
    default:
      return (
        <Traco {...p} grosso={3.2}>
          <Path d="M6 12h.1M12 12h.1M18 12h.1" />
        </Traco>
      )
  }
}
