# Inovação e diferenciais

> O "GEV" citado pelo Russo é o **Jev**, modelo da TypeSafe AI ([post de lançamento](https://typesafe.ai/blog/introducing-system-one-models-and-jev), 15/09/2026, acesso antecipado). Confirmado pelo Russo em 01/11/2026.

## Em uma frase
**GUT calibrada:** a matriz GUT e os sinais de risco de Manchester viram perguntas tipadas que o Jev responde com probabilidades calibradas, em cerca de 100 ms e custo quase zero por relato, sem alucinar.

## O que é o Jev (fatos do post da TypeSafe)
- "System One Model" treinado com RLCD (Reinforcement Learning for Calibrated Decisions).
- Entra estado não estruturado (texto e estrutura); sai decisão tipada definida antes (classificar, rotear, pontuar, extrair), com probabilidades calibradas e confiança.
- Não gera texto: não erra o tipo e não alucina formato.
- Latência de 70 a 500 ms. Entrada US$ 0,042 por milhão de tokens, saída grátis.
- Até 255 opções por escolha.
- Ainda **não aceita imagem** ("not on images (yet…)"). Servidores na costa oeste dos EUA.

## Comparação com o mercado
| | FixMyStreet | Colab | SeeClickFix | uReport | Waze for Cities | **Nós** |
|---|---|---|---|---|---|---|
| Captura com foto | Sim | Sim | Sim | Web | Não (dados de tráfego) | Foto, vídeo e GPS no local |
| Triagem por IA | Não | Não divulgado | Não divulgado | Não | Não | **Visão + Jev tipado e calibrado** |
| Método de prioridade | Por categoria e órgão | Manual pela prefeitura | Manual, fila e votos | Manual | Não se aplica | **GUT calibrada + sinais de Manchester** |
| Mapa | 2D | 2D | 2D | 2D | Mapa Waze | **3D estilo Pokémon GO** |
| Tempo real | Não | Parcial | Parcial | Não | Sim (tráfego) | **Sim, com retriagem a cada evento** |
| Padrão aberto | Open311 | Não | Open311 | Open311 | Formato Waze | **Open311 compatível** |
| Presença no Brasil | Não | Forte | Não | Não | Sim | Piloto Itamogi-MG |

Fontes: [FixMyStreet](https://github.com/mysociety/fixmystreet/), [Colab](https://apps.apple.com/br/app/colab/id609666061), [SeeClickFix](https://www.govtech.com/biz/CivicPlus-Debuts-New-Division-to-Integrate-SeeClickFix.html), [uReport](https://github.com/City-of-Bloomington/uReport), [Waze for Cities](https://www.waze.com/partners/wazeforcities). "Não divulgado" quer dizer sem informação pública encontrada.

## O que já existe
- Apps de zeladoria priorizam por categoria, ordem de chegada ou votos. Identificar a importância dos relatos segue em aberto ([NSF, dados do SeeClickFix](https://par.nsf.gov/biblio/10115006-what-matters-most-optimal-quick-classification-urban-issue-reports-importance)).
- IA em centrais 311 classifica **texto** por categoria: Cidade do México ([LXAI](https://doi.org/10.52591/lxai202207101)), Kansas City ([ACM](https://doi.org/10.1145/3555176)), Nova York ([JRI](https://doi.org/10.34288/jri.v8i4.589)). Nenhuma entrega prioridade calibrada e explicável.

## Bases do protocolo
- **Manchester:** 5 níveis com cores e tempo máximo, discriminadores por queixa, na dúvida sobe o nível ([TriageIQ](https://www.triageiq.com/understanding-the-manchester-triage-system), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5289484/), [TriageNet](https://www.triagenet.net/classroom/course/view.php?id=1173)).
- **GUT:** Kepner e Tregoe, G x U x T de 1 a 125 ([gov.br](https://www.gov.br/transportes/pt-br/assuntos/portal-da-estrategia/artigos-gestao-estrategica/como-funciona-a-matriz-gut)).
- **Risco de ativos:** probabilidade x consequência, recalculado com o histórico ([Springer](https://link.springer.com/article/10.1186/s40068-023-00287-7)).

## Triagem em duas etapas
1. **Visão (adaptador):** um modelo com visão transforma foto ou vídeo em campos estruturados: categoria candidata, sinais visíveis, contexto, texto do cidadão, local e relatos próximos. Desde 12/11/2026 o Jev também recebe a foto já borrada (rostos e placas), com `JEV_FOTO=true`; a foto original, a coordenada e quem relatou nunca saem.
2. **Jev (motor de decisão):** recebe esse estado e devolve, tipado e com probabilidade calibrada: nível 1 a 5, categoria, secretaria, cada sinal de risco e as distribuições de G, U e T.

## GUT calibrada (o coração da inovação)
Tudo abaixo é **proposta a calibrar no piloto**.

1. **G, U e T como distribuições.** O Jev devolve P(G=1..5), P(U=1..5) e P(T=1..5), não um número só.
   - **GUT esperada** = média de G x U x T sobre as distribuições (com independência, E[G] x E[U] x E[T]). Ordena a fila.
   - **GUT pessimista** = percentil 90 de G x U x T. Define o nível quando a incerteza é alta (Manchester: na dúvida, sobe).
2. **Sinais de Manchester como perguntas tipadas sim/não**, cada uma com probabilidade (água jorrando? fio exposto? via bloqueada? perto de escola?). Sinal crítico com P acima do limiar (proposta 0,8) **trava o nível mínimo** daquele sinal.
3. **Tendência viva.** A cada relato próximo (mesmo quadrante H3 e janela de tempo), o Jev recalcula a T. Custa frações de centavo, então roda a cada evento, e o mapa de calor muda em tempo real.
4. **Incerteza decide o caminho:**
   - confiança alta e nível 1 a 3: despacho automático;
   - nível 4 ou 5: revisão humana sempre;
   - confiança baixa ou entropia alta: revisão humana ou pedido de mais uma foto ao cidadão.
5. **Ajuste por prefeitura.** Pesos, limiares e faixas ficam no Admin. As correções do operador recalibram os limiares; a calibração é medida com Brier e ECE.
6. **Explicável.** O operador vê três barras (G, U, T) com a probabilidade de cada nota e os sinais que pesaram.

### Faixas de GUT para nível (proposta)
1 a 8 azul, 9 a 27 verde, 28 a 59 amarelo, 60 a 99 laranja, 100 a 125 vermelho.

### Exemplo: cano estourado
| | 1 | 2 | 3 | 4 | 5 | Média |
|---|---|---|---|---|---|---|
| G | 0 | 0 | 0 | 0,20 | 0,80 | 4,8 |
| U | 0 | 0 | 0 | 0,30 | 0,70 | 4,7 |
| T | 0 | 0 | 0,20 | 0,60 | 0,20 | 4,0 |

- GUT esperada = 4,8 x 4,7 x 4,0 = **90** (laranja).
- P(G x U x T = 125) = 0,8 x 0,7 x 0,2 = 0,11, então a GUT pessimista (p90) = **125** (vermelho).
- Sinal "água jorrando" com P = 0,93, acima de 0,8: trava no mínimo nível 5.
- Resultado: **nível 5, vermelho**, vai para revisão humana, bairro fica vermelho no mapa.
- Chegam mais 3 relatos no mesmo quadrante: T sobe e a GUT esperada passa de 100.

## Falar e mostrar: relato sem teclado (proposta, ideia do Russo)
- A pessoa aponta a câmera e fala. Voz (transcrição pt-BR), visão e GPS com endereço e bairro viram o estado que o Jev classifica.
- O formulário chega pronto; basta um toque ou dizer "confirmar". Campos incertos aparecem destacados.
- Se faltar algo, o app pergunta por voz uma coisa só, a do campo de maior incerteza do Jev.
- Teclado fica como alternativa. Inclui idosos e quem tem dificuldade de leitura e escrita.
- Áudio descartado após a transcrição (LGPD).
- Metas propostas: relato em menos de 30 s; percentual de campos aceitos sem correção.
- Detalhes no [ADR 0011](adr/0011-captura-por-voz-e-camera.md).

## Pins vivos na auditoria (ideia do Russo, 01/11/2026)
O painel da prefeitura funciona como um "cinema" da cidade: cada relato aparece no mapa em tempo real como uma bolinha colorida pelo nível.
- **Chegada:** o pin surge com animação curta.
- **Agrupamento:** o pin cresce com o número de relatos agrupados e mostra quantas pessoas relataram.
- **Urgência:** pin vermelho pulsa (por exemplo, cano estourado jorrando água: equipe na hora). Verde é leve e segue o prazo normal.
- **Clique:** abre mídia, endereço, bairro, reportantes, nível, barras G, U e T e status.
- **Filtros:** por cor e por secretaria.
- **Contadores:** relatos abertos por bairro e quadrante, ao lado do mapa de calor.
- Nenhum concorrente pesquisado mostra isso. Comportamento detalhado nos ADRs 0004 e 0009.

## Mapa 3D no MVP
O 3D simples (prédios extrudados, câmera inclinada, pins vivos e mapa de calor) é obrigatório no MVP por decisão do Russo. O estilo Pokémon GO com avatar vem na próxima fase.

## Como medimos
- Concordância com a triagem humana (nível exato, tolerância de 1 nível, kappa ponderado).
- Calibração: Brier e ECE das probabilidades do Jev contra as decisões do operador.
- Tempo até a primeira resposta por nível, contra o tempo máximo.
- Duplicados evitados, custo e latência por triagem.

## Frase do pitch
"Hospitais atendem por gravidade, não por ordem de chegada. Nós medimos a gravidade de cada problema da cidade com probabilidade, em 100 milissegundos, e dizemos o motivo."
