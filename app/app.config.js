// Completa o app.json com o que não pode ficar no Git (ADR 0025): a chave do
// Google Maps para Android vem do ambiente da build (segredo
// GOOGLE_MAPS_ANDROID_KEY no GitHub). Sem a chave, o mapa fica vazio no APK,
// mas a câmera e o envio continuam.
module.exports = ({ config }) => {
  const chave = (process.env.GOOGLE_MAPS_ANDROID_KEY ?? '').trim()
  if (!chave) return config
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: chave }]],
  }
}
