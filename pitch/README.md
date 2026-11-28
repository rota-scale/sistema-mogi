# Pitch de 3 minutos: Sistema MOGI

Versão de 16/11/2026 para a banca do hackathon AKCIT de 21/11. Quem fala cada bloco: Renan (produto e negócio) e João Russo (demo). Papéis em [docs/time.md](../docs/time.md). Cronometrar no ensaio; se passar de 3:00, cortar primeiro o bloco 2:20.

## Preparação da tela
- Celular com o app do morador aberto em `/relatar`, pelo link do `make tunel`, bateria cheia e som ligado.
- Notebook no projetor com a central em `/` (login `operador`), mapa de Itamogi aberto, som ligado e já clicado uma vez (o navegador só toca som depois do primeiro toque).
- Segundo celular ou aba com `/campo` (login `equipe`), ou o mesmo celular depois.
- Objeto de cena para fotografar: imagem impressa de um cano estourado, **gerada por IA e marcada como tal**, ou um problema real se a demo for na rua.
- Cadastro do morador já feito no celular da demo, com um CPF de teste gerado (nunca o de uma pessoa).
- Os pinos de fundo são relatos **de demonstração**: diga isso em voz alta ao abrir o mapa.
- Números: use só os do [registro de evidências](../docs/evidencias.md), sempre com a natureza (medido pelo time, estimativa ou campo).

## Roteiro cronometrado
| Tempo | Bloco | Fala sugerida | Na tela |
|---|---|---|---|
| 0:00 a 0:20 | Problema | "Em Itamogi, quando um cano estoura, a prefeitura fica sabendo por telefone, sem foto e sem endereço. E o cano entra na mesma fila de um lixo parado. Em cidade pequena, a equipe é pouca e cada saída conta." | Capa com o mapa de Itamogi |
| 0:20 a 0:40 | Solução | "O MOGI é triagem de pronto-socorro para a rua. O morador fotografa, a IA entende, a regra da prefeitura dá a prioridade de 1 a 5 e o prazo, e uma pessoa confere o que é grave." | Diagrama do agente do README |
| 0:40 a 1:05 | Demo: morador | "Sem baixar app: abro o link, faço o cadastro uma vez só, e o mapa já me mostra onde estou, com um botão só." (o cadastro já está feito) Tira a foto, fala "cano estourado jorrando água perto da escola", toca Enviar. | Celular: mapa primeiro, câmera, foto, enviar; recibo com protocolo, nível 5 e prazo de 2 horas |
| 1:05 a 1:30 | Demo: central | "O pino chegou na central, com o som de crítico. O operador vê a foto, com rostos e placas protegidos, a urgência em uma linha e o motivo: água jorrando trava o nível 5. Confirma com um toque e manda a equipe de Água e esgoto." | Central: pino vermelho ao vivo, som, detalhe, "Confirmar" e "Mandar equipe de Água e esgoto" |
| 1:30 a 1:50 | Demo: equipe e morador | "A equipe vê só os chamados da secretaria dela, vai pela rota, conserta e tira a foto do depois. E o morador vê: resolvido, com a foto." | `/campo`: resolver com foto do depois; celular do morador: acompanhamento em quatro passos |
| 1:50 a 2:20 | Como o agente decide | "A IA não decide sozinha. Ela responde perguntas pequenas: que problema é, tem água jorrando, quão grave. Quem decide o nível é uma regra em Lua, linguagem criada no Brasil, na PUC-Rio, que o técnico da prefeitura lê e muda no painel, testa em 13 cenários e fica com histórico. Se a IA cair, entra a reserva, depois um classificador local, e por último uma pessoa." | Tela do gestor: Regras da triagem com o `agua.lua`; motivo no detalhe do chamado |
| 2:20 a 2:40 | Números e privacidade | "Em 11 casos de teste escritos pelo time, 10 caíram no nível certo. Medimos 160 milissegundos de mediana e três centésimos de centavo por relato. Rosto e placa são borrados antes de qualquer um ver, o texto sai sem CPF ou telefone, e o vídeo não tem som." | Tabela de números medidos pelo time (15/11), com a legenda "casos escritos pelo time" |
| 2:40 a 3:00 | Impacto e pedido | "Um servidor só, software aberto, uma cidade por instalação. Começa em Itamogi e vai para qualquer cidade pequena com as regras dela. Queremos fazer o piloto com a prefeitura e levar para os consórcios da região." | Slide do BMC e indicadores de impacto |

## Três mensagens-chave
1. **A IA julga, a prefeitura decide, uma pessoa confere.** Perguntas tipadas à IA, nível numa regra Lua auditável, revisão humana no que é grave.
2. **Do relato à foto do conserto, ao vivo.** Morador, central, equipe e gestor no mesmo mapa, e o morador vê o resultado.
3. **Barato, privado e feito para cidade pequena.** Centavos de IA por mês, um servidor, privacidade desde a captura.

## Perguntas prováveis da banca
| Pergunta | Resposta curta |
|---|---|
| E a privacidade? | Rostos e placas são borrados antes de alguém ver; o texto perde e-mail, CPF, telefone e placa; para a IA vão só a foto protegida, o texto limpo e o bairro, nunca a coordenada nem quem relatou. Vídeo sem som, só para servidor logado e com registro. Original apagada em 90 dias. O borrão ainda vai ser validado com fotos reais. |
| Por que pedir CPF? | Para a prefeitura saber que o relato veio de um morador de verdade e poder voltar a falar com ele, e para o morador ver o histórico em qualquer celular. O CPF fica cifrado no banco, aparece sempre mascarado, só o gestor abre o número completo e cada abertura fica registrada. A IA nunca recebe. O morador apaga a conta quando quiser. No piloto real, o caminho é o login gov.br. |
| Quanto custa? | Medimos cerca de R$ 0,0003 por relato só com texto e R$ 0,0007 com foto. Mil relatos por mês saem por menos de um real de IA. O resto é um servidor pequeno. Preço para a prefeitura ainda é hipótese. |
| Por que não usar só um LLM? | Porque a prefeitura precisa explicar a prioridade. Um LLM decidindo tudo é mais caro, mais lento e difícil de auditar. Aqui a IA dá probabilidades em perguntas fechadas, conferidas contra um esquema, e a decisão é uma regra que a cidade escreve. E se um provedor cair, outro assume. |
| Por que Lua? | É pequena, feita para ser embutida e segura numa sandbox (50 ms, sem acesso a arquivo ou rede). Um técnico da prefeitura lê sem ser programador. E separa a decisão da cidade do julgamento da IA. Cada cidade tem a sua pasta de regras. |
| Onde estão RAG, function calling e multiagentes? | No agente de contexto: antes de decidir, a IA recebe as orientações da prefeitura e os casos parecidos da cidade (RAG) e pode chamar funções para ver se já relataram ali e como casos iguais foram tratados (function calling). Tudo aparece em "O que a IA consultou" no painel. Visão, contexto, Jev, IA de reserva, regra Lua e agrupamento são agentes especializados coordenados pelo serviço de triagem. |
| Escala para outras cidades? | Cidade é cadastro no banco; nova cidade é uma linha, uma pasta de regras Lua e a revisão das categorias. Uma instalação por cidade, por LGPD e isolamento. O caminho para consórcio está no ADR 0021. |
| O que é real e o que é simulado? | Real: o sistema inteiro rodando, a triagem com o Jev ao vivo, o borrão, o tempo real, os testes. Simulado: os pinos de fundo no mapa e as fotos e vídeos da demo, gerados por IA e marcados. Os casos medidos em 15/11 foram escritos pelo time; o teste de campo em Itamogi traz os reais. |
| A prefeitura já topou? | O piloto é a proposta; o consentimento formal da prefeitura de Itamogi está a confirmar. |

## Plano B se a demo ao vivo falhar
1. **Sem internet ou túnel fora do ar:** rodar o vídeo gravado da demo completa (morador, central, equipe, morador), feito na véspera, com relógio visível. Avisar a banca que é gravação.
2. **Jev fora do ar:** seguir ao vivo; a cadeia cai para a reserva ou o classificador local, e o detalhe do chamado mostra qual decidiu. Usar isso como prova do fallback.
3. **Notebook falhou:** prints das telas no próprio slide, com a legenda "build de 15/11".
4. Em qualquer caso, dados simulados aparecem marcados como simulados e imagens geradas por IA são chamadas assim.

## Backup de evidências acadêmicas (consulta P1, 27/11/2026)

Para perguntas da banca sobre “por que não só um LLM”, GovTech comparável, revisão humana, equidade territorial ou o que vem depois do Jev, use o pacote P1 — não o roteiro de 3 minutos:

- Hub com ranking, hashtags e grafo: [docs/research/README.md](../docs/research/README.md)
- Falas prontas e o que não dizer: [docs/research/P1-evidencias-ia-govtech-2026.md](../docs/research/P1-evidencias-ia-govtech-2026.md)

Cuidados obrigatórios na banca:

- Não atribuir nomes de papers (JEPA, SigLIP, DINOv3, TabPFN, Conformal) à mentoria do Állan. Ele falou da classe de modelos de decisão multimodais, na linha do Jev.
- Não afirmar que o Jev multimodal já está em produção, nem que a TypeSafe faz fine-tune com dados do cliente.
- Não citar Liquid Neural Networks, UrbanCLIP, GeoCLIP ou Grounding DINO em tempo real sem GPU como caminho do MOGI.
- Não usar métricas de Recife, Singapura ou Auto311 como se fossem números do MOGI.
