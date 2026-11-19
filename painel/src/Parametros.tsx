import { useEffect, useState } from 'react'
import { fraseDoErro, parametros as buscarParametros, salvarParametros } from './apiGestor'
import {
  AJUSTES, comoFrase, diferencas, errosDosParametros, MODULOS, passoDoAjuste, resumoDasMudancas, valorComUnidade,
  type Ajuste, type Modulos, type Parametros as Valores, type RespostaDeParametros,
} from './gestor'
import './gestor.css'

const coordenada = (n: number) => n.toFixed(4).replace('.', ',')

function Modulo({ nome, frase, dono, revisarEm, ligado, mudou, aoMudar }: {
  nome: string
  frase: string
  dono: string
  revisarEm: string
  ligado: boolean
  mudou: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <label className="pa-modulo">
      <span className="pa-modulo-texto">
        <strong>{nome}</strong>
        <span>{frase}</span>
        <small className="pa-modulo-dono">
          Responsável: {dono} · rever {revisarEm}
        </small>
      </span>
      <span className="pa-chave">
        <input type="checkbox" role="switch" checked={ligado} onChange={(e) => aoMudar(e.target.checked)} />
        <span className="pa-trilho" aria-hidden="true" />
        <span className="pa-estado" aria-hidden="true">{ligado ? 'Ligado' : 'Desligado'}</span>
      </span>
      {mudou && <span className="pa-mudou">Mudou: falta salvar</span>}
    </label>
  )
}

function CampoDeAjuste({ a, valor, padrao, min, erro, mudou, aoMudar }: {
  a: Ajuste
  valor: number
  padrao: number
  min: number
  erro?: string
  mudou: boolean
  aoMudar: (v: number) => void
}) {
  const id = `ajuste-${a.chave}`
  return (
    <div className={'pa-ajuste' + (erro ? ' invalido' : mudou ? ' mudou' : '')}>
      <label className="pa-pergunta" htmlFor={id}>
        {a.pergunta}
      </label>
      <div className="pa-controle">
        <button type="button" className="pa-passo" aria-label={`Diminuir ${a.passo}`} disabled={valor <= min} onClick={() => aoMudar(passoDoAjuste(valor, a.passo, min, a.max, -1))}>
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={a.max}
          step={1}
          value={Number.isNaN(valor) ? '' : valor}
          aria-invalid={erro ? true : undefined}
          aria-describedby={`${id}-efeito`}
          onChange={(e) => aoMudar(e.target.value === '' ? NaN : Number(e.target.value))}
        />
        <button type="button" className="pa-passo" aria-label={`Aumentar ${a.passo}`} disabled={valor >= a.max} onClick={() => aoMudar(passoDoAjuste(valor, a.passo, min, a.max, 1))}>
          +
        </button>
        <span className="pa-unidade">{valor === 1 ? a.unidade[0] : a.unidade[1]}</span>
      </div>
      {erro && <p className="erro" role="alert">{comoFrase(erro)}</p>}
      <p className="pa-padrao">
        <span>padrão: {valorComUnidade(a, padrao)}</span>
        {valor !== padrao && (
          <button type="button" onClick={() => aoMudar(padrao)}>
            Voltar ao padrão
          </button>
        )}
        {mudou && !erro && <span className="pa-mudou">Mudou: falta salvar</span>}
      </p>
      <p className="pa-efeito" id={`${id}-efeito`}>{a.efeito}</p>
    </div>
  )
}

// Ajustes da cidade (ADR 0018): módulos e parâmetros que valem na hora, sem
// reiniciar o servidor. O que é da instalação aparece só para leitura.
export function Parametros() {
  const [resp, setResp] = useState<RespostaDeParametros | null>(null)
  const [rascunho, setRascunho] = useState<Valores | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let vivo = true
    buscarParametros()
      .then((r) => {
        if (!vivo) return
        setResp(r)
        setRascunho(r.parametros)
        setErro(null)
      })
      .catch((e) => vivo && setErro(fraseDoErro(e)))
    return () => {
      vivo = false
    }
  }, [tentativa])

  if (!resp || !rascunho) {
    return (
      <div className="g-painel">
        <h2 className="g-titulo">Ajustes da cidade</h2>
        {erro ? (
          <div className="g-aviso erro-forte" role="alert">
            <p>{erro}</p>
            <button type="button" className="botao-secundario" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <p className="vazio">Carregando os ajustes…</p>
        )}
      </div>
    )
  }

  const mudancas = diferencas(rascunho, resp.parametros)
  const erros = errosDosParametros(rascunho)
  const primeiroErro = AJUSTES.map((a) => erros[a.chave]).find(Boolean)

  const mudar = (parte: Partial<Valores>) => {
    setRascunho({ ...rascunho, ...parte })
    setAviso(null)
    setErro(null)
  }
  const mudarModulo = (chave: keyof Modulos, v: boolean) => mudar({ modulos: { ...rascunho.modulos, [chave]: v } })

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await salvarParametros(rascunho)
      setResp(r)
      setRascunho(r.parametros)
      setAviso('Ajustes salvos. Já estão valendo.')
    } catch (e) {
      setErro(fraseDoErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="g-painel">
      <div>
        <h2 className="g-titulo">Ajustes da cidade</h2>
        <p className="sub">Valem na hora, sem reiniciar nada. Cada mudança fica guardada com o seu nome e a data.</p>
      </div>

      <p className="op-subtitulo">O que está ligado</p>
      <div className="pa-modulos">
        {MODULOS.map((m) => (
          <Modulo
            key={m.chave}
            nome={m.nome}
            frase={m.frase}
            dono={m.dono}
            revisarEm={m.revisarEm}
            ligado={rascunho.modulos[m.chave]}
            mudou={mudancas.includes(`modulos.${m.chave}`)}
            aoMudar={(v) => mudarModulo(m.chave, v)}
          />
        ))}
      </div>

      <p className="op-subtitulo">Ajustes</p>
      <div className="pa-ajustes">
        {AJUSTES.map((a) => (
          <CampoDeAjuste
            key={a.chave}
            a={a}
            valor={rascunho[a.chave]}
            padrao={resp.padrao[a.chave]}
            // O limite por rede nunca fica abaixo do limite por celular.
            min={a.chave === 'envios_por_ip' && Number.isInteger(rascunho.envios_por_aparelho) ? Math.max(a.min, rascunho.envios_por_aparelho) : a.min}
            erro={erros[a.chave]}
            mudou={mudancas.includes(a.chave)}
            aoMudar={(v) => mudar({ [a.chave]: v })}
          />
        ))}
      </div>

      <div className="pa-salvar">
        <div>
          <p className="pa-salvar-texto">{resumoDasMudancas(mudancas.length)}</p>
          {primeiroErro && mudancas.length > 0 && <p className="erro">Corrija antes de salvar: {primeiroErro}.</p>}
          {erro && <p className="erro" role="alert">{erro}</p>}
          {aviso && <p className="aviso-ok" role="status">{aviso}</p>}
        </div>
        <div className="us-acoes">
          {mudancas.length > 0 && (
            <button type="button" className="botao-secundario" disabled={salvando} onClick={() => mudar(resp.parametros)}>
              Desfazer
            </button>
          )}
          <button type="button" className="botao-principal" disabled={salvando || mudancas.length === 0 || Boolean(primeiroErro)} onClick={() => void salvar()}>
            {salvando ? 'Salvando…' : 'Salvar ajustes'}
          </button>
        </div>
      </div>

      <div className="pa-cidade">
        <strong>{resp.cidade.nome}</strong>
        <span>
          Centro do mapa: {coordenada(resp.cidade.centro_lat)}, {coordenada(resp.cidade.centro_lng)}
        </span>
        <span>Mudado na instalação do servidor.</span>
      </div>
    </div>
  )
}
