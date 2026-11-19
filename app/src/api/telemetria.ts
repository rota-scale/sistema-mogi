import { detalheDaTelemetria } from '@/logica/web'
import type { TipoDeTelemetria } from '@/logica/web'
import { pedir } from './base'

// Avisa o servidor de uma falha no aparelho. Não espera resposta, nunca
// quebra o app, e o detalhe é sempre um código, sem dado da pessoa.
export function avisar(tipo: TipoDeTelemetria, detalhe: string = ''): void {
  void pedir('/telemetria', { metodo: 'POST', corpo: { tipo, detalhe: detalheDaTelemetria(detalhe), tela: 'expo' }, prazoMs: 8000 }).catch(
    () => {},
  )
}
