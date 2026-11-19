# Escala de prioridade (protocolo Triagem Urbana)

Alinhada ao [ADR 0010](adr/0010-protocolo-de-triagem-urbana.md).

| Nível | Cor | Nome | GUT (esperada ou pessimista) | Tempo máximo proposto |
|---|---|---|---|---|
| 5 | Vermelho | Crítico | 100 a 125 | até 2 horas |
| 4 | Laranja | Muito urgente | 60 a 99 | até 24 horas |
| 3 | Amarelo | Urgente | 28 a 59 | até 3 dias úteis |
| 2 | Verde | Padrão | 9 a 27 | até 7 dias úteis |
| 1 | Azul | Não urgente | 1 a 8 | rotina da equipe responsável |

Tempos e faixas são **proposta**, a validar com a prefeitura de Itamogi.

## Como o nível é decidido (GUT calibrada)
1. O Jev devolve G, U e T como probabilidades de 1 a 5 e cada sinal de risco como sim/não com probabilidade.
2. Sinal crítico com probabilidade acima de 0,8 trava o nível mínimo do sinal.
3. Sem sinal decisivo, vale a faixa da GUT esperada; com incerteza alta, a da GUT pessimista (p90).
4. A fila dentro do nível é ordenada pela GUT esperada.
5. Níveis 4 e 5 sempre passam por revisão humana.

Exemplo do cano estourado em [inovacao-e-diferenciais.md](inovacao-e-diferenciais.md). Limiares são proposta a calibrar no piloto.

## Categorias, exemplos e discriminadores
| Categoria | Exemplo | Nível padrão | Sinais de risco (perguntas sim/não ao Jev) |
|---|---|---|---|
| Água e esgoto | Cano estourado | 5 | água jorrando, alagamento, perto de escola |
| Água e esgoto | Esgoto a céu aberto | 4 | perto de escola, creche ou posto de saúde |
| Iluminação e energia | Fio caído | 5 | fio exposto ao alcance de pessoas |
| Iluminação e energia | Poste apagado | 3 | fio elétrico exposto |
| Limpeza urbana | Lixo parado, caçamba | 1 | acúmulo grande, bloqueio de calçada |
| Limpeza urbana | Entulho na calçada | 2 | obriga pedestre a ir para a rua |
| Vias e buracos | Buraco grande em via movimentada | 4 | risco a motos, perto de curva |
| Vias e buracos | Buraco pequeno | 3 | crescendo, relatos repetidos |
| Árvores | Árvore caída na via | 5 | sobre fios, bloqueio total |
| Árvores | Poda necessária | 2 | encostando em fios |
| Sinalização | Semáforo apagado | 4 | cruzamento movimentado |
| Sinalização | Placa danificada | 2 | placa de pare ou preferência |
| Calçadas e praças | Calçada quebrada | 2 | rampa de acessibilidade |
| Animais | Animal morto na via | 3 | calor, perto de residências |
