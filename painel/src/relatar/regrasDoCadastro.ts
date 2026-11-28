// Regras puras do cadastro do morador, do perfil e do "Meu bairro": sem DOM,
// para testar no Node.

import { LIMITE_TEXTO } from './logica'
import type { Recente, Status } from './logica'

export type TipoDeMorador = 'pf' | 'pj' | 'servidor'

export const TIPOS_DE_MORADOR: readonly { id: TipoDeMorador; nome: string }[] = [
  { id: 'pf', nome: 'Pessoa física' },
  { id: 'pj', nome: 'Empresa' },
  { id: 'servidor', nome: 'Servidor público' },
]

export function ehTipoDeMorador(v: unknown): v is TipoDeMorador {
  return v === 'pf' || v === 'pj' || v === 'servidor'
}

export function nomeDoTipo(tipo: TipoDeMorador): string {
  return TIPOS_DE_MORADOR.find((t) => t.id === tipo)?.nome ?? 'Pessoa física'
}

// Empresa usa CNPJ; pessoa física e servidor usam CPF.
export function nomeDoDocumento(tipo: TipoDeMorador): 'CPF' | 'CNPJ' {
  return tipo === 'pj' ? 'CNPJ' : 'CPF'
}

export function tamanhoDoDocumento(tipo: TipoDeMorador): number {
  return tipo === 'pj' ? 14 : 11
}

export function somenteDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

// Máscara enquanto a pessoa digita: 123.456.789-01, sem pontuação sobrando.
export function mascararCpf(entrada: string): string {
  const d = somenteDigitos(entrada).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

// 12.345.678/0001-90
export function mascararCnpj(entrada: string): string {
  const d = somenteDigitos(entrada).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function mascararDocumento(tipo: TipoDeMorador, entrada: string): string {
  return tipo === 'pj' ? mascararCnpj(entrada) : mascararCpf(entrada)
}

const repetido = (d: string) => /^(\d)\1*$/.test(d)

// Dígitos verificadores do CPF (módulo 11).
export function validarCpf(entrada: string): boolean {
  const d = somenteDigitos(entrada)
  if (d.length !== 11 || repetido(d)) return false
  const digito = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

// Dígitos verificadores do CNPJ (pesos 5..2, 9..2).
export function validarCnpj(entrada: string): boolean {
  const d = somenteDigitos(entrada)
  if (d.length !== 14 || repetido(d)) return false
  const digito = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * pesos[i]
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13])
}

export function validarDocumento(tipo: TipoDeMorador, entrada: string): boolean {
  return tipo === 'pj' ? validarCnpj(entrada) : validarCpf(entrada)
}

// Frase curta do problema no documento; null quando está certo.
export function erroDoDocumento(tipo: TipoDeMorador, entrada: string): string | null {
  const nome = nomeDoDocumento(tipo)
  const d = somenteDigitos(entrada)
  if (d.length === 0) return `Digite o ${nome}.`
  if (d.length < tamanhoDoDocumento(tipo)) return `O ${nome} tem ${tamanhoDoDocumento(tipo)} números.`
  if (!validarDocumento(tipo, d)) return `Este ${nome} não existe. Confira os números.`
  return null
}

export interface FormularioDoCadastro {
  tipo: TipoDeMorador
  nome: string
  documento: string
  profissao: string
  bairro: string
  aceite: boolean
  // Onde a pessoa mora (opcionais): CEP e o município escolhido na busca.
  cep?: string
  municipio?: { nome: string; uf: string; ibge: string } | null
}

export interface ErrosDoCadastro {
  nome?: string
  documento?: string
  aceite?: string
}

export const LIMITE_NOME = 120
export const LIMITE_CAMPO = 80

export function errosDoCadastro(f: FormularioDoCadastro): ErrosDoCadastro {
  const erros: ErrosDoCadastro = {}
  if (f.nome.trim().length < 2) erros.nome = f.tipo === 'pj' ? 'Escreva o nome da empresa.' : 'Escreva seu nome.'
  const doc = erroDoDocumento(f.tipo, f.documento)
  if (doc) erros.documento = doc
  if (!f.aceite) erros.aceite = 'Marque a caixa para concordar.'
  return erros
}

export function temErro(e: ErrosDoCadastro): boolean {
  return Boolean(e.nome || e.documento || e.aceite)
}

const limpo = (s: string, limite: number) => s.trim().replace(/\s+/g, ' ').slice(0, limite)

// Corpo do POST /api/moradores. Opcional vazio fica de fora.
export function corpoDoCadastro(f: FormularioDoCadastro): Record<string, unknown> {
  const corpo: Record<string, unknown> = {
    tipo: f.tipo,
    nome: limpo(f.nome, LIMITE_NOME),
    documento: somenteDigitos(f.documento),
    aceite: f.aceite,
  }
  const profissao = limpo(f.profissao, LIMITE_CAMPO)
  const bairro = limpo(f.bairro, LIMITE_CAMPO)
  if (profissao) corpo.profissao = profissao
  if (bairro) corpo.bairro = bairro
  const cep = somenteDigitos(f.cep ?? '')
  if (cep.length === 8) corpo.cep = cep
  if (f.municipio) {
    corpo.municipio = f.municipio.nome
    corpo.uf = f.municipio.uf
    corpo.municipio_ibge = f.municipio.ibge
  }
  return corpo
}

// CEP com a máscara 00000-000 enquanto a pessoa digita.
export function mascararCep(bruto: string): string {
  const d = somenteDigitos(bruto).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// Corpo do PUT /api/eu: os três campos que a pessoa pode mudar.
export interface EdicaoDoPerfil {
  nome: string
  profissao: string
  bairro: string
  // Só vem quando a pessoa mexeu na cidade; null apaga a cidade e o CEP.
  municipio?: { nome: string; uf: string; ibge: string } | null
}

export function corpoDaEdicao(d: EdicaoDoPerfil): Record<string, unknown> {
  const corpo: Record<string, unknown> = { nome: limpo(d.nome, LIMITE_NOME), profissao: limpo(d.profissao, LIMITE_CAMPO), bairro: limpo(d.bairro, LIMITE_CAMPO) }
  if (d.municipio !== undefined) {
    corpo.moradia = d.municipio ? { municipio: d.municipio.nome, uf: d.municipio.uf, municipio_ibge: d.municipio.ibge } : {}
  }
  return corpo
}

export interface Morador {
  id: string
  tipo: TipoDeMorador
  nome: string
  documento_mascarado: string
  profissao: string | null
  bairro: string | null
  cep: string | null
  municipio: string | null
  uf: string | null
  criado_em: string
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

export function lerMorador(bruto: unknown): Morador | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const b = bruto as Record<string, unknown>
  const nome = texto(b.nome)
  if (!nome) return null
  return {
    id: typeof b.id === 'string' || typeof b.id === 'number' ? String(b.id) : '',
    tipo: ehTipoDeMorador(b.tipo) ? b.tipo : 'pf',
    nome,
    documento_mascarado: texto(b.documento_mascarado) ?? '',
    profissao: texto(b.profissao),
    bairro: texto(b.bairro),
    cep: texto(b.cep),
    municipio: texto(b.municipio),
    uf: texto(b.uf),
    criado_em: texto(b.criado_em) ?? '',
  }
}

export type FalhaDoCadastro =
  | 'documento_invalido'
  | 'nome_invalido'
  | 'aceite_obrigatorio'
  | 'documento_cadastrado'
  | 'muitos_envios'
  | 'sem_conexao'
  | 'desconhecido'

// Resposta do POST /api/moradores. Só o 201 traz token e o código de
// recuperação; documento já cadastrado volta 409, sem nada da conta (issue #26).
export function interpretarCadastro(
  status: number,
  corpo: unknown,
): { token: string; morador: Morador; codigo: string | null } | { falha: FalhaDoCadastro } {
  const d = typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : {}
  if (status === 201) {
    const token = texto(d.token)
    const morador = lerMorador(d.morador)
    // Sem o módulo de recuperação, o servidor não manda código.
    const codigo = texto(d.codigo_recuperacao) || null
    return token && morador ? { token, morador, codigo } : { falha: 'desconhecido' }
  }
  if (status === 0) return { falha: 'sem_conexao' }
  if (status === 409 || d.codigo === 'documento_cadastrado') return { falha: 'documento_cadastrado' }
  if (d.codigo === 'documento_invalido' || d.codigo === 'nome_invalido' || d.codigo === 'aceite_obrigatorio') return { falha: d.codigo }
  if (status === 429) return { falha: 'muitos_envios' }
  return { falha: 'desconhecido' }
}

// Código de recuperação: 12 letras e números em três grupos, ABCD-EFGH-JKMN.
// Sem 0, O, 1, I e L, que se confundem ao anotar.
const ALFABETO_DO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function mascararCodigo(entrada: string): string {
  const c = [...entrada.toUpperCase()].filter((x) => ALFABETO_DO_CODIGO.includes(x)).join('').slice(0, 12)
  return c.match(/.{1,4}/g)?.join('-') ?? ''
}

export function codigoCompleto(entrada: string): boolean {
  return mascararCodigo(entrada).length === 14
}

// O campo de entrar aceita CPF ou CNPJ: a máscara segue a quantidade de números.
export function mascararCpfOuCnpj(entrada: string): string {
  return somenteDigitos(entrada).length > 11 ? mascararCnpj(entrada) : mascararCpf(entrada)
}

export function documentoDeEntrada(entrada: string): boolean {
  const d = somenteDigitos(entrada)
  return d.length === 11 ? validarCpf(d) : d.length === 14 && validarCnpj(d)
}

export type FalhaDaEntrada = 'credenciais_invalidas' | 'muitos_envios' | 'sem_conexao' | 'desconhecido'

// Resposta do POST /api/moradores/entrar. Documento sem cadastro e código
// errado dão o mesmo 401, de propósito.
export function interpretarEntrada(status: number, corpo: unknown): { token: string; morador: Morador } | { falha: FalhaDaEntrada } {
  const d = typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : {}
  if (status === 200) {
    const token = texto(d.token)
    const morador = lerMorador(d.morador)
    return token && morador ? { token, morador } : { falha: 'desconhecido' }
  }
  if (status === 0) return { falha: 'sem_conexao' }
  if (status === 401) return { falha: 'credenciais_invalidas' }
  if (status === 429) return { falha: 'muitos_envios' }
  return { falha: 'desconhecido' }
}

export function mensagemDaEntrada(f: FalhaDaEntrada): string {
  switch (f) {
    case 'credenciais_invalidas':
      return 'Documento ou código não conferem. Depois de 5 erros, espere 15 minutos.'
    case 'muitos_envios':
      return 'Muitas tentativas em pouco tempo. Espere alguns minutos.'
    case 'sem_conexao':
      return 'Sem internet agora. Confira o sinal e tente de novo.'
    default:
      return 'Não deu para entrar agora. Tente de novo.'
  }
}

export function mensagemDoCadastro(f: FalhaDoCadastro, tipo: TipoDeMorador, recuperacao = true): string {
  switch (f) {
    case 'documento_invalido':
      return `Este ${nomeDoDocumento(tipo)} não existe. Confira os números.`
    case 'nome_invalido':
      return tipo === 'pj' ? 'Escreva o nome da empresa.' : 'Escreva seu nome.'
    case 'aceite_obrigatorio':
      return 'Marque a caixa para concordar.'
    case 'documento_cadastrado':
      return recuperacao
        ? `Este ${nomeDoDocumento(tipo)} já tem cadastro. Entre com o seu código de recuperação.`
        : `Este ${nomeDoDocumento(tipo)} já tem cadastro em outro celular. Peça à prefeitura para liberar e cadastre de novo.`
    case 'muitos_envios':
      return 'Muitas tentativas em pouco tempo. Espere alguns minutos.'
    case 'sem_conexao':
      return 'Sem internet agora. Confira o sinal e tente de novo.'
    default:
      return 'Não deu para criar o cadastro agora. Tente de novo.'
  }
}

// Histórico do morador, de GET /api/eu/relatos.

const STATUS: readonly Status[] = ['a_classificar', 'revisao', 'aberta', 'em_atendimento', 'resolvida']

export interface RelatoDoMorador {
  protocolo: string
  categoria: string
  categoria_nome: string
  status: Status
  nivel: number | null
  criado_em: string
  resolvido_em: string | null
  chave: string | null
}

export interface MeusRelatos {
  total: number
  resolvidos: number
  tempo_medio_horas: number | null
  relatos: RelatoDoMorador[]
}

const contagem = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

export function lerMeusRelatos(bruto: unknown): MeusRelatos | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const b = bruto as Record<string, unknown>
  const relatos = Array.isArray(b.relatos)
    ? b.relatos
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && texto((r as Record<string, unknown>).protocolo) !== null)
        .map((r) => ({
          protocolo: r.protocolo as string,
          categoria: texto(r.categoria) ?? 'outros',
          categoria_nome: texto(r.categoria_nome) ?? '',
          status: STATUS.includes(r.status as Status) ? (r.status as Status) : 'a_classificar',
          nivel: typeof r.nivel === 'number' ? r.nivel : null,
          criado_em: texto(r.criado_em) ?? '',
          resolvido_em: texto(r.resolvido_em),
          chave: texto(r.chave),
        }))
    : []
  const tempo = b.tempo_medio_horas
  return {
    total: Math.max(contagem(b.total), relatos.length),
    resolvidos: contagem(b.resolvidos),
    tempo_medio_horas: typeof tempo === 'number' && Number.isFinite(tempo) && tempo >= 0 ? tempo : null,
    relatos,
  }
}

// "5 h", "1 dia", "3 dias"; sem resolvidos ainda, "Ainda não".
export function tempoMedio(horas: number | null): string {
  if (horas === null) return 'Ainda não'
  if (horas < 24) return `${Math.max(1, Math.round(horas))} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? '1 dia' : `${dias} dias`
}

// "hoje", "ontem", "há 5 dias".
export function haQuanto(iso: string, agora: Date): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((dia(agora) - dia(new Date(t))) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

// O relato do servidor vira um "recente": a folha do andamento acha a chave
// por ele. Sem ponto: ele só entra no mapa se o aparelho guardou o lugar.
export function recenteDoServidor(r: RelatoDoMorador): Recente {
  return {
    protocolo: r.protocolo,
    nivel: r.nivel,
    criado_em: r.criado_em,
    chave: r.chave,
    status: r.status,
    lat: null,
    lng: null,
    categoria: r.categoria || null,
  }
}

// Atualiza os relatos guardados no aparelho com o que o servidor sabe
// (nível, status e a chave que faltava), sem perder o lugar do pino.
export function atualizarRecentes(lista: readonly Recente[], doServidor: readonly RelatoDoMorador[]): Recente[] {
  return lista.map((r) => {
    const s = doServidor.find((x) => x.protocolo === r.protocolo)
    if (!s) return r
    return { ...r, nivel: s.nivel, status: s.status, chave: r.chave ?? s.chave, categoria: r.categoria ?? (s.categoria || null) }
  })
}

// Lista que a folha do andamento consulta: os do aparelho e, depois, os
// que vieram de outro aparelho.
export function unirRelatos(lista: readonly Recente[], doServidor: readonly RelatoDoMorador[]): Recente[] {
  const novos = doServidor.filter((s) => !lista.some((r) => r.protocolo === s.protocolo)).map(recenteDoServidor)
  return [...atualizarRecentes(lista, doServidor), ...novos]
}

// "Meu bairro", de GET /api/comunidade.

export interface ItemDaComunidade {
  categoria: string
  categoria_nome: string
  resolvido_em: string
  foto_depois_url: string | null
  distancia_m: number
}

export interface Comunidade {
  raio_m: number
  resolvidos_30d: number
  abertos: number
  bairro: string | null
  itens: ItemDaComunidade[]
}

export function lerComunidade(bruto: unknown): Comunidade | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const b = bruto as Record<string, unknown>
  const itens = Array.isArray(b.itens)
    ? b.itens
        .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null && typeof (i as Record<string, unknown>).categoria === 'string')
        .map((i) => ({
          categoria: i.categoria as string,
          categoria_nome: texto(i.categoria_nome) ?? '',
          resolvido_em: texto(i.resolvido_em) ?? '',
          foto_depois_url: texto(i.foto_depois_url),
          distancia_m: typeof i.distancia_m === 'number' && Number.isFinite(i.distancia_m) ? Math.max(0, i.distancia_m) : 0,
        }))
    : []
  return {
    raio_m: contagem(b.raio_m),
    resolvidos_30d: Math.max(contagem(b.resolvidos_30d), itens.length),
    abertos: contagem(b.abertos),
    bairro: texto(b.bairro),
    itens,
  }
}

export function fraseDosResolvidos(n: number): string {
  return n === 1
    ? '1 problema resolvido perto de você nos últimos 30 dias'
    : `${n} problemas resolvidos perto de você nos últimos 30 dias`
}

// Três sugestões rápidas por tipo; sem tipo, frases que servem para todos.
const SUGESTOES: Record<string, readonly [string, string, string]> = {
  agua: ['Cano estourado', 'Vazamento', 'Esgoto'],
  iluminacao: ['Lâmpada apagada', 'Acesa de dia', 'Poste caído'],
  vias: ['Buraco grande', 'Asfalto afundou', 'Bueiro aberto'],
  limpeza: ['Lixo acumulado', 'Entulho', 'Mato alto'],
  arvores: ['Árvore caída', 'Galho perigoso', 'Precisa de poda'],
  sinalizacao: ['Placa caída', 'Semáforo apagado', 'Faixa apagada'],
  calcadas: ['Calçada quebrada', 'Buraco na calçada', 'Sem rampa'],
  animais: ['Animal ferido', 'Animal morto', 'Cão solto'],
}
const SUGESTOES_GERAIS: readonly [string, string, string] = ['Está perigoso', 'Faz muitos dias', 'Perto de escola']

export function sugestoesDoTipo(categoria: string | null): readonly string[] {
  return (categoria && SUGESTOES[categoria]) || SUGESTOES_GERAIS
}

// Junta a sugestão tocada ao texto, sem repetir o que já está lá.
export function juntarSugestao(atual: string, sugestao: string): string {
  const novo = sugestao.trim()
  if (!novo) return atual
  if (atual.toLocaleLowerCase('pt-BR').includes(novo.toLocaleLowerCase('pt-BR'))) return atual
  const base = atual.trimEnd()
  if (!base) return novo.slice(0, LIMITE_TEXTO)
  const junta = /[.!?,;:]$/.test(base) ? ' ' : ', '
  return `${base}${junta}${novo.toLocaleLowerCase('pt-BR')}`.slice(0, LIMITE_TEXTO)
}
