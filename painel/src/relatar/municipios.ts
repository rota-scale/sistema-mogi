// Busca de cidade do cadastro: os 5.570 municípios do IBGE, procurados sem
// acento, com prioridade para o começo das palavras e tolerância a um erro de
// digitação. A lista (municipios.json) só carrega quando o campo abre.

export interface Municipio {
  nome: string
  uf: string
  ibge: string
}

export const rotulo = (m: Municipio) => `${m.nome} - ${m.uf}`

export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function lerLista(bruto: readonly string[]): Municipio[] {
  const out: Municipio[] = []
  for (const linha of bruto) {
    const p = linha.split(';')
    if (p.length === 3 && p[0] && /^[A-Z]{2}$/.test(p[1]) && /^\d{7}$/.test(p[2])) out.push({ nome: p[0], uf: p[1], ibge: p[2] })
  }
  return out
}

let cache: Promise<Municipio[]> | null = null
export function carregarMunicipios(): Promise<Municipio[]> {
  cache ??= import('./municipios.json').then((m) => lerLista(m.default as string[]))
  return cache
}

// Distância de edição limitada a 1: a palavra digitada bate com o começo de
// uma palavra do nome, com no máximo uma letra trocada, sobrando ou faltando.
function quaseComeca(palavra: string, termo: string): boolean {
  for (const n of [termo.length - 1, termo.length, termo.length + 1]) {
    if (n < 1 || n > palavra.length) continue
    if (ate1(palavra.slice(0, n), termo)) return true
  }
  return false
}

function ate1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let erros = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++erros > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return erros + (a.length - i) + (b.length - j) <= 1
}

// Pontua o quanto o nome combina com o que foi digitado; 0 é "não combina".
function pontuar(nome: string, termos: string[]): number {
  const palavras = nome.split(' ')
  let total = 0
  for (const t of termos) {
    if (palavras.some((p) => p === t)) total += 4
    else if (palavras.some((p) => p.startsWith(t))) total += 3
    else if (nome.includes(t)) total += 1
    else if (t.length >= 4 && palavras.some((p) => quaseComeca(p, t))) total += 1
    else return 0
  }
  if (nome.startsWith(termos.join(' '))) total += 2
  return total
}

// Devolve até `limite` municípios. "preferidas" (código IBGE da cidade da
// prefeitura e a do GPS) sobem no empate. Um "uf" no fim ("curitiba pr") filtra.
export function buscarMunicipio(texto: string, lista: readonly Municipio[], preferidas: readonly string[] = [], limite = 6): Municipio[] {
  let termos = normalizar(texto).split(' ').filter(Boolean)
  // Menos de 2 letras não busca: a lista não abre sugerindo cidade nenhuma.
  if (termos.join('').length < 2) return []
  let uf: string | null = null
  const ultimo = termos[termos.length - 1]
  if (termos.length > 1 && ultimo.length === 2 && lista.some((m) => m.uf.toLowerCase() === ultimo)) {
    uf = ultimo.toUpperCase()
    termos = termos.slice(0, -1)
  }
  const achados: { m: Municipio; p: number }[] = []
  for (const m of lista) {
    if (uf && m.uf !== uf) continue
    const p = pontuar(normalizar(m.nome), termos)
    // A cidade do GPS só desempata entre as que já combinam com o texto.
    if (p > 0) achados.push({ m, p: p + (preferidas.includes(m.ibge) ? 0.5 : 0) })
  }
  achados.sort((a, b) => b.p - a.p || a.m.nome.length - b.m.nome.length || a.m.nome.localeCompare(b.m.nome, 'pt-BR'))
  return achados.slice(0, limite).map((a) => a.m)
}

// Acha o município pelo nome e UF que vieram do GPS ou do CEP.
export function acharMunicipio(nome: string, uf: string, lista: readonly Municipio[]): Municipio | null {
  const n = normalizar(nome)
  return lista.find((m) => m.uf === uf.toUpperCase() && normalizar(m.nome) === n) ?? lista.find((m) => normalizar(m.nome) === n && !uf) ?? null
}
