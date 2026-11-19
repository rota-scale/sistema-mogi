import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { tocar } from '../sons'
import {
  codigoCompleto,
  documentoDeEntrada,
  erroDoDocumento,
  errosDoCadastro,
  LIMITE_CAMPO,
  LIMITE_NOME,
  mascararCep,
  mascararCodigo,
  mascararCpfOuCnpj,
  mascararDocumento,
  mensagemDaEntrada,
  mensagemDoCadastro,
  nomeDoDocumento,
  somenteDigitos,
  tamanhoDoDocumento,
  temErro,
  TIPOS_DE_MORADOR,
  validarDocumento,
} from './cadastro'
import type { ErrosDoCadastro, Morador, TipoDeMorador } from './cadastro'
import { buscarCep, buscarEndereco, cadastrar, entrar } from './conta'
import CampoCidade from './CampoCidade'
import { acharMunicipio, carregarMunicipios } from './municipios'
import type { Municipio } from './municipios'
import { estiloPorPerfil, FAIXAS, SEXOS } from './boneco'
import type { EstiloDoBoneco, FaixaDeIdade, Sexo } from './boneco'
import { IconeCerto, IconeCompartilhar, IconeEscudo, IconeFechar, IconeMapa, IconePessoa, IconePredio } from './pecas'

interface Props {
  // "envio": a pessoa tentou enviar e o relato espera o cadastro.
  // "apagada": a pessoa acabou de apagar a conta neste aparelho.
  motivo: 'inicio' | 'envio' | 'apagada'
  // GPS de agora (nunca o pino manual nem a última leitura guardada): só
  // sugere a cidade e o bairro, porque onde a pessoa está não é onde mora.
  ponto?: { lat: number; lng: number } | null
  // Módulo do código de recuperação (Administração). Desligado, o cadastro
  // termina direto no mapa e some o "Já tenho cadastro".
  recuperacao?: boolean
  // Cidade da prefeitura, como no /api/config ("Itamogi-MG").
  cidade?: string
  // Sexo e idade escolhem o boneco do mapa (fica só no aparelho).
  aoEstilo?: (estilo: EstiloDoBoneco) => void
  aoPronto: (morador: Morador) => void
  aoFechar: () => void
}

export const TERMO =
  'A prefeitura vê seu nome. Seu CPF fica guardado com segurança e só é aberto se a prefeitura precisar falar com você. A IA nunca recebe seus dados.'

// Termos de ciência, um por linha, no último passo do cadastro.
export const TERMOS: readonly string[] = [
  'A prefeitura vê seu nome e os avisos que você mandar.',
  'Seu CPF fica guardado com segurança. Só a prefeitura abre, se precisar falar com você, e fica registrado quem abriu.',
  'Rostos e placas nas fotos são protegidos antes de alguém ver.',
  'A IA nunca recebe seus dados pessoais.',
  'Sexo e idade ficam só no seu celular, para escolher o boneco.',
  'Você pode apagar sua conta quando quiser, no Perfil.',
]

const ICONE: Record<TipoDeMorador, () => ReactNode> = {
  pf: () => <IconePessoa tamanho={28} />,
  pj: () => <IconePredio tamanho={28} />,
  servidor: () => <IconeEscudo tamanho={28} />,
}

// Cadastro do morador: uma tela, um botão. Tipo, nome, documento com
// máscara e conferência na hora, dois campos opcionais e o termo.
export default function Cadastro(props: Props) {
  // "novo": criar cadastro; "entrar": já tem cadastro, em outro aparelho;
  // "codigo": cadastro criado, a pessoa anota o código de recuperação.
  const [modo, setModo] = useState<'novo' | 'entrar' | 'codigo'>('novo')
  const [docParaEntrar, setDocParaEntrar] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [novo, setNovo] = useState<{ morador: Morador; codigo: string | null } | null>(null)

  if (modo === 'codigo' && novo && novo.codigo) return <CodigoNovo codigo={novo.codigo} aoPronto={() => props.aoPronto(novo.morador)} />
  if (modo === 'entrar')
    return (
      <Entrar
        documentoInicial={docParaEntrar}
        aviso={aviso}
        aoPronto={props.aoPronto}
        aoFechar={props.aoFechar}
        aoCriar={() => {
          setAviso(null)
          setModo('novo')
        }}
      />
    )
  return (
    <CriarCadastro
      {...props}
      aoCriado={(morador, codigo) => {
        if (!codigo) return props.aoPronto(morador)
        setNovo({ morador, codigo })
        setModo('codigo')
      }}
      aoJaTem={(documento, frase) => {
        setDocParaEntrar(documento)
        setAviso(frase)
        setModo('entrar')
      }}
    />
  )
}

// "Itamogi-MG" vira nome e UF para achar o município da prefeitura.
function separarCidade(c: string): { nome: string; uf: string } {
  const m = /^(.*?)[\s-]+([A-Za-z]{2})$/.exec(c.trim())
  return m ? { nome: m[1], uf: m[2] } : { nome: c.trim(), uf: '' }
}

function CriarCadastro({
  motivo,
  ponto,
  cidade = '',
  recuperacao = true,
  aoEstilo,
  aoFechar,
  aoCriado,
  aoJaTem,
}: Props & { aoCriado: (m: Morador, codigo: string | null) => void; aoJaTem: (documento: string, frase: string | null) => void }) {
  const [tipo, setTipo] = useState<TipoDeMorador>('pf')
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [profissao, setProfissao] = useState('')
  const [bairro, setBairro] = useState('')
  // Bairro pelo GPS: preenchido sozinho se a pessoa ainda não digitou nada.
  const [bairroDoGps, setBairroDoGps] = useState(false)
  // CEP e cidade onde mora: o CEP preenche cidade e bairro; o GPS também.
  const [cep, setCep] = useState('')
  const [cepAviso, setCepAviso] = useState<string | null>(null)
  const [municipio, setMunicipio] = useState<Municipio | null>(null)
  const [municipioDe, setMunicipioDe] = useState<'gps' | 'cep' | null>(null)
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null)
  useEffect(() => {
    let vivo = true
    void carregarMunicipios().then((l) => vivo && setMunicipios(l))
    return () => {
      vivo = false
    }
  }, [])
  const daPrefeitura = municipios ? acharMunicipio(separarCidade(cidade).nome, separarCidade(cidade).uf, municipios) : null
  // O GPS de agora só sugere: aparece um botão "Usar minha localização" e
  // nada é preenchido sem o toque. Sem GPS, cidade e bairro ficam vazios.
  const [doGps, setDoGps] = useState<{ cidade: string; uf: string; bairro: string } | null>(null)
  useEffect(() => {
    if (!ponto) return
    let vivo = true
    void buscarEndereco(ponto.lat, ponto.lng).then((e) => {
      if (vivo && e?.cidade) setDoGps({ cidade: e.cidade, uf: e.uf, bairro: e.bairro })
    })
    return () => {
      vivo = false
    }
    // Uma vez, ao abrir: o GPS mexe um pouco e não precisa perguntar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const municipioDoGps = doGps && municipios ? acharMunicipio(doGps.cidade, doGps.uf, municipios) : null
  const usarGps = () => {
    if (!municipioDoGps || !doGps) return
    setMunicipio(municipioDoGps)
    setMunicipioDe('gps')
    if (doGps.bairro && (!bairro.trim() || bairroDoGps)) {
      setBairro(doGps.bairro)
      setBairroDoGps(true)
    }
  }

  const mudarCep = (bruto: string) => {
    const novo = mascararCep(bruto)
    setCep(novo)
    setCepAviso(null)
    if (novo.length !== 9) return
    setCepAviso('Buscando o CEP…')
    void buscarCep(novo).then(async (r) => {
      if (r === 'nao_achou') return setCepAviso('Não achamos esse CEP. Confira os números ou escolha a cidade abaixo.')
      if (r === 'sem_conexao') return setCepAviso('A busca do CEP não respondeu. Escolha a cidade abaixo.')
      const lista = municipios ?? (await carregarMunicipios())
      const m = lista.find((x) => x.ibge === r.ibge) ?? acharMunicipio(r.cidade, r.uf, lista)
      setCepAviso(null)
      if (m) {
        setMunicipio(m)
        setMunicipioDe('cep')
      }
      if (r.bairro) {
        setBairro((atual) => {
          if (atual.trim() && !bairroDoGps) return atual
          setBairroDoGps(true)
          return r.bairro
        })
      }
    })
  }
  const [aceite, setAceite] = useState(false)
  // Dois passos: os dados e, no fim, os termos de ciência.
  const [etapa, setEtapa] = useState<'dados' | 'termos'>('dados')
  const [sexo, setSexo] = useState<Sexo | null>(null)
  const [faixa, setFaixa] = useState<FaixaDeIdade | null>(null)
  const [erros, setErros] = useState<ErrosDoCadastro>({})
  const [saiuDoDocumento, setSaiuDoDocumento] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  const titulo = useRef<HTMLHeadingElement>(null)
  const campoNome = useRef<HTMLInputElement>(null)
  const campoDoc = useRef<HTMLInputElement>(null)
  const caixa = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar, enviando])

  const doc = nomeDoDocumento(tipo)
  const digitos = somenteDigitos(documento).length
  const completo = digitos === tamanhoDoDocumento(tipo)
  const docValido = completo && validarDocumento(tipo, documento)
  // O erro do documento aparece quando o número está completo, ao sair do
  // campo ou depois de tocar em Criar cadastro; nunca no meio da digitação.
  const erroDoc = tentou || saiuDoDocumento || completo ? erroDoDocumento(tipo, documento) : null
  const erroNome = tentou ? erros.nome : undefined
  const erroAceite = tentou && !aceite ? erros.aceite : undefined

  const escolherTipo = (novo: TipoDeMorador) => {
    setTipo(novo)
    setDocumento((d) => mascararDocumento(novo, d))
    setFalha(null)
  }

  const criar = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    const form = { tipo, nome, documento, profissao, bairro, aceite, cep, municipio }
    const achados = errosDoCadastro(form)
    setFalha(null)
    if (etapa === 'dados') {
      // Primeiro passo: só nome e documento; o aceite vem na tela dos termos.
      const doPasso = { nome: achados.nome, documento: achados.documento }
      setErros(doPasso)
      setTentou(true)
      if (temErro(doPasso)) {
        tocar('erro')
        if (doPasso.nome) campoNome.current?.focus()
        else campoDoc.current?.focus()
        return
      }
      setTentou(false)
      setEtapa('termos')
      titulo.current?.focus()
      return
    }
    setErros(achados)
    setTentou(true)
    if (temErro(achados)) {
      tocar('erro')
      if (achados.nome) campoNome.current?.focus()
      else if (achados.documento) campoDoc.current?.focus()
      else caixa.current?.focus()
      return
    }
    setEnviando(true)
    const r = await cadastrar(form)
    setEnviando(false)
    if ('morador' in r) {
      const estilo = estiloPorPerfil(sexo, faixa)
      if (estilo) aoEstilo?.(estilo)
      aoCriado(r.morador, r.codigo)
      return
    }
    tocar('erro')
    if (r.falha === 'documento_invalido' || r.falha === 'nome_invalido') setEtapa('dados')
    if (r.falha === 'documento_cadastrado' && !recuperacao) {
      // Sem o código, quem libera é a prefeitura: o aviso fica no campo.
      setEtapa('dados')
      setErros({ documento: mensagemDoCadastro(r.falha, tipo, false) })
      campoDoc.current?.focus()
    } else if (r.falha === 'documento_cadastrado') {
      aoJaTem(mascararCpfOuCnpj(documento), mensagemDoCadastro(r.falha, tipo))
    } else if (r.falha === 'documento_invalido') {
      setErros({ documento: mensagemDoCadastro(r.falha, tipo) })
      campoDoc.current?.focus()
    } else if (r.falha === 'nome_invalido') {
      setErros({ nome: mensagemDoCadastro(r.falha, tipo) })
      campoNome.current?.focus()
    } else if (r.falha === 'aceite_obrigatorio') {
      setAceite(false)
      setErros({ aceite: mensagemDoCadastro(r.falha, tipo) })
      caixa.current?.focus()
    } else {
      setFalha(mensagemDoCadastro(r.falha, tipo))
    }
  }

  // Recusa do servidor para o documento vale até a pessoa mudar o número.
  const erroDoDocMostrado = erroDoc ?? (tentou ? erros.documento : undefined)

  return (
    <div className="pagina" role="dialog" aria-modal="true" aria-labelledby="cadastro-titulo" aria-describedby="cadastro-sub">
      <header className="pagina-topo">
        <h2 id="cadastro-titulo" ref={titulo} tabIndex={-1} className="pagina-titulo">
          {etapa === 'dados' ? 'Seu cadastro' : 'Antes de criar'}
        </h2>
        <button type="button" className="botao-mapa botao-plano" aria-label="Fechar o cadastro" disabled={enviando} onClick={aoFechar}>
          <IconeFechar />
        </button>
      </header>
      <p className="cad-passo" aria-hidden="true">
        Passo {etapa === 'dados' ? 1 : 2} de 2
      </p>
      <p id="cadastro-sub" className="pagina-sub">
        {etapa === 'termos'
          ? 'Confira o que acontece com os seus dados.'
          : motivo === 'envio'
          ? 'Para enviar, faça seu cadastro. Seu relato continua guardado.'
          : motivo === 'apagada'
            ? 'Sua conta foi apagada. Para avisar a prefeitura de novo, faça um cadastro.'
            : 'Leva um minuto. Você só faz uma vez.'}
      </p>
      {etapa === 'dados' && recuperacao && (
        <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => aoJaTem('', null)}>
          Já tenho cadastro
        </button>
      )}

      <form className="formulario" noValidate onSubmit={(e) => void criar(e)}>
        {etapa === 'dados' && (
          <>
          <fieldset className="campo-grupo">
            <legend className="campo-rotulo">Você é</legend>
            <div className="segmentos">
              {TIPOS_DE_MORADOR.map((t) => (
                <label key={t.id} className={`segmento${tipo === t.id ? ' marcado' : ''}`}>
                  <input type="radio" name="tipo" value={t.id} checked={tipo === t.id} onChange={() => escolherTipo(t.id)} />
                  {ICONE[t.id]()}
                  <span>{t.nome}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="campo">
            <label className="campo-rotulo" htmlFor="cad-nome">
              {tipo === 'pj' ? 'Nome da empresa' : 'Seu nome'}
            </label>
            <input
              ref={campoNome}
              id="cad-nome"
              className="campo-entrada"
              type="text"
              autoComplete={tipo === 'pj' ? 'organization' : 'name'}
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={LIMITE_NOME}
              value={nome}
              aria-invalid={erroNome ? true : undefined}
              aria-describedby={erroNome ? 'cad-nome-erro' : undefined}
              onChange={(e) => {
                setNome(e.target.value)
                if (erros.nome) setErros((x) => ({ ...x, nome: undefined }))
              }}
            />
            {erroNome && (
              <p id="cad-nome-erro" className="campo-erro">
                {erroNome}
              </p>
            )}
          </div>

          <div className="campo">
            <label className="campo-rotulo" htmlFor="cad-doc">
              {doc}
            </label>
            <div className="campo-linha">
              <input
                ref={campoDoc}
                id="cad-doc"
                className="campo-entrada campo-numero"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                placeholder={tipo === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                value={documento}
                aria-invalid={erroDoDocMostrado ? true : undefined}
                aria-describedby={erroDoDocMostrado ? 'cad-doc-erro' : docValido ? 'cad-doc-ok' : undefined}
                onChange={(e) => {
                  setDocumento(mascararDocumento(tipo, e.target.value))
                  setSaiuDoDocumento(false)
                  if (erros.documento) setErros((x) => ({ ...x, documento: undefined }))
                }}
                onBlur={() => setSaiuDoDocumento(digitos > 0)}
              />
              {docValido && (
                <span className="campo-ok" id="cad-doc-ok">
                  <IconeCerto tamanho={18} />
                  {doc} certo
                </span>
              )}
            </div>
            {erroDoDocMostrado && (
              <p id="cad-doc-erro" className="campo-erro" role="alert">
                {erroDoDocMostrado}
              </p>
            )}
          </div>

          <div className="campo">
            <label className="campo-rotulo" htmlFor="cad-profissao">
              Profissão ou o que faz <span className="campo-opcional">(opcional)</span>
            </label>
            <input
              id="cad-profissao"
              className="campo-entrada"
              type="text"
              autoComplete="organization-title"
              enterKeyHint="next"
              maxLength={LIMITE_CAMPO}
              value={profissao}
              onChange={(e) => setProfissao(e.target.value)}
            />
          </div>

          <p className="campo-rotulo campo-secao">
            Onde você mora <span className="campo-opcional">(opcional)</span>
          </p>
          <p className="campo-sub campo-secao-sub">Pode ser diferente de onde você está agora.</p>
          {municipioDoGps && municipio?.ibge !== municipioDoGps.ibge && (
            <button type="button" className="botao botao-secundario botao-gps" onClick={usarGps}>
              <IconeMapa tamanho={20} />
              Usar minha localização: {municipioDoGps.nome} - {municipioDoGps.uf}
            </button>
          )}
          <div className="campo">
            <label className="campo-rotulo" htmlFor="cad-cep">
              CEP
            </label>
            <input
              id="cad-cep"
              className="campo-entrada campo-cep"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              enterKeyHint="next"
              placeholder="00000-000"
              maxLength={9}
              value={cep}
              aria-describedby={cepAviso ? 'cad-cep-aviso' : undefined}
              onChange={(e) => mudarCep(e.target.value)}
            />
            {cepAviso && (
              <p id="cad-cep-aviso" className="campo-nota" role="status">
                {cepAviso}
              </p>
            )}
          </div>

          <CampoCidade
            id="cad-cidade"
            valor={municipio}
            aoMudar={(m) => {
              setMunicipio(m)
              setMunicipioDe(null)
            }}
            preferidas={municipioDoGps ? [municipioDoGps.ibge] : []}
            nota={municipioDe === 'cep' ? '(pelo CEP, confira)' : municipioDe === 'gps' ? '(pela sua localização, confira)' : ''}
          />
          {municipio && daPrefeitura && municipio.ibge !== daPrefeitura.ibge && (
            <p className="campo-aviso-cidade" role="note">
              O MOGI atende {daPrefeitura.nome} por enquanto. Você pode se cadastrar e relatar o que vir em {daPrefeitura.nome}.
            </p>
          )}

          <div className="campo">
            <label className="campo-rotulo" htmlFor="cad-bairro">
              Bairro {bairroDoGps && <span className="campo-opcional">(confira)</span>}
            </label>
            <input
              id="cad-bairro"
              className="campo-entrada"
              type="text"
              autoComplete="off"
              enterKeyHint="done"
              maxLength={LIMITE_CAMPO}
              value={bairro}
              onChange={(e) => {
                setBairro(e.target.value)
                setBairroDoGps(false)
              }}
            />
          </div>

          <fieldset className="campo-grupo">
            <legend className="campo-rotulo">
              Seu boneco no mapa <span className="campo-opcional">(opcional)</span>
            </legend>
            <p className="campo-sub" aria-hidden="true">
              Sexo
            </p>
            <div className="segmentos segmentos-texto" role="radiogroup" aria-label="Sexo">
              {SEXOS.map((x) => (
                <label key={x.nome} className={`segmento${sexo === x.id ? ' marcado' : ''}`}>
                  <input type="radio" name="sexo" checked={sexo === x.id} onChange={() => setSexo(x.id)} />
                  <span>{x.nome}</span>
                </label>
              ))}
            </div>
            <p className="campo-sub" aria-hidden="true">
              Idade
            </p>
            <div className="segmentos segmentos-texto" role="radiogroup" aria-label="Idade">
              {FAIXAS.map((x) => (
                <label key={x.id} className={`segmento${faixa === x.id ? ' marcado' : ''}`}>
                  <input type="radio" name="faixa" checked={faixa === x.id} onChange={() => setFaixa(x.id)} />
                  <span>{x.nome}</span>
                </label>
              ))}
            </div>
            <p className="campo-nota">Só para escolher o boneco. Fica no seu celular.</p>
          </fieldset>
          </>
        )}

        {etapa === 'termos' && (
          <div className={`termo${erroAceite ? ' termo-erro' : ''}`}>
            <ul id="cad-termo" className="termos">
              {TERMOS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <label className="caixa">
              <input
                ref={caixa}
                type="checkbox"
                checked={aceite}
                aria-describedby={erroAceite ? 'cad-termo cad-aceite-erro' : 'cad-termo'}
                aria-invalid={erroAceite ? true : undefined}
                onChange={(e) => setAceite(e.target.checked)}
              />
              <span>Li e concordo</span>
            </label>
            {erroAceite && (
              <p id="cad-aceite-erro" className="campo-erro">
                {erroAceite}
              </p>
            )}
          </div>
        )}

        {falha && (
          <p className="campo-erro formulario-falha" role="alert">
            {falha}
          </p>
        )}

        <div className="cad-acoes">
          {etapa === 'termos' && (
            <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => setEtapa('dados')}>
              Voltar
            </button>
          )}
          <button type="submit" className="botao botao-primario" aria-disabled={enviando}>
            {enviando && <span className="girando girando-claro" aria-hidden="true" />}
            {etapa === 'dados' ? 'Continuar' : enviando ? 'Criando' : 'Criar cadastro'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Entrar em outro aparelho: documento e o código anotado no cadastro.
function Entrar({
  documentoInicial,
  aviso,
  aoPronto,
  aoFechar,
  aoCriar,
}: {
  documentoInicial: string
  aviso: string | null
  aoPronto: (m: Morador) => void
  aoFechar: () => void
  aoCriar: () => void
}) {
  const [documento, setDocumento] = useState(documentoInicial)
  const [codigo, setCodigo] = useState('')
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const campoDoc = useRef<HTMLInputElement>(null)
  const campoCodigo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar, enviando])

  const erroDoc = tentou && !documentoDeEntrada(documento) ? 'Digite o CPF ou o CNPJ completo.' : undefined
  const erroCodigo = tentou && !codigoCompleto(codigo) ? 'O código tem 12 letras e números.' : undefined

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setTentou(true)
    setFalha(null)
    if (!documentoDeEntrada(documento)) {
      tocar('erro')
      campoDoc.current?.focus()
      return
    }
    if (!codigoCompleto(codigo)) {
      tocar('erro')
      campoCodigo.current?.focus()
      return
    }
    setEnviando(true)
    const r = await entrar(documento, mascararCodigo(codigo))
    setEnviando(false)
    if ('morador' in r) {
      aoPronto(r.morador)
      return
    }
    tocar('erro')
    setFalha(mensagemDaEntrada(r.falha))
  }

  return (
    <div className="pagina" role="dialog" aria-modal="true" aria-labelledby="entrar-titulo" aria-describedby="entrar-sub">
      <header className="pagina-topo">
        <h2 id="entrar-titulo" ref={titulo} tabIndex={-1} className="pagina-titulo">
          Já tenho cadastro
        </h2>
        <button type="button" className="botao-mapa botao-plano" aria-label="Fechar" disabled={enviando} onClick={aoFechar}>
          <IconeFechar />
        </button>
      </header>
      <p id="entrar-sub" className="pagina-sub">
        {aviso ?? 'Use o código de recuperação que apareceu quando você fez o cadastro.'}
      </p>

      <form className="formulario" noValidate onSubmit={(e) => void enviar(e)}>
        <div className="campo">
          <label className="campo-rotulo" htmlFor="ent-doc">
            CPF ou CNPJ
          </label>
          <input
            ref={campoDoc}
            id="ent-doc"
            className="campo-entrada campo-numero"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            value={documento}
            aria-invalid={erroDoc ? true : undefined}
            aria-describedby={erroDoc ? 'ent-doc-erro' : undefined}
            onChange={(e) => setDocumento(mascararCpfOuCnpj(e.target.value))}
          />
          {erroDoc && (
            <p id="ent-doc-erro" className="campo-erro">
              {erroDoc}
            </p>
          )}
        </div>

        <div className="campo">
          <label className="campo-rotulo" htmlFor="ent-codigo">
            Código de recuperação
          </label>
          <input
            ref={campoCodigo}
            id="ent-codigo"
            className="campo-entrada campo-numero"
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="ABCD-EFGH-JKMN"
            value={codigo}
            aria-invalid={erroCodigo ? true : undefined}
            aria-describedby={erroCodigo ? 'ent-codigo-erro' : undefined}
            onChange={(e) => setCodigo(mascararCodigo(e.target.value))}
          />
          {erroCodigo && (
            <p id="ent-codigo-erro" className="campo-erro">
              {erroCodigo}
            </p>
          )}
        </div>

        {falha && (
          <p className="campo-erro formulario-falha" role="alert">
            {falha}
          </p>
        )}

        <button type="submit" className="botao botao-primario" aria-disabled={enviando}>
          {enviando && <span className="girando girando-claro" aria-hidden="true" />}
          {enviando ? 'Entrando' : 'Entrar'}
        </button>
        <p className="pagina-sub">Perdeu o código? Fale com a equipe do MOGI na prefeitura.</p>
        <button type="button" className="botao botao-secundario" disabled={enviando} onClick={aoCriar}>
          Fazer cadastro novo
        </button>
      </form>
    </div>
  )
}

// O código aparece uma vez só: o servidor guarda apenas uma marca dele.
function CodigoNovo({ codigo, aoPronto }: { codigo: string; aoPronto: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titulo.current?.focus()
    tocar('registrado')
  }, [])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  const compartilhar = async () => {
    try {
      await navigator.share({ title: 'Código do MOGI', text: `Meu código de recuperação do MOGI: ${codigo}` })
    } catch {
      /* a pessoa cancelou */
    }
  }

  return (
    <div className="pagina" role="dialog" aria-modal="true" aria-labelledby="codigo-titulo" aria-describedby="codigo-sub">
      <header className="pagina-topo">
        <h2 id="codigo-titulo" ref={titulo} tabIndex={-1} className="pagina-titulo">
          Anote seu código
        </h2>
      </header>
      <p id="codigo-sub" className="pagina-sub">
        Cadastro feito. Guarde este código: com ele e o seu documento, você entra em outro celular. Ele não aparece de novo.
      </p>
      <p className="codigo-recuperacao" aria-label={`Código: ${[...codigo.replace(/-/g, '')].join(' ')}`}>
        {codigo.split('-').map((g, i, todos) => (
          <span key={i} className="codigo-grupo">
            {g}
            {i < todos.length - 1 ? '-' : ''}
          </span>
        ))}
      </p>
      <div className="formulario">
        <button type="button" className="botao botao-secundario" onClick={() => void copiar()}>
          {copiado ? <IconeCerto tamanho={20} /> : null}
          {copiado ? 'Copiado' : 'Copiar código'}
        </button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button type="button" className="botao botao-secundario" onClick={() => void compartilhar()}>
            <IconeCompartilhar tamanho={20} />
            Guardar em outro lugar
          </button>
        )}
        <button type="button" className="botao botao-primario" onClick={aoPronto}>
          Já anotei
        </button>
      </div>
    </div>
  )
}
