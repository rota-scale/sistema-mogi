# ADR 0005: Captura móvel PWA primeiro
**Status:** Substituída pelo ADR 0013 (app Expo para Android e iPhone) · **Data:** 01/11/2026

## Contexto
Precisamos de captura com foto, vídeo e GPS em celulares variados até 14/11.

## Decisão
PWA responsiva com câmera e Geolocation API do navegador, fila offline para envio. App nativo (Expo com MapLibre) só depois do piloto, reaproveitando os módulos.

## Alternativas consideradas
- Nativo desde o início: publicação em lojas e prazo.

## Consequências
Instala pelo navegador; acesso a sensores um pouco mais limitado.

Atualização em 15/11/2026: ver [ADR 0014](0014-app-do-morador-web-e-expo.md), que mantém o app web (PWA) como referência e o Expo em paridade.
