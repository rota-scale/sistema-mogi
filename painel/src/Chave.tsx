// Chave de ligar e desligar que diz o estado em palavras, não só na cor.
export function Chave({ nome, ligada, aoMudar, desativada }: { nome: string; ligada: boolean; aoMudar: () => void; desativada?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} className="chave" onClick={aoMudar} disabled={desativada}>
      <span>{nome}</span>
      <span className="chave-estado">{ligada ? 'Ligado' : 'Desligado'}</span>
    </button>
  )
}
