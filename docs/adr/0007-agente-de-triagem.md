# ADR 0007: Agente de triagem (visão + Jev)
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
A triagem precisa ser rápida, auditável e barata. O Jev da TypeSafe decide com tipos e probabilidades calibradas em 70 a 500 ms, mas ainda não aceita imagem e roda nos EUA.

## Decisão
- **Etapa 1, visão:** porta `DescritorDeMidia` com adaptadores por provedor. Gera campos estruturados (categoria candidata, sinais visíveis, contexto). Rostos e placas são borrados antes.
- **Etapa 2, decisão:** porta `ClassificadorDeOcorrencia` com adaptador Jev, preenchendo o esquema do ADR 0010. **Jev aceito como classificador definitivo** pelo Russo em 01/11/2026 (precisão na classificação e na tipagem).
- **Etapa 3, regra:** scripts Lua por prefeitura, executados no Go com gopher-lua em sandbox, aplicam sinais, limiares e pesos GUT. O Jev dá as probabilidades; o Lua aplica a regra auditável (ADR 0013). Aceito em 01/11/2026.
- **Fallback:** se o Jev falhar ou estourar o tempo, adaptador com LLM de saída estruturada validada por schema; se também falhar, "a classificar" para revisão humana.
- Para o Jev vão a descrição estruturada e, desde 12/11/2026 (decisão do Russo), a foto já borrada. Nunca a foto original nem dados pessoais.
- Log por chamada: provedor, tokens, custo, latência, confiança. Métrica de qualidade e calibração contra o operador.
- Chave de API fora do repositório, em variável de ambiente.

## Alternativas consideradas
- Um único LLM com visão decidindo tudo: mais lento, caro e sem calibração.
- Modelo próprio: sem dados nem tempo.

## Consequências
Decisão barata e confiável com troca de provedor fácil; dependência de serviço em acesso antecipado, mitigada pelo fallback.

Atualização em 15/11/2026: a cadeia atual é Jev, IA de reserva com saída estruturada, classificador local e, por último, "a classificar"; com `JEV_FOTO=true` o Jev vê a foto borrada e também faz a etapa de visão. Detalhes em [docs/fluxo-do-agente.md](../fluxo-do-agente.md); mídia no [ADR 0015](0015-midia-v2-varias-fotos-e-video.md).
