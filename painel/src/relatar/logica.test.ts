import { describe, expect, it } from 'vitest'
import { montarCorpo } from './envio'
import {
  acaoDoErro,
  anuncioDaGravacao,
  apoioDasFotos,
  AVISO_DO_VIDEO,
  avisoDaCamera,
  avisoDoDefeito,
  avisoDoLocal,
  CAMERA_FALHOU,
  CAMERA_PAROU,
  defeitoDoVideo,
  duracaoPorExtenso,
  escolherQuadros,
  extensaoDoVideo,
  formatarDuracao,
  instantesDosQuadros,
  intervaloDosQuadros,
  lerMidia,
  MIDIA_PADRAO,
  oQueVai,
  prazoDeEnvio,
  rotuloDoEnvio,
  rotuloDoVideo,
  segundosRestantes,
  SEM_CAMERA,
  SEM_GRAVACAO,
  tipoDeGravacao,
  TIPOS_DE_VIDEO,
  tipoSemCodec,
  vagasDeFoto,
  VIDEO_MINIMO_MS,
  camposDoRelato,
  categoriaEfetiva,
  CENTRO_PADRAO,
  codigoDoErro,
  CONFIG_PADRAO,
  corDoNivel,
  dimensoesReduzidas,
  ehUuid,
  escolhaAposConfig,
  formatarDataHora,
  formatarDistancia,
  formatarPrazo,
  FOTO_ILEGIVEL,
  fotoCabe,
  GRAVADOR_NAO_ABRIU,
  interpretarEnvio,
  juntarFala,
  lerConfig,
  lerRecentes,
  LIMITE_FOTO_BYTES,
  LIMITE_PRECISAO,
  LIMITE_TEXTO,
  linhaDeLocal,
  linhaDePrecisao,
  linhaDeStatus,
  melhorPosicao,
  mensagemDeErro,
  mesclarRecentes,
  NIVEIS,
  nomeDoNivel,
  oQueFalta,
  pedeMapa,
  podeEnviar,
  porcentagem,
  posicaoEscolhida,
  posicaoManual,
  precisaoAceita,
  recenteDaResposta,
  rotuloDoNivel,
  situacaoDoLocal,
  suportaGravacao,
  textoDoProgresso,
  textoSobreNivel,
  tipoOpcional,
  uuidDeBytes,
  vistaInicialDoMapa,
} from './logica'
import type { CodigoDeErro, LimitesDeMidia, Posicao, Recente, Resposta } from './logica'

const FUSO = 'America/Sao_Paulo'
const praca: Posicao = { lat: -21.0793, lng: -47.0486, precisao: 12.4 }
// Limites que o servidor de hoje informa em /api/config.
const midia: LimitesDeMidia = { fotos_max: 4, foto_mb: 12, video: true, video_segundos: 15, video_mb: 25, quadros_max: 3 }

describe('níveis', () => {
  it('dá nome, cor e rótulo com número e nome', () => {
    expect(nomeDoNivel(1)).toBe('Não urgente')
    expect(nomeDoNivel(5)).toBe('Crítico')
    expect(corDoNivel(4)).toBe('#D9822B')
    expect(rotuloDoNivel(3)).toBe('Nível 3 · Urgente')
  })

  it('trata nível ausente ou fora da escala como a classificar', () => {
    expect(nomeDoNivel(null)).toBe('A classificar')
    expect(rotuloDoNivel(null)).toBe('A classificar')
    expect(rotuloDoNivel(9)).toBe('A classificar')
    expect(corDoNivel(null)).not.toBe(corDoNivel(1))
  })

  it('usa texto escuro nos níveis 3 e 4 e branco nos demais', () => {
    for (const n of NIVEIS) {
      const claro = textoSobreNivel(n.nivel) === '#FFFFFF'
      expect(claro).toBe(n.nivel !== 3 && n.nivel !== 4)
    }
  })
})

describe('prazo', () => {
  it('formata data e hora curtas em pt-BR', () => {
    expect(formatarPrazo('2026-11-13T17:30:00Z', FUSO)).toBe('13/11 às 14:30')
    expect(formatarPrazo('2026-01-05T03:05:00Z', FUSO)).toBe('05/01 às 00:05')
  })

  it('sem prazo ou com data inválida vira rotina da equipe', () => {
    expect(formatarPrazo(null)).toBe('rotina da equipe')
    expect(formatarPrazo('amanhã')).toBe('rotina da equipe')
  })

  it('formata data e hora dos relatos recentes', () => {
    expect(formatarDataHora('2026-11-12T17:30:00Z', FUSO)).toBe('12/11 às 14:30')
    expect(formatarDataHora('x')).toBe('')
  })
})

describe('confirmação', () => {
  it('avisa da conferência quando o relato vai para revisão', () => {
    expect(linhaDeStatus({ status: 'revisao', secretaria: 'Obras' })).toBe('Um servidor da prefeitura vai conferir agora.')
    expect(linhaDeStatus({ status: 'a_classificar', secretaria: null })).toBe(
      'Um servidor da prefeitura vai conferir agora.',
    )
  })

  it('diz que o chamado foi aberto, com a secretaria quando existe', () => {
    expect(linhaDeStatus({ status: 'aberta', secretaria: null })).toBe('Chamado aberto na secretaria responsável.')
    expect(linhaDeStatus({ status: 'aberta', secretaria: 'Obras e Serviços' })).toBe(
      'Chamado aberto na secretaria responsável: Obras e Serviços.',
    )
  })

  it('junta endereço e bairro', () => {
    expect(linhaDeLocal({ endereco: 'Rua A, 10', bairro: 'Centro' })).toBe('Rua A, 10 · Centro')
    expect(linhaDeLocal({ endereco: null, bairro: 'Centro' })).toBe('Centro')
    expect(linhaDeLocal({ endereco: null, bairro: null })).toBe('')
  })
})

describe('regra de envio', () => {
  const base = { fotos: 1, posicao: praca, categoria: 'vias', iaAtiva: false }

  it('exige foto, posição e categoria quando não há IA', () => {
    expect(podeEnviar(base)).toBe(true)
    expect(podeEnviar({ ...base, fotos: 0 })).toBe(false)
    expect(podeEnviar({ ...base, posicao: null })).toBe(false)
    expect(podeEnviar({ ...base, categoria: null })).toBe(false)
    expect(podeEnviar({ ...base, categoria: '' })).toBe(false)
  })

  it('com IA ativa aceita deixar a IA decidir', () => {
    expect(podeEnviar({ ...base, categoria: '', iaAtiva: true })).toBe(true)
    expect(podeEnviar({ ...base, categoria: 'agua', iaAtiva: true })).toBe(true)
  })

  it('explica o que falta', () => {
    expect(oQueFalta(base)).toBeNull()
    expect(oQueFalta({ ...base, posicao: null })).toBe('Falta a localização para enviar.')
    expect(oQueFalta({ ...base, categoria: null })).toBe('Toque no tipo de problema para enviar')
  })

  it('basta uma foto pronta, e espera a que ainda está sendo preparada', () => {
    expect(podeEnviar({ ...base, fotos: 4 })).toBe(true)
    expect(podeEnviar({ ...base, fotos: 2, preparando: true })).toBe(false)
    expect(oQueFalta({ ...base, fotos: 0 })).toBe('Falta a foto do problema.')
    expect(oQueFalta({ ...base, fotos: 0, preparando: true })).toBe('Preparando a foto…')
    expect(oQueFalta({ ...base, fotos: 2, preparando: true })).toBe('Preparando a foto…')
    expect(oQueFalta({ ...base, fotos: 3 })).toBeNull()
  })

  it('pede o mapa quando o GPS não serviu', () => {
    expect(oQueFalta({ ...base, posicao: null, pedeMapa: true })).toBe('Falta marcar o lugar no mapa.')
  })

  it('a IA só é escolha padrão quando está ativa', () => {
    expect(categoriaEfetiva(null, true)).toBe('')
    expect(categoriaEfetiva(null, false)).toBeNull()
    expect(categoriaEfetiva('vias', false)).toBe('vias')
    expect(categoriaEfetiva('', false)).toBeNull()
  })
})

describe('campos do formulário', () => {
  it('manda lat, lng, precisão, categoria e texto', () => {
    expect(camposDoRelato({ posicao: praca, categoria: 'vias', texto: '  buraco fundo ' })).toEqual({
      lat: '-21.079300',
      lng: '-47.048600',
      precisao: '12',
      categoria: 'vias',
      texto: 'buraco fundo',
    })
  })

  it('omite categoria, texto e precisão quando não existem', () => {
    const campos = camposDoRelato({ posicao: { ...praca, precisao: null }, categoria: '', texto: '   ' })
    expect(campos).toEqual({ lat: '-21.079300', lng: '-47.048600' })
  })

  it('ponto marcado no mapa leva local_manual e não leva precisão', () => {
    const campos = camposDoRelato({ posicao: posicaoManual(-21.0756, -47.0486), categoria: 'vias', texto: '' })
    expect(campos).toEqual({ lat: '-21.075600', lng: '-47.048600', local_manual: '1', categoria: 'vias' })
  })

  it('corta o texto no limite', () => {
    const campos = camposDoRelato({ posicao: praca, categoria: null, texto: 'a'.repeat(LIMITE_TEXTO + 50) })
    expect(campos.texto).toHaveLength(LIMITE_TEXTO)
  })
})

describe('fala', () => {
  it('acrescenta a fala ao texto', () => {
    expect(juntarFala('', ' poste apagado ')).toBe('poste apagado')
    expect(juntarFala('Rua A. ', 'poste apagado')).toBe('Rua A. poste apagado')
    expect(juntarFala('Rua A.', '  ')).toBe('Rua A.')
  })

  it('respeita o limite de caracteres', () => {
    expect(juntarFala('a'.repeat(LIMITE_TEXTO - 2), 'bcdef')).toHaveLength(LIMITE_TEXTO)
  })
})

describe('posição', () => {
  it('fica com a leitura mais precisa', () => {
    const boa = { ...praca, precisao: 8 }
    const ruim = { ...praca, lat: -21.08, precisao: 60 }
    expect(melhorPosicao(null, ruim)).toBe(ruim)
    expect(melhorPosicao(ruim, boa)).toBe(boa)
    expect(melhorPosicao(boa, ruim)).toBe(boa)
    expect(melhorPosicao(boa, { ...praca, precisao: null })).toBe(boa)
  })

  it('descreve a precisão em metros', () => {
    expect(linhaDePrecisao(praca)).toBe('Localização ok · precisão de 12 m')
    expect(linhaDePrecisao({ ...praca, precisao: null })).toBe('Localização ok')
    expect(linhaDePrecisao(posicaoManual(-21, -47))).toBe('Lugar marcado no mapa')
  })

  it('aceita o GPS só até 100 m de precisão', () => {
    expect(LIMITE_PRECISAO).toBe(100)
    expect(precisaoAceita({ ...praca, precisao: 100 })).toBe(true)
    expect(precisaoAceita({ ...praca, precisao: 100.5 })).toBe(false)
    expect(precisaoAceita({ ...praca, precisao: 2000 })).toBe(false)
    expect(precisaoAceita({ ...praca, precisao: null })).toBe(false)
    expect(precisaoAceita(posicaoManual(-21, -47))).toBe(true)
  })

  it('leitura imprecisa não vira posição de envio', () => {
    const longe = { ...praca, precisao: 2000 }
    expect(posicaoEscolhida(praca, null)).toBe(praca)
    expect(posicaoEscolhida(longe, null)).toBeNull()
    expect(posicaoEscolhida(null, null)).toBeNull()
  })

  it('o ponto marcado à mão vence o GPS, mesmo o GPS bom', () => {
    const marcado = posicaoManual(-21.08, -47.05)
    expect(marcado).toEqual({ lat: -21.08, lng: -47.05, precisao: null, manual: true })
    expect(posicaoEscolhida(praca, marcado)).toBe(marcado)
    expect(posicaoEscolhida({ ...praca, precisao: 3 }, marcado)).toBe(marcado)
    // Leitura nova do GPS não mexe no ponto marcado.
    const gpsNovo = melhorPosicao(praca, { ...praca, precisao: 2 })
    expect(posicaoEscolhida(gpsNovo, marcado)).toBe(marcado)
    // Quando o morador pede o GPS de novo, o ponto marcado sai.
    expect(posicaoEscolhida(gpsNovo, null)).toBe(gpsNovo)
  })

  it('traz a longitude do mapa de volta para a faixa válida', () => {
    expect(posicaoManual(-21, 313).lng).toBeCloseTo(-47)
    expect(posicaoManual(-21, -407).lng).toBeCloseTo(-47)
    expect(posicaoManual(95, 0).lat).toBe(90)
  })

  it('classifica a situação do lugar', () => {
    const vazio = { gps: null, manual: null, falha: null, buscando: false }
    expect(situacaoDoLocal(vazio)).toBe('parada')
    expect(situacaoDoLocal({ ...vazio, buscando: true })).toBe('buscando')
    expect(situacaoDoLocal({ ...vazio, gps: praca })).toBe('ok')
    expect(situacaoDoLocal({ ...vazio, gps: { ...praca, precisao: 250 } })).toBe('impreciso')
    expect(situacaoDoLocal({ ...vazio, falha: 'negado' })).toBe('negado')
    expect(situacaoDoLocal({ ...vazio, falha: 'sem_sinal' })).toBe('sem_sinal')
    expect(situacaoDoLocal({ ...vazio, falha: 'sem_suporte' })).toBe('sem_suporte')
    expect(situacaoDoLocal({ ...vazio, gps: praca, manual: posicaoManual(-21, -47), falha: 'negado' })).toBe('manual')
  })

  it('pede o mapa quando o GPS falha ou está impreciso', () => {
    expect(pedeMapa('impreciso')).toBe(true)
    expect(pedeMapa('negado')).toBe(true)
    expect(pedeMapa('sem_sinal')).toBe(true)
    expect(pedeMapa('sem_suporte')).toBe(true)
    expect(pedeMapa('ok')).toBe(false)
    expect(pedeMapa('manual')).toBe(false)
    expect(pedeMapa('buscando')).toBe(false)
  })

  it('avisa em frase simples, com o caminho do mapa', () => {
    expect(avisoDoLocal('impreciso', { ...praca, precisao: 2000 })).toBe(
      'O GPS está impreciso: pode errar por 2 km. Marque no mapa o lugar do problema.',
    )
    expect(avisoDoLocal('negado', null)).toContain('No cadeado ao lado do endereço do site, permita Localização')
    expect(avisoDoLocal('negado', null)).toContain('mapa')
    expect(avisoDoLocal('sem_sinal', null)).toContain('Marque no mapa')
    expect(avisoDoLocal('sem_suporte', null)).toContain('Marque no mapa')
    expect(avisoDoLocal('ok', praca)).toBeNull()
    expect(avisoDoLocal('manual', null)).toBeNull()
  })

  it('arredonda a distância do erro do GPS', () => {
    expect(formatarDistancia(104)).toBe('100 m')
    expect(formatarDistancia(256)).toBe('260 m')
    expect(formatarDistancia(1500)).toBe('1,5 km')
    expect(formatarDistancia(2000)).toBe('2 km')
  })

  it('abre o mapa no ponto marcado, na leitura do GPS ou no centro de Itamogi', () => {
    expect(CENTRO_PADRAO).toEqual({ lat: -21.0793, lng: -47.0486 })
    expect(vistaInicialDoMapa(null, null)).toEqual({ lat: -21.0793, lng: -47.0486, zoom: 15 })
    expect(vistaInicialDoMapa({ lat: -21.09, lng: -47.06, precisao: 2000 }, null)).toEqual({ lat: -21.09, lng: -47.06, zoom: 15 })
    expect(vistaInicialDoMapa(praca, null)).toEqual({ lat: praca.lat, lng: praca.lng, zoom: 17 })
    expect(vistaInicialDoMapa(praca, posicaoManual(-21.08, -47.05))).toEqual({ lat: -21.08, lng: -47.05, zoom: 17 })
  })
})

describe('relatos recentes', () => {
  const r = (n: number): Recente => ({
    protocolo: `MOGI-${n}`,
    nivel: 2,
    criado_em: `2026-11-0${n}T10:00:00Z`,
    chave: `chave-${n}`,
    status: 'aberta',
    lat: null,
    lng: null,
    categoria: null,
  })

  it('põe o mais novo primeiro e guarda no máximo cinco', () => {
    let lista: Recente[] = []
    for (let i = 1; i <= 7; i++) lista = mesclarRecentes(lista, r(i))
    expect(lista.map((x) => x.protocolo)).toEqual(['MOGI-7', 'MOGI-6', 'MOGI-5', 'MOGI-4', 'MOGI-3'])
  })

  it('não repete protocolo', () => {
    const lista = mesclarRecentes([r(2), r(1)], { ...r(1), nivel: 4 })
    expect(lista).toHaveLength(2)
    expect(lista[0]).toMatchObject({ protocolo: 'MOGI-1', nivel: 4 })
  })

  it('descarta o que veio estragado do armazenamento', () => {
    expect(lerRecentes('x')).toEqual([])
    expect(lerRecentes([r(1), { protocolo: 3 }, null, { ...r(2), nome: 'não guardar' }])).toEqual([r(1), r(2)])
  })

  it('mantém item antigo, guardado sem chave nem status', () => {
    const antigo = { protocolo: 'MOGI-2026-000007', nivel: null, criado_em: '2026-11-01T10:00:00Z' }
    expect(lerRecentes([antigo, { ...antigo, protocolo: 'MOGI-2026-000008', chave: '', status: 'apagada' }])).toEqual([
      { ...antigo, chave: null, status: null, lat: null, lng: null, categoria: null },
      { ...antigo, protocolo: 'MOGI-2026-000008', chave: null, status: null, lat: null, lng: null, categoria: null },
    ])
  })

  it('guarda protocolo, chave, nível, status e a data do servidor', () => {
    const resposta: Resposta = {
      protocolo: 'MOGI-2026-000123',
      chave: 'a1b2c3',
      status: 'aberta',
      nivel: 4,
      categoria: 'agua',
      secretaria: 'Obras',
      prazo_ate: null,
      prazo_fonte: null,
      endereco: 'Rua A, 10',
      bairro: 'Centro',
      agrupada: false,
      relatos: 1,
      criado_em: '2026-11-12T17:30:00Z',
      repetido: false,
    }
    const recente = recenteDaResposta(resposta, { lat: -21.0756, lng: -47.0486 })
    expect(recente).toEqual({
      protocolo: 'MOGI-2026-000123',
      chave: 'a1b2c3',
      status: 'aberta',
      nivel: 4,
      criado_em: '2026-11-12T17:30:00Z',
      lat: -21.0756,
      lng: -47.0486,
      categoria: 'agua',
    })
    expect(recenteDaResposta(resposta)).toMatchObject({ lat: null, lng: null })
    // O que vai ao armazenamento volta igual, e a data aparece com hora.
    expect(lerRecentes(JSON.parse(JSON.stringify([recente])))).toEqual([recente])
    expect(formatarDataHora(recente.criado_em, FUSO)).toBe('12/11 às 14:30')
  })
})

describe('redução da foto', () => {
  it('reduz o lado maior para 1600 mantendo a proporção', () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 })
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 1200, altura: 1600 })
    expect(dimensoesReduzidas(4032, 2268)).toEqual({ largura: 1600, altura: 900 })
  })

  it('não amplia foto pequena', () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 })
    expect(dimensoesReduzidas(1600, 1600)).toEqual({ largura: 1600, altura: 1600 })
  })

  it('nunca devolve lado zero em foto muito estreita', () => {
    expect(dimensoesReduzidas(10000, 2)).toEqual({ largura: 1600, altura: 1 })
    expect(dimensoesReduzidas(0, 0)).toEqual({ largura: 0, altura: 0 })
  })

  it('só aceita foto reduzida de até 12 MB', () => {
    expect(LIMITE_FOTO_BYTES).toBe(12 * 1024 * 1024)
    expect(fotoCabe(300_000)).toBe(true)
    expect(fotoCabe(LIMITE_FOTO_BYTES)).toBe(true)
    expect(fotoCabe(LIMITE_FOTO_BYTES + 1)).toBe(false)
    expect(fotoCabe(0)).toBe(false)
  })
})

describe('erros de envio', () => {
  const todos: CodigoDeErro[] = [
    'foto_ausente',
    'foto_formato',
    'foto_grande',
    'fotos_demais',
    'video_formato',
    'video_grande',
    'video_longo',
    'video_com_audio',
    'local_invalido',
    'fora_da_cidade',
    'muitos_envios',
    'midia_indisponivel',
    'interno',
    'sem_conexao',
    'tempo_esgotado',
    'desconhecido',
  ]
  const deVideo = ['video_com_audio', 'video_formato', 'video_grande', 'video_longo'] as const

  it('tem uma frase própria para cada código', () => {
    expect(mensagemDeErro('muitos_envios')).toBe('Muitos relatos em pouco tempo. Espere alguns minutos e tente de novo.')
    expect(mensagemDeErro('foto_formato')).toBe('Não consegui ler essa foto. Tire outra pela câmera.')
    expect(mensagemDeErro('foto_formato')).toBe(FOTO_ILEGIVEL)
    expect(mensagemDeErro('sem_conexao')).toBe(
      'Sem internet agora. Seu relato continua aqui: toque em Tentar de novo quando o sinal voltar.',
    )
    expect(mensagemDeErro('foto_ausente')).toContain('Tire outra pela câmera')
    expect(mensagemDeErro('foto_grande')).toContain('Tire outra pela câmera')
    expect(mensagemDeErro('local_invalido')).toContain('mapa')
    expect(mensagemDeErro('midia_indisponivel')).toContain('Tentar de novo')
    expect(mensagemDeErro('interno')).toContain('Tentar de novo')
    expect(mensagemDeErro('tempo_esgotado')).toContain('Tentar de novo')
    expect(mensagemDeErro('desconhecido')).toContain('Tentar de novo')
    expect(new Set(todos.map((c) => mensagemDeErro(c))).size).toBe(todos.length)
  })

  it('usa o nome da cidade da config no ponto fora da cidade', () => {
    expect(mensagemDeErro('fora_da_cidade')).toBe('Este ponto fica fora de Itamogi. O MOGI só recebe relatos da cidade.')
    expect(mensagemDeErro('fora_da_cidade', 'Monte Santo de Minas')).toBe(
      'Este ponto fica fora de Monte Santo de Minas. O MOGI só recebe relatos da cidade.',
    )
  })

  it('diz o limite de fotos que o servidor informou', () => {
    expect(mensagemDeErro('fotos_demais', 'Itamogi', midia)).toBe('São no máximo 4 fotos. Remova uma e envie de novo.')
    expect(mensagemDeErro('fotos_demais', 'Itamogi', { ...midia, fotos_max: 2 })).toContain('no máximo 2 fotos')
    expect(mensagemDeErro('fotos_demais')).toBe('Só cabe uma foto por relato. Remova as outras e envie de novo.')
  })

  it('vídeo recusado: explica o motivo e manda enviar sem ele', () => {
    expect(mensagemDeErro('video_com_audio')).toContain('sem som')
    expect(mensagemDeErro('video_grande')).toContain('grande demais')
    expect(mensagemDeErro('video_longo', 'Itamogi', midia)).toContain('passou de 15 segundos')
    expect(mensagemDeErro('video_longo', 'Itamogi', { ...midia, video_segundos: 10 })).toContain('passou de 10 segundos')
    for (const c of deVideo) {
      expect(mensagemDeErro(c)).toContain('Tirei o vídeo do relato')
      expect(mensagemDeErro(c)).toContain('enviar sem ele')
      expect(acaoDoErro(c)).toBe('sem_video')
    }
    expect(acaoDoErro('fotos_demais')).toBe('menos_fotos')
  })

  it('o botão principal acompanha a falha', () => {
    expect(rotuloDoEnvio(null, 1)).toBe('Enviar relato')
    expect(rotuloDoEnvio('repetir', 3)).toBe('Tentar de novo')
    expect(rotuloDoEnvio('sem_video', 3)).toBe('Enviar só com as fotos')
    expect(rotuloDoEnvio('sem_video', 1)).toBe('Enviar só com a foto')
    expect(rotuloDoEnvio('menos_fotos', 5)).toBe('Enviar relato')
    expect(rotuloDoEnvio('mapa', 1)).toBe('Enviar relato')
  })

  it('nunca mostra número de erro, texto técnico nem travessão', () => {
    for (const c of todos) {
      const frase = mensagemDeErro(c, 'Itamogi', midia)
      expect(frase).not.toMatch(/\d{3}|erro|servidor|[\u2013\u2014]/i)
      expect(frase).toMatch(/[.!]$/)
    }
  })

  it('prefere o código do servidor e cai no status quando ele não vem', () => {
    expect(codigoDoErro(400, 'foto_ausente')).toBe('foto_ausente')
    expect(codigoDoErro(400, 'local_invalido')).toBe('local_invalido')
    expect(codigoDoErro(429, 'muitos_envios')).toBe('muitos_envios')
    expect(codigoDoErro(413, undefined)).toBe('foto_grande')
    expect(codigoDoErro(415, null)).toBe('foto_formato')
    expect(codigoDoErro(422, '')).toBe('fora_da_cidade')
    expect(codigoDoErro(429, 'outro')).toBe('muitos_envios')
    expect(codigoDoErro(502, null)).toBe('midia_indisponivel')
    expect(codigoDoErro(503, null)).toBe('midia_indisponivel')
    expect(codigoDoErro(500, null)).toBe('interno')
    expect(codigoDoErro(400, null)).toBe('desconhecido')
  })

  it('reconhece os códigos de várias fotos e de vídeo', () => {
    expect(codigoDoErro(400, 'fotos_demais')).toBe('fotos_demais')
    expect(codigoDoErro(415, 'video_formato')).toBe('video_formato')
    expect(codigoDoErro(413, 'video_grande')).toBe('video_grande')
    expect(codigoDoErro(422, 'video_longo')).toBe('video_longo')
    expect(codigoDoErro(422, 'video_com_audio')).toBe('video_com_audio')
    // Recusa por tamanho sem código: com vídeo junto, a culpa mais provável é dele.
    expect(codigoDoErro(413, null, true)).toBe('video_grande')
    expect(codigoDoErro(413, null, false)).toBe('foto_grande')
    expect(codigoDoErro(413, 'foto_grande', true)).toBe('foto_grande')
    expect(interpretarEnvio(422, { erro: 'x', codigo: 'video_com_audio' }, true)).toEqual({ codigo: 'video_com_audio' })
    expect(interpretarEnvio(413, '<html>', true)).toEqual({ codigo: 'video_grande' })
  })

  it('diz o que fazer depois de cada falha', () => {
    expect(acaoDoErro('foto_ausente')).toBe('outra_foto')
    expect(acaoDoErro('foto_formato')).toBe('outra_foto')
    expect(acaoDoErro('foto_grande')).toBe('outra_foto')
    expect(acaoDoErro('local_invalido')).toBe('mapa')
    expect(acaoDoErro('fora_da_cidade')).toBe('mapa')
    for (const c of ['muitos_envios', 'midia_indisponivel', 'interno', 'sem_conexao', 'tempo_esgotado', 'desconhecido'] as const) {
      expect(acaoDoErro(c)).toBe('repetir')
    }
  })
})

describe('resposta do envio', () => {
  const corpo = {
    protocolo: 'MOGI-2026-000123',
    chave: 'a1b2c3',
    status: 'aberta',
    nivel: 4,
    categoria: 'agua',
    secretaria: 'Obras',
    prazo_ate: '2026-11-13T17:30:00Z',
    prazo_fonte: 'Carta de serviços',
    endereco: 'Rua A, 10',
    bairro: 'Centro',
    agrupada: false,
    relatos: 1,
    criado_em: '2026-11-12T17:30:00Z',
    repetido: false,
  }

  it('aceita 201 (novo) e 200 (repetição da mesma chave)', () => {
    expect(interpretarEnvio(201, corpo)).toEqual({ resposta: corpo })
    expect(interpretarEnvio(200, { ...corpo, repetido: true })).toEqual({ resposta: { ...corpo, repetido: true } })
  })

  it('completa o que faltar sem perder o protocolo', () => {
    const r = interpretarEnvio(201, { protocolo: 'MOGI-2026-000124', status: 'estranho', nivel: null })
    expect(r).toMatchObject({
      resposta: { protocolo: 'MOGI-2026-000124', chave: '', status: 'a_classificar', nivel: null, agrupada: false, relatos: 1 },
    })
  })

  it('sucesso sem protocolo não é sucesso', () => {
    expect(interpretarEnvio(201, null)).toEqual({ codigo: 'desconhecido' })
    expect(interpretarEnvio(200, { id: 'x' })).toEqual({ codigo: 'desconhecido' })
  })

  it('transforma a recusa do servidor em código', () => {
    expect(interpretarEnvio(422, { erro: 'ponto fora do município', codigo: 'fora_da_cidade' })).toEqual({ codigo: 'fora_da_cidade' })
    expect(interpretarEnvio(429, { erro: 'limite', codigo: 'muitos_envios' })).toEqual({ codigo: 'muitos_envios' })
    expect(interpretarEnvio(502, null)).toEqual({ codigo: 'midia_indisponivel' })
    expect(interpretarEnvio(500, 'Internal Server Error')).toEqual({ codigo: 'interno' })
    // Corpo de sucesso com status de erro continua sendo erro.
    expect(interpretarEnvio(500, corpo)).toEqual({ codigo: 'interno' })
  })
})

describe('progresso do envio', () => {
  it('mostra a porcentagem real e depois a análise', () => {
    expect(textoDoProgresso({ fase: 'preparando' })).toBe('Preparando o envio…')
    expect(textoDoProgresso({ fase: 'enviando', fracao: 0.62 })).toBe('Enviando a foto… 62%')
    expect(textoDoProgresso({ fase: 'enviando', fracao: 0 })).toBe('Enviando a foto… 0%')
    expect(textoDoProgresso({ fase: 'analisando' })).toBe('Analisando o relato…')
  })

  it('conta as fotos e o vídeo no texto, com singular e plural', () => {
    const p = { fase: 'enviando', fracao: 0.62 } as const
    expect(textoDoProgresso(p, { fotos: 1, video: false })).toBe('Enviando a foto… 62%')
    expect(textoDoProgresso(p, { fotos: 2, video: false })).toBe('Enviando 2 fotos… 62%')
    expect(textoDoProgresso(p, { fotos: 3, video: true })).toBe('Enviando 3 fotos e o vídeo… 62%')
    expect(textoDoProgresso(p, { fotos: 1, video: true })).toBe('Enviando a foto e o vídeo… 62%')
    expect(textoDoProgresso({ fase: 'analisando' }, { fotos: 3, video: true })).toBe('Analisando o relato…')
    expect(oQueVai({ fotos: 4, video: false })).toBe('4 fotos')
    expect(oQueVai({ fotos: 0, video: false })).toBe('a foto')
  })

  it('dá mais prazo ao envio com vídeo', () => {
    expect(prazoDeEnvio(false)).toBe(90_000)
    expect(prazoDeEnvio(true)).toBe(180_000)
  })

  it('mantém a porcentagem entre 0 e 100', () => {
    expect(porcentagem({ fase: 'enviando', fracao: 1.4 })).toBe(100)
    expect(porcentagem({ fase: 'enviando', fracao: -1 })).toBe(0)
    expect(porcentagem({ fase: 'preparando' })).toBe(0)
    expect(porcentagem({ fase: 'analisando' })).toBe(100)
  })
})

describe('identificadores', () => {
  it('monta um UUID v4 a partir de 16 bytes', () => {
    const id = uuidDeBytes(new Uint8Array(16).fill(0xff))
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    expect(uuidDeBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000')
    expect(ehUuid(id)).toBe(true)
  })

  it('reconhece UUID e recusa o resto', () => {
    expect(ehUuid('3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b')).toBe(true)
    expect(ehUuid('3F2B8C1E-9A4D-4E7F-8B21-0C5D6E7F8A9B')).toBe(true)
    expect(ehUuid('3f2b8c1e9a4d4e7f8b210c5d6e7f8a9b')).toBe(false)
    expect(ehUuid('')).toBe(false)
    expect(ehUuid(null)).toBe(false)
  })
})

describe('configuração', () => {
  it('aceita a resposta do servidor', () => {
    const c = lerConfig({ cidade: 'Itamogi', ia_ativa: true, categorias: [{ id: 'vias', nome: 'Buraco na via' }] })
    expect(c.ia_ativa).toBe(true)
    expect(c.categorias).toEqual([{ id: 'vias', nome: 'Buraco na via' }])
  })

  it('cai na lista padrão, sem IA, quando a resposta não serve', () => {
    expect(lerConfig(null)).toBe(CONFIG_PADRAO)
    expect(lerConfig({ ia_ativa: true, categorias: [] })).toBe(CONFIG_PADRAO)
    expect(CONFIG_PADRAO.ia_ativa).toBe(false)
    expect(CONFIG_PADRAO.categorias.map((c) => c.id)).toEqual([
      'agua', 'iluminacao', 'vias', 'limpeza', 'arvores', 'sinalizacao', 'calcadas', 'animais', 'outros',
    ])
  })

  it('lê os limites de fotos e vídeo', () => {
    const c = lerConfig({ cidade: 'Itamogi', ia_ativa: false, categorias: [{ id: 'vias', nome: 'Vias' }], midia })
    expect(c.midia).toEqual(midia)
  })

  it('servidor antigo, sem midia: uma foto e nada de vídeo', () => {
    const c = lerConfig({ cidade: 'Itamogi', ia_ativa: true, categorias: [{ id: 'vias', nome: 'Vias' }] })
    expect(c.midia).toEqual(MIDIA_PADRAO)
    expect(MIDIA_PADRAO.fotos_max).toBe(1)
    expect(MIDIA_PADRAO.video).toBe(false)
    expect(CONFIG_PADRAO.midia).toBe(MIDIA_PADRAO)
    expect(lerMidia(null)).toBe(MIDIA_PADRAO)
    expect(lerMidia('4')).toBe(MIDIA_PADRAO)
  })

  it('limite estranho cai no padrão e vídeo só liga com true', () => {
    expect(lerMidia({ fotos_max: '4', video: 'sim', video_segundos: null })).toEqual(MIDIA_PADRAO)
    expect(lerMidia({ fotos_max: 0, video: false }).fotos_max).toBe(1)
    expect(lerMidia({ fotos_max: 3.9 }).fotos_max).toBe(3)
    expect(lerMidia({ fotos_max: 999 }).fotos_max).toBe(10)
    expect(lerMidia({ video: true })).toEqual({ ...MIDIA_PADRAO, video: true })
    expect(lerMidia({ video: true, video_segundos: 10, video_mb: 8, quadros_max: 0 })).toMatchObject({
      video_segundos: 10,
      video_mb: 8,
      quadros_max: 0,
    })
  })

  it('enquanto a config não respondeu, o tipo é opcional', () => {
    expect(tipoOpcional(null)).toBe(true)
    expect(tipoOpcional({ ...CONFIG_PADRAO, ia_ativa: true })).toBe(true)
    // Só exige quando a resposta (ou o prazo estourado, que vira a padrão) diz que não há IA.
    expect(tipoOpcional(CONFIG_PADRAO)).toBe(false)
  })

  it('a escolha feita antes da config só vale se existir na lista que chegou', () => {
    const comIa = { ...CONFIG_PADRAO, ia_ativa: true }
    expect(escolhaAposConfig(null, comIa)).toBeNull()
    expect(escolhaAposConfig('vias', CONFIG_PADRAO)).toBe('vias')
    expect(escolhaAposConfig('poda', CONFIG_PADRAO)).toBeNull()
    expect(escolhaAposConfig('', comIa)).toBe('')
    expect(escolhaAposConfig('', CONFIG_PADRAO)).toBeNull()
  })
})

describe('várias fotos', () => {
  it('conta as vagas, incluindo as fotos em preparo', () => {
    expect(vagasDeFoto(1, midia)).toBe(3)
    expect(vagasDeFoto(4, midia)).toBe(0)
    expect(vagasDeFoto(7, midia)).toBe(0)
    expect(vagasDeFoto(1, MIDIA_PADRAO)).toBe(0)
    expect(vagasDeFoto(-2, midia)).toBe(4)
  })

  it('explica o limite só quando cabe mais de uma', () => {
    expect(apoioDasFotos(midia)).toBe('Até 4 fotos. A primeira é a principal.')
    expect(apoioDasFotos({ ...midia, fotos_max: 2 })).toBe('Até 2 fotos. A primeira é a principal.')
    expect(apoioDasFotos(MIDIA_PADRAO)).toBeNull()
  })

  it('monta o multipart com foto repetida, na ordem, e sem nada de vídeo', async () => {
    const fotos = [new Blob(['a'], { type: 'image/jpeg' }), new Blob(['bb'], { type: 'image/jpeg' })]
    const corpo = montarCorpo({ fotos }, { lat: '-21.070000', lng: '-47.040000' })
    const enviadas = corpo.getAll('foto') as File[]
    expect(enviadas.map((f) => f.name)).toEqual(['relato-1.jpg', 'relato-2.jpg'])
    expect(await enviadas[0].text()).toBe('a')
    expect(await enviadas[1].text()).toBe('bb')
    expect(corpo.get('lat')).toBe('-21.070000')
    expect(corpo.has('video')).toBe(false)
    expect(corpo.has('quadro')).toBe(false)
    expect(corpo.has('video_duracao_ms')).toBe(false)
  })

  it('com vídeo, manda o arquivo, os quadros e a duração medida', () => {
    const foto = new Blob(['a'], { type: 'image/jpeg' })
    const quadro = new Blob(['q'], { type: 'image/jpeg' })
    const video = { blob: new Blob(['v'], { type: 'video/webm' }), duracaoMs: 4321.6, quadros: [quadro, quadro, quadro] }
    const corpo = montarCorpo({ fotos: [foto, foto, foto], video }, { lat: '1', lng: '2' })
    expect(corpo.getAll('foto')).toHaveLength(3)
    expect(corpo.getAll('video')).toHaveLength(1)
    expect((corpo.get('video') as File).name).toBe('relato.webm')
    expect((corpo.getAll('quadro') as File[]).map((f) => f.name)).toEqual(['quadro-1.jpg', 'quadro-2.jpg', 'quadro-3.jpg'])
    expect(corpo.get('video_duracao_ms')).toBe('4322')
    const semQuadros = montarCorpo({ fotos: [foto], video: { ...video, blob: new Blob(['v'], { type: 'video/mp4' }), quadros: [] } }, {})
    expect((semQuadros.get('video') as File).name).toBe('relato.mp4')
    expect(semQuadros.has('quadro')).toBe(false)
    expect(montarCorpo({ fotos: [foto], video: null }, {}).has('video')).toBe(false)
  })
})

describe('vídeo curto', () => {
  it('escolhe o primeiro tipo que o gravador aceita', () => {
    expect(tipoDeGravacao(() => true)).toBe('video/mp4;codecs=avc1')
    expect(tipoDeGravacao((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9')
    expect(tipoDeGravacao((t) => t === 'video/webm;codecs=vp8' || t === 'video/webm')).toBe('video/webm;codecs=vp8')
    expect(tipoDeGravacao((t) => t === 'video/mp4')).toBe('video/mp4')
    expect(tipoDeGravacao(() => false)).toBeNull()
    expect([...TIPOS_DE_VIDEO]).toEqual([
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ])
  })

  it('navegador que estoura ao perguntar o tipo não derruba a escolha', () => {
    const suporta = (t: string) => {
      if (t.includes('mp4')) throw new Error('tipo desconhecido')
      return t === 'video/webm'
    }
    expect(tipoDeGravacao(suporta)).toBe('video/webm')
  })

  it('tira o codec do tipo e acha a extensão do arquivo', () => {
    expect(tipoSemCodec('video/webm;codecs=vp9')).toBe('video/webm')
    expect(tipoSemCodec('Video/MP4; codecs="avc1.42E01E"')).toBe('video/mp4')
    expect(extensaoDoVideo('video/webm;codecs=vp8')).toBe('webm')
    expect(extensaoDoVideo('video/x-matroska;codecs=avc1')).toBe('webm')
    expect(extensaoDoVideo('video/mp4;codecs=avc1')).toBe('mp4')
    expect(extensaoDoVideo('video/quicktime')).toBe('mov')
    expect(extensaoDoVideo('')).toBe('mp4')
  })

  it('os quadros ficam por volta de 15%, 50% e 85% da duração', () => {
    expect(instantesDosQuadros(10_000)).toEqual([1500, 5000, 8500])
    expect(instantesDosQuadros(4000, 3)).toEqual([600, 2000, 3400])
    expect(instantesDosQuadros(4000, 2)).toEqual([600, 3400])
    expect(instantesDosQuadros(4000, 1)).toEqual([2000])
    expect(instantesDosQuadros(4000, 0)).toEqual([])
    expect(instantesDosQuadros(Infinity)).toEqual([])
    expect(instantesDosQuadros(0)).toEqual([])
    expect(instantesDosQuadros(NaN)).toEqual([])
  })

  it('entre os quadros guardados na gravação, fica com os mais próximos dos instantes', () => {
    // Um quadro a cada segundo, a partir de 0,5 s, em 10 s de vídeo.
    const guardados = [500, 1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500]
    expect(escolherQuadros(guardados, 10_000)).toEqual([1, 4, 8])
    expect(escolherQuadros(guardados, 10_000, 2)).toEqual([1, 8])
    expect(escolherQuadros(guardados, 10_000, 1)).toEqual([4])
    expect(escolherQuadros(guardados, 10_000, 0)).toEqual([])
  })

  it('com poucos quadros fica com todos, sem repetir nenhum', () => {
    expect(escolherQuadros([500], 1200)).toEqual([0])
    expect(escolherQuadros([500, 1500], 2100)).toEqual([0, 1])
    expect(escolherQuadros([], 4000)).toEqual([])
    // Vídeo de 4 s: quatro quadros para três vagas.
    const escolhidos = escolherQuadros([500, 1500, 2500, 3500], 4000)
    expect(escolhidos).toEqual([0, 1, 3])
    expect(new Set(escolhidos).size).toBe(3)
  })

  it('sem duração confiável, usa o instante do último quadro', () => {
    expect(escolherQuadros([500, 1500, 2500, 3500, 4500], Infinity)).toEqual([0, 2, 3])
    expect(escolherQuadros([500, 1500, 2500, 3500, 4500], 0, 1)).toEqual([2])
  })

  it('guarda um quadro por segundo, e menos em limite longo', () => {
    expect(intervaloDosQuadros(15)).toBe(1000)
    expect(intervaloDosQuadros(5)).toBe(1000)
    expect(intervaloDosQuadros(60)).toBe(4000)
  })

  it('formata a duração como relógio e por extenso', () => {
    expect(formatarDuracao(7000)).toBe('0:07')
    expect(formatarDuracao(4400)).toBe('0:04')
    expect(formatarDuracao(14_600)).toBe('0:15')
    expect(formatarDuracao(65_000)).toBe('1:05')
    expect(formatarDuracao(0)).toBe('0:00')
    expect(formatarDuracao(Infinity)).toBe('0:00')
    expect(formatarDuracao(-5)).toBe('0:00')
    expect(duracaoPorExtenso(7000)).toBe('7 segundos')
    expect(duracaoPorExtenso(1200)).toBe('1 segundo')
    expect(duracaoPorExtenso(0)).toBe('0 segundos')
  })

  it('conta o tempo que falta sem passar dos limites', () => {
    expect(segundosRestantes(0, 15)).toBe(15)
    expect(segundosRestantes(100, 15)).toBe(15)
    expect(segundosRestantes(5001, 15)).toBe(10)
    expect(segundosRestantes(14_999, 15)).toBe(1)
    expect(segundosRestantes(15_000, 15)).toBe(0)
    expect(segundosRestantes(99_000, 15)).toBe(0)
    expect(segundosRestantes(-500, 15)).toBe(15)
  })

  it('anuncia a gravação no começo e de 5 em 5 segundos, não a cada segundo', () => {
    expect(anuncioDaGravacao(15, 15)).toBe('Gravando, faltam 15 segundos')
    expect(anuncioDaGravacao(10, 15)).toBe('Gravando, faltam 10 segundos')
    expect(anuncioDaGravacao(5, 15)).toBe('Gravando, faltam 5 segundos')
    expect(anuncioDaGravacao(9, 15)).toBeNull()
    expect(anuncioDaGravacao(0, 15)).toBeNull()
    expect(anuncioDaGravacao(12, 12)).toBe('Gravando, faltam 12 segundos')
    expect(anuncioDaGravacao(1, 1)).toBe('Gravando, falta 1 segundo')
    const falas = Array.from({ length: 16 }, (_, i) => anuncioDaGravacao(15 - i, 15)).filter(Boolean)
    expect(falas).toHaveLength(3)
  })

  it('descarta vídeo vazio, curto demais ou acima do limite', () => {
    const MB = 1024 * 1024
    expect(VIDEO_MINIMO_MS).toBe(1000)
    expect(defeitoDoVideo(600_000, 4000, midia)).toBeNull()
    expect(defeitoDoVideo(600_000, 1000, midia)).toBeNull()
    expect(defeitoDoVideo(600_000, 999, midia)).toBe('curto')
    expect(defeitoDoVideo(600_000, NaN, midia)).toBe('curto')
    expect(defeitoDoVideo(0, 4000, midia)).toBe('vazio')
    expect(defeitoDoVideo(25 * MB, 15_000, midia)).toBeNull()
    expect(defeitoDoVideo(25 * MB + 1, 15_000, midia)).toBe('grande')
    expect(defeitoDoVideo(9 * MB, 15_000, { ...midia, video_mb: 8 })).toBe('grande')
  })

  it('só oferece vídeo em navegador que grava direto da câmera', () => {
    const camera = { mediaDevices: { getUserMedia: () => {} } }
    const gravador = { MediaRecorder: class {} }
    expect(suportaGravacao(camera, gravador)).toBe(true)
    expect(suportaGravacao(camera, {})).toBe(false)
    expect(suportaGravacao({ mediaDevices: {} }, gravador)).toBe(false)
    // Página sem https não tem mediaDevices.
    expect(suportaGravacao({}, gravador)).toBe(false)
    expect(suportaGravacao(undefined, undefined)).toBe(false)
  })

  it('cada problema do vídeo diz o que fazer, e o relato segue com as fotos', () => {
    expect(avisoDoDefeito('grande')).toBe('O vídeo ficou grande demais. Grave um mais curto.')
    expect(avisoDoDefeito('curto')).toBe('O vídeo ficou curto demais. Grave por pelo menos 1 segundo.')
    expect(avisoDoDefeito('vazio')).toBe(SEM_GRAVACAO)
    expect(SEM_CAMERA).toBe('Sem acesso à câmera para vídeo. Você pode enviar só com as fotos.')
    expect(avisoDaCamera('NotAllowedError')).toBe(SEM_CAMERA)
    expect(avisoDaCamera('SecurityError')).toBe(SEM_CAMERA)
    expect(avisoDaCamera('NotReadableError')).toBe(CAMERA_FALHOU)
    expect(avisoDaCamera(undefined)).toBe(CAMERA_FALHOU)
    for (const frase of [SEM_CAMERA, CAMERA_FALHOU, CAMERA_PAROU, SEM_GRAVACAO, GRAVADOR_NAO_ABRIU]) {
      expect(frase).toContain('enviar só com as fotos')
    }
    expect(AVISO_DO_VIDEO).toBe('O vídeo é gravado sem som. Evite filmar rostos e placas.')
    expect(rotuloDoVideo(midia)).toBe('Gravar vídeo (até 15 s)')
    expect(rotuloDoVideo({ ...midia, video_segundos: 10 })).toBe('Gravar vídeo (até 10 s)')
  })
})

describe('fora da cidade', () => {
  it('lê a cerca e diz quem está fora', async () => {
    const { foraDaCidade, lerCaixa } = await import('./logica')
    const caixa = lerCaixa({ min_lng: -47.2, min_lat: -21.22, max_lng: -46.9, max_lat: -20.95 })
    expect(caixa).not.toBeNull()
    expect(foraDaCidade(caixa, { lat: -21.0793, lng: -47.0486 })).toBe(false)
    // Curitiba
    expect(foraDaCidade(caixa, { lat: -25.4284, lng: -49.2733 })).toBe(true)
    expect(foraDaCidade(null, { lat: -25.4, lng: -49.2 })).toBe(false)
    expect(foraDaCidade(caixa, null)).toBe(false)
    expect(lerCaixa({ min_lng: 1, min_lat: 1, max_lng: 0, max_lat: 2 })).toBeNull()
    expect(lerCaixa(null)).toBeNull()
  })
})
