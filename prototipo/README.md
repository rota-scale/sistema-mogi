# Protótipo do Sistema MOGI (Monitoramento e Ocorrências com Gestão Inteligente)

## Stack proposta
Máximo de open source ([ADR 0012](../docs/adr/0012-preferencia-por-open-source-no-mvp.md)), monólito modular com portas e adaptadores ([ADR 0002](../docs/adr/0002-arquitetura-modular.md)).

| Componente | Opção open source | Licença | Custo no MVP |
|---|---|---|---|
| App Android e iPhone | React Native + Expo, MapLibre React Native | MIT | Grátis |
| Backend | Go (API, fila, WebSocket, JWT, URLs pré-assinadas) | BSD-3-Clause | Grátis |
| Regras de triagem | Lua via gopher-lua | MIT | Grátis |
| Painel da prefeitura | React + Vite, react-map-gl | MIT | Grátis |
| Mapa 3D (obrigatório) | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) com `fill-extrusion` | BSD-3-Clause (conferida) | Grátis |
| Camadas de dados (pins, heatmap, H3) | deck.gl | MIT | Grátis |
| Tiles e prédios | [OpenFreeMap](https://github.com/hyperknot/openfreemap) (dados OpenStreetMap); alternativa Protomaps | MIT; dados ODbL (conferida) | Grátis, sem chave |
| Endereço e bairro | [Nominatim](https://github.com/osm-search/Nominatim) | GPL-3.0 (conferida) | Grátis; público limitado a 1 req/s com atribuição ([política](https://operations.osmfoundation.org/policies/nominatim/)); usar cache ou instância própria |
| Banco e geodados | PostgreSQL + PostGIS | PostgreSQL License; GPL-2.0 | Grátis |
| Quadrantes | H3 | Apache-2.0 | Grátis |
| Tempo real | WebSocket no Go + LISTEN/NOTIFY do Postgres | Incluso | Grátis |
| Fotos e vídeos | SeaweedFS (S3 compatível, um servidor) | Apache-2.0 | Grátis; plano B Garage |
| Voz | Reconhecimento nativo do aparelho no app Expo; Whisper como opção | Do sistema; MIT | Grátis |
| Visão (opção aberta) | Qwen2.5-VL atrás do adaptador | Apache-2.0 | Grátis se auto-hospedado; API paga como alternativa |
| Borrar rosto e placa | OpenCV com detector de rostos e placas abertos | Apache-2.0 (OpenCV) | Grátis |
| Decisão da triagem | **Jev (TypeSafe), exceção declarada, não é open source** | Proprietária | US$ 0,042 por milhão de tokens de entrada; fallback com LLM estruturado |

Licenças marcadas "conferida" foram verificadas no repositório oficial em 01/11/2026; as demais são as conhecidas de cada projeto, a reconfirmar antes do piloto.

## Telas do MVP
1. Captura "falar e mostrar": foto ou vídeo, botão de falar e formulário pré-preenchido para confirmar com um toque (MVP). Pergunta de voz de volta fica desejável (ADR 0011).
2. Confirmação com protocolo e prioridade.
3. Painel de auditoria com **mapa 3D simples obrigatório** (prédios extrudados, câmera inclinada) e pins vivos: bolinhas chegando em tempo real, cor pelo nível, tamanho pelo número de relatos, vermelho pulsando, filtros por cor e secretaria, contador por bairro e mapa de calor.
4. Painel do operador com fila por prioridade.
5. Detalhe da ocorrência (mídia, endereço, bairro, quem reportou, status).
6. Indicadores: tempo de resposta, acerto da IA, custo e latência.

Ainda sem código.

Stack completa e motivos no [ADR 0013](../docs/adr/0013-stack-do-mvp.md). Sem Supabase.
