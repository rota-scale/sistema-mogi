// Notificação do navegador e o que o alerta de chamado crítico guarda neste
// aparelho. O som do alerta é o "critico" de sons.ts; a lógica que dá para
// testar está em regrasDoAlerta.ts.

export const CHAVE_NOTIFICACAO = 'mogi.alerta.notificacao'
export const CHAVE_VISTOS = 'mogi.alerta.vistos'

export function lerGuardado(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

export function guardar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    /* sem armazenamento: a preferência vale só até recarregar */
  }
}

export function preferencia(chave: string, padrao: boolean): boolean {
  const v = lerGuardado(chave)
  return v == null ? padrao : v === '1'
}

export type Permissao = NotificationPermission | 'sem-suporte'

export function permissaoDeNotificacao(): Permissao {
  return typeof Notification === 'undefined' ? 'sem-suporte' : Notification.permission
}

export async function pedirNotificacao(): Promise<Permissao> {
  if (typeof Notification === 'undefined') return 'sem-suporte'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

// Só avisa se a permissão já foi dada; a marca (tag) evita empilhar avisos do
// mesmo chamado.
export function notificar(titulo: string, corpo: string, marca: string, aoClicar: () => void) {
  if (permissaoDeNotificacao() !== 'granted') return
  try {
    const n = new Notification(titulo, { body: corpo, tag: marca, icon: '/logo.svg' })
    n.onclick = () => {
      window.focus()
      aoClicar()
      n.close()
    }
  } catch {
    /* alguns navegadores só aceitam notificação pelo service worker */
  }
}
