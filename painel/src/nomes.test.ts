import { describe, expect, it } from 'vitest'

// No volume padrão do Mac, maiúscula e minúscula são o mesmo nome: com
// Alerta.tsx e alerta.ts lado a lado, `import './Alerta'` abria alerta.ts e o
// build quebrava só no Mac. Módulos importáveis não podem diferir só na caixa.
describe('nomes de arquivo', () => {
  it('nenhum módulo difere de outro só na caixa', () => {
    const arquivos = Object.keys(import.meta.glob('./**/*.{ts,tsx}'))
    const vistos = new Map<string, string>()
    const repetidos: string[] = []
    for (const arquivo of arquivos) {
      const chave = arquivo.replace(/\.tsx?$/, '').toLowerCase()
      const anterior = vistos.get(chave)
      if (anterior) repetidos.push(`${anterior} e ${arquivo}`)
      else vistos.set(chave, arquivo)
    }
    expect(arquivos.length).toBeGreaterThan(20)
    expect(repetidos).toEqual([])
  })
})
