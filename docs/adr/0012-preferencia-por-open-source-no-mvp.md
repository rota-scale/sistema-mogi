# ADR 0012: Preferência por open source no MVP
**Status:** Aceita (decisão do Russo em 01/11/2026) · **Data:** 01/11/2026

## Contexto
É um MVP com 1 a 2 semanas de prazo e sem orçamento. O Russo pediu o máximo de open source possível.

## Decisão
- Todo componente usa, por padrão, software open source, auto-hospedável ou com plano gratuito. Tabela em [prototipo/README.md](../../prototipo/README.md), atualizada com a stack do [ADR 0013](0013-stack-do-mvp.md) (Go, Lua via gopher-lua, Expo, PostGIS + H3, SeaweedFS; sem Supabase).
- Componentes pagos ou fechados só entram como adaptador trocável.
- **Exceção declarada:** Jev (TypeSafe), escolha do Russo, com fallback para LLM de saída estruturada.
- Respeitar licenças e atribuições (OpenStreetMap, ODbL; uso justo do Nominatim público ou instância própria).

## Alternativas consideradas
- Serviços pagos (Mapbox, Google Maps): custo e dependência.

## Consequências
Custo perto de zero e liberdade para auto-hospedar no piloto; mais responsabilidade de operação e de cumprir licenças copyleft (GPL) se distribuirmos código modificado.
