# Decisões e pendências

Revisado em 15/11/2026.

## Decisões abertas para o Russo
1. Confirmar se o acesso antecipado do Jev cobre o volume do piloto e o preço usado no cálculo de custo (US$ 0,042 por milhão de tokens de entrada, a confirmar na conta).
2. Aprovar os ADRs em Proposta: 0001 a 0011 (exceto os pontos já aceitos do 0004), 0014 a 0022.
3. Calibrar as faixas GUT, os limiares (sinal 0,8, confiança 0,6) e a fração de 35% da tendência com relatos reais de Itamogi. Inclui o caso do lixo parado, que o Jev pôs em nível 3 e o cartão do caso de uso diz 1.
4. Prazos de atendimento por nível (escala de prioridade), a validar com a prefeitura.
5. Provedor e modelo da IA de reserva (padrão `claude-opus-5-5`; o custo dele com relatos reais não foi medido).
6. Hospedagem do piloto (VPS ou servidor da prefeitura) e o proxy com HTTPS do SOP 07.
7. Licença do repositório: ainda não há LICENSE.
8. Repositório continua privado ou abre para a banca da AKCIT (até 20/11).
9. Enviar a troca de integrante à AKCIT.
10. Confirmar a caixa do município de Itamogi para ligar a cerca (`CIDADE_CAIXA`); o valor do `.env.example` é aproximado.
11. Validar o borrão de rostos e placas com fotos reais antes de abrir para cidadãos.
12. Consentimento da prefeitura de Itamogi para chamar o teste de "piloto" e encarregado de dados indicado.
13. Preço para a prefeitura (hipóteses no [BMC](../bmc/README.md)).

## Resolvidas
- 01/11/2026 (19:09 BRT): nome do produto é **Sistema MOGI**, Monitoramento e Ocorrências com Gestão Inteligente, referência a Itamogi.
- 01/11/2026: "GEV" é o Jev da TypeSafe AI.
- 01/11/2026: 3D simples obrigatório no MVP; estilo Pokémon GO na próxima fase (ADR 0004).
- 01/11/2026: máximo de open source no MVP; Jev como exceção (ADR 0012).
- 01/11/2026 (19:03 e 19:04 BRT): backend Go com JWT e WebSocket, Lua nas regras, Postgres + PostGIS + H3, SeaweedFS, Jev como classificador definitivo, sem Supabase, Rust fora do MVP (ADR 0013).
- 12/11/2026: o Russo liberou mandar ao Jev a foto já borrada; nunca a original, a coordenada ou quem relatou. `JEV_FOTO=false` desliga.
- 14/11/2026: relato com até 4 fotos e 1 vídeo de até 15 s; vídeo restrito e auditado, sem áudio, apagado em 90 dias; "Perto de você" em lista mínima, sem mapa público; web e Expo mantidos, com o web como referência (conversa, [ADR 0014](adr/0014-app-do-morador-web-e-expo.md), [ADR 0015](adr/0015-midia-v2-varias-fotos-e-video.md)).
- 14/11/2026: simplicidade para quem opera: urgência em uma linha, motivo em frase, um botão principal por vez, termos internos só no bloco do gestor ([ADR 0017](adr/0017-principios-de-produto.md), princípio 7).
- 14/11/2026: retenção da mídia original em 90 dias, ajustável pelo gestor (antiga pendência 12, [ADR 0015](adr/0015-midia-v2-varias-fotos-e-video.md)).
- 15/11/2026: chave do Jev funcionando, com teste ao vivo de texto e de foto (números no [README](../README.md#números-medidos)).
- 15/11/2026: sons com propósito no web, na equipe de campo e no Expo ([ADR 0022](adr/0022-sons-com-proposito.md)).
- 15/11/2026: mapa primeiro no app do morador, com uma ação só (a câmera), no web e no Expo.
- 15/11/2026: documentação atualizada para as entregas do hackathon (conversa).
- 16/11/2026: o Russo decidiu o cadastro com CPF obrigatório para relatar e uma versão mínima da comunidade ("Meu bairro"); o documento fica cifrado, mascarado e com acesso auditado ([ADR 0024](adr/0024-cadastro-do-morador-com-cpf.md), que substitui o envio anônimo do 0020).
- 16/11/2026: o Android segue no Expo com TypeScript, sem app em Kotlin; distribuição em três degraus ([ADR 0025](adr/0025-android-com-expo-e-desenvolvimento-agentico.md), [ADR 0026](adr/0026-distribuicao-no-android.md)).
- 16/11/2026: primeiro contato para quem não lida com tecnologia: slides, tour no mapa e Ajuda curta para o morador; guia de primeiro uso para operador, gestor e equipe (conversa).
- 16/11/2026: o Russo pediu que sexo e idade, opcionais no cadastro, escolham o boneco do mapa; as respostas ficam só no aparelho, para não guardar mais dado pessoal no servidor.
- 16/11/2026: o cadastro passa a ter dois passos, com os termos de ciência no fim.

## Fora do escopo do MVP
- Estilo Pokémon GO com avatar se deslocando ao vivo: próxima fase.
- Interface gamificada estilo Duolingo: fase futura.
- ~~RAG de prazos (RF13) e function calling (RF14)~~: entregues em 15/11 ([ADR 0023](adr/0023-agente-de-contexto-rag-e-function-calling.md)); falta a base oficial da prefeitura.
- Borrão de vídeo, notificação push ou SMS, integração Open311 e Waze for Cities.

## Backlog
Entregue: esqueleto Go com sandbox Lua, painel web, adaptador de IA com esquema, mapa MapLibre 3D, pinos ao vivo, tempo real, log de custo e latência, várias fotos e vídeo, equipe de campo, acompanhamento e "Também vi", aba Operação, cidade e parâmetros como dado, CI, sons, app Expo em paridade até a v0.1 (o cadastro e a área do morador ainda não estão no Expo, [issue #30](https://github.com/rota-scale/cidade-inteligente-akcit/issues/30)) com o web.

- [ ] Teste de campo em Itamogi com relatos reais
- [ ] Fotos reais de Itamogi para a demo e para validar o borrão
- [ ] Bairros oficiais de Itamogi (hoje vêm do Nominatim)
- [ ] Dados reais de Itamogi (IBGE) na proposta
- [ ] Fila sem rede no app web (o Expo já tem)
- [ ] Vídeo gravado da demo (plano B) e ensaio do pitch
- [ ] Login gov.br antes do piloto público ([issue #26](https://github.com/rota-scale/cidade-inteligente-akcit/issues/26))
- [ ] App Expo com cadastro, tour, boneco e Ajuda do web ([issue #30](https://github.com/rota-scale/cidade-inteligente-akcit/issues/30))
- [ ] Bairro pelo CEP, além do GPS
- [ ] Chave do Google Maps para o APK e endereço fixo do servidor
- [ ] Relatório de 26/11
