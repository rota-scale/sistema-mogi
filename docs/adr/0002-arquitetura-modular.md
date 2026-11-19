# ADR 0002: Arquitetura modular (monólito modular, portas e adaptadores)
**Status:** Proposta · **Data:** 01/11/2026

## Contexto
Prazo curto, time pequeno e requisitos que vão aparecer com o piloto.

## Decisão
Um monólito modular em TypeScript com módulos: `ocorrencias`, `triagem`, `geo`, `midia`, `roteamento`, `notificacoes`, `tempo-real`, `indicadores`. Cada módulo expõe portas (interfaces) e usa adaptadores para o mundo externo (IA, banco, armazenamento, mapa). Módulos só conversam por portas ou eventos.

## Alternativas consideradas
- Microsserviços: custo operacional alto para o MVP.
- Código sem fronteiras: rápido no começo, difícil de mudar.

## Consequências
Troca de provedores sem mexer no domínio; módulos extraíveis depois. Exige revisão das fronteiras em cada PR.

Atualização em 15/11/2026: o monólito modular foi feito em Go, não em TypeScript ([ADR 0013](0013-stack-do-mvp.md)); os módulos atuais estão em [docs/arquitetura.md](../arquitetura.md).
