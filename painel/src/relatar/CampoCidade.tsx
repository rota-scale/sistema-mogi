import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { buscarMunicipio, carregarMunicipios, normalizar, rotulo } from './municipios'
import type { Municipio } from './municipios'

interface Props {
  id: string
  valor: Municipio | null
  aoMudar: (m: Municipio | null) => void
  // Códigos do IBGE que sobem na lista: a cidade da prefeitura e a do GPS.
  preferidas: readonly string[]
  // Texto ao lado do rótulo: "(opcional)" ou "(pelo GPS, confira)".
  nota: string
}

// Campo de cidade com busca: digite parte do nome, sem acento, e escolha na
// lista. Segue o padrão ARIA de combobox com lista (setas, Enter e Esc).
export default function CampoCidade({ id, valor, aoMudar, preferidas, nota }: Props) {
  const [lista, setLista] = useState<Municipio[] | null>(null)
  const [texto, setTexto] = useState(valor ? rotulo(valor) : '')
  const [aberta, setAberta] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const idLista = useId()
  const entrada = useRef<HTMLInputElement>(null)

  // O valor chega de fora (GPS ou CEP): o texto acompanha. Quando o valor
  // vira nulo porque a pessoa está digitando, o texto dela fica.
  useEffect(() => {
    if (valor) setTexto(rotulo(valor))
  }, [valor])

  const carregar = () => {
    if (!lista) void carregarMunicipios().then(setLista)
  }

  const escolhido = valor && texto === rotulo(valor)
  const achados = lista && !escolhido ? buscarMunicipio(texto, lista, preferidas) : []
  const mostrar = aberta && !escolhido && lista !== null && normalizar(texto).length >= 2
  const vazio = mostrar && achados.length === 0 && normalizar(texto).length >= 2

  const escolher = (m: Municipio) => {
    aoMudar(m)
    setTexto(rotulo(m))
    setAberta(false)
  }

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberta(true)
      setAtivo((a) => Math.min(a + 1, Math.max(achados.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && mostrar && achados[ativo]) {
      e.preventDefault()
      escolher(achados[ativo])
    } else if (e.key === 'Escape' && aberta) {
      // Fecha só a lista; o Esc não chega a fechar o cadastro.
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      setAberta(false)
    }
  }

  return (
    <div className="campo campo-cidade">
      <label className="campo-rotulo" htmlFor={id}>
        Cidade <span className="campo-opcional">{nota}</span>
      </label>
      <input
        ref={entrada}
        id={id}
        className="campo-entrada"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrar}
        aria-controls={idLista}
        aria-activedescendant={mostrar && achados[ativo] ? `${idLista}-${ativo}` : undefined}
        autoComplete="address-level2"
        enterKeyHint="next"
        spellCheck={false}
        placeholder="Comece a digitar o nome"
        value={texto}
        onFocus={() => {
          carregar()
          setAberta(true)
        }}
        onChange={(e) => {
          setTexto(e.target.value)
          setAtivo(0)
          setAberta(true)
          if (valor) aoMudar(null)
        }}
        onKeyDown={aoTeclar}
        onBlur={() => setAberta(false)}
      />
      <ul id={idLista} className="cidade-lista" role="listbox" aria-label="Cidades encontradas" hidden={!mostrar || (achados.length === 0 && !vazio)}>
        {achados.map((m, i) => (
          <li
            key={m.ibge}
            id={`${idLista}-${i}`}
            role="option"
            aria-selected={i === ativo}
            className={`cidade-opcao${i === ativo ? ' ativa' : ''}`}
            // mousedown, e não click: o campo não perde o foco antes da escolha.
            onMouseDown={(e) => {
              e.preventDefault()
              escolher(m)
            }}
          >
            <span className="cidade-nome">{m.nome}</span>
            <span className="cidade-uf">{m.uf}</span>
          </li>
        ))}
        {vazio && (
          <li className="cidade-vazio" role="presentation">
            Nenhuma cidade com esse nome
          </li>
        )}
      </ul>
      {!valor && texto.trim() && !aberta && <p className="campo-nota">Escolha a cidade na lista.</p>}
    </div>
  )
}
