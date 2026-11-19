# SOP 05: Rodar a demo
Roteiro falado e perguntas da banca em [pitch/README.md](../../pitch/README.md).

1. Na véspera: `make tunel` no notebook da demo (ou servidor no ar pelo SOP 07), `make senhas` para conferir os três logins, celular com bateria cheia e som ligado, vídeo do plano B guardado fora do notebook.
2. Chamados de fundo: o banco nasce vazio (`DEMO_CHAMADOS=0`). `make demo` cria 80 relatos simulados e `make limpar-demo` apaga todos. As fotos e vídeos deles são gerados por IA e aparecem marcados como simulados. No teste com relatos reais, mantenha o valor em 0. Com o valor em 0 o painel esconde os simulados: para mostrá-los no palco, abra a ajuda do painel (tecla `?`) e ligue **Mostrar chamados simulados**. Eles aparecem com a marca Simulado.
3. Jev: confira `TYPESAFE_API_KEY` no `.env` e `JEV_FOTO=true`, e que o log mostra "triagem com Jev ligada". Sem chave, a demo roda com o classificador local e o detalhe do chamado diz isso.
4. Abra a central (`/`, login `operador`) no projetor, com o mapa de Itamogi, e clique uma vez na página para o som poder tocar. Abra `/campo` (login `equipe`) num segundo aparelho.
5. Roteiro: no celular, `/relatar`, mapa primeiro, foto do cano estourado (imagem gerada por IA, dita como tal), fala "cano estourado jorrando água perto da escola", Enviar; o pino vermelho chega com o som de crítico; a central abre, confirma e manda a equipe; a equipe resolve com foto do depois; o morador abre o acompanhamento e vê resolvido.
6. Mostre os números: Indicadores (tempo, acerto, custo) e o bloco de detalhes da triagem do chamado.
7. Plano B: sem internet, rode o vídeo gravado e diga que é gravação; com o Jev fora do ar, siga ao vivo e mostre o fallback no detalhe.
8. Depois: `make parar` derruba o túnel.
