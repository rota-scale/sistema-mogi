import { useCallback, useRef, useState } from 'react'
import { useFecharAoSair } from './ganchos'
import { FormaDoNivel, Icone } from './icones'
import { corDoNivel, NIVEIS, nomeDoNivel, rotuloDoFiltro } from './niveis'

// Do mais urgente para o menos; 0 é o chamado que a triagem não avaliou.
const ORDEM = [...NIVEIS.map((n) => n.nivel).reverse(), 0]

// Legenda e filtro de urgência do mapa: cor, nome e quantos em aberto. O
// filtro vale também para a fila. No celular fica atrás de um botão.
export function Urgencia({
  celular,
  escolhidos,
  abertos,
  aoAlternar,
  verResolvidas,
  aoVerResolvidas,
}: {
  celular: boolean
  // Vazio quer dizer todas as urgências.
  escolhidos: number[]
  abertos: Map<number, number>
  aoAlternar: (nivel: number) => void
  verResolvidas: boolean
  aoVerResolvidas: (v: boolean) => void
}) {
  const [aberta, setAberta] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => setAberta(false), [])
  useFecharAoSair(ref, celular && aberta, fechar)
  const quantos = (n: number) => abertos.get(n) ?? 0
  const total = ORDEM.reduce((soma, n) => soma + quantos(n), 0)

  return (
    <div className="urgencia" ref={ref}>
      {celular && (
        <button type="button" className={'botao-mapa largo' + (escolhidos.length > 0 ? ' com-filtro' : '')} aria-expanded={aberta} aria-controls="filtro-de-urgencia" onClick={() => setAberta((a) => !a)}>
          Urgência
          <strong>
            {total}
            <span className="oculto"> em aberto</span>
          </strong>
          <Icone nome={aberta ? 'acima' : 'abaixo'} tamanho={18} />
        </button>
      )}
      {(!celular || aberta) && (
        <div className="urgencia-painel" id="filtro-de-urgencia" role="group" aria-label="Filtrar por urgência">
          {!celular && <span className="urgencia-titulo">Urgência</span>}
          {/* "Sem avaliação" só aparece quando existe algum. */}
          {ORDEM.filter((n) => n !== 0 || quantos(0) > 0 || escolhidos.includes(0)).map((n) => (
            <button
              key={n}
              type="button"
              className={'urgencia-filtro' + (escolhidos.length > 0 && !escolhidos.includes(n) ? ' apagado' : '')}
              aria-pressed={escolhidos.includes(n)}
              title={rotuloDoFiltro(n, quantos(n))}
              onClick={() => aoAlternar(n)}
            >
              <FormaDoNivel nivel={n || null} cor={corDoNivel(n || null)} tamanho={18} contorno="#2B1A10" />
              <span>{nomeDoNivel(n || null)}</span>
              <strong>
                {quantos(n)}
                <span className="oculto"> {quantos(n) === 1 ? 'chamado' : 'chamados'} em aberto</span>
              </strong>
            </button>
          ))}
          <label className="marcar">
            <input type="checkbox" checked={verResolvidas} onChange={(e) => aoVerResolvidas(e.target.checked)} /> Mostrar resolvidos no mapa
          </label>
        </div>
      )}
    </div>
  )
}
