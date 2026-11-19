// Identidade do MOGI: claro, sobre creme, para ler na rua com sol forte.
export const cores = {
  creme: '#F5F1E8',
  creme2: '#EBE4D3',
  papel: '#FFFDF7',
  cafezal: '#1F4D2B',
  cafezalFundo: '#12301A',
  folha: '#3E7B3A',
  ipe: '#E9B526',
  ipeFundo: '#B98A0E',
  cereja: '#B3261E',
  cerejaFundo: '#7D1711',
  cerejaClaro: '#FBE9E7',
  cafe: '#4A2C1D',
  ceu: '#3B6EA5',
  aviso: '#FDF3D0',
  branco: '#FFFFFF',
  apagado: '#8A7A6C',
  veu: 'rgba(18, 48, 26, 0.55)',
} as const

// Texto base de 18 pt; nada abaixo de 16.
export const letra = { base: 18, menor: 16, maior: 22, titulo: 26 } as const

export const raio = 20

// Alvo de toque mínimo e o dos botões de canto.
export const toque = { minimo: 48, canto: 56 } as const

export const sombra = {
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 6,
} as const

export const cheio = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const
