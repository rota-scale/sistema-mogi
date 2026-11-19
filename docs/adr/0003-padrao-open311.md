# ADR 0003: Dados compatíveis com Open311 GeoReport v2
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
Prefeituras já usam ou vão usar outros sistemas. O GeoReport v2 é o padrão aberto mais usado (FixMyStreet, uReport).

## Decisão
O modelo de ocorrência mapeia para GeoReport v2 (`service_code`, `description`, `lat`, `long`, `media_url`, `status`, `requested_datetime`, `agency_responsible`). Campos próprios (prioridade, confiança da IA, quadrante H3) ficam como extensões documentadas. Expor `/georeport/v2/services` e `/requests` depois do MVP.

## Alternativas consideradas
- Modelo próprio sem padrão: integração cara depois.

## Consequências
Integração facilitada; algumas traduções de nomes.
