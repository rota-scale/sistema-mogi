# ADR 0014: App do morador em duas frentes, web como referência e Expo em paridade
**Status:** Proposta · **Data:** 15/11/2026 (decisão do Russo em 14/11/2026)

## Contexto
O [ADR 0005](0005-captura-movel.md) escolheu uma PWA; o [ADR 0013](0013-stack-do-mvp.md) trocou por um app Expo (em Proposta). No sprint de 11/11 o relato virou também uma página web servida pelo Go em `/relatar`, para testar no celular sem build nativa (conversa de 11/11). Em 14/11 a auditoria mostrou que o app Expo estava atrás do web em tudo ([auditoria](../auditoria-2026-11-14.md)), e o Russo decidiu manter os dois, com o web como referência (conversa de 14/11). Faltava registrar a decisão num ADR.

## Decisão
- **Duas frentes, uma API.** O app web do morador (`painel/src/relatar/`, servido em `/relatar`) e o app Expo (`app/`, Android e iPhone) falam com as mesmas rotas (`/api/config`, `/api/ocorrencias`, `/api/perto`, `/api/perto/confirmacao`, `/api/acompanhar`, `/api/telemetria`) e recebem as mesmas respostas e códigos de erro.
- **O web é a referência e sai primeiro.** Recurso novo de captura nasce no web; o Expo alcança depois. O teste de campo e a demo usam o link web, que não exige instalar nada.
- **Lógica compartilhada, não copiada.** `app/src/logica/web.ts` importa direto `painel/src/relatar/logica.ts`; o `app/metro.config.js` inclui a pasta do painel em `watchFolders`. Mensagens de erro, validação do envio, precisão do GPS, prazo, andamento, "Perto de você" e progresso são as mesmas funções. O que só existe no app (fila sem rede, corpo do envio) fica em `app/src/logica/` com teste. A tabela de sons é copiada de `painel/src/sons.ts` e um teste compara as duas.
- **Mesmo comportamento na tela.** Mapa primeiro, com a pessoa no lugar dela e uma ação só (a câmera); foto no toque e vídeo sem som ao segurar; envio com a mesma chave de idempotência em toda tentativa ([ADR 0020](0020-envio-anonimo-e-idempotente.md)).
- **Diferenças aceitas.** O Expo usa `react-native-maps` (Apple Maps e Google Maps), não MapLibre; não tem ditado próprio (usa o do teclado); tem fila sem rede, que o web ainda não tem. Build própria para Android pede uma chave do Google Maps.

## Alternativas consideradas
- **Só o web (PWA):** zero instalação e um código só, mas sem fila confiável em segundo plano e com câmera e GPS dependentes do navegador.
- **Só o Expo:** experiência nativa, mas exige instalar o app, o que afasta o morador ocasional e atrasa o teste de campo.
- **Código de tela compartilhado (React Native Web):** um código para tudo, mas reescreveria o web às vésperas do hackathon.

## Consequências
Cada recurso de captura custa duas implementações de tela, aviso registrado pelo Russo em 14/11; a lógica compartilhada reduz o risco de as regras divergirem. Mudança em `painel/src/relatar/logica.ts` afeta os dois apps e precisa passar nos testes dos dois (300 no painel e 31 no app em 15/11). Substitui em parte o [ADR 0005](0005-captura-movel.md) e a linha do app Expo no [ADR 0013](0013-stack-do-mvp.md), e complementa o [ADR 0011](0011-captura-por-voz-e-camera.md).
