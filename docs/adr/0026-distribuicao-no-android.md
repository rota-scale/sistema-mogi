# ADR 0026: Distribuição no Android em três degraus
**Status:** Proposta · **Data:** 16/11/2026

## Contexto
A visita ao prefeito de Itamogi é em 18/11/2026 e o AKCIT em 21/11, e a maioria das pessoas tem Android. O app Expo ainda não tem cadastro ([issue #30](https://github.com/rota-scale/cidade-inteligente-akcit/issues/30)). O endereço do servidor do app Expo é fixado na build (`EXPO_PUBLIC_API_URL`), e o link do `make tunel` muda a cada vez.

## Decisão
Três degraus, do que funciona hoje ao que exige mais preparo.

1. **Agora (18/11 e AKCIT): app web instalado pelo Chrome.**
   - O morador abre o link do túnel + `/relatar` no Chrome e toca em "Instalar app" (ou no menu, "Adicionar à tela inicial").
   - O manifesto em `painel/public/manifest.webmanifest` já dá ícone, nome e tela cheia.
   - É o mesmo app do iPhone, com cadastro, código de recuperação e Ajuda.
2. **Teste interno: APK gerado pelo CI.**
   - O workflow `Android (APK de teste)` gera o projeto com `expo prebuild` e compila com Gradle num runner do GitHub. O APK sai como artefato da execução.
   - Na execução manual, quem dispara informa o **endereço do servidor** do momento (o link do túnel), que vai para a build.
   - O mapa do Android usa o Google Maps e precisa de uma chave (Maps SDK for Android). Ela vai como segredo `GOOGLE_MAPS_ANDROID_KEY` do GitHub e entra na build pelo `app/app.config.js`, nunca no Git. Sem o segredo, o APK sai com o mapa vazio, mas a câmera e o envio funcionam.
   - O APK é assinado com a chave de depuração do modelo do Expo: **serve só para teste**, instalado à mão ("fontes desconhecidas"). Não vai para a loja.
3. **Piloto: Play Store, teste interno.**
   - Depende de: cadastro no app Expo (#30), um endereço fixo do servidor (domínio da Rota) e uma chave de assinatura própria guardada fora do Git.
   - O caminho provável é o EAS Build e o EAS Submit do Expo, ou o Gradle com a chave nos segredos do GitHub. A escolha fica para quando houver a conta de desenvolvedor no Google Play.

## Alternativas consideradas
- **Publicar já na Play Store:** a revisão do Google e a conta de desenvolvedor não cabem até 21/11, e o app Expo ainda não tem o cadastro.
- **EAS Build agora:** exige conta do Expo e manda a build para a nuvem do Expo. O runner do GitHub faz o mesmo sem conta nova; o EAS fica para o degrau 3.
- **Tela no app para trocar o servidor:** resolve o link que muda, mas pede mais código e mais teste. O endereço fixo do degrau 3 resolve de vez.

## Consequências
- No dia 18/11, quem tem Android usa o app web instalado, sem esperar build nenhuma.
- O APK de teste fica pronto para quando o #30 entrar, e o CI já prova a cada mudança que o app compila para Android.
- O APK de teste aponta para um único servidor. Se o túnel mudar, é preciso rodar o workflow de novo com o link novo.
