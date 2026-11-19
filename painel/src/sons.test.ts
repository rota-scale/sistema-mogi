import { describe, expect, it } from 'vitest'
import { GESTOS_QUE_LIBERAM, SONS, pode, type Som } from './sons'

describe('sons', () => {
  it('destrava o áudio só com gestos que o celular aceita', () => {
    // No iPhone e no Android, encostar o dedo (touchstart, pointerdown) não
    // conta como gesto: só soltar. Com eles, o som nunca destravava.
    expect(GESTOS_QUE_LIBERAM).toContain('touchend')
    expect(GESTOS_QUE_LIBERAM).toContain('click')
    expect(GESTOS_QUE_LIBERAM).not.toContain('touchstart')
    expect(GESTOS_QUE_LIBERAM).not.toContain('pointerdown')
  })

  it('cada som tem o arquivo em public/sons', () => {
    const arquivos = Object.keys(import.meta.glob('../public/sons/*.mp3'))
    for (const [som, def] of Object.entries(SONS)) {
      expect(arquivos, som).toContain(`../public/sons/${def.arquivo}.mp3`)
    }
  })

  it('volume entre 0 e 1 e o crítico é o mais alto da central', () => {
    for (const def of Object.values(SONS)) expect(def.volume).toBeGreaterThan(0)
    for (const def of Object.values(SONS)) expect(def.volume).toBeLessThanOrEqual(1)
    const central: Som[] = ['novo_relato', 'confirmado', 'desfazer', 'registrado', 'reconectou']
    for (const s of central) expect(SONS.critico.volume).toBeGreaterThan(SONS[s].volume)
  })

  it('respeita o intervalo mínimo de cada som', () => {
    const ultimas: Partial<Record<Som, number>> = {}
    expect(pode(ultimas, 'novo_relato', 1000)).toBe(true)
    ultimas.novo_relato = 1000
    expect(pode(ultimas, 'novo_relato', 1000 + SONS.novo_relato.intervaloMs - 1)).toBe(false)
    expect(pode(ultimas, 'novo_relato', 1000 + SONS.novo_relato.intervaloMs)).toBe(true)
    // Um som não segura outro.
    expect(pode(ultimas, 'critico', 1001)).toBe(true)
  })
})
