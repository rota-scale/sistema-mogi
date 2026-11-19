# ADR 0004: Mapa 3D com fallback 2D
**Status:** Aceita no ponto do 3D simples no MVP (decisão do Russo em 01/11/2026); demais pontos em Proposta · **Data:** 01/11/2026

## Contexto
O diferencial é o mapa 3D estilo Pokémon GO: o usuário se vê andando e registra no local; o operador vê as ocorrências ao vivo.

## Decisão
MapLibre GL JS com terreno e prédios extrudados, deck.gl para camadas de dados (pinos, hexágonos H3 coloridos por gravidade). Câmera inclinada seguindo o GPS do usuário. Detectar aparelho fraco ou WebGL indisponível e cair para 2D com o mesmo componente.

### Pins vivos no painel
- Pin surge com animação ao chegar o evento; tamanho proporcional aos relatos agrupados, com número visível.
- Cor pelo nível (azul, verde, amarelo, laranja, vermelho); vermelho pulsa.
- Clique abre o detalhe do chamado. Filtros por cor e secretaria. Contador por bairro e quadrante H3.
- Animações respeitam `prefers-reduced-motion` e o fallback 2D usa os mesmos pins sem 3D.

### Decisão do Russo (01/11/2026)
- **3D simples é obrigatório no MVP:** MapLibre GL JS com prédios em 3D (`fill-extrusion` de OpenStreetMap via OpenFreeMap, sem chave paga), câmera inclinada, pins vivos e mapa de calor por gravidade por cima. Estimativa: 2 a 3 dias de uma pessoa.
- **Estilo Pokémon GO** (cidadão se deslocando ao vivo, avatar) fica para a próxima fase.

## Alternativas consideradas
- CesiumJS e Google 3D Tiles: pesado e com custo.
- Mapbox: licença e cobrança por uso.
- AR nativo: fora do prazo.

## Consequências
Stack aberta e sem custo de licença; visual menos fotorrealista.

Atualização em 15/11/2026: o painel usa MapLibre GL sem deck.gl, e o app do morador abre no mapa primeiro; o app Expo usa `react-native-maps`. Ver [ADR 0014](0014-app-do-morador-web-e-expo.md) e [ADR 0017](0017-principios-de-produto.md).
