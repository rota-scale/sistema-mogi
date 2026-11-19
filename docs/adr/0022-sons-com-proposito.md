# ADR 0022: Sons com propósito
**Status:** Proposta · **Data:** 15/11/2026

## Contexto
O Russo pediu sons "dopaminérgicos" para o sistema e o app, usando o earshot, para pontos de atenção, auditoria, pino chegando em tempo real, usabilidade e acessibilidade: cada som com um propósito e um fator único. Quem usa o MOGI está na rua com o celular na mão olhando para o problema (morador, equipe) ou com o mapa aberto o dia todo sem olhar o tempo todo (central).

## Decisão
- Um conjunto pequeno e fechado de sons, cada um com um propósito só, descrito em [docs/sons.md](../sons.md): confirmar o gesto, recompensar o envio, avisar chegada, pedir atenção, lembrar a auditoria.
- Sons gerados em código pelo banco do earshot (MIT): sem gravação de terceiros, sem licença a acompanhar além da MIT, reproduzíveis pela receita.
- Som nunca é o único sinal; liga e desliga lembrado no aparelho; intervalo mínimo por som; vibração no celular; volumes nivelados por papel, com o crítico mais alto que o resto da central.
- Um módulo só (`painel/src/sons.ts`) para central, morador e equipe; o app Expo usa os mesmos arquivos.

## Alternativas consideradas
- Bipes sintetizados no navegador: soam genéricos e baratos, que é o oposto do pedido.
- Bibliotecas de sons de interface prontas: licença a conferir e sons que outros apps já usam.
- Sem som: perde o aviso da central e a confirmação para quem filma sem olhar a tela.

## Consequências
Cerca de 70 KB de áudio, baixados sob demanda por tela. O som não pode tocar antes do primeiro toque na página (regra do navegador), então a central só ouve depois de interagir uma vez; a faixa de alerta visual cobre esse momento.
