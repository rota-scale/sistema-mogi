import { lerRelatos } from '@/logica/relatos'
import type { Recente } from '@/logica/web'
import { gravar, ler } from './guardado'

const CHAVE_RELATOS = 'mogi.relatos'

export async function relatosGuardados(): Promise<Recente[]> {
  return lerRelatos(await ler(CHAVE_RELATOS))
}

export function guardarRelatos(lista: Recente[]): Promise<void> {
  return gravar(CHAVE_RELATOS, lista)
}
