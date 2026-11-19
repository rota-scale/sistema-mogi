import AsyncStorage from '@react-native-async-storage/async-storage'

// Leitura e gravação que nunca quebram o app: sem armazenamento, o dado
// vale só enquanto o app está aberto.
export async function ler(chave: string): Promise<unknown> {
  try {
    const bruto = await AsyncStorage.getItem(chave)
    return bruto === null ? null : JSON.parse(bruto)
  } catch {
    return null
  }
}

export async function gravar(chave: string, valor: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    /* idem */
  }
}
