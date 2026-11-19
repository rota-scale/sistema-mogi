// As regras do relato são as mesmas do app web: o Metro precisa enxergar
// a pasta do painel para empacotar painel/src/relatar/logica.ts.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../painel/src/relatar')]

module.exports = config
