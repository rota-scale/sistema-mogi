import * as Crypto from 'expo-crypto'
import { ehUuid, uuidDeBytes } from '@/logica/web'
import { gravar, ler } from './guardado'

const CHAVE_APARELHO = 'mogi.aparelho'

export function novoUuid(): string {
  try {
    return Crypto.randomUUID()
  } catch {
    return uuidDeBytes(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)))
  }
}

let aparelho: Promise<string> | null = null

// Identifica o aparelho para o limite de envios. É um número sorteado uma
// vez e guardado, sem nenhum dado da pessoa. Não é segredo, por isso fica
// no armazenamento comum e não no cofre do sistema.
export function idDoAparelho(): Promise<string> {
  aparelho ??= (async () => {
    const guardado = await ler(CHAVE_APARELHO)
    if (ehUuid(guardado)) return guardado
    const novo = novoUuid()
    await gravar(CHAVE_APARELHO, novo)
    return novo
  })()
  return aparelho
}
