# ADR 0013: Stack do MVP do Sistema MOGI
**Status:** Aceita (Russo, 01/11/2026) para backend Go com JWT e WebSocket, regras em Lua, Postgres + PostGIS + H3, SeaweedFS para mídia, Jev como classificador, sem Supabase; Proposta para app Expo e painel React + Vite · **Data:** 01/11/2026

## Contexto
MVP em 1 a 2 semanas, app para Android e iPhone, painel da prefeitura com mapa 3D, máximo de open source (ADR 0012). O Russo não quer Supabase.

## Decisão
- **App Android e iPhone (Proposta):** React Native com Expo (câmera, vídeo, microfone, GPS) e MapLibre React Native. Substitui a PWA do ADR 0005.
- **Backend (Aceita):** Go. API única, fila de triagem, WebSocket, chamadas à visão e ao Jev, login com JWT, geração de URLs pré-assinadas para upload, PostGIS e H3 com h3-go.
- **Banco (Aceita):** PostgreSQL + PostGIS + H3. Tempo real com LISTEN/NOTIFY do Postgres repassado pelo WebSocket do Go.
- **Regras da Triagem Urbana em Lua (Aceita):** destaque nacional por ser linguagem brasileira, criada na PUC-Rio, e regras editáveis por prefeitura sem novo deploy. Sinais de risco por categoria, limiares e pesos GUT são scripts Lua embutidos no Go. O Jev dá as probabilidades; o Lua aplica a regra auditável.
  - Biblioteca: **[gopher-lua](https://github.com/yuin/gopher-lua)** (MIT, Lua 5.1, Go puro, cerca de 7 mil estrelas, madura). Tempo limitado por `context` ([README](https://github.com/yuin/gopher-lua)). Não tem limite de memória nem sandbox prontos ([issue 230](https://github.com/yuin/gopher-lua/issues/230)), então: estado sem bibliotecas `io`, `os`, `debug` e `package`, só funções liberadas, timeout de 50 ms por regra, scripts só do Admin e limites de memória do contêiner.
  - Alternativa observada: [lua-pure](https://github.com/htcom-code/lua-pure) (MIT, Lua 5.4, sandbox e limite de instruções nativos), mas ainda alfa.
- **Painel web (Proposta):** React + Vite (SPA) com react-map-gl e deck.gl, servido como estático pelo Go. Comparação em [pesquisa-painel-web.md](../pesquisa-painel-web.md).
- **Princípio (Russo, 01/11/2026, 19:04 BRT):** MVP enxuto para Itamogi (menos de 50 mil habitantes, a confirmar no IBGE), sem investidores nem orçamento: open source, simples, custo mínimo, um servidor só.
- **Mídia (Aceita):** **[SeaweedFS](https://github.com/seaweedfs/seaweedfs)** (Apache-2.0, em Go, binários prontos, compatível com S3, roda em um servidor só). Substitui o MinIO, aceito antes e revogado pelo Russo às 19:04 BRT. Upload direto do celular por URL pré-assinada gerada pelo Go. Tudo atrás de um adaptador S3, então trocar de servidor não muda o código.
- **Login (Aceita):** JWT emitido pelo Go. **Tempo real (Aceita):** WebSocket no Go com LISTEN/NOTIFY.
- **Classificador (Aceita):** Jev como classificador definitivo (ADR 0007).

## Riscos
- **SeaweedFS:** existe uma edição empresarial paga; usamos só a comunitária Apache-2.0. Fixar a versão do binário.
- **Plano B:** Garage (AGPL-3.0, leve, financiado pela NLnet). Gerenciado depois: Cloudflare R2 ou Amazon S3, sem mudar código, pelo adaptador S3.
- **Rust:** descartado no MVP pela velocidade de desenvolvimento necessária em 1 a 2 semanas.

## Alternativas consideradas
- Supabase: recusado pelo Russo.
- Next.js no lugar de Go + Vite: SSR desnecessário e backend fora da escolha do Russo.
- MinIO: descartado. Edição comunitária em modo de manutenção, distribuída só como código-fonte, sem console administrativo desde 2025, e AGPL-3.0 ([README](https://github.com/minio/minio), [InfoQ](https://www.infoq.com/news/2025/12/minio-s3-api-alternatives/), [Blocks and Files](https://www.blocksandfiles.com/ai-ml/2025/06/19/minio-users-complain-after-admin-ui-removed-from-community-edition/1610856)).
- Garage (Deuxfleurs): simples e leve, mas AGPL-3.0 e menos recursos S3 ([comparação](https://deployopen.com/comparisons/infrastructure/minio/garage-vs-seaweedfs)). Plano B.
- Rust no backend: desempenho sobrando, prazo não.

## Consequências
Um binário Go serve API, tempo real e painel; regras de triagem mudam sem deploy; TypeScript compartilhado entre app e painel. Exige cuidado com o sandbox do Lua e operar o SeaweedFS num servidor único com backup.

Atualização em 15/11/2026: ver [ADR 0014](0014-app-do-morador-web-e-expo.md) (app web e Expo, com `react-native-maps`), [ADR 0015](0015-midia-v2-varias-fotos-e-video.md) (link assinado no lugar da URL pré-assinada) e [ADR 0021](0021-cidade-como-dado-e-escala.md) (a fila de triagem não foi implementada e tem gatilho). O painel usa MapLibre GL sem deck.gl.
