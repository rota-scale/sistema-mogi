# Pesquisa: framework do painel web da prefeitura

Pergunta do Russo (01/11/2026): o painel deve ser React com Vite?

## Requisitos do painel
Mapa 3D MapLibre + deck.gl, pins ao vivo por WebSocket, filtros, detalhe do chamado. Painel interno e logado (sem SEO). 1 a 2 semanas, time que já sabe React e Next.js. Backend em Go.

## Comparação
| Critério | React + Vite (SPA) | Next.js | SvelteKit | Vue / Nuxt | Go + HTMX/templ |
|---|---|---|---|---|---|
| deck.gl | Bindings oficiais React; todos os exemplos do site são em React ([deck.gl](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre)) | Mesmos bindings, mas mapa precisa rodar só no cliente | Sem bindings oficiais, integração manual | Sem bindings oficiais | Só JS avulso, foge do modelo HTMX |
| MapLibre | react-map-gl, recomendado pelo deck.gl ([react-map-gl](https://visgl.github.io/react-map-gl/docs/get-started)) | Igual | Wrappers da comunidade | Wrappers da comunidade | JS avulso |
| Configuração do worker do MapLibre | Exemplo oficial já usa Vite ([MapLibreOverlay](https://deck.gl/docs/api-reference/maplibre/overview)) | Ajuste manual no bundler | Vite, ajuste simples | Vite, ajuste simples | Não se aplica |
| Muitos pins | Renderização na GPU pelo deck.gl, independe do framework | Igual | Igual | Igual | Igual, mas sem estado reativo |
| Tempo real | WebSocket do Go direto no cliente | Igual, SSR não ajuda | Igual | Igual | Bom para listas, ruim para estado do mapa |
| SSR e SEO | Não precisa | Recurso sobrando, mais complexidade | Opcional | Opcional | Server-side por natureza |
| Reuso com o app Expo | Mesma linguagem (TypeScript), tipos e cliente da API compartilhados | Igual | Só tipos | Só tipos | Nenhum |
| Curva do time | Nenhuma | Nenhuma | Nova | Nova | Nova para front |
| Deploy | Arquivos estáticos servidos pelo próprio Go ou CDN | Precisa de servidor Node ou export estático | Estático possível | Estático possível | Binário Go |

## Recomendação
**React + Vite (SPA) com TypeScript, react-map-gl e @deck.gl/maplibre.** É o caminho documentado oficialmente pelo deck.gl (inclusive o exemplo usa Vite), o time já domina React, não há necessidade de SSR num painel logado, compartilha tipos e cliente da API com o app Expo e sai como arquivos estáticos que o próprio Go serve. Next.js funcionaria, mas o SSR é peso sem benefício aqui; SvelteKit, Nuxt e HTMX exigiriam aprender algo novo e integrar deck.gl à mão.
