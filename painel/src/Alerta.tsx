import { textoDoAlerta } from './regrasDoAlerta'
import { Icone } from './icones'
import type { Ocorrencia } from './tipos'

// Faixa de chamado crítico. Não some sozinha: sai quando o chamado é aberto
// ou quando alguém toca em "Depois".
export function Alerta({ pendentes, aoVer, aoDepois }: { pendentes: Ocorrencia[]; aoVer: (id: string) => void; aoDepois: () => void }) {
  if (pendentes.length === 0) return null
  return (
    <div className="alerta-critico" role="alert">
      <Icone nome="alerta" tamanho={24} />
      <strong>{textoDoAlerta(pendentes)}</strong>
      <div className="alerta-acoes">
        <button type="button" className="alerta-ver" onClick={() => aoVer(pendentes[0].id)}>
          Ver agora
        </button>
        <button type="button" className="alerta-depois" onClick={aoDepois}>
          Depois
        </button>
      </div>
    </div>
  )
}
