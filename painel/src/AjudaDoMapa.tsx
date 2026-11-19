import { useEffect, useRef } from 'react'
import { Chave } from './Chave'
import type { Preferencia, Preferencias } from './preferencias'

interface Props {
  aberta: boolean
  preferencias: Preferencias
  aoMudar: (p: Preferencia) => void
  aoFechar: () => void
  aoGuia: () => void
}

// Ajuda e configurações do painel: os comandos do mapa, os atalhos e as
// opções de acessibilidade num lugar só. Diálogo nativo: o navegador cuida
// do foco, do Esc e da camada de cima.
export function AjudaDoMapa({ aberta, preferencias, aoMudar, aoFechar, aoGuia }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberta && !d.open) d.showModal()
    else if (!aberta && d.open) d.close()
  }, [aberta])

  // Clique fora fecha. Onde o navegador já faz isso (closedby), não repete.
  const cliqueFora = (e: React.MouseEvent<HTMLDialogElement>) => {
    const d = ref.current
    if (!d || 'closedBy' in HTMLDialogElement.prototype || e.target !== d) return
    const r = d.getBoundingClientRect()
    const dentro = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right
    if (!dentro) d.close()
  }

  return (
    <dialog ref={ref} className="ajuda" aria-labelledby="ajuda-titulo" onClose={aoFechar} onClick={cliqueFora} {...({ closedby: 'any' } as object)}>
      <header className="ajuda-cabeca">
        <h2 id="ajuda-titulo">Ajuda e configurações</h2>
        <button type="button" className="botao-secundario" onClick={aoFechar}>
          Fechar
        </button>
      </header>

      <h3 className="ajuda-secao">Comandos do mapa</h3>
      <dl className="ajuda-lista">
        <dt>Mover</dt>
        <dd>Arraste o mapa.</dd>
        <dt>Aproximar e afastar</dt>
        <dd>Pinça com dois dedos, rolagem do mouse ou os botões + e − no canto do mapa.</dd>
        <dt>Girar e inclinar</dt>
        <dd>
          Segure <kbd>Control</kbd> e arraste. Ou arraste a bússola, no canto do mapa. No celular, gire com dois dedos.
        </dd>
        <dt>Voltar ao norte</dt>
        <dd>Clique na bússola.</dd>
        <dt>Pelo teclado</dt>
        <dd>
          Clique no mapa e use as setas para mover, <kbd>+</kbd> e <kbd>−</kbd> para aproximar, <kbd>Shift</kbd> com as setas para girar e inclinar.
        </dd>
        <dt>Abrir um chamado</dt>
        <dd>Clique no pino ou na fila ao lado.</dd>
      </dl>

      <h3 className="ajuda-secao">Atalhos do painel</h3>
      <dl className="ajuda-lista">
        <dt>
          <kbd>M</kbd>
        </dt>
        <dd>Ver só o mapa, ou trazer os painéis de volta.</dd>
        <dt>
          <kbd>?</kbd>
        </dt>
        <dd>Abrir esta ajuda.</dd>
        <dt>
          <kbd>Esc</kbd>
        </dt>
        <dd>Fechar o chamado aberto ou esta ajuda.</dd>
      </dl>

      <h3 className="ajuda-secao">Tela</h3>
      <div className="ajuda-chaves">
        <Chave nome="Ver só o mapa" ligada={preferencias.soMapa} aoMudar={() => aoMudar('soMapa')} />
        <Chave nome="Mostrar chamados simulados" ligada={preferencias.simulados} aoMudar={() => aoMudar('simulados')} />
      </div>

      <h3 className="ajuda-secao">Acessibilidade</h3>
      <div className="ajuda-chaves">
        <Chave nome="Texto maior" ligada={preferencias.textoGrande} aoMudar={() => aoMudar('textoGrande')} />
        <Chave nome="Alto contraste" ligada={preferencias.altoContraste} aoMudar={() => aoMudar('altoContraste')} />
        <Chave nome="Reduzir animações" ligada={preferencias.poucoMovimento} aoMudar={() => aoMudar('poucoMovimento')} />
      </div>
      <p className="ajuda-nota">Chamados simulados são da demonstração e aparecem com a marca Simulado; desligado, a fila e o mapa mostram só relatos reais quando o servidor não tem demo ligada. As opções ficam guardadas neste aparelho. Camadas, 3D e estilo do mapa ficam no botão de camadas, no canto de cima do mapa. Sons e notificações ficam no menu da sua conta.</p>

      <button type="button" className="botao-secundario" onClick={aoGuia}>
        Ver o guia de novo
      </button>
    </dialog>
  )
}
