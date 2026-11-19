# ADR 0006: Geodados com PostGIS e H3
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
Precisamos agrupar por rua, bairro e quadrante.

## Decisão
PostGIS para pontos e polígonos de bairros (OpenStreetMap ou base da prefeitura). H3 (resolução a calibrar para Itamogi) para quadrantes uniformes. SQLite com coordenadas só na demo, se necessário.

## Alternativas consideradas
- Grade quadrada própria: distorce e não tem ferramentas.

## Consequências
Consultas espaciais fortes; exige Postgres com extensão.

Atualização em 15/11/2026: H3 em resolução 9 e bairros vindos do Nominatim; bairros oficiais como polígonos ficam com gatilho no [ADR 0021](0021-cidade-como-dado-e-escala.md).
