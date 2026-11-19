# ADR 0019: Observabilidade mínima, sem serviços extras
**Status:** Proposta · **Data:** 14/11/2026

## Contexto
O teste de campo precisa de resposta para três perguntas na hora: o sistema está de pé, os relatos estão entrando, e o que está falhando. A auditoria de 14/11 ([item B16](../auditoria-2026-11-14.md)) mostrou que o servidor não tinha métricas nem identificador de requisição, que `/saude` não conferia nada, e que o ponto mais cego era o celular: se a câmera, o GPS ou o envio falham no aparelho do morador, o servidor nem fica sabendo.

O Russo perguntou se era caso de Grafana. Para um servidor único com dezenas de relatos, seriam mais dois ou três contêineres (Prometheus, Grafana, coletor de logs), mais senhas e mais configuração, contra o princípio do MVP enxuto em um servidor ([ADR 0013](0013-stack-do-mvp.md)). Observabilidade é um dos três pilares pedidos para o projeto (com manutenibilidade e escalabilidade), então precisa existir desde já, mas no tamanho certo.

## Decisão
Tudo dentro do próprio MOGI, sem contêiner novo:

- **Identificador por requisição.** Cada pedido recebe um id curto, devolvido em `X-Request-Id` e escrito no log. Casa a queixa de alguém com a linha exata.
- **Log estruturado.** `log/slog`; `LOG_FORMATO=json` deixa uma linha por evento, pronta para um coletor quando houver.
- **Métricas em memória** (pacote `observa`): por rota, contagem, tempo médio, p95 por histograma, erros do servidor e recusas; pedidos por minuto na última hora; as 50 falhas mais recentes. Zeram no reinício, de propósito: o que precisa durar já está no banco.
- **Quadro da operação.** `GET /operacao` (gestor) junta as métricas com o que o banco sabe: saúde do banco e do armazenamento, fila por status, nível 5 esperando revisão, prazos vencidos, relatos por hora nas últimas 24 h, cada etapa da triagem na última hora com falhas e último erro (é onde aparece o Jev fora do ar), e os sinais dos aparelhos. Vira a aba Operação do painel.
- **Telemetria dos aparelhos.** `POST /telemetria` recebe um código curto (`gps_negado`, `foto_ilegivel`, `envio_falhou`...), a tela e um detalhe. Não guarda IP, identificador do aparelho nem o user agent inteiro: só a família do navegador e do sistema ("Chrome 130, Android 14"), e o detalhe passa pelo filtro de dados pessoais. Fica 30 dias.
- **Relatório do campo.** `GET /relatorio.csv` (gestor) e `make relatorio`: uma linha por chamado real, com tempos, mídias e classificador, sem texto do relato, sem coordenada e sem login.
- **Saúde de verdade.** `/saude` confere banco e armazenamento (feito na Onda 0) e é o que o HEALTHCHECK da imagem usa.

Só relatos reais entram nesses números; os simulados da demo ficam de fora.

## Alternativas consideradas
- **Prometheus e Grafana:** padrão de mercado e o caminho natural quando houver mais de um servidor ou mais de uma cidade. Hoje é peso sem retorno.
- **Serviço de erros de terceiro (Sentry e parecidos):** manda dado de uso para fora e contraria a preferência por open source auto-hospedado (ADR 0012).
- **Só log:** não responde "está entrando relato?" sem alguém lendo o terminal.

## Consequências
O gestor acompanha o campo pelo painel, no celular. As métricas em memória valem por processo: com mais de uma réplica, cada uma mostra a sua parte, e aí o passo seguinte é expor as mesmas contagens no formato do Prometheus, o que o pacote `observa` já permite sem mudar quem o alimenta. A telemetria depende de o aparelho ter rede na hora da falha: no app web, um aviso sem rede é descartado (o envio da telemetria nunca quebra a tela); guardar e reenviar depois fica pendente.
