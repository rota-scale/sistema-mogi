# Observabilidade, manutenção e escala

| Tema | Existe no código hoje | Próximo passo, proposta |
|---|---|---|
| Observabilidade | `X-Request-Id`, `slog` em texto ou JSON, métricas em memória por rota, p95 e falhas recentes, `/saude` com banco e mídia, `/operacao`, telemetria de aparelhos, CSV e etapas de triagem com custo e latência | Centralizar logs e alertas com proteção de dados; medir disco e certificados; expor métricas agregáveis para múltiplas réplicas |
| Manutenibilidade | Módulos Go, interfaces de mídia e triagem, migrações embutidas com trava, testes e CI; regras Lua, parâmetros e histórico editáveis | Ensaiar restauração; revisar segurança e LGPD; validar e governar regras e parâmetros municipais |
| Escalabilidade | PostGIS e índices, H3 quando instalado, agrupamento e eventos Postgres; cadastro da cidade, uma cidade por instalação; JWT, armazenamento S3 e LISTEN/NOTIFY compartilháveis | Medir capacidade antes de prometer escala; testar concorrência, conexões, mídia e falhas; planejar limites compartilhados e distribuição das regras para múltiplas réplicas |

## Limites relevantes

O Compose usa um servidor e volumes locais, sem alta disponibilidade declarada. A triagem acontece durante o pedido HTTP, não há fila assíncrona. O limitador e métricas vivem em cada processo; as métricas zeram ao reiniciar. Os arquivos de regra persistem em volume local e precisam de estratégia de distribuição e sincronização. LISTEN/NOTIFY e WebSocket precisam ser avaliados para reconexão, perda de eventos e distribuição. O modelo previsto é uma instalação isolada por município, não várias cidades na mesma base.

O [ADR 0021](../adr/0021-cidade-como-dado-e-escala.md) propõe fila de triagem quando o p95 do envio ultrapassar 8 segundos ou o borrão de vídeo exigir processamento assíncrono. Limites compartilhados e métricas Prometheus são passos previstos para múltiplas réplicas, não recursos atuais.

O motor Lua relê arquivos, usa sandbox com limite de tempo e registra alterações, mas o código não define limite próprio de memória do interpretador. Testar e aprovar as regras como política pública continua sendo responsabilidade humana. Consulte [motor](../../backend/internal/triagem/lua.go), [admin](../../backend/internal/admin/admin.go), [limitador](../../backend/internal/httpx/httpx.go) e [Compose](../../docker-compose.yml).
