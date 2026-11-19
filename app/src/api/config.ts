import { CONFIG_PADRAO, lerConfig } from '@/logica/web'
import type { Config } from '@/logica/web'
import { pedir } from './base'

// Sempre resolve em até 4 s: sem resposta, vale a config padrão (sem IA).
export async function buscarConfig(): Promise<Config> {
  const r = await pedir('/config', { prazoMs: 4000 })
  return r.status === 200 ? lerConfig(r.corpo) : CONFIG_PADRAO
}
