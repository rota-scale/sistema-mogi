// Guia de primeiro uso da prefeitura: operador, gestor e equipe de campo.
// Regras puras, sem DOM, para testar no Node. O componente Guia.tsx procura
// cada alvo pelo seletor CSS e ilumina a área.

export type PapelDoGuia = 'operador' | 'gestor' | 'campo'

export interface PassoDoGuia {
  // Seletor CSS do que é iluminado; null: um cartão no meio da tela.
  alvo: string | null
  titulo: string
  frase: string
}

const CENTRAL: readonly PassoDoGuia[] = [
  { alvo: null, titulo: 'Bem-vindo à central do MOGI', frase: 'Os avisos dos moradores chegam aqui, com foto e lugar no mapa. Vamos ver em 1 minuto.' },
  { alvo: '.fila .abas', titulo: 'A fila', frase: 'Comece por "Para conferir". O mais urgente fica sempre em cima.' },
  { alvo: '.area-mapa', titulo: 'O mapa', frase: 'Cada pino é um aviso. A cor e a forma mostram a urgência.' },
  { alvo: '.urgencia', titulo: 'Filtrar pela urgência', frase: 'Toque numa urgência para ver só ela no mapa.' },
  { alvo: '.busca', titulo: 'Buscar', frase: 'Procure por rua, bairro, protocolo ou palavra.' },
]

const SO_GESTOR: readonly PassoDoGuia[] = [
  { alvo: 'nav.telas', titulo: 'Gestão', frase: 'Em Indicadores, o que foi resolvido e em quanto tempo. Em Administração, prazos, usuários e regras.' },
]

const FECHO_DA_CENTRAL: PassoDoGuia = {
  alvo: null,
  titulo: 'O dia a dia',
  frase: 'Abra um aviso, confira a foto e toque em "Sim, confirmar" e depois em "Mandar equipe". O resto o MOGI faz.',
}

const CAMPO: readonly PassoDoGuia[] = [
  { alvo: null, titulo: 'Bem-vindo, equipe', frase: 'Aqui chegam só os chamados da sua secretaria, com foto e o lugar no mapa.' },
  { alvo: '.abas', titulo: 'Seus chamados', frase: '"Para atender" é o que falta fazer. "Feitos hoje" é o que você já resolveu.' },
  { alvo: '.topo-acoes', titulo: 'Atualizar', frase: 'Quando chega um chamado, o celular toca. Se quiser, toque em Atualizar.' },
  { alvo: null, titulo: 'Resolver', frase: 'No local, abra o chamado, tire a foto do serviço feito e toque em "Resolvi".' },
]

export function passosDoGuia(papel: PapelDoGuia, celular: boolean): PassoDoGuia[] {
  if (papel === 'campo') return [...CAMPO]
  // No celular, as telas do gestor ficam no menu, não na barra do alto.
  const gestao = papel === 'gestor' && !celular ? SO_GESTOR : []
  return [...CENTRAL, ...gestao, FECHO_DA_CENTRAL]
}

export const chaveDoGuia = (papel: PapelDoGuia) => `mogi.guia.${papel}`

export function papelDoGuia(papel: string | null | undefined): PapelDoGuia | null {
  return papel === 'operador' || papel === 'gestor' || papel === 'campo' ? papel : null
}

export function guiaVisto(papel: PapelDoGuia, ler: (k: string) => string | null): boolean {
  try {
    return ler(chaveDoGuia(papel)) === 'visto'
  } catch {
    // Sem armazenamento: não insiste em mostrar a cada tela.
    return true
  }
}
