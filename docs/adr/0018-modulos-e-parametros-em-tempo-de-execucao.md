# ADR 0018: Módulos e parâmetros em tempo de execução, na prefeitura ou na nuvem
**Status:** Proposta · **Data:** 14/11/2026

## Contexto
A auditoria de 14/11 ([item B20](../auditoria-2026-11-14.md)) listou valores fixos no código que as ADRs anteriores marcaram "a calibrar no piloto": raio de 50 m e janela de 30 dias do agrupamento, limite de envios, dias de guarda da mídia. Calibrar em campo exigia recompilar e reimplantar. Além disso, o Russo quer levar o MOGI a outras regionais, e cada prefeitura começa de um jeito: uma quer vídeo e equipe de campo desde o primeiro dia, outra só foto e mapa.

O pedido foi de modularidade em tempo real, valendo tanto para instalação no servidor da prefeitura quanto para uso sob demanda em nuvem.

## Decisão
- **Uma imagem, dois jeitos de implantar.** O mesmo contêiner (ADR 0013) roda no servidor da prefeitura ou numa VPS. Nada no código distingue os dois; a diferença está só no `.env` (segredos, endereço, proxy de confiança).
- **Parâmetros no banco, por cidade.** A tabela `parametros` guarda um documento JSON por cidade; o que não estiver nele vale o padrão do código, então a tabela pode ficar vazia. Hoje são: raio e janela do agrupamento, raio do "Perto de você", envios por aparelho e por IP a cada 10 minutos, dias de guarda da mídia original, e os módulos.
- **Módulos que ligam e desligam:** vídeo no relato, "Perto de você" com "Também vi", tela da equipe de campo e ditado por voz. `GET /config` informa o que está ligado e os apps escondem o resto; o servidor também recusa ou ignora o que está desligado.
- **Mudança sem reinício.** O gestor edita em `/admin/parametros` (painel, Regras, aba Parâmetros). Vale na hora na instância que gravou e em até 15 segundos nas outras. Cada versão anterior fica em `parametros_historico`, com autor e data.
- **Faixas seguras.** O servidor recusa valor que quebre o sistema ou abra brecha (raio de 1 m, limite de envios zero, limite por IP menor que por aparelho).
- **Travas da instalação continuam no ambiente.** Segredos, endereços e `MODULO_VIDEO=false` (que mantém o vídeo desligado mesmo que o gestor ligue) ficam no `.env`: são decisão de quem opera o servidor, não de quem usa o painel.

Ficam de fora desta decisão, por dependerem de validação com a prefeitura: os prazos por nível ([pendência 11](../decisoes-e-pendencias.md)) e a lista de categorias, que ainda tem partes fixas no código.

## Alternativas consideradas
- **Tudo em variável de ambiente:** exige reiniciar e acesso ao servidor para calibrar; ruim em campo.
- **Uma linha por parâmetro (chave e valor):** mais flexível, mas perde a conferência do conjunto (um limite depende do outro).
- **Serviço de configuração ou de feature flags de terceiro:** peso e dependência desnecessários neste porte.

## Consequências
Calibrar no piloto vira uma edição no painel, com histórico. Parâmetro novo entra no código com padrão e passa a aparecer no documento na próxima gravação. O cache de 15 segundos é por instância; se um dia isso for pouco, o `NOTIFY` do Postgres que já serve o tempo real avisa as réplicas.

## Dono e data de cada módulo (v0.3.3)
Módulo ligável é feature flag, e flag sem dono vira condição para sempre. Cada um tem responsável e momento de rever (em `MODULOS`, `painel/src/gestor.ts`, mostrado na Administração):

| Módulo | Responsável | Rever |
|---|---|---|
| `video` | Russo | fim do piloto |
| `perto` | Russo | fim do piloto |
| `campo` | Russo | fim do piloto |
| `voz` | Russo | fim do piloto |
| `recuperacao` | Russo | quando o Face ID entrar (#40) |
| `cadastro` (só no servidor) | Russo | quando o login gov.br entrar (#26) |
