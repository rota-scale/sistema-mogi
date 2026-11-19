# ADR 0025: Android com Expo, TypeScript e desenvolvimento agêntico
**Status:** Proposta · **Data:** 16/11/2026

## Contexto
O Russo pediu uma fundação para o Android em 16/11/2026: a maioria dos moradores de Itamogi não tem iPhone. Ele pediu também que a stack escolhida seja a mais atual para **desenvolvimento agêntico**, isto é, para um time pequeno que constrói com agentes de IA (Claude Code, Copilot, Antigravity).

Onde estamos:
- O app do morador existe em duas versões ([ADR 0014](0014-app-do-morador-web-e-expo.md)): a **web** (`painel/src/relatar`), que já roda no Chrome do Android, e a **Expo** (`app/`, Expo SDK 58, React Native 0.88, TypeScript), que roda no Android e no iPhone.
- O app Expo nunca virou um APK instalável: rodava só no Expo Go.
- O app Expo ainda não tem o cadastro com CPF ([issue #30](https://github.com/rota-scale/cidade-inteligente-akcit/issues/30)).

## Decisão
- **O Android continua no Expo, com TypeScript.** Não abrimos um segundo app em Kotlin nativo. Um código só serve Android e iPhone, e a lógica pura é a mesma do painel e do app web, também em TypeScript.
- **Kotlin só como módulo nativo.** Quando uma função exigir código do Android (por exemplo, IA no próprio aparelho com as APIs do Google), ela entra como módulo Kotlin pelo Expo Modules API, dentro do mesmo app. Não vira um app à parte.
- **Geração contínua do projeto nativo (CNG).** A pasta `android/` não vai para o Git. Ela é gerada a partir do `app.json` com `npx expo prebuild --platform android`. Toda configuração nativa (pacote, permissões, ícone) fica no `app.json` ou em plugin de configuração. Assim a atualização do SDK do Expo não vira conflito em arquivo gerado.
- **Pacote `com.rotascale.mogi`.** Ele pode mudar sem custo até a primeira publicação na Play Store. Depois dela, é para sempre.
- **Permissões mínimas:**
  - câmera e localização;
  - **sem microfone**: o vídeo é sem som (ADR 0015);
  - sem armazenamento externo e sem sobreposição de tela, bloqueados no `app.json` com `blockedPermissions`.
- **Versão:** o `versionCode` do Android segue a versão do produto: `MAIOR*10000 + MENOR*100 + CORREÇÃO` (a v0.2.1 é 201).

## Por que esta stack serve ao desenvolvimento agêntico
- **TypeScript é onde os agentes erram menos.** Tipos conferidos pelo `tsc`, testes em Jest e lint dão ao agente uma resposta rápida e automática sobre o que quebrou. É o ciclo que o CI já roda (job "App Expo").
- **Um código só, um contexto só.** O agente lê `app/`, `painel/` e `backend/` na mesma linguagem do lado do cliente. Com dois apps nativos, cada mudança seria feita duas vezes, por agentes diferentes, com risco de divergir.
- **O Expo publica ferramentas para agentes:**
  - o servidor MCP oficial do Expo (no plano gratuito desde 26/05/2026) dá ao agente a documentação da versão certa do SDK, os simuladores e as builds;
  - as Expo Skills e o `app/AGENTS.md`, que já está no repositório, mandam o agente ler a documentação da versão em uso em vez de confiar na memória.
- **A build roda numa sandbox isolada**, no CI do GitHub, e não na máquina de ninguém: o agente dispara, lê o log e corrige.

## Alternativas consideradas
- **Kotlin com Jetpack Compose:** é o padrão do Google e o caminho de quem é Android primeiro com time de Android. Para nós seria um segundo app, em outra linguagem, sem reaproveitar a lógica do painel, e o iPhone continuaria precisando do Expo.
- **Kotlin Multiplatform com Compose Multiplatform:** compartilha lógica e tela em Kotlin. Exigiria reescrever o app inteiro e a lógica que já temos em TypeScript.
- **Flutter:** um código só, mas em Dart. Seria a terceira linguagem do time e não reaproveita nada do painel.
- **Só o app web (PWA) no Android:** já funciona hoje e é o caminho do dia 18/11 ([ADR 0026](0026-distribuicao-no-android.md)). Mas o navegador limita a câmera, a fila sem rede e as notificações, que o app nativo resolve.

## Consequências
- Ganho: um APK de verdade sem time de Android, e a mesma base para o iPhone.
- Custo: o módulo nativo, quando aparecer, é Kotlin que alguém precisa manter.
- O app Expo só fica útil para relatar depois da paridade do cadastro ([issue #30](https://github.com/rota-scale/cidade-inteligente-akcit/issues/30)). Até lá, o APK serve para testar mapa, câmera e localização.

## Fontes
- Guia do Expo para escolher a stack (fonte do próprio Expo, que tem interesse na escolha): [expo.dev](https://expo.dev/articles/choosing-a-mobile-stack/choose-a-mobile-stack) e [stack para agentes de IA](https://expo.dev/articles/choosing-a-mobile-stack/which-mobile-stack-for-ai-coding-agents).
- Servidor MCP do Expo: [documentação](https://docs.expo.dev/eas/ai/mcp/) e [anúncio no plano gratuito](https://expo.dev/changelog/the-expo-mcp-server-is-now-available-on-the-free-plan.md).
- Comparação independente da Software Mansion, mesmo app em KMP e React Native: [blog](https://swmansion.com/blog/we-built-the-same-app-in-kmp-and-react-native-here-s-what-we-found).
- Build local sem EAS (prebuild e Gradle): [Expo, apps locais](https://docs.expo.dev/guides/local-app-overview/).
