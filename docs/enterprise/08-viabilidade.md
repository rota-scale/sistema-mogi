# Viabilidade para o pitch

## O que já existe e funciona

- **Morador:** mapa primeiro, câmera no centro (até 4 fotos ou vídeo de 15 s sem áudio), fala, recibo com protocolo, cadastro com CPF feito uma vez, acompanhamento pelo protocolo e pelo perfil, "Também vi" para quem passa, na web e no app Expo.
- **Central:** mapa e fila ao vivo, revisão, despacho por secretaria, reabertura, sons com propósito.
- **Equipe de campo:** tela própria no celular, só com os chamados da secretaria, resolução com foto do depois.
- **Gestor:** indicadores, aba Operação, regras Lua com simulação, usuários e parâmetros da cidade sem deploy.
- **Triagem:** Jev, IA opcional e classificador local, com a regra em Lua decidindo; testada ao vivo com o Jev em 15/11.

Conferido com testes automatizados e `make conferir` contra banco e armazenamento reais. **Ainda não:** teste de campo em Itamogi e celulares de verdade em escala.

## Lua: diferencial brasileiro

Lua nasceu na PUC-Rio. No MOGI, a política de prioridade da prefeitura vira um arquivo legível, testado com cenários e trocado pelo gestor sem programador nem deploy. A IA ajuda; quem decide é a regra que a cidade aprovou, e nos níveis 4 e 5 uma pessoa confere.

## Custo

Custo de IA medido no teste: cerca de **R$ 0,0003 por relato só com texto** e **R$ 0,0007 com foto**. É só a inferência.

Com preços públicos da AWS em São Paulo (15/11/2026, câmbio de simulação R$ 5,50 por dólar):

| Cenário | Relatos/mês | Infra + IA | Por relato |
|---|---:|---:|---:|
| A: piloto num servidor | 1.000 | R$ 363,18/mês | R$ 0,36 |
| B: banco e mídia gerenciados | 20.000 | R$ 1.532,76/mês | R$ 0,08 |

São subtotais: ficam de fora operação, suporte, impostos e tráfego. Memória de cálculo em [AWS](07-aws.md). Para uma cidade pequena, o servidor da prefeitura ou uma VPS com backup pode sair mais barato que a nuvem gerenciada.

## Riscos

| Risco | O que fazemos |
|---|---|
| Privacidade | Borrão seletivo, vídeo sem áudio, original restrita e apagada em 90 dias, trilha de quem abriu. Falta validar o borrão com fotos reais e fechar a base legal com a prefeitura |
| Triagem errada | Cadeia com reserva local, revisão humana nos níveis altos, regra auditável. Calibrar com os casos do teste de campo |
| Operação municipal | Servidor único: backup ensaiado, plano manual e `/saude` monitorado |
| Custo e escala | Cotação pública com hipóteses de volume; medir no piloto antes de prometer |
| Escopo | Notificação ativa ao morador e várias cidades na mesma base são próximos passos, não entregas |
