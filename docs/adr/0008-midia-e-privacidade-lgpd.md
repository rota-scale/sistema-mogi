# ADR 0008: Mídia e privacidade (LGPD)
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
Fotos e vídeos podem expor rostos e placas.

## Decisão
Borrar rostos e placas antes de publicar; original só para operadores autorizados. Armazenamento SeaweedFS (S3 compatível, Apache-2.0, auto-hospedado, ADR 0013) com upload e leitura por URLs pré-assinadas geradas pelo Go. Retenção proposta: original apagado após a ocorrência fechar mais 90 dias (a validar). Identidade de quem reportou só visível à prefeitura.

## Alternativas consideradas
- Publicar a mídia original: risco legal.

## Consequências
Custo de processamento extra; conformidade com a LGPD.

Atualização em 15/11/2026: ver [ADR 0015](0015-midia-v2-varias-fotos-e-video.md), que troca a URL pré-assinada por link assinado servido pelo Go e implementa a retenção de 90 dias.
