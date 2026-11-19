# Benchmark: o que o Waze faz e como isso vira MOGI

O Russo pediu o Waze como modelo principal do mapa e do relato (briefing de 01/11). Este documento separa o que vale copiar, o que precisa ser adaptado ao nosso negócio e o que fica de fora. As telas foram conferidas no Mobbin em 14/11/2026; os links apontam para a tela real.

A diferença de negócio que orienta tudo: no Waze quem consome o alerta é outro motorista, em segundos. No MOGI quem consome é a prefeitura, que precisa priorizar, despachar e prestar contas; e o morador quer saber se foi ouvido. Então copiamos a **facilidade de relatar** e o **mapa vivo**, e acrescentamos o que o Waze não tem: triagem, prazo, equipe e devolutiva.

## 1. Padrão por padrão

| Padrão do Waze | Por que funciona | Como fica no MOGI | Onde |
|---|---|---|---|
| Botão de relatar sempre visível sobre o mapa, relato em 2 toques | Não há formulário entre a pessoa e o envio | Câmera primeiro: fotografar e enviar. A categoria é escolhida pela triagem; as fichas de tipo só aparecem quando a IA está fora | App do morador |
| Grade de ícones grandes com rótulo curto | Leitura imediata, serve para quem tem pouca prática | Fichas de tipo grandes, com ícone e nome, quando o morador precisa escolher | App do morador |
| "Depois" e "Enviar" fixos embaixo | A ação principal está sempre no polegar | Botão "Enviar relato" fixo embaixo; "Tentar de novo" no mesmo lugar | App do morador |
| Aviso "Enviado" sobre o mapa | Confirma sem tirar a pessoa do contexto | Tela de confirmação com protocolo, nível e prazo; na Onda 2 leva ao acompanhamento | App do morador |
| Cartão do alerta: tipo, "310 m de você", há quanto tempo, joinha com contagem | Quem passa valida o alerta sem escrever nada | "Perto de você": tipo, distância e idade dos chamados abertos em 80 m, com "Também vi". Soma ao chamado sem duplicar | Onda 2 |
| "Ainda está lá?" | A multidão mantém o mapa verdadeiro | "Também vi" do morador e "Não encontrei no local" da equipe de campo | Onda 2 |
| Alerta sonoro de perigo | A urgência não depende de olhar a tela | Nível 5 novo: som, notificação e contador na aba até alguém reconhecer | Onda 2 |
| Alerta expira | Informação velha some sozinha | Linha do tempo do chamado, resolver com confirmação, reabrir com motivo | Feito na Onda 0 |
| Pino fixo no centro, mapa arrasta por baixo | Marcar um ponto com um dedo, sem mirar | Mini mapa para o morador marcar o lugar quando o GPS falha ou erra | Feito na Onda 0 |
| Navegar até o ponto | Uma ação, sem copiar endereço | Botão Rota para a equipe de campo, abrindo Waze ou Google Maps | Onda 2 |
| Funciona com sinal ruim | É usado na rua | Envio repetível sem duplicar (feito); fila de envio sem rede (Onda 2) | Onda 0 e 2 |
| "Obrigado" de quem usou o alerta | Fecha o ciclo e incentiva o próximo relato | Devolutiva: "resolvido", com a foto do depois na página do protocolo | Onda 2 |

## 2. Padrões de outros apps que completam o Waze

| Padrão | App de referência | Como fica no MOGI |
|---|---|---|
| Folha deslizante sobre o mapa, em alturas | [Snapchat](https://mobbin.com/screens/282e248e-9b30-4740-9e7b-d814d0cc0e42), [Airbnb](https://mobbin.com/screens/538cf0e6-0926-489b-bfd9-c8669cf2bf29) | Painel no celular: mapa em tela cheia e fila ou detalhe numa folha com alça, título, status, botões em pílula e carrossel de mídia |
| Filtros em fichas dentro da folha e botão "Lista" | [TikTok, explorar lugares](https://mobbin.com/screens/74b7ba2d-2c88-4ccd-9255-6a249f842adf) | Fila com busca e filtros de bairro, categoria, secretaria e ordenação |
| Linha do tempo de etapas com hora | [talabat](https://mobbin.com/screens/06aced2d-ab5a-4169-b943-823630279351), [Shop](https://mobbin.com/screens/a0a7b1e7-493c-4ae1-bde1-6174e1c5aa4c) | Acompanhar o protocolo: recebido, em análise, equipe a caminho, resolvido; prazo no topo |
| Miniaturas com X, "Envio completo 1 de 1", "Adicionar mais fotos" | [Tripadvisor](https://mobbin.com/screens/dac6f24f-1bea-4a61-9d3c-918c5f63a6f6) | Até 4 fotos e 1 vídeo curto por relato (Onda 1) |

Fluxo de relato do Waze usado como base: [enviar relato](https://mobbin.com/flows/e4575277-41aa-4d4d-9078-949aaa7a20b2?tab=screens).

## 3. O que não copiamos, e por quê

- **Mapa público com todos os alertas.** No Waze o alerta é para todos. No MOGI um mapa público expõe todos os problemas abertos da cidade e a casa de quem relatou. Decisão do Russo em 14/11: só a lista mínima "Perto de você", sem foto, sem texto e sem endereço de terceiros.
- **Pontos, ranking e avatares.** Ficam para depois do MVP ([decisões](decisoes-e-pendencias.md)).
- **Perfil e comentário público.** Desde 16/11 o morador tem cadastro com CPF ([ADR 0024](adr/0024-cadastro-do-morador-com-cpf.md)), mas o perfil é privado: nada de nome, foto ou comentário público.
- **Waze for Cities.** Publicar interdições geradas por chamados críticos continua no futuro ([pesquisa](pesquisa-solucoes-semelhantes.md)).

## 4. Princípios que saem do benchmark

Estão registrados no [ADR 0017](adr/0017-principios-de-produto.md) e valem como critério de revisão de toda tela nova:

1. O caminho feliz do morador tem no máximo 2 toques além da câmera.
2. Toda falha diz o que fazer e deixa tentar de novo sem perder o que foi feito.
3. O mapa nunca some: detalhe e lista abrem por cima dele.
4. Nada que pertence a outra pessoa aparece para o morador.
5. Toda ação da prefeitura fica no histórico e tem volta.
