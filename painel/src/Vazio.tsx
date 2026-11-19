// Estado vazio, carregando ou com erro: um mosaico mínimo nas formas da marca
// (losango, círculo, meio círculo), uma frase útil e, quando houver, o que
// fazer. A ilustração é decorativa; o texto diz tudo.
export type TipoDoVazio = 'calmo' | 'carregando' | 'erro'

export function Mosaico({ tipo = 'calmo' }: { tipo?: TipoDoVazio }) {
  return (
    <svg className={'mosaico ' + tipo} viewBox="0 0 96 48" width="96" height="48" aria-hidden="true">
      <path className="m-meio" d="M4 44A20 20 0 0 1 44 44Z" />
      <circle className="m-circulo" cx="60" cy="28" r="14" />
      <path className="m-losango" d="M84 10L94 24L84 38L74 24Z" />
    </svg>
  )
}

export function Vazio({
  tipo = 'calmo',
  titulo,
  texto,
  acao,
}: {
  tipo?: TipoDoVazio
  titulo: string
  texto?: string
  acao?: { nome: string; aoClicar: () => void; desativada?: boolean }
}) {
  return (
    <div className={'estado-vazio ' + tipo} role={tipo === 'erro' ? 'alert' : 'status'}>
      <Mosaico tipo={tipo} />
      <p className="estado-vazio-titulo">{titulo}</p>
      {texto && <p className="estado-vazio-texto">{texto}</p>}
      {acao && (
        <button type="button" className="botao-secundario" onClick={acao.aoClicar} disabled={acao.desativada}>
          {acao.nome}
        </button>
      )}
    </div>
  )
}
