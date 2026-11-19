import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AJUSTES, ALFABETO_DA_SENHA, MODULOS, avisoSemRelato, comoFrase, detalheDoSinal, resumoDoVeredito, conferirNovoUsuario, conferirParametros, diferencas, duracaoEmPalavras,
  errosDosParametros, fraseDoMotivo, gerarSenha, haQuanto, linhasDaTriagem, noArHa, nomeDaEtapa, nomeDaRota, nomeDoProvedor,
  nomeDoSinal, ordenarUsuarios, passoDoAjuste, repetirComAbaVisivel, resumoDasMudancas, rotuloDoPapel, seloDaEtapa, senhaEmBlocos,
  etapasDoFunil, sinaisNaUltimaHora, tempoEmPalavras, textoDoGraficoDeRelatos, textoDoGraficoDoServidor, valorComUnidade, veredito,
  type Cadastro, type DadosDaOperacao, type EtapaDaOperacao, type Parametros,
} from './gestor'

const AGORA = '2026-11-15T02:30:00Z'

function etapa(p: Partial<EtapaDaOperacao> & { etapa: string }): EtapaDaOperacao {
  return { provedor: '', chamadas: 10, falhas: 0, media_ms: 50, p95_ms: 80, ultima_falha: null, ...p }
}

// Uma hora boa: tudo respondendo, fila sem crítico e nenhum aviso de aparelho.
function dados(p: Partial<DadosDaOperacao> = {}): DadosDaOperacao {
  return {
    agora: AGORA,
    saude: { banco: 'ok', midia: 'ok' },
    banco: { conexoes_em_uso: 0, conexoes_max: 4 },
    fila: { revisao: 2, a_classificar: 0, abertas: 3, em_atendimento: 1, nivel5_em_revisao: 0, prazo_vencido: 0 },
    relatos: { ultima_hora: 10, ultimas_24h: 30, ultimo_em: '2026-11-15T02:27:00Z', por_hora: [] },
    triagem: [
      etapa({ etapa: 'borrao', provedor: 'midia.BorradorSeletivo' }),
      etapa({ etapa: 'armazenamento', provedor: 's3' }),
      etapa({ etapa: 'geocodigo', provedor: 'nominatim' }),
      etapa({ etapa: 'classificacao', provedor: 'jev-1.14.0' }),
      etapa({ etapa: 'regra_lua', provedor: 'itamogi/agua.lua' }),
    ],
    servidor: {
      no_ar_desde: '2026-11-15T00:20:00Z', pedidos: 100, erros_5xx: 0, recusas_4xx: 3, rotas: [], falhas: [],
      por_minuto: Array.from({ length: 60 }, (_, i) => ({ minuto: `m${i}`, pedidos: 2, erros_5xx: 0, recusas_4xx: 0 })),
    },
    aparelhos: { por_tipo: [], recentes: [] },
    ...p,
  }
}

const trocar = (d: DadosDaOperacao, nome: string, p: Partial<EtapaDaOperacao>) =>
  d.triagem.map((e) => (e.etapa === nome ? { ...e, ...p } : e))

describe('veredito da operação', () => {
  it('diz tudo funcionando quando nada falha', () => {
    const v = veredito(dados())
    expect(v.nivel).toBe('ok')
    expect(v.titulo).toBe('Tudo funcionando')
    expect(v.motivos).toEqual([])
    expect(v.frase).toMatch(/respondendo/)
  })

  it('aponta problema quando o banco ou o armazenamento não responde', () => {
    expect(veredito(dados({ saude: { banco: 'indisponível', midia: 'ok' } })).nivel).toBe('problema')
    const v = veredito(dados({ saude: { banco: 'ok', midia: 'indisponível' } }))
    expect(v.titulo).toBe('Com problema')
    expect(v.frase).toBe('O lugar onde as fotos ficam guardadas não respondeu.')
  })

  it('aponta problema com uma única falha em etapa essencial', () => {
    for (const nome of ['borrao', 'armazenamento', 'regra_lua']) {
      const d = dados()
      const v = veredito({ ...d, triagem: trocar(d, nome, { falhas: 1 }) })
      expect(v.nivel, nome).toBe('problema')
    }
    const d = dados()
    const v = veredito({ ...d, triagem: trocar(d, 'borrao', { chamadas: 38, falhas: 2 }) })
    expect(v.frase).toBe('O borrão de rostos e placas falhou 2 de 38 vezes na última hora.')
  })

  it('aponta problema com erro do sistema só nos últimos 10 minutos', () => {
    const d = dados()
    const antigo = d.servidor.por_minuto.map((m, i) => (i === 40 ? { ...m, erros_5xx: 3 } : m))
    expect(veredito({ ...d, servidor: { ...d.servidor, por_minuto: antigo } }).nivel).toBe('ok')
    const recente = d.servidor.por_minuto.map((m, i) => (i === 55 ? { ...m, erros_5xx: 1 } : m))
    const v = veredito({ ...d, servidor: { ...d.servidor, por_minuto: recente } })
    expect(v.nivel).toBe('problema')
    expect(v.frase).toBe('O sistema deu erro em 1 pedido nos últimos 10 minutos.')
  })

  it('aponta problema quando todos os classificadores falharam, e só atenção quando um deles falha', () => {
    const base = dados().triagem.filter((e) => e.etapa !== 'classificacao')
    const jevFora = etapa({ etapa: 'classificacao', provedor: 'jev-1.14.0', chamadas: 8, falhas: 8 })
    const todos = veredito(dados({ triagem: [...base, jevFora, etapa({ etapa: 'classificacao', provedor: 'claude-haiku', chamadas: 8, falhas: 8 })] }))
    expect(todos.nivel).toBe('problema')
    expect(todos.motivos).toHaveLength(1)
    expect(todos.frase).toBe('A avaliação de urgência falhou em todos os relatos da última hora.')

    const um = veredito(dados({ triagem: [...base, jevFora, etapa({ etapa: 'classificacao', provedor: 'local-por-categoria', chamadas: 8 })] }))
    expect(um.nivel).toBe('atencao')
    expect(um.frase).toBe('A avaliação de urgência (Jev) falhou em 8 de 8 relatos na última hora.')
  })

  it('pede atenção quando etapa não essencial falha em mais de 20% das chamadas', () => {
    const d = dados()
    expect(veredito({ ...d, triagem: trocar(d, 'geocodigo', { chamadas: 10, falhas: 2 }) }).nivel).toBe('ok')
    const v = veredito({ ...d, triagem: trocar(d, 'geocodigo', { chamadas: 29, falhas: 29 }) })
    expect(v.nivel).toBe('atencao')
    expect(v.titulo).toBe('Atenção')
    expect(v.frase).toBe('A leitura de endereço falhou em 29 de 29 relatos na última hora.')
  })

  it('pede atenção por crítico esperando, prazo vencido e aviso de aparelho, dizendo o que fazer', () => {
    const d = dados()
    const v = veredito({
      ...d,
      fila: { ...d.fila, nivel5_em_revisao: 2, prazo_vencido: 1 },
      aparelhos: {
        por_tipo: [{ chave: 'gps_negado', n: 2 }],
        recentes: [
          { quando: '2026-11-15T02:20:00Z', tipo: 'gps_negado', detalhe: null, tela: null, navegador: null },
          { quando: '2026-11-14T20:00:00Z', tipo: 'gps_negado', detalhe: null, tela: null, navegador: null },
        ],
      },
    })
    expect(v.nivel).toBe('atencao')
    expect(v.motivos.map(fraseDoMotivo)).toEqual([
      '2 chamados críticos esperando alguém conferir: abra o Mapa.',
      '1 chamado com o prazo vencido: abra o Mapa e cobre a equipe responsável.',
      '1 problema avisado pelos celulares na última hora: veja a lista em Problemas nos celulares.',
    ])
  })

  it('lista os problemas antes das atenções e usa o primeiro na frase do topo', () => {
    const d = dados()
    const v = veredito({ ...d, saude: { banco: 'fora', midia: 'ok' }, fila: { ...d.fila, nivel5_em_revisao: 1 } })
    expect(v.nivel).toBe('problema')
    expect(v.motivos.map((m) => m.gravidade)).toEqual(['problema', 'atencao'])
    expect(v.frase).toBe('O banco de dados não respondeu.')
  })

  it('não se assusta com triagem vazia', () => {
    expect(veredito(dados({ triagem: [] })).nivel).toBe('ok')
  })

  it('conta só os avisos de aparelho da última hora', () => {
    const s = (quando: string) => ({ quando, tipo: 'x', detalhe: null, tela: null, navegador: null })
    expect(sinaisNaUltimaHora([s('2026-11-15T02:29:00Z'), s('2026-11-15T01:31:00Z'), s('2026-11-15T01:29:00Z')], AGORA)).toBe(2)
  })
})

describe('linhas da triagem', () => {
  it('junta as regras da prefeitura numa linha e separa a classificação por quem avaliou', () => {
    const linhas = linhasDaTriagem([
      etapa({ etapa: 'regra_lua', provedor: 'itamogi/vias.lua', chamadas: 10, media_ms: 1 }),
      etapa({ etapa: 'classificacao', provedor: 'local-por-categoria', chamadas: 4 }),
      etapa({ etapa: 'regra_lua', provedor: 'itamogi/agua.lua', chamadas: 30, media_ms: 5, falhas: 1, ultima_falha: '2026-11-15T02:00:00Z', ultimo_erro: ' erro na linha 3 ' }),
      etapa({ etapa: 'classificacao', provedor: 'jev-1.14.0', chamadas: 6, falhas: 6, ultima_falha: '2026-11-15T02:10:00Z', ultimo_erro: 'Jev: status 503' }),
      etapa({ etapa: 'borrao', provedor: 'midia.BorradorSeletivo' }),
    ])
    expect(linhas.map((l) => [l.nome, l.quem])).toEqual([
      ['Borrar rostos e placas', null],
      ['Avaliar a urgência', 'Jev'],
      ['Avaliar a urgência', 'regra local, sem IA'],
      ['Regra da prefeitura', null],
    ])
    const regra = linhas[3]
    expect(regra.chamadas).toBe(40)
    expect(regra.falhas).toBe(1)
    expect(regra.media_ms).toBe(4)
    expect(regra.selo).toBe('instável')
    expect(regra.ultimo_erro).toBe('erro na linha 3')
    expect(linhas[1].selo).toBe('falhando')
  })

  it('dá o selo pela parcela de falhas', () => {
    expect(seloDaEtapa(10, 0)).toBe('ok')
    expect(seloDaEtapa(10, 5)).toBe('instável')
    expect(seloDaEtapa(10, 6)).toBe('falhando')
    expect(seloDaEtapa(0, 0)).toBe('ok')
  })
})

describe('nomes em português comum', () => {
  it('traduz as etapas e deixa a desconhecida legível', () => {
    expect(nomeDaEtapa('borrao')).toBe('Borrar rostos e placas')
    expect(nomeDaEtapa('armazenamento')).toBe('Guardar as fotos')
    expect(nomeDaEtapa('geocodigo')).toBe('Descobrir o endereço')
    expect(nomeDaEtapa('visao')).toBe('Olhar a foto (IA)')
    expect(nomeDaEtapa('classificacao')).toBe('Avaliar a urgência')
    expect(nomeDaEtapa('regra_lua')).toBe('Regra da prefeitura')
    expect(nomeDaEtapa('etapa_nova')).toBe('etapa nova')
  })

  it('traduz quem avaliou a urgência', () => {
    expect(nomeDoProvedor('jev-1.14.0')).toBe('Jev')
    expect(nomeDoProvedor('local-por-categoria')).toBe('regra local, sem IA')
    expect(nomeDoProvedor('anthropic/claude-haiku')).toBe('IA de reserva')
    expect(nomeDoProvedor('outro')).toBe('outro')
  })

  it('traduz os avisos dos aparelhos e mostra o desconhecido como veio', () => {
    expect(nomeDoSinal('gps_negado')).toBe('Localização negada')
    expect(nomeDoSinal('gps_impreciso')).toBe('Localização imprecisa')
    expect(nomeDoSinal('foto_ilegivel')).toBe('Foto que não abriu')
    expect(nomeDoSinal('envio_falhou')).toBe('Envio que não saiu')
    expect(nomeDoSinal('video_falhou')).toBe('Vídeo que não gravou')
    expect(nomeDoSinal('camera_negada')).toBe('Câmera negada')
    expect(nomeDoSinal('campo_envio_falhou')).toBe('Equipe: envio que não saiu')
    expect(nomeDoSinal('campo_foto_ilegivel')).toBe('Equipe: foto que não abriu')
    expect(nomeDoSinal('campo_gps_negado')).toBe('Equipe: localização negada')
    expect(nomeDoSinal('bateria_fraca_demais')).toBe('bateria fraca demais')
  })

  it('traduz só as rotas principais', () => {
    expect(nomeDaRota('POST /ocorrencias')).toBe('Envio de relato')
    expect(nomeDaRota('GET /ocorrencias')).toBe('Lista de chamados')
    expect(nomeDaRota('GET /midia')).toBe('Fotos e vídeos')
    expect(nomeDaRota('POST /auth/login')).toBe('Entrar no painel')
    expect(nomeDaRota('GET /ocorrencias/{id}')).toBe('GET /ocorrencias/{id}')
  })

  it('diz o papel em palavras', () => {
    expect(rotuloDoPapel('gestor')).toBe('Gestor: vê e muda tudo')
    expect(rotuloDoPapel('operador', '')).toBe('Central: confere e manda as equipes')
    expect(rotuloDoPapel('campo', 'Obras e vias')).toBe('Equipe de campo: Obras e vias')
    expect(rotuloDoPapel('campo', '')).toBe('Equipe de campo: sem secretaria')
    expect(rotuloDoPapel('auditor')).toBe('auditor')
  })

  it('transforma a mensagem do servidor em frase', () => {
    expect(comoFrase('você não pode tirar o seu próprio acesso de gestor')).toBe('Você não pode tirar o seu próprio acesso de gestor.')
    expect(comoFrase('Já é frase.')).toBe('Já é frase.')
    expect(comoFrase('  ')).toBe('Algo deu errado.')
  })
})

describe('tempo em palavras', () => {
  it('diz há quanto tempo', () => {
    expect(haQuanto('2026-11-15T02:27:00Z', AGORA)).toBe('há 3 min')
    expect(haQuanto('2026-11-15T02:29:40Z', AGORA)).toBe('agora há pouco')
    expect(haQuanto('2026-11-15T00:20:00Z', AGORA)).toBe('há 2 h 10 min')
    expect(haQuanto('2026-11-13T02:30:00Z', AGORA)).toBe('há 2 dias')
    // Relógio do aparelho atrasado em relação ao servidor não vira tempo negativo.
    expect(haQuanto('2026-11-15T02:30:05Z', AGORA)).toBe('agora há pouco')
  })

  it('diz há quanto tempo o servidor está no ar', () => {
    expect(noArHa('2026-11-15T00:20:00Z', AGORA)).toBe('no ar há 2 h 10 min')
    expect(noArHa('2026-11-15T02:29:50Z', AGORA)).toBe('no ar há menos de 1 min')
    expect(noArHa('2026-11-12T22:30:00Z', AGORA)).toBe('no ar há 2 dias 4 h')
  })

  it('escreve durações com no máximo duas unidades', () => {
    expect(duracaoEmPalavras(5 * 60_000)).toBe('5 min')
    expect(duracaoEmPalavras(3 * 3_600_000)).toBe('3 h')
    expect(duracaoEmPalavras(24 * 3_600_000)).toBe('1 dia')
  })

  it('diz o tempo de uma etapa', () => {
    expect(tempoEmPalavras(0)).toBe('menos de 1 s')
    expect(tempoEmPalavras(999)).toBe('menos de 1 s')
    expect(tempoEmPalavras(1200)).toBe('1,2 s')
    expect(tempoEmPalavras(12_400)).toBe('12 s')
    expect(tempoEmPalavras(65_000)).toBe('1 min 5 s')
    expect(tempoEmPalavras(120_000)).toBe('2 min')
  })

  it('avisa da falta de relato só de dia e depois de 30 minutos', () => {
    expect(avisoSemRelato('2026-11-15T01:48:00Z', AGORA, 14)).toBe('Nenhum relato há 42 min')
    expect(avisoSemRelato('2026-11-15T02:10:00Z', AGORA, 14)).toBeNull()
    expect(avisoSemRelato('2026-11-15T01:48:00Z', AGORA, 3)).toBeNull()
    expect(avisoSemRelato('2026-11-15T01:48:00Z', AGORA, 22)).toBeNull()
    expect(avisoSemRelato(null, AGORA, 10)).toBe('Nenhum relato real chegou ainda')
  })
})

describe('texto alternativo dos gráficos', () => {
  it('lê os relatos por hora com os números', () => {
    const horas = [
      { hora: 'a', relatos: 0, tambem_vi: 0 },
      { hora: 'b', relatos: 3, tambem_vi: 1 },
      { hora: 'c', relatos: 1, tambem_vi: 0 },
    ]
    expect(textoDoGraficoDeRelatos(horas, (h) => h + 'h')).toBe(
      'Relatos por hora nas últimas 24 horas: 4 relatos e 1 "também vi" no total. bh: 3 relatos e 1 "também vi"; ch: 1 relato.',
    )
    expect(textoDoGraficoDeRelatos([horas[0]], (h) => h)).toBe('Relatos por hora nas últimas 24 horas: nenhum relato.')
  })

  it('lê os pedidos por minuto com os números', () => {
    const t = textoDoGraficoDoServidor([
      { minuto: 'a', pedidos: 4, erros_5xx: 1, recusas_4xx: 0 },
      { minuto: 'b', pedidos: 6, erros_5xx: 0, recusas_4xx: 2 },
    ])
    expect(t).toBe('Pedidos por minuto nos últimos 60 minutos: 10 pedidos, 1 erro do sistema e 2 recusados. No minuto mais cheio, 6 pedidos.')
  })
})

describe('gerador de senha', () => {
  afterEach(() => vi.restoreAllMocks())

  it('gera 12 caracteres do alfabeto sem ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      const s = gerarSenha()
      expect(s).toHaveLength(12)
      expect(s).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/)
    }
  })

  it('não tem no alfabeto os caracteres que se confundem', () => {
    expect(ALFABETO_DA_SENHA).not.toMatch(/[01iloO]/)
    expect(new Set(ALFABETO_DA_SENHA).size).toBe(ALFABETO_DA_SENHA.length)
    expect(ALFABETO_DA_SENHA).toBe(ALFABETO_DA_SENHA.toLowerCase())
  })

  it('usa crypto.getRandomValues', () => {
    const espia = vi.spyOn(globalThis.crypto, 'getRandomValues')
    gerarSenha()
    expect(espia).toHaveBeenCalled()
  })

  it('não repete a mesma senha', () => {
    expect(new Set(Array.from({ length: 50 }, () => gerarSenha())).size).toBe(50)
  })

  it('descarta os bytes que desequilibram o sorteio e respeita o tamanho pedido', () => {
    // 248 a 255 ficam fora: 256 não é múltiplo de 31.
    const s = gerarSenha(4, (n) => new Uint8Array(n).map((_, i) => [255, 0, 248, 31, 30, 1][i % 6]))
    expect(s).toBe('aa9b')
  })

  it('separa em blocos de quatro só para a leitura', () => {
    expect(senhaEmBlocos('abcdefgh2345')).toEqual(['abcd', 'efgh', '2345'])
  })
})

describe('parâmetros da cidade', () => {
  const padrao: Parametros = {
    raio_agrupamento_m: 50, janela_agrupamento_dias: 30, raio_perto_m: 80, envios_por_aparelho: 12, envios_por_ip: 120,
    retencao_dias: 90, modulos: { video: true, perto: true, campo: true, voz: true, recuperacao: false },
  }

  it('aceita o padrão e os extremos das faixas', () => {
    expect(conferirParametros(padrao)).toBeNull()
    expect(conferirParametros({ ...padrao, raio_agrupamento_m: 5, janela_agrupamento_dias: 365, raio_perto_m: 10, retencao_dias: 0 })).toBeNull()
    expect(conferirParametros({ ...padrao, envios_por_aparelho: 200, envios_por_ip: 200 })).toBeNull()
    expect(conferirParametros({ ...padrao, envios_por_ip: 5000, retencao_dias: 3650 })).toBeNull()
  })

  it('recusa fora da faixa com a mesma frase do servidor', () => {
    expect(conferirParametros({ ...padrao, raio_agrupamento_m: 4 })).toBe('raio de agrupamento entre 5 e 500 metros')
    expect(conferirParametros({ ...padrao, raio_agrupamento_m: 501 })).toBe('raio de agrupamento entre 5 e 500 metros')
    expect(conferirParametros({ ...padrao, janela_agrupamento_dias: 0 })).toBe('janela de agrupamento entre 1 e 365 dias')
    expect(conferirParametros({ ...padrao, raio_perto_m: 9 })).toBe('raio de perto de você entre 10 e 500 metros')
    expect(conferirParametros({ ...padrao, envios_por_aparelho: 0 })).toBe('envios por aparelho entre 1 e 200 a cada 10 minutos')
    expect(conferirParametros({ ...padrao, envios_por_ip: 11 })).toBe('envios por IP entre o limite por aparelho e 5000 a cada 10 minutos')
    expect(conferirParametros({ ...padrao, envios_por_ip: 5001 })).toBe('envios por IP entre o limite por aparelho e 5000 a cada 10 minutos')
    expect(conferirParametros({ ...padrao, retencao_dias: -1 })).toBe('retenção entre 0 e 3650 dias')
    expect(conferirParametros({ ...padrao, retencao_dias: 3651 })).toBe('retenção entre 0 e 3650 dias')
  })

  it('recusa campo vazio e número quebrado', () => {
    expect(conferirParametros({ ...padrao, raio_perto_m: NaN })).toBe('raio de perto de você entre 10 e 500 metros')
    expect(conferirParametros({ ...padrao, retencao_dias: 1.5 })).toBe('retenção entre 0 e 3650 dias')
  })

  it('aponta todos os campos errados, e o primeiro na ordem da tela', () => {
    const p = { ...padrao, raio_agrupamento_m: 1, retencao_dias: 9999 }
    expect(Object.keys(errosDosParametros(p))).toEqual(['raio_agrupamento_m', 'retencao_dias'])
    expect(conferirParametros(p)).toBe('raio de agrupamento entre 5 e 500 metros')
  })

  it('conta o que mudou, módulos incluídos', () => {
    expect(diferencas(padrao, padrao)).toEqual([])
    const novo = { ...padrao, raio_agrupamento_m: 60, modulos: { ...padrao.modulos, video: false } }
    expect(diferencas(novo, padrao)).toEqual(['raio_agrupamento_m', 'modulos.video'])
    expect(resumoDasMudancas(0)).toBe('Nada alterado')
    expect(resumoDasMudancas(1)).toBe('1 ajuste alterado')
    expect(resumoDasMudancas(2)).toBe('2 ajustes alterados')
  })

  it('tem uma pergunta para cada parâmetro numérico, com faixa igual à do servidor', () => {
    expect(AJUSTES.map((a) => a.chave)).toEqual([
      'raio_agrupamento_m', 'janela_agrupamento_dias', 'raio_perto_m', 'envios_por_aparelho', 'envios_por_ip', 'retencao_dias',
    ])
    for (const a of AJUSTES) {
      expect(conferirParametros({ ...padrao, envios_por_aparelho: 1, envios_por_ip: 5000, [a.chave]: a.max }), a.chave).toBeNull()
      expect(conferirParametros({ ...padrao, [a.chave]: a.max + 1 }), a.chave).not.toBeNull()
      expect(conferirParametros({ ...padrao, envios_por_aparelho: 1, [a.chave]: a.min - 1 }), a.chave).not.toBeNull()
    }
  })

  it('escreve o valor com a unidade', () => {
    expect(valorComUnidade(AJUSTES[0], 50)).toBe('50 m')
    expect(valorComUnidade(AJUSTES[1], 30)).toBe('30 dias')
    expect(valorComUnidade(AJUSTES[1], 1)).toBe('1 dia')
    expect(valorComUnidade(AJUSTES[3], 12)).toBe('12 relatos')
  })

  it('anda em passos grandes sem sair da faixa', () => {
    expect(passoDoAjuste(50, 10, 5, 500, 1)).toBe(60)
    expect(passoDoAjuste(50, 10, 5, 500, -1)).toBe(40)
    expect(passoDoAjuste(53, 10, 5, 500, 1)).toBe(60)
    expect(passoDoAjuste(53, 10, 5, 500, -1)).toBe(50)
    expect(passoDoAjuste(5, 10, 5, 500, -1)).toBe(5)
    expect(passoDoAjuste(495, 10, 5, 500, 1)).toBe(500)
    expect(passoDoAjuste(NaN, 10, 5, 500, 1)).toBe(5)
  })
})

describe('usuários', () => {
  const u = (p: Partial<Cadastro>): Cadastro => ({ login: 'x', nome: '', papel: 'operador', secretaria: '', ativo: true, criado_em: AGORA, ...p })

  it('põe os desligados no fim e ordena por papel e nome', () => {
    const lista = ordenarUsuarios([
      u({ login: 'teste1', papel: 'gestor', ativo: false }),
      u({ login: 'zeca', papel: 'campo', secretaria: 'Obras e vias' }),
      u({ login: 'operador' }),
      u({ login: 'ana', nome: 'Ana', papel: 'campo', secretaria: 'Trânsito' }),
      u({ login: 'gestor', papel: 'gestor' }),
    ])
    expect(lista.map((x) => x.login)).toEqual(['gestor', 'operador', 'ana', 'zeca', 'teste1'])
  })

  it('confere o cadastro novo antes de enviar', () => {
    const ok = { login: 'obras1', senha: 'abcdefgh2345', papel: 'campo' as const, secretaria: 'Obras e vias' }
    expect(conferirNovoUsuario(ok)).toBeNull()
    expect(conferirNovoUsuario({ ...ok, login: 'ab' })).toMatch(/^login de 3 a 32 caracteres/)
    expect(conferirNovoUsuario({ ...ok, login: 'Obras 1' })).toMatch(/^login de 3 a 32 caracteres/)
    expect(conferirNovoUsuario({ ...ok, papel: '' })).toBe('escolha o que a pessoa faz no sistema')
    expect(conferirNovoUsuario({ ...ok, secretaria: ' ' })).toBe('usuário de campo precisa de uma secretaria')
    expect(conferirNovoUsuario({ ...ok, papel: 'operador', secretaria: '' })).toBeNull()
    expect(conferirNovoUsuario({ ...ok, senha: '' })).toBe('gere uma senha para a pessoa')
  })
})

describe('atualização só com a aba visível', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function documentoFalso(estado: 'visible' | 'hidden') {
    const ouvintes = new Set<() => void>()
    const doc = {
      visibilityState: estado,
      addEventListener: (_: string, f: () => void) => ouvintes.add(f),
      removeEventListener: (_: string, f: () => void) => ouvintes.delete(f),
    }
    vi.stubGlobal('document', doc)
    return {
      mudar: (novo: 'visible' | 'hidden') => {
        doc.visibilityState = novo
        for (const f of ouvintes) f()
      },
      ouvintes,
    }
  }

  it('repete com a aba à vista, para com ela oculta e busca na hora ao voltar', () => {
    vi.useFakeTimers()
    const aba = documentoFalso('visible')
    const fn = vi.fn()
    const parar = repetirComAbaVisivel(fn, 15_000)
    vi.advanceTimersByTime(30_000)
    expect(fn).toHaveBeenCalledTimes(2)

    aba.mudar('hidden')
    vi.advanceTimersByTime(60_000)
    expect(fn).toHaveBeenCalledTimes(2)

    aba.mudar('visible')
    expect(fn).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(15_000)
    expect(fn).toHaveBeenCalledTimes(4)

    parar()
    vi.advanceTimersByTime(60_000)
    expect(fn).toHaveBeenCalledTimes(4)
    expect(aba.ouvintes.size).toBe(0)
  })

  it('não começa a contar com a aba já oculta', () => {
    vi.useFakeTimers()
    documentoFalso('hidden')
    const fn = vi.fn()
    const parar = repetirComAbaVisivel(fn, 15_000)
    vi.advanceTimersByTime(60_000)
    expect(fn).not.toHaveBeenCalled()
    parar()
  })
})

describe('resumoDoVeredito', () => {
  const atencao = (texto: string) => ({ gravidade: 'atencao' as const, texto })
  const problema = (texto: string) => ({ gravidade: 'problema' as const, texto })

  it('com um motivo só, usa o motivo como frase e não repete na lista', () => {
    const r = resumoDoVeredito({ nivel: 'atencao', titulo: 'Atenção', frase: 'x', motivos: [{ ...atencao('A leitura de endereço falhou'), acao: 'use o ponto no mapa' }] })
    expect(r.frase).toBe('A leitura de endereço falhou: use o ponto no mapa.')
    expect(r.motivos).toEqual([])
  })

  it('sem motivo, mantém a frase do veredito', () => {
    expect(resumoDoVeredito({ nivel: 'ok', titulo: 'Tudo funcionando', frase: 'Tudo certo.', motivos: [] }).frase).toBe('Tudo certo.')
  })

  it('com vários, conta e só marca a gravidade quando ela muda', () => {
    const so = resumoDoVeredito({ nivel: 'atencao', titulo: '', frase: '', motivos: [atencao('a'), atencao('b'), atencao('c')] })
    expect(so.frase).toBe('3 pontos pedem atenção.')
    expect(so.marcarGravidade).toBe(false)
    expect(so.motivos).toHaveLength(3)
    const mistura = resumoDoVeredito({ nivel: 'problema', titulo: '', frase: '', motivos: [problema('a'), atencao('b'), atencao('c')] })
    expect(mistura.frase).toBe('1 problema e 2 pontos de atenção.')
    expect(mistura.marcarGravidade).toBe(true)
    expect(resumoDoVeredito({ nivel: 'problema', titulo: '', frase: '', motivos: [problema('a'), problema('b')] }).frase).toBe('2 problemas agora.')
  })
})

describe('detalheDoSinal', () => {
  it('troca o código do celular por palavras', () => {
    expect(detalheDoSinal('sem_conexao')).toBe('sem conexão')
    expect(detalheDoSinal('foto_grande')).toBe('foto grande demais')
  })
  it('tira os sublinhados do código que não conhece', () => {
    expect(detalheDoSinal('erro_estranho_novo')).toBe('erro estranho novo')
    expect(detalheDoSinal(' HTTP 502 ')).toBe('HTTP 502')
  })
})

describe('funil do relato', () => {
  it('barras pelo começo e queda entre etapas, sem queda negativa', () => {
    const e = etapasDoFunil([
      { chave: 'funil_abriu', n: 20 },
      { chave: 'funil_cadastro', n: 5 },
      { chave: 'funil_foto', n: 10 },
      { chave: 'funil_enviou', n: 8 },
    ])
    expect(e.map((x) => x.nome)).toEqual(['Abriu o app', 'Fez o cadastro', 'Tirou a foto', 'Enviou o relato'])
    expect(e.map((x) => x.doInicio)).toEqual([100, 25, 50, 40])
    expect(e.map((x) => x.queda)).toEqual([null, 75, 0, 20])
  })
  it('sem dados, sem barras; começo zero não divide por zero', () => {
    expect(etapasDoFunil(undefined)).toEqual([])
    expect(etapasDoFunil([{ chave: 'funil_abriu', n: 0 }, { chave: 'funil_enviou', n: 0 }]).map((x) => x.doInicio)).toEqual([0, 0])
  })
})

describe('módulos ligáveis', () => {
  it('todo módulo tem dono e data para rever (feature flag não fica para sempre)', () => {
    for (const m of MODULOS) {
      expect(m.dono.length).toBeGreaterThan(0)
      expect(m.revisarEm.length).toBeGreaterThan(0)
    }
  })
})
