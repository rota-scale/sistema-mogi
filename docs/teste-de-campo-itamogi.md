# Na rua em Itamogi: 18/11/2026

Roteiro da segunda parte da visita (a primeira está em [visita-prefeitura.md](visita-prefeitura.md)). **Quem faz é você, sozinho ou com alguém da equipe:** mande alguns avisos reais pelo MOGI e veja chegarem no computador. Não peça nada aos moradores nem aos servidores.

É um teste da equipe Rota Scale, não uma aprovação da prefeitura.

## Regras do dia
- Cadastro com o **seu** CPF. Nada de CPF ou foto de outras pessoas.
- Fotos sem rostos e sem placas no enquadramento.
- O cano estourado é **de exemplo** (foto de arquivo): diga isso se mostrar a alguém.
- Anote na ficha na hora. Número sem anotação não entra no pitch.

## Os avisos (40 min)
Antes de sair: central aberta no MacBook (login `operador`), celular (iPhone ou Android) pelo link do túnel em `/relatar` e cadastro já feito. Se possível, alguém fica na central para ver o pino chegar e anotar o tempo.

| # | Caso | O que esperar |
|---|---|---|
| B1 | Buraco em via | nível 3 ou 4, pino laranja, Obras e vias |
| B2 | Poste apagado (ou lâmpada acesa de dia) | nível 2 ou 3, Iluminação |
| B3 | Lixo ou entulho na calçada | nível 1 ou 2, Limpeza |
| B4 | Segundo relato do mesmo buraco do B1, a menos de 50 m | **vira o mesmo chamado**, com "2 pessoas relataram" |
| B5 | "Também vi" num pino que já existe | conta mais um relato, sem chamado novo |
| B6 | Cano estourado **simulado** (foto de arquivo) | nível 5, vai para a conferência de uma pessoa |
| B7 | Foto de dentro de um imóvel (uma sala, uma parede) | vai para conferência como "parece local privado" e não vira pino público |

### Ficha de cada relato

| # | Hora do envio | Protocolo | Nível esperado | Nível dado | Segundos até o pino na central | Deu certo? O que travou? |
|---|---|---|---|---|---|---|
| B1 | | | | | | |
| B2 | | | | | | |
| B3 | | | | | | |
| B4 | | | | | | |
| B5 | | | | | | |
| B6 | | | | | | |
| B7 | | | | | | |

## Evidência a gravar
- Gravação de tela do celular e do MacBook com o **relógio visível**.
- Prints: recibo com protocolo, pino chegando, detalhe do chamado com a foto borrada e o motivo da regra.
- No fim do dia, no MacBook: `make relatorio` (uma linha por chamado real, sem texto, sem coordenada e sem dado pessoal) e depois `make parar`.

## Riscos e o que fazer
| Risco | O que fazer |
|---|---|
| Sinal fraco na rua | hotspot 4G de outro celular; se o envio falhar, o relato continua na tela e "Tentar de novo" não manda em dobro (o app web não guarda fila sem rede) |
| Câmera ou localização negadas | iPhone: Ajustes, Safari, Câmera e Localização, "Permitir". Android: no Chrome, o cadeado ao lado do endereço, Permissões |
| Túnel caiu | `make link` no MacBook; se não voltar, `make tunel` de novo (o link muda) |
| Jev fora do ar | a cadeia cai para a reserva ou o classificador local; mostre no detalhe qual decidiu: é a prova do fallback |
| Esqueceu o código de recuperação | o cadastro continua no celular; o código só serve para entrar em outro aparelho |

## Depois
1. Me mande foto da ficha e o que o prefeito disse. Eu passo para a seção "Campo, 18/11/2026" do [registro de evidências](evidencias.md).
2. Troque no README, no pitch e no BMC só o que veio de campo, com o rótulo "teste de campo da equipe, 18/11".
3. O que for combinado com a prefeitura fica registrado no time, sem chamar de aprovação.
