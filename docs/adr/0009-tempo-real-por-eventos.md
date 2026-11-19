# ADR 0009: Tempo real por eventos
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
Operador e cidadão precisam ver mudanças ao vivo.

## Decisão
Módulos publicam eventos de domínio (`OcorrenciaCriada`, `OcorrenciaClassificada`, `StatusAlterado`). O backend Go os entrega por WebSocket próprio, alimentado por LISTEN/NOTIFY do Postgres (aceito em 01/11/2026, ADR 0013). Clientes refazem a consulta ao reconectar. Os eventos `OcorrenciaCriada`, `OcorrenciaAgrupada` (com total de relatos) e `NivelAlterado` alimentam diretamente a animação dos pins vivos e os contadores por bairro (ADR 0004).

## Alternativas consideradas
- Polling: simples, mas lento e caro.

## Consequências
Interface viva e módulos desacoplados; exige cuidado com reconexão.

Atualização em 15/11/2026: os eventos de cada chamado ficam na tabela `eventos` (criada, relato, revisada, despachada, resolvida, reaberta e outros) e o WebSocket da equipe de campo é filtrado por secretaria. Ver [ADR 0016](0016-ciclo-de-vida-papeis-e-equipe-de-campo.md).
