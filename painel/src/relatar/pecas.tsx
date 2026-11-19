import { corDaPele, ehCrianca, ehFeminino, ehIdoso, PADRAO } from './boneco'
import type { Aparencia } from './boneco'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { corDoNivel, nomeDoNivel, textoSobreNivel } from './logica'
import type { Lado } from './logica'
import { caminhoDaForma, confete, formaDoNivel } from './marca'

type Icone = { tamanho?: number }

const base = (tamanho: number) => ({
  width: tamanho,
  height: tamanho,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

function Svg({ tamanho, largura = 2, children }: { tamanho: number; largura?: number; children: ReactNode }) {
  return (
    <svg {...base(tamanho)} strokeWidth={largura}>
      {children}
    </svg>
  )
}

export function IconeCamera({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M14.5 4h-5L7.5 6.5H4.5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  )
}

export function IconeMicrofone({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </Svg>
  )
}

export function IconeTeclado({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </Svg>
  )
}

export function IconeParar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </Svg>
  )
}

// desenha: o traço se desenha da esquerda para a direita, como um visto feito à mão.
export function IconeCerto({ tamanho = 24, desenha = false }: Icone & { desenha?: boolean }) {
  return (
    <Svg tamanho={tamanho} largura={2.4}>
      <path className={desenha ? 'certo-desenha' : undefined} pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  )
}

export function IconeFechar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho} largura={2.4}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}

export function IconeEnviar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho} largura={2.4}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </Svg>
  )
}

export function IconeVoltar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho} largura={2.4}>
      <path d="M19 12H6M11 6l-6 6 6 6" />
    </Svg>
  )
}

export function IconeAvancar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho} largura={2.4}>
      <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
    </Svg>
  )
}

export function IconeTocar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </Svg>
  )
}

export function IconeMira({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  )
}

export function IconeLista({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={3} />
    </Svg>
  )
}

export function IconeCompartilhar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2" />
    </Svg>
  )
}

export function IconeRecarregar({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
    </Svg>
  )
}

export function IconeSom({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </Svg>
  )
}

export function IconeSemSom({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </Svg>
  )
}

// Um ícone por tipo de problema; tipo desconhecido usa o de "outro".
const DESENHOS: Record<string, ReactNode> = {
  agua: <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />,
  iluminacao: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z" />
    </>
  ),
  vias: (
    <>
      <path d="M3 20l4-16M21 20L17 4M12 5v2M12 11v2" />
      <ellipse cx="12" cy="17.5" rx="4" ry="1.8" />
    </>
  ),
  limpeza: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  arvores: (
    <>
      <path d="M12 2.5l5.5 7.5h-3l4.5 6.5H5l4.5-6.5h-3z" />
      <path d="M12 16.5v5M9.5 21.5h5" />
    </>
  ),
  sinalizacao: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 2.5l7 7-7 7-7-7z" />
    </>
  ),
  calcadas: (
    <>
      <path d="M8.5 3h7l5 18h-17z" />
      <path d="M6.6 9.5h10.8M5 15.5h14M12 3v18" />
    </>
  ),
  animais: (
    <>
      <circle cx="6.5" cy="10" r="1.8" />
      <circle cx="10" cy="6.2" r="1.8" />
      <circle cx="14" cy="6.2" r="1.8" />
      <circle cx="17.5" cy="10" r="1.8" />
      <path d="M12 12c-2.4 0-4.5 3-4.5 5 0 1.6 1.3 2.5 2.6 2.2 1-.2 1.3-.6 1.9-.6s.9.4 1.9.6c1.3.3 2.6-.6 2.6-2.2 0-2-2.1-5-4.5-5z" />
    </>
  ),
  outros: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth={3.4} />
    </>
  ),
}

export function IconeDoTipo({ id, tamanho = 24 }: { id: string; tamanho?: number }) {
  return <svg {...base(tamanho)}>{DESENHOS[id] ?? DESENHOS.outros}</svg>
}

// Pino do seletor: a ponta fica no meio da base. No miolo, o losango ipê do logo.
export const IconePino = () => (
  <svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true" focusable="false">
    <path d="M22 54S40 34.5 40 21a18 18 0 1 0-36 0c0 13.5 18 33 18 33z" fill="#1F4D2B" stroke="#FFFDF7" strokeWidth="3" />
    <path d="M22 11l10 10-10 10-10-10z" fill="#E9B526" />
    <circle cx="22" cy="21" r="3.4" fill="#1E3F8A" />
  </svg>
)

// Forma do nível (círculo, quadrado, losango, triângulo, exclamação): a
// urgência nunca depende só da cor.
export function FormaDoNivel({ nivel, tamanho = 12 }: { nivel: number | null; tamanho?: number }) {
  return (
    <svg className="forma-nivel" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={caminhoDaForma(formaDoNivel(nivel))} />
    </svg>
  )
}

// Losango do MOGI, sem o fundo creme do logo.
export function IconeMogi({ tamanho = 28 }: Icone) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="140 40 720 880" aria-hidden="true" focusable="false">
      <polygon points="500,220 840,560 500,900 160,560" fill="#1F4D2B" />
      <polygon points="500,356 704,560 500,764 296,560" fill="#E9B526" />
      <circle cx="500" cy="560" r="91.8" fill="#1E3F8A" />
      <path d="M500,180 A126,126 0 0,1 376.256,56.2563 A126,126 0 0,1 500,180 Z" fill="#1F4D2B" />
      <path d="M500,180 A126,126 0 0,1 623.744,56.2563 A126,126 0 0,1 500,180 Z" fill="#3E7B3A" />
      <circle cx="500" cy="218" r="52" fill="#B3261E" />
    </svg>
  )
}

// O boneco do MOGI, como um avatar: cabeça grande, corpo curto, contorno
// branco e sombra no chão. Olha para a direita; a esquerda é o espelho.
export function Boneco({ andando, lado, aparencia = PADRAO }: { andando: boolean; lado: Lado; aparencia?: Aparencia }) {
  const { estilo, tom } = aparencia
  const pele = corDaPele(tom)
  const crianca = ehCrianca(estilo)
  const idoso = ehIdoso(estilo)
  const feminino = ehFeminino(estilo)
  const cabelo = idoso ? '#C9C4BC' : '#3B2416'
  // Criança: o mesmo boneco, menor, com os pés no mesmo lugar.
  const escala = crianca ? 'translate(4.3 10.1) scale(0.82)' : undefined
  return (
    <span className={`boneco${andando ? ' andando' : ''}${lado === 'esquerda' ? ' boneco-esquerda' : ''}`} aria-hidden="true">
      <svg width="48" height="60" viewBox="0 0 48 60" focusable="false">
        <ellipse className="boneco-sombra" cx="24" cy="56.5" rx="10" ry="2.8" fill="rgba(18,48,26,0.3)" />
        <g transform={escala}>
        <g className="boneco-corpo">
          {idoso && (
            <g>
              <path d="M33 38l3 16" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
              <path d="M33 38l3 16" stroke="#6B4A2B" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          )}
          <g className="boneco-braco boneco-braco-tras">
            <path d="M24 35l-1 8" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
            <path d="M24 35l-1 8" stroke="#12301A" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          <g className="boneco-perna boneco-perna-a">
            <path d="M24 44v8.5" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
            <path d="M24 44v8.5" stroke="#12301A" strokeWidth="4.5" strokeLinecap="round" />
          </g>
          <g className="boneco-perna boneco-perna-b">
            <path d="M24 44v8.5" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
            <path d="M24 44v8.5" stroke="#2A6A3A" strokeWidth="4.5" strokeLinecap="round" />
          </g>
          <rect x="15.5" y="31" width="17" height="16" rx="7" fill="#1F4D2B" stroke="#FFFFFF" strokeWidth="2" />
          <path d="M20.5 37.5h7" stroke="#E9B526" strokeWidth="2.2" strokeLinecap="round" />
          <g className="boneco-braco boneco-braco-frente">
            <path d="M24 35l1 8" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
            <path d="M24 35l1 8" stroke="#2A6A3A" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          {estilo === 'mulher' && (
            <path d="M10.4 18a13.6 13.6 0 0 1 27.2 0v12.5q-3 2.2-5.6 0V22h-16v8.5q-2.6 2.2-5.6 0z" fill={cabelo} stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
          )}
          {estilo === 'menina' && (
            <>
              <circle cx="9.5" cy="21" r="5" fill={cabelo} stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="38.5" cy="21" r="5" fill={cabelo} stroke="#FFFFFF" strokeWidth="2" />
            </>
          )}
          {estilo === 'senhora' && <circle cx="24" cy="5" r="5.5" fill={cabelo} stroke="#FFFFFF" strokeWidth="2" />}
          <circle cx="24" cy="18" r="13" fill={pele} stroke="#FFFFFF" strokeWidth="2" />
          {feminino || idoso ? (
            <path
              d={idoso && !feminino ? 'M11.8 17a12.4 12.4 0 0 1 3.4-8.2q1 4 1.4 7.2zM36.2 17a12.4 12.4 0 0 0-3.4-8.2q-1 4-1.4 7.2z' : 'M11.4 16.5a12.6 12.6 0 0 1 25.2 0q-6.3-4.4-12.6-2.4q-6.3-2-12.6 2.4z'}
              fill={cabelo}
              stroke="#FFFFFF"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          ) : (
            <>
              <path d="M11.6 15.5a12.6 12.6 0 0 1 24.8 0z" fill="#E9B526" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
              <path d="M35 14.6h6.5" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
              <path d="M35 14.6h6.5" stroke="#B98A0E" strokeWidth="2.6" strokeLinecap="round" />
            </>
          )}
          {estilo === 'menina' && <path d="M30 9.5l3-2.6 0.4 3.6z M30 9.5l-0.6 3.8 3.4-1.6z" fill="#E9B526" />}
          <circle cx="28.5" cy="19.5" r="1.7" fill="#1F4D2B" />
          <circle cx="21.5" cy="19.5" r="1.7" fill="#1F4D2B" />
          {idoso && (
            <g fill="none" stroke="#1F4D2B" strokeWidth="1.3">
              <circle cx="21.5" cy="19.5" r="3.4" />
              <circle cx="28.5" cy="19.5" r="3.4" />
              <path d="M24.9 19.3h0.2" />
            </g>
          )}
          <path d="M22.5 24.2q2.5 2 5 0" stroke="#1F4D2B" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
        </g>
      </svg>
    </span>
  )
}

// Cone de direção, deitado no mapa: aponta para o norte e o marcador gira.
export function ConeDeDirecao() {
  return (
    <svg className="cone" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="cone-luz" cx="60" cy="60" r="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B6EA5" stopOpacity="0.5" />
          <stop offset="1" stopColor="#3B6EA5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M60 60L38 6a58 58 0 0 1 44 0z" fill="url(#cone-luz)" />
    </svg>
  )
}

// Selo da urgência: forma e nome, o número é interno.
export function Selo({ nivel, pequeno = false }: { nivel: number | null; pequeno?: boolean }) {
  return (
    <span
      className={pequeno ? 'selo selo-pequeno' : 'selo'}
      style={{ background: corDoNivel(nivel), color: textoSobreNivel(nivel) }}
    >
      <FormaDoNivel nivel={nivel} tamanho={pequeno ? 10 : 12} />
      {nomeDoNivel(nivel)}
    </span>
  )
}

const semMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Confete geométrico curto (losango, círculo, meia-lua, triângulo nas cores da
// marca) para o problema resolvido. Quem pediu menos movimento não vê nada.
export function Confete({ semente }: { semente: number }) {
  const [pecas] = useState(() => (semMovimento() ? [] : confete(semente)))
  if (pecas.length === 0) return null
  return (
    <span className="confete" aria-hidden="true">
      {pecas.map((p, i) => (
        <span
          key={i}
          className={`confete-peca confete-${p.forma}`}
          style={
            {
              left: `${p.x}%`,
              width: p.tamanho,
              height: p.tamanho,
              color: p.cor,
              animationDelay: `${p.atrasoMs}ms`,
              '--queda': `${p.queda}vh`,
              '--deriva': `${p.deriva}vw`,
              '--giro': `${p.giro}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}

// Anel de progresso em volta de um botão redondo. fracao null: giro sem fim.
export function Anel({ fracao, tamanho, cor = '#E9B526' }: { fracao: number | null; tamanho: number; cor?: string }) {
  const r = tamanho / 2 - 4
  const volta = 2 * Math.PI * r
  return (
    <svg
      className={fracao === null ? 'anel anel-incerto' : 'anel'}
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(255,253,247,0.55)" strokeWidth="6" />
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={r}
        fill="none"
        stroke={cor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={volta}
        strokeDashoffset={volta * (1 - (fracao ?? 0.3))}
        transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
      />
    </svg>
  )
}

// Ícone de cada passo do andamento, no mesmo traço dos outros.
export function IconeDoPasso({ tipo, tamanho = 22 }: Icone & { tipo: string }) {
  switch (tipo) {
    case 'recebido': // a mensagem chegou
      return (
        <Svg tamanho={tamanho}>
          <path d="M4 7.5 12 13l8-5.5" />
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
        </Svg>
      )
    case 'conferido': // a prefeitura olhou e carimbou
      return (
        <Svg tamanho={tamanho}>
          <path d="M12 3.5 19 6v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
        </Svg>
      )
    case 'a_caminho': // a equipe saiu
      return (
        <Svg tamanho={tamanho}>
          <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7" />
          <circle cx="7" cy="17.5" r="1.8" />
          <circle cx="16.5" cy="17.5" r="1.8" />
        </Svg>
      )
    default: // resolvido
      return (
        <Svg tamanho={tamanho} largura={2.2}>
          <path d="M12 3.5l2.2 2 3-.3.6 2.9 2.6 1.5-1.2 2.7 1.2 2.7-2.6 1.5-.6 2.9-3-.3-2.2 2-2.2-2-3 .3-.6-2.9-2.6-1.5 1.2-2.7-1.2-2.7 2.6-1.5.6-2.9 3 .3z" />
          <path d="m8.8 12.2 2.2 2.2 4.2-4.4" />
        </Svg>
      )
  }
}

export function IconeRelogio({ tamanho = 20 }: Icone) {
  return (
    <Svg tamanho={tamanho} largura={2.2}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function IconeAjuda({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho} largura={2.2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 4" />
      <path d="M12 17.6h.01" strokeWidth={3} />
    </Svg>
  )
}

// Bússola: a ponta vermelha aponta para o norte, girando com o mapa.
export function IconeBussola({ tamanho = 24, graus = 0 }: Icone & { graus?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${-graus}deg)`, transition: 'transform 120ms linear' }}>
      <path d="M12 3l3.2 9H8.8z" fill="#B3261E" />
      <path d="M12 21l-3.2-9h6.4z" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

// Perfil: cabeça e ombros, no mesmo traço.
export function IconePessoa({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho} largura={2.2}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.8-3.9 3.8-6 7.5-6s6.7 2.1 7.5 6" />
    </Svg>
  )
}

// Meu bairro: duas casinhas.
export function IconeBairro({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M2.5 20.5h19" />
      <path d="M4 20.5V11l5-4 5 4v9.5" />
      <path d="M14 13.5l3.5-3 3.5 3v7" />
      <path d="M7.5 20.5v-4h3v4" />
    </Svg>
  )
}

export function IconeLapis({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </Svg>
  )
}

export function IconeSair({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </Svg>
  )
}

export function IconeLixeira({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
    </Svg>
  )
}

export function IconePredio({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M5 20.5V4.5h9v16M14 9.5h5v11M3 20.5h18" />
      <path d="M8 8h3M8 11.5h3M8 15h3M16.5 13h.01M16.5 16.5h.01" />
    </Svg>
  )
}

// Servidor público: o escudo com o visto.
export function IconeEscudo({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M12 3.5 19 6v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Svg>
  )
}

export function IconeMapa({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </Svg>
  )
}

// Mão com o indicador esticado, para os gestos do tour.
export function IconeMao({ tamanho = 24 }: Icone) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M12 9.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 10.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.6-2.2L3.6 15.7a1.5 1.5 0 0 1 2.3-1.9L9 17" />
      <path d="M9 11v6" />
    </Svg>
  )
}
