# ADR 0011: Captura por voz e câmera
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
O Russo considera o teclado ultrapassado: o relato deve sair da voz e da câmera, com o formulário preenchido pela IA. Complementa o ADR 0005 (PWA).

## Decisão
- Fluxo "falar e mostrar": a pessoa aponta a câmera e fala ("tem um cano estourado aqui jorrando água faz uma hora").
- Porta `TranscritorDeVoz` (pt-BR) com adaptadores: Web Speech API do navegador no MVP; Whisper ou serviço equivalente como opção.
- Transcrição + descrição da visão + GPS com geocodificação reversa (endereço e bairro) formam o estado estruturado; o Jev devolve categoria, nível, secretaria e GUT com confiança.
- Formulário pré-preenchido: confirmar com um toque ou dizendo "confirmar". Campos com confiança baixa ficam destacados para corrigir por voz ou toque.
- Se faltar algo, o app faz uma pergunta por voz, escolhida pelo campo de maior incerteza do Jev (ex.: "a água está atingindo casas?"). Desejável, fora do MVP mínimo.
- Teclado continua como alternativa (acessibilidade, lugar barulhento).
- LGPD: áudio processado e descartado; guarda só a transcrição; aviso de consentimento antes de gravar.

## Alternativas consideradas
- Formulário digitado: lento e exclui quem tem dificuldade de leitura e escrita.
- Só voz, sem confirmação: risco de erro sem controle do cidadão.

## Consequências
Relato mais rápido e inclusivo (idosos, baixa escolaridade). Web Speech API varia por navegador, por isso o adaptador. Meta proposta: relato em menos de 30 s e alto percentual de campos aceitos sem correção.

Atualização em 15/11/2026: ver [ADR 0014](0014-app-do-morador-web-e-expo.md). O relato hoje abre no mapa com uma ação só (a câmera); a fala é opcional e o formulário pré-preenchido para confirmar não foi feito.
