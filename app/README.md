# App do morador (Expo)

App do Sistema MOGI para o morador relatar um problema da rua. Mesmo comportamento e mesmas regras do app web (`painel/src/relatar`), em React Native com Expo SDK 58.

A tela inicial é o mapa, com um boneco no lugar da pessoa e um botão só: a câmera. Tocar no disparador tira foto; segurar grava vídeo sem som. Depois é "Enviar".

## Como rodar no Expo Go

1. Suba o servidor (`make subir` na raiz, ou `make tunel` para ter um link https).
2. Diga ao app onde está o servidor. Copie `.env.example` para `.env` e ajuste `EXPO_PUBLIC_API_URL`:
   - o link https do túnel, que funciona em qualquer rede; ou
   - `http://IP-do-computador:8080`, com o celular na mesma Wi-Fi.
   O `make app` (na raiz) grava o `.env` e sobe o Expo.
3. `npm install` e `npx expo start`. Abra o QR code no Expo Go (SDK 58).

O app chama as rotas em `/api` (`/api/config`, `/api/ocorrencias`, `/api/perto`, `/api/acompanhar`, `/api/telemetria`).

## Comandos

```bash
npx tsc --noEmit                      # tipos
npx expo lint                         # lint
npm test                              # testes da lógica (jest-expo)
npx expo export --platform android    # confere se empacota
npx expo export --platform ios
```

## Estrutura

```
src/app/         telas (Expo Router): index (mapa), camera, local (marcar no mapa), acompanhar/[protocolo]
src/componentes/ peças de tela: mapas, Boneco, Pino, Folha, Andamento, Cartao, GradeDeTipos...
src/estado/      o que vale no app inteiro: localização ao vivo, config, relatos, fila, som
src/api/         conversa com o servidor
src/aparelho/    armazenamento, arquivos, fotos, vídeo, fila sem rede e sons
src/logica/      regras puras e os testes
assets/sons/     os mesmos sons do app web (banco earshot, MIT)
```

## Uma regra só com o app web

`src/logica/web.ts` importa direto `painel/src/relatar/logica.ts`. O `metro.config.js` inclui essa pasta em `watchFolders`. Mensagens de erro, validação do envio, precisão do GPS, prazo, andamento, "Perto de você", boneco e progresso são as mesmas funções do site. O que só existe no app (fila sem rede, corpo do envio, frases de uma linha) fica em `src/logica/` com teste. A tabela de sons é copiada de `painel/src/sons.ts` (aquele arquivo usa o navegador) e um teste compara as duas.

## O que funciona no Expo Go

- Mapa em tela cheia acompanhando a pessoa, com o boneco e os pinos dos relatos dela (`react-native-maps`: Apple Maps no iPhone, Google Maps no Android, sem chave no Expo Go).
- Câmera traseira dentro do app: foto no toque, vídeo sem som ao segurar (até o limite do servidor), até 4 fotos, miniaturas com X.
- Envio com barra de progresso, a mesma chave em toda nova tentativa (não duplica), mensagens curtas por erro.
- Fila sem rede: "Enviar quando a internet voltar" guarda o relato e envia sozinho depois.
- "Já relataram aqui" com "Também vi".
- Andamento do relato em quatro passos, puxar para atualizar, compartilhar o protocolo.
- Marcar o lugar no mapa quando o GPS não serve.
- Sons e vibração nos mesmos momentos do site, com botão de ligar e desligar. O som respeita o modo silencioso.

## O que não funciona ou muda fora do Expo Go

- **Voz:** o ditado do site usa a fala do navegador, que não existe aqui. O campo "Escrever algo" aceita o ditado do teclado do celular. O app não pede o microfone.
- **Build própria para Android:** o Google Maps passa a exigir uma chave. Crie a chave (Maps SDK for Android) e ponha no plugin `react-native-maps` do `app.json`, em `androidGoogleMapsApiKey`. Sem a chave o mapa fica vazio, mas a câmera e o envio continuam. No iPhone não precisa de chave.
- **Navegador (`npx expo start --web`):** serve só para conferir as telas. Não há mapa, e a foto não é enviada como arquivo. O morador sem o app usa o site do MOGI.
- **Vídeo:** o arquivo sai sem trilha de áudio (a câmera é aberta com `mute`). Se algum aparelho gravar com som, o servidor recusa e o app oferece "Enviar só com as fotos".
