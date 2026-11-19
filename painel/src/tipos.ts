// Espelha a resposta do backend Go (backend/internal/ocorrencias).

export type Status = 'a_classificar' | 'revisao' | 'aberta' | 'em_atendimento' | 'resolvida'

export type Distribuicao = [number, number, number, number, number]

export interface Etapa {
  etapa: string
  provedor?: string
  ms: number
  custo_brl: number
  tokens_entrada: number
  tokens_saida: number
  ok: boolean
  erro?: string
}

// O que o agente de contexto recuperou e as funções que a IA chamou (ADR 0023).
export interface ContextoDaTriagem {
  orientacoes?: { categoria: string; titulo: string; texto: string }[]
  casos?: { protocolo: string; categoria: string; resumo: string; bairro?: string; status: string; nivel?: number; dias: number; distancia_m?: number }[]
  ferramentas?: { nome: string; argumentos?: Record<string, unknown>; resultado: string; ms: number; erro?: string }[]
}

export interface Triagem {
  contexto?: ContextoDaTriagem
  descricao?: { categoria: string; resumo: string; sinais_visiveis: string[] | null; foto_util: boolean; provedor: string }
  classificacao?: {
    categoria: string
    secretaria: string
    sinais: Record<string, number>
    g: Distribuicao
    u: Distribuicao
    t: Distribuicao
    confianca: number
    provedor: string
    // Probabilidade de o relato mostrar mesmo um problema urbano; só vem com a visão.
    problema_urbano?: number
  }
  gut_esperada: number
  gut_p90: number
  regra?: { nivel: number; motivo: string; script: string }
  motivo: string
  revisao: boolean
  latencia_ms: number
  falha?: string
  relatos?: number
}

export interface Relato {
  id: string
  texto: string | null
  lat: number
  lng: number
  criado_em: string
  // "tambem_vi" é a confirmação de quem passou perto: não traz texto nem foto.
  tipo?: 'relato' | 'tambem_vi'
  midia_url?: string
  // Quem enviou (ADR 0024), com o documento mascarado; nulo na demonstração
  // e para a equipe de campo.
  morador?: { nome: string; tipo: string; documento_mascarado: string; profissao: string | null } | null
}

// Mídia de um relato. "quadro" é um quadro borrado tirado do vídeo e serve de
// capa. O vídeo original não é borrado: vem sem url e só abre pela rota de
// abertura, que registra quem viu.
export interface Midia {
  id: string
  // De qual relato veio; null na foto do depois, que é da equipe.
  relato_id: string | null
  tipo: 'foto' | 'quadro' | 'video' | 'depois'
  mime: string
  ordem: number
  largura: number | null
  altura: number | null
  duracao_ms: number | null
  criado_em: string
  url?: string
  // false: a original já foi apagada pela retenção de 90 dias.
  disponivel: boolean
}

// Passo do histórico do chamado. "dados" muda com o tipo: nivel na revisão,
// observacao e secretaria no despacho, motivo na resolução, na reabertura e no
// "não encontrei", midia no vídeo aberto.
export interface Evento {
  tipo: string
  autor: string | null
  dados: Record<string, unknown>
  criado_em: string
}

export interface Ocorrencia {
  id: string
  protocolo: string
  categoria: string
  secretaria: string | null
  texto: string | null
  lat: number
  lng: number
  precisao_m: number | null
  h3: string | null
  endereco: string | null
  bairro: string | null
  status: Status
  nivel: number | null
  nivel_ia: number | null
  relatos: number
  triagem: Triagem | null
  prazo_ate: string | null
  prazo_fonte: string | null
  revisado_por: string | null
  revisado_em: string | null
  despachado_por: string | null
  despachado_em: string | null
  resolvido_por: string | null
  resolvido_em: string | null
  custo_brl: number
  latencia_ms: number | null
  demo: boolean
  criado_em: string
  atualizado_em: string
  midia_url?: string
  midias?: Midia[]
  relatos_lista?: Relato[]
  etapas?: Etapa[]
  eventos?: Evento[]
}

export interface EventoAoVivo {
  tipo: 'Conectado' | 'Ressincronizar' | 'OcorrenciaCriada' | 'OcorrenciaAtualizada'
  ocorrencia?: Ocorrencia
}

export interface Usuario {
  login: string
  papel: 'operador' | 'gestor' | 'campo' | 'prefeito'
  nome?: string
  secretaria?: string
}

export interface Contagem {
  chave: string
  n: number
}

export interface Indicadores {
  dias: number
  desde: string
  so_reais: boolean
  total: number
  simulados: number
  relatos: number
  agrupados: number
  por_status: Contagem[]
  por_nivel: Contagem[]
  por_categoria: Contagem[]
  por_dia: Contagem[]
  resposta: {
    nivel: number
    chamados: number
    resolvidos: number
    no_prazo: number
    com_prazo: number
    min_ate_despacho: number | null
    min_ate_resolucao: number | null
  }[]
  acerto: { revisados: number; exatos: number; ate_1_nivel: number; subiu: number; desceu: number }
  triagem: {
    latencia_media_ms: number | null
    latencia_p95_ms: number | null
    custo_medio_brl: number | null
    custo_total_brl: number
    a_classificar: number
    meta_latencia_ms: number
    meta_custo_brl: number
  }
  etapas: {
    etapa: string
    provedor: string
    chamadas: number
    falhas: number
    media_ms: number
    p95_ms: number
    custo_brl: number
  }[]
}

export interface Regra {
  arquivo: string
  conteudo: string
}

export interface Simulado {
  cenario: string
  categoria: string
  texto: string
  nivel: number
  motivo: string
  script: string
  erro?: string
}

export interface Categoria {
  id: string
  nome: string
  secretaria: string
}
