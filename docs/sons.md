# Sons do MOGI

Cada som existe para uma coisa só. Ele confirma um gesto, avisa que algo chegou ou pede atenção, e sempre vem junto de um sinal na tela: quem não ouve, ou está com o som desligado, não perde nada. Decisão no [ADR 0022](adr/0022-sons-com-proposito.md).

Os arquivos ficam em `painel/public/sons/` (18 arquivos, cerca de 70 KB no total) e o mapa de propósito, volume, intervalo e vibração em `painel/src/sons.ts`.

## De onde vêm

Todos saem do banco de sons do [earshot](https://github.com/Leonxlnx/earshot) (licença MIT), que gera cada som em código. Nada foi gravado de terceiros. Cada um foi renderizado com `earshot sfx render` e passou pela conferência `earshot sfx check` (todos "clean"). Depois passou pela mesma cadeia de acabamento, para soarem como uma família e como uma central, não como um alarme:

- corte de grave abaixo de 170 Hz (tira o "bumbo" que embola em caixinha de celular) e de agudo acima de 8,5 kHz (tira o chiado);
- menos 3,5 dB em 3,2 kHz e menos 2,5 dB em 6,5 kHz, a faixa que mais cansa o ouvido num dia inteiro de painel aberto;
- mais 1,5 dB em 420 Hz, para dar corpo e calor;
- compressão leve (2,5:1), entrada de 4 ms e saída de 60 ms, sem estalo;
- uma sala curta (ecos de 38 e 61 ms, bem baixos), que dá acabamento sem virar eco;
- volume pelo pico, por papel: confirmações entre -20 e -16 dBFS, avisos entre -16 e -11, e só o crítico em -9.

O resultado é MP3 mono de 80 kbps.

## Morador e equipe de campo

| Som | Quando toca | Por que existe | Do banco |
|---|---|---|---|
| `camera` | a câmera abre | confirma que o toque funcionou antes da imagem aparecer | `toggle/on` |
| `foto` | a foto é tirada | o clique de obturador que todo mundo reconhece | `shutter/quick` |
| `gravar` / `parar` | o vídeo começa e para | quem filma olhando o problema sabe sem olhar a tela | `toggle/latch`, `toggle/off` |
| `ouvir` / `parou` | o microfone liga e desliga | diz quando falar e quando parou de ouvir | `ui_pop/blip`, `ui_pop/fall` |
| `enviado` | o servidor confirmou o relato | a recompensa do gesto: quatro notas subindo, a sensação de "foi" | `mallet/up4` |
| `pino` | o pino aparece no mapa | liga o envio ao lugar no mapa | `drip/plink` |
| `tambem_vi` | a confirmação de quem passou foi gravada | um agradecimento curto, mais leve que o envio | `mallet/glock` em mi |
| `resolvido` | o problema foi resolvido (o morador vê no acompanhamento, a equipe conclui) | fecha o ciclo com festa | `mallet/flourish` |
| `erro` | algo não saiu | pede para olhar a tela sem assustar: duas notas de marimba descendo, o "ops" que todo mundo entende | `mallet/marimba` em mi e dó |
| `chamado_equipe` | chega um chamado novo para a equipe | a equipe está na rua com o celular no bolso | `notify/mid_wood` |

## Central e gestor

| Som | Quando toca | Por que existe | Do banco |
|---|---|---|---|
| `novo_relato` | um pino novo chega ao vivo | o mapa está vivo; no máximo um a cada 4 s, numa rajada soa uma vez | `drip/drop` |
| `critico` | chega um chamado crítico | o único som que pede atenção agora: dois toques, o mais alto da central, no máximo a cada 8 s | `notify/mid_tine` duas vezes |
| `confirmado` | conferir urgência ou mandar equipe deu certo | confirma a ação sem tirar o olho do mapa: uma nota de marimba, curta e quente | `mallet/marimba` em dó |
| `desfazer` | a última ação foi desfeita | o gesto contrário soa contrário | `swish/flick` |
| `registrado` | abrir o vídeo sem borrão | lembra que aquilo ficou na auditoria | `toggle/micro` |
| `reconectou` | o painel volta a receber ao vivo | tranquiliza depois de uma queda de rede | `ui_pop/boop` |

## Regras

- **Som nunca é o único sinal.** Toda situação que toca som também muda a tela.
- **Liga e desliga** num botão de alto-falante, lembrado no aparelho (`mogi.sons`, o mesmo para todas as telas). Ligado por padrão.
- **Intervalo mínimo por som**, para uma rajada de eventos não virar barulho.
- **Vibração** no celular para foto, vídeo, envio, resolvido, erro, crítico e chamado da equipe.
- **Só depois do primeiro toque**: o navegador não deixa tocar som antes de a pessoa tocar na página, e o MOGI respeita isso.
- **Volume baixo e curto**: o mais longo tem 0,75 s.

## Trocar ou acrescentar um som

```bash
pip install --no-deps -e caminho/do/earshot   # mais numpy scipy soundfile soxr pyloudnorm
earshot sfx list
earshot sfx render mallet/glock -o novo.wav --pitch E6
earshot sfx check novo.wav
ffmpeg -i novo.wav -ac 1 -af loudnorm=I=-20:TP=-2 -c:a libmp3lame -b:a 64k painel/public/sons/novo.mp3
```

Depois acrescente o propósito em `painel/src/sons.ts`; o teste `sons.test.ts` confere se cada som tem o arquivo.
