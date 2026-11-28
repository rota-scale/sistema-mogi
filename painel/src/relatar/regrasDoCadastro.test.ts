import { describe, expect, it } from 'vitest'
import {
  atualizarRecentes,
  corpoDaEdicao,
  corpoDoCadastro,
  mascararCep,
  erroDoDocumento,
  errosDoCadastro,
  fraseDosResolvidos,
  haQuanto,
  codigoCompleto,
  documentoDeEntrada,
  interpretarCadastro,
  interpretarEntrada,
  mascararCodigo,
  mascararCpfOuCnpj,
  mensagemDaEntrada,
  juntarSugestao,
  lerComunidade,
  lerMeusRelatos,
  lerMorador,
  mascararCnpj,
  mascararCpf,
  mascararDocumento,
  mensagemDoCadastro,
  nomeDoDocumento,
  somenteDigitos,
  sugestoesDoTipo,
  temErro,
  tempoMedio,
  unirRelatos,
  validarCnpj,
  validarCpf,
} from './regrasDoCadastro'
import type { Recente } from './logica'
import { acaoDoErro, codigoDoErro, depoisDaConfirmacao, interpretarConfirmacao, interpretarEnvio, lerConfig, mensagemDeErro } from './logica'

// CPF e CNPJ válidos de exemplo (dígitos verificadores certos, não são de ninguém).
const CPF = '52998224725'
const CNPJ = '11222333000181'

describe('CPF', () => {
  it('aceita dígitos verificadores certos, com ou sem máscara', () => {
    expect(validarCpf(CPF)).toBe(true)
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('111.444.777-35')).toBe(true)
  })
  it('recusa dígito errado, tamanho errado e números repetidos', () => {
    expect(validarCpf('52998224724')).toBe(false)
    expect(validarCpf('5299822472')).toBe(false)
    expect(validarCpf('529982247250')).toBe(false)
    expect(validarCpf('11111111111')).toBe(false)
    expect(validarCpf('00000000000')).toBe(false)
    expect(validarCpf('')).toBe(false)
  })
  it('mascara enquanto digita, sem pontuação sobrando', () => {
    expect(mascararCpf('')).toBe('')
    expect(mascararCpf('529')).toBe('529')
    expect(mascararCpf('5299')).toBe('529.9')
    expect(mascararCpf('529982')).toBe('529.982')
    expect(mascararCpf('5299822')).toBe('529.982.2')
    expect(mascararCpf('5299822472')).toBe('529.982.247-2')
    expect(mascararCpf(CPF)).toBe('529.982.247-25')
    // Colado com lixo ou além de 11 números: corta.
    expect(mascararCpf('529.982.247-25999')).toBe('529.982.247-25')
    expect(mascararCpf('ab5c2')).toBe('52')
  })
})

describe('CNPJ', () => {
  it('aceita dígitos certos e recusa os errados', () => {
    expect(validarCnpj(CNPJ)).toBe(true)
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
    expect(validarCnpj('11222333000180')).toBe(false)
    expect(validarCnpj('22222222222222')).toBe(false)
    expect(validarCnpj('1122233300018')).toBe(false)
  })
  it('mascara enquanto digita', () => {
    expect(mascararCnpj('11')).toBe('11')
    expect(mascararCnpj('112')).toBe('11.2')
    expect(mascararCnpj('112223')).toBe('11.222.3')
    expect(mascararCnpj('112223330')).toBe('11.222.333/0')
    expect(mascararCnpj('1122233300018')).toBe('11.222.333/0001-8')
    expect(mascararCnpj(CNPJ)).toBe('11.222.333/0001-81')
  })
  it('a empresa usa CNPJ; pessoa e servidor, CPF', () => {
    expect(nomeDoDocumento('pj')).toBe('CNPJ')
    expect(nomeDoDocumento('pf')).toBe('CPF')
    expect(nomeDoDocumento('servidor')).toBe('CPF')
    expect(mascararDocumento('pj', CNPJ)).toBe('11.222.333/0001-81')
    expect(mascararDocumento('servidor', CPF)).toBe('529.982.247-25')
  })
})

describe('formulário do cadastro', () => {
  const certo = { tipo: 'pf' as const, nome: 'Maria Souza', documento: '529.982.247-25', profissao: '', bairro: '', aceite: true }

  it('frases claras para cada problema do documento', () => {
    expect(erroDoDocumento('pf', '')).toBe('Digite o CPF.')
    expect(erroDoDocumento('pf', '529.982')).toBe('O CPF tem 11 números.')
    expect(erroDoDocumento('pf', '529.982.247-24')).toBe('Este CPF não existe. Confira os números.')
    expect(erroDoDocumento('pj', '11.222')).toBe('O CNPJ tem 14 números.')
    expect(erroDoDocumento('pf', CPF)).toBeNull()
  })

  it('pede nome, documento válido e o aceite', () => {
    expect(temErro(errosDoCadastro(certo))).toBe(false)
    const e = errosDoCadastro({ ...certo, nome: ' ', documento: '111.111.111-11', aceite: false })
    expect(e).toEqual({ nome: 'Escreva seu nome.', documento: 'Este CPF não existe. Confira os números.', aceite: 'Marque a caixa para concordar.' })
    expect(errosDoCadastro({ ...certo, tipo: 'pj', nome: '', documento: CNPJ }).nome).toBe('Escreva o nome da empresa.')
  })

  it('manda só números no documento e deixa de fora o opcional vazio', () => {
    expect(corpoDoCadastro(certo)).toEqual({ tipo: 'pf', nome: 'Maria Souza', documento: CPF, aceite: true })
    expect(corpoDoCadastro({ ...certo, nome: '  Maria   Souza ', profissao: ' Pedreira ', bairro: 'Centro' })).toEqual({
      tipo: 'pf',
      nome: 'Maria Souza',
      documento: CPF,
      aceite: true,
      profissao: 'Pedreira',
      bairro: 'Centro',
    })
    expect(corpoDaEdicao({ nome: ' Ana ', profissao: '', bairro: ' Vila  Nova ' })).toEqual({ nome: 'Ana', profissao: '', bairro: 'Vila Nova' })
  })

  it('somenteDigitos tira tudo que não é número', () => {
    expect(somenteDigitos('529.982.247-25')).toBe(CPF)
  })
})

describe('resposta do cadastro', () => {
  const morador = { id: 7, tipo: 'servidor', nome: 'Ana', documento_mascarado: '***.***.247-25', profissao: null, bairro: 'Centro', criado_em: '2026-11-16T10:00:00Z' }

  it('201 e 200 trazem token e morador', () => {
    expect(interpretarCadastro(201, { token: 'abc', morador, codigo_recuperacao: 'ABCD-EFGH-JKMN' })).toEqual({
      token: 'abc',
      codigo: 'ABCD-EFGH-JKMN',
      morador: {
        id: '7',
        tipo: 'servidor',
        nome: 'Ana',
        documento_mascarado: '***.***.247-25',
        profissao: null,
        bairro: 'Centro',
        cep: null,
        municipio: null,
        uf: null,
        criado_em: '2026-11-16T10:00:00Z',
      },
    })
    expect(interpretarCadastro(201, { morador })).toEqual({ falha: 'desconhecido' })
    // Sem o módulo de recuperação o servidor não manda código: vale o cadastro.
    expect(interpretarCadastro(201, { token: 'abc', morador })).toMatchObject({ token: 'abc', codigo: null })
  })

  it('documento já cadastrado não entra sem o código (issue #26)', () => {
    expect(interpretarCadastro(409, { codigo: 'documento_cadastrado' })).toEqual({ falha: 'documento_cadastrado' })
    expect(interpretarCadastro(200, { token: 'abc', morador: { nome: 'Ana' } })).toEqual({ falha: 'desconhecido' })
    expect(mensagemDoCadastro('documento_cadastrado', 'pf')).toContain('código de recuperação')
    expect(mensagemDoCadastro('documento_cadastrado', 'pf', false)).toContain('Peça à prefeitura')
  })

  it('código de recuperação: máscara sem letras que se confundem', () => {
    expect(mascararCodigo('abcd efgh jkmn')).toBe('ABCD-EFGH-JKMN')
    expect(mascararCodigo('ab0o1il')).toBe('AB')
    expect(mascararCodigo('ABCDEFGHJKMNPQ')).toBe('ABCD-EFGH-JKMN')
    expect(codigoCompleto('abcd-efgh-jkm')).toBe(false)
    expect(codigoCompleto('abcdefghjkmn')).toBe(true)
  })

  it('entrar aceita CPF ou CNPJ e não revela se o documento existe', () => {
    expect(mascararCpfOuCnpj(CPF)).toBe('529.982.247-25')
    expect(mascararCpfOuCnpj(CNPJ)).toBe('11.222.333/0001-81')
    expect(documentoDeEntrada(CPF)).toBe(true)
    expect(documentoDeEntrada(CNPJ)).toBe(true)
    expect(documentoDeEntrada('12345678900')).toBe(false)
    const morador = { id: '7', nome: 'Ana' }
    expect('token' in interpretarEntrada(200, { token: 'x', morador })).toBe(true)
    expect(interpretarEntrada(401, { codigo: 'credenciais_invalidas' })).toEqual({ falha: 'credenciais_invalidas' })
    expect(interpretarEntrada(429, null)).toEqual({ falha: 'muitos_envios' })
    expect(interpretarEntrada(0, null)).toEqual({ falha: 'sem_conexao' })
    expect(mensagemDaEntrada('credenciais_invalidas')).toContain('não conferem')
  })

  it('códigos do servidor viram frases', () => {
    expect(interpretarCadastro(400, { codigo: 'documento_invalido' })).toEqual({ falha: 'documento_invalido' })
    expect(interpretarCadastro(400, { codigo: 'aceite_obrigatorio' })).toEqual({ falha: 'aceite_obrigatorio' })
    expect(interpretarCadastro(400, { codigo: 'nome_invalido' })).toEqual({ falha: 'nome_invalido' })
    expect(mensagemDoCadastro('nome_invalido', 'pf')).toBe('Escreva seu nome.')
    expect(interpretarCadastro(0, null)).toEqual({ falha: 'sem_conexao' })
    expect(interpretarCadastro(429, null)).toEqual({ falha: 'muitos_envios' })
    expect(interpretarCadastro(500, null)).toEqual({ falha: 'desconhecido' })
    expect(mensagemDoCadastro('documento_invalido', 'pj')).toBe('Este CNPJ não existe. Confira os números.')
    expect(mensagemDoCadastro('sem_conexao', 'pf')).toContain('Sem internet')
  })

  it('lerMorador exige o nome e corrige o tipo desconhecido', () => {
    expect(lerMorador(null)).toBeNull()
    expect(lerMorador({ tipo: 'pf' })).toBeNull()
    expect(lerMorador({ nome: 'Zé', tipo: 'x' })?.tipo).toBe('pf')
  })
})

describe('meus relatos', () => {
  const bruto = {
    total: 3,
    resolvidos: 1,
    tempo_medio_horas: 50,
    relatos: [
      { protocolo: 'MOGI-1', categoria: 'vias', categoria_nome: 'Buraco na via', status: 'resolvida', nivel: 3, criado_em: '2026-11-10T10:00:00Z', resolvido_em: '2026-11-12T12:00:00Z', chave: 'k1' },
      { protocolo: 'MOGI-2', categoria: 'agua', status: 'estranho', nivel: null, criado_em: '2026-11-15T10:00:00Z', chave: null },
      { categoria: 'agua' },
    ],
  }

  it('lê números e relatos, descartando o que não tem protocolo', () => {
    const m = lerMeusRelatos(bruto)!
    expect(m.total).toBe(3)
    expect(m.resolvidos).toBe(1)
    expect(m.tempo_medio_horas).toBe(50)
    expect(m.relatos).toHaveLength(2)
    expect(m.relatos[1].status).toBe('a_classificar')
    expect(m.relatos[1].chave).toBeNull()
    expect(lerMeusRelatos({ relatos: [] })).toEqual({ total: 0, resolvidos: 0, tempo_medio_horas: null, relatos: [] })
    expect(lerMeusRelatos('x')).toBeNull()
  })

  it('tempo médio em palavras curtas', () => {
    expect(tempoMedio(null)).toBe('Ainda não')
    expect(tempoMedio(0.2)).toBe('1 h')
    expect(tempoMedio(5.4)).toBe('5 h')
    expect(tempoMedio(26)).toBe('1 dia')
    expect(tempoMedio(50)).toBe('2 dias')
  })

  it('junta aos relatos do aparelho sem perder o lugar do pino', () => {
    const locais: Recente[] = [
      { protocolo: 'MOGI-1', nivel: null, criado_em: '2026-11-10T10:00:00Z', chave: null, status: 'aberta', lat: -21, lng: -47, categoria: null },
    ]
    const m = lerMeusRelatos(bruto)!
    const atual = atualizarRecentes(locais, m.relatos)
    expect(atual[0]).toEqual({ ...locais[0], nivel: 3, status: 'resolvida', chave: 'k1', categoria: 'vias' })
    const unidos = unirRelatos(locais, m.relatos)
    expect(unidos.map((r) => r.protocolo)).toEqual(['MOGI-1', 'MOGI-2'])
    expect(unidos[1].lat).toBeNull()
    expect(unidos[0].lat).toBe(-21)
  })
})

describe('meu bairro', () => {
  it('lê o resumo e os itens', () => {
    const c = lerComunidade({
      raio_m: 800,
      resolvidos_30d: 12,
      abertos: 4,
      bairro: 'Centro',
      itens: [{ categoria: 'vias', categoria_nome: 'Buraco', resolvido_em: '2026-11-14T10:00:00Z', foto_depois_url: '/api/midia/x', distancia_m: 120 }, { nada: 1 }],
    })!
    expect(c.resolvidos_30d).toBe(12)
    expect(c.abertos).toBe(4)
    expect(c.bairro).toBe('Centro')
    expect(c.itens).toHaveLength(1)
    expect(lerComunidade({}))
      .toEqual({ raio_m: 0, resolvidos_30d: 0, abertos: 0, bairro: null, itens: [] })
  })

  it('frases do contador e da data', () => {
    expect(fraseDosResolvidos(1)).toBe('1 problema resolvido perto de você nos últimos 30 dias')
    expect(fraseDosResolvidos(12)).toBe('12 problemas resolvidos perto de você nos últimos 30 dias')
    const agora = new Date('2026-11-16T15:00:00')
    expect(haQuanto('2026-11-16T08:00:00', agora)).toBe('hoje')
    expect(haQuanto('2026-11-15T20:00:00', agora)).toBe('ontem')
    expect(haQuanto('2026-11-11T10:00:00', agora)).toBe('há 5 dias')
    expect(haQuanto('', agora)).toBe('')
  })
})

describe('descrição', () => {
  it('três sugestões por tipo e as gerais sem tipo', () => {
    expect(sugestoesDoTipo('agua')).toEqual(['Cano estourado', 'Vazamento', 'Esgoto'])
    expect(sugestoesDoTipo(null)).toHaveLength(3)
    expect(sugestoesDoTipo('desconhecido')).toEqual(sugestoesDoTipo(null))
  })
  it('a sugestão entra no texto sem repetir', () => {
    expect(juntarSugestao('', 'Vazamento')).toBe('Vazamento')
    expect(juntarSugestao('Na esquina', 'Vazamento')).toBe('Na esquina, vazamento')
    expect(juntarSugestao('Na esquina.', 'Esgoto')).toBe('Na esquina. esgoto')
    expect(juntarSugestao('vazamento forte', 'Vazamento')).toBe('vazamento forte')
  })
})

describe('cadastro no envio, no Também vi e na config', () => {
  it('401 pede o cadastro e mantém o relato', () => {
    expect(codigoDoErro(401, 'cadastro_obrigatorio')).toBe('cadastro_obrigatorio')
    expect(codigoDoErro(401, undefined)).toBe('cadastro_obrigatorio')
    expect(acaoDoErro('cadastro_obrigatorio')).toBe('cadastro')
    expect(mensagemDeErro('cadastro_obrigatorio')).toContain('cadastro')
    expect(interpretarEnvio(401, { codigo: 'cadastro_obrigatorio' })).toEqual({ codigo: 'cadastro_obrigatorio' })
    expect(interpretarConfirmacao(401, { codigo: 'cadastro_obrigatorio' })).toEqual({ codigo: 'cadastro_obrigatorio' })
    expect(depoisDaConfirmacao('cadastro_obrigatorio')).toBe('cadastro')
  })
  it('recibo fora do escopo', () => {
    const r = interpretarEnvio(201, { protocolo: 'MOGI-9', fora_do_escopo: true })
    expect('resposta' in r && r.resposta.fora_do_escopo).toBe(true)
    const s = interpretarEnvio(201, { protocolo: 'MOGI-9' })
    expect('resposta' in s && s.resposta.fora_do_escopo).toBeUndefined()
  })
  it('modulos.cadastro só liga com true', () => {
    const base = { categorias: [{ id: 'vias', nome: 'Vias' }] }
    expect(lerConfig({ ...base, modulos: { cadastro: true } }).modulos.cadastro).toBe(true)
    expect(lerConfig({ ...base, modulos: {} }).modulos.cadastro).toBe(false)
    expect(lerConfig(base).modulos.cadastro).toBe(false)
  })
})

describe('CEP e cidade no cadastro', () => {
  const base = { tipo: 'pf' as const, nome: 'Maria Souza', documento: '529.982.247-25', profissao: '', bairro: '', aceite: true }

  it('máscara do CEP', () => {
    expect(mascararCep('37530')).toBe('37530')
    expect(mascararCep('375300001234')).toBe('37530-000')
    expect(mascararCep('37.530-0')).toBe('37530-0')
  })

  it('CEP completo e cidade vão no corpo; incompleto não vai', () => {
    const itamogi = { nome: 'Itamogi', uf: 'MG', ibge: '3132909' }
    expect(corpoDoCadastro({ ...base, cep: '37530-000', municipio: itamogi })).toMatchObject({
      cep: '37530000',
      municipio: 'Itamogi',
      uf: 'MG',
      municipio_ibge: '3132909',
    })
    const sem = corpoDoCadastro({ ...base, cep: '3753', municipio: null })
    expect(sem).not.toHaveProperty('cep')
    expect(sem).not.toHaveProperty('municipio')
  })

  it('a edição só manda a cidade quando a pessoa mexeu', () => {
    expect(corpoDaEdicao({ nome: 'Ana', profissao: '', bairro: '' })).not.toHaveProperty('moradia')
    expect(corpoDaEdicao({ nome: 'Ana', profissao: '', bairro: '', municipio: null })).toMatchObject({ moradia: {} })
  })
})
