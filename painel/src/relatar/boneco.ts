// O boneco do mapa é escolhido pela pessoa, no Perfil: criança, adulto ou
// idoso, menino ou menina, e o tom de pele. A escolha fica só neste aparelho
// e nunca vai ao servidor: o MOGI não pede sexo nem idade (ADR 0024).

export type EstiloDoBoneco = 'homem' | 'mulher' | 'menino' | 'menina' | 'senhor' | 'senhora'
export type TomDePele = 'claro' | 'medio' | 'escuro'

export interface Aparencia {
  estilo: EstiloDoBoneco
  tom: TomDePele
}

export const ESTILOS: readonly { id: EstiloDoBoneco; nome: string }[] = [
  { id: 'homem', nome: 'Homem' },
  { id: 'mulher', nome: 'Mulher' },
  { id: 'menino', nome: 'Menino' },
  { id: 'menina', nome: 'Menina' },
  { id: 'senhor', nome: 'Senhor' },
  { id: 'senhora', nome: 'Senhora' },
]

export const TONS: readonly { id: TomDePele; nome: string; cor: string }[] = [
  { id: 'claro', nome: 'Pele clara', cor: '#F6DCC0' },
  { id: 'medio', nome: 'Pele morena', cor: '#C98E5F' },
  { id: 'escuro', nome: 'Pele negra', cor: '#7A4A2C' },
]

export const PADRAO: Aparencia = { estilo: 'homem', tom: 'claro' }
export const CHAVE_BONECO = 'mogi.boneco'

export function corDaPele(tom: TomDePele): string {
  return TONS.find((t) => t.id === tom)?.cor ?? TONS[0].cor
}

export const ehCrianca = (e: EstiloDoBoneco) => e === 'menino' || e === 'menina'
export const ehIdoso = (e: EstiloDoBoneco) => e === 'senhor' || e === 'senhora'
export const ehFeminino = (e: EstiloDoBoneco) => e === 'mulher' || e === 'menina' || e === 'senhora'

// Lê o que está guardado; qualquer coisa estranha volta ao padrão.
export function lerAparencia(bruto: string | null): Aparencia {
  if (!bruto) return PADRAO
  try {
    const d = JSON.parse(bruto) as Partial<Aparencia>
    const estilo = ESTILOS.some((e) => e.id === d.estilo) ? (d.estilo as EstiloDoBoneco) : PADRAO.estilo
    const tom = TONS.some((t) => t.id === d.tom) ? (d.tom as TomDePele) : PADRAO.tom
    return { estilo, tom }
  } catch {
    return PADRAO
  }
}

export function gravarAparencia(a: Aparencia): string {
  return JSON.stringify({ estilo: a.estilo, tom: a.tom })
}

// O cadastro pergunta sexo e faixa de idade (opcionais) só para escolher o
// boneco. As respostas ficam neste aparelho, como o próprio boneco.
export type Sexo = 'feminino' | 'masculino'
export type FaixaDeIdade = 'ate17' | 'adulto' | '60mais'

export const SEXOS: readonly { id: Sexo | null; nome: string }[] = [
  { id: 'feminino', nome: 'Feminino' },
  { id: 'masculino', nome: 'Masculino' },
  { id: null, nome: 'Prefiro não dizer' },
]

export const FAIXAS: readonly { id: FaixaDeIdade; nome: string }[] = [
  { id: 'ate17', nome: 'Até 17 anos' },
  { id: 'adulto', nome: '18 a 59 anos' },
  { id: '60mais', nome: '60 anos ou mais' },
]

// Sem sexo informado, o boneco fica o padrão (null: não muda nada).
// Sem idade, vale adulto.
export function estiloPorPerfil(sexo: Sexo | null, faixa: FaixaDeIdade | null): EstiloDoBoneco | null {
  if (!sexo) return null
  const f = faixa ?? 'adulto'
  if (sexo === 'feminino') return f === 'ate17' ? 'menina' : f === '60mais' ? 'senhora' : 'mulher'
  return f === 'ate17' ? 'menino' : f === '60mais' ? 'senhor' : 'homem'
}
