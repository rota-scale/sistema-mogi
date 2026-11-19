# Pesquisa de soluções semelhantes

Pesquisa feita em 01/11/2026. Licenças conferidas nas páginas citadas.

## Soluções de zeladoria e ocorrências urbanas
| Solução | O que faz | Copiar | Evitar | Licença |
|---|---|---|---|---|
| [FixMyStreet (mySociety)](https://github.com/mysociety/fixmystreet/) | Pin no mapa, descobre o órgão certo pelo local e tipo, envia por e-mail ou Open311; relatos públicos com alertas por área | Roteamento automático por local e categoria; relatos públicos evitam duplicidade | Fluxo só por formulário, sem triagem inteligente | Própria aberta (ver repo) |
| [Open311 GeoReport v2](https://www.fixmystreet.com/open311/) | Padrão aberto para sistemas de ocorrência conversarem (services, requests, status, media_url) | Modelo de dados e endpoints compatíveis | Extensões fora do padrão sem documentar | Padrão aberto |
| [uReport (Bloomington)](https://github.com/City-of-Bloomington/uReport) | CRM com endpoint Open311 para municípios pequenos | Foco em cidade pequena, fila e atribuição | Interface antiga | AGPL-3.0 |
| [Ushahidi](https://www.open311.org/2011/07/ushahidi-and-the-open311-ecosystem/) | Mapeamento colaborativo de crises | Mapa de relatos em massa | O próprio autor apontou falta de triagem e de banco geoespacial | AGPL |
| Decidim | Participação cidadã (consultas, orçamentos) | Transparência e devolutiva | Não é ferramenta de zeladoria | AGPL-3.0 |
| [Colab (Brasil)](https://apps.apple.com/br/app/colab/id609666061) | Foto, descrição e publicação para a prefeitura; zeladoria, consultas e pontos/ranking; usado em Niterói, Recife, Palmas e outras ([casos](https://www.colab.com.br/veja-como-o-colab-melhorou-a-eficiencia-de-alguns-municipios/)) | Gamificação leve, devolutiva da prefeitura, venda B2G no Brasil | Concorrente direto: precisamos nos diferenciar pela IA e pelo mapa 3D em tempo real | Proprietária |
| [SeeClickFix / CivicPlus](https://www.govtech.com/biz/CivicPlus-Acquires-311-Software-Company-SeeClickFix.html) | App 311; tinha mais de 400 governos quando foi comprado pela CivicPlus em 2019 ([fonte](https://www.govtech.com/biz/CivicPlus-Debuts-New-Division-to-Integrate-SeeClickFix.html)) | Separar experiência do cidadão e gestão interna; integrações com sistemas de ativos | Depender de muitos canais sem caixa única | Proprietária |
| 1746 Rio | Central de atendimento da prefeitura do Rio por telefone, app e web | Catálogo de serviços com prazos | Registro majoritariamente textual | Proprietária |
| [Waze for Cities](https://www.waze.com/partners/wazeforcities) | Troca gratuita de dados: cidade envia interdições, recebe tráfego anonimizado | Publicar interdições geradas pelas ocorrências críticas | Termos restritivos de uso dos dados | Termos Google |

## Opções de stack para mapa 3D em tempo real
- **MapLibre GL JS:** terreno 3D e prédios com `fill-extrusion`, aberto ([exemplo](https://www.maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/), [terreno e prédios](https://docs.maptoolkit.org/map-styles/3d-buildings-and-terrain/)). React Native suporta prédios, mas não terreno, segundo a mesma fonte.
- **deck.gl:** camadas de dados sobre o MapLibre, incluindo [H3HexagonLayer](https://deck.gl/docs/api-reference/geo-layers/h3-hexagon-layer) extrudada para quadrantes.
- **CesiumJS e Google Photorealistic 3D Tiles:** visual impressionante, mas pesado no celular e com custo e termos de uso ([Map Tiles API](https://developers.google.com/maps/comms/eea/map-tiles)). Fica como opção futura.
- **Mapbox:** ótimo, mas licença proprietária e cobrança por uso.
- **AR estilo Pokémon GO (Niantic, 8th Wall):** fora do MVP; o efeito "me vejo andando" sai com a câmera do mapa seguindo o GPS em 3D.
- **Tempo real (pesquisado, descartado pelo Russo; usamos WebSocket no Go, ADR 0013):** [Supabase Realtime](https://supabase.com/realtime) transmite mudanças do Postgres por WebSocket com regras de acesso por linha ([código](https://github.com/supabase/realtime)). Alternativa: WebSocket próprio ou SSE.
- **Geodados:** PostGIS para consultas por polígono (bairros) e H3 para quadrantes.
- **Mídia:** armazenamento de objetos compatível com S3.
- **IA:** visão atrás de um adaptador para descrever a mídia; decisão com o [Jev da TypeSafe](https://typesafe.ai/blog/introducing-system-one-models-and-jev), tipado e calibrado, que ainda não aceita imagem.

## Conclusão
Nada no mercado combina triagem por IA com prioridade, mapa 3D em tempo real e padrão Open311 para cidades pequenas. Esse é o nosso espaço.
