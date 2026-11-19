# ADR 0015: Mídia v2, com várias fotos, vídeo curto, link assinado e retenção
**Status:** Proposta · **Data:** 14/11/2026

## Contexto
O [ADR 0008](0008-midia-e-privacidade-lgpd.md) previa borrar rostos e placas, mostrar a original só a operadores autorizados, ler por URL pré-assinada do S3 e apagar em 90 dias. O código seguiu outro caminho em três pontos: a leitura passou a ser por link HMAC servido pelo Go (sprint de 11/11), a original não era mostrada a ninguém e a retenção nunca foi implementada. Além disso o relato aceitava uma foto só, e a SPEC já pedia vídeo como desejável.

Em 14/11 o Russo decidiu: até 4 fotos e 1 vídeo de até 15 s por relato; vídeo restrito e auditado, sem áudio, apagado em 90 dias (conversa).

O servidor não decodifica vídeo: a imagem final é distroless, sem ffmpeg. Borrar quadro a quadro exigiria outro contêiner e uma fila, o que não cabe antes do congelamento de 20/11.

## Decisão
- **Tabela `midias`.** Cada arquivo de um chamado é uma linha, com tipo `foto`, `quadro`, `video` ou `depois`, ligada ao relato de origem. As colunas antigas de foto em `ocorrencias` e `relatos` continuam como capa.
- **Fotos.** Até 4 por relato, 12 MB cada, JPEG ou PNG, no máximo 40 megapixels. Cada uma é borrada pelo mesmo `Borrador`; ficam a original e a borrada. A primeira é a capa e vai para a triagem; até duas das outras seguem para a IA de visão quando ela está ligada (o Jev recebe uma imagem por pedido).
- **Vídeo.** Um por relato, opcional, sempre junto de pelo menos uma foto. MP4, MOV ou WebM, até 25 MB e 15 s. O servidor lê só a estrutura do arquivo e **recusa vídeo com trilha de áudio**: vozes de quem passa não entram no MOGI. O vídeo não é borrado, então:
  - não tem link público; a capa são até 3 quadros extraídos no aparelho e borrados como foto;
  - só abre por um link pedido na hora por um servidor logado (`POST /ocorrencias/{id}/midias/{midia}/abertura`), válido por 10 minutos;
  - cada abertura grava o evento `video_visto`, com quem abriu, no histórico do chamado.
- **Links assinados.** O `Assinador` emite dois tipos de link, com assinaturas que não se misturam: público, só para versões borradas (`publica`, `quadro`, `depois`), e restrito, só para arquivo de vídeo. A foto original não tem link de nenhum tipo. A entrega responde a pedidos de trecho (`Range`), que o vídeo precisa para tocar no iPhone.
- **Retenção.** Toda original (foto sem borrão e vídeo) nasce com data de apagar, pelo parâmetro da cidade `retencao_dias` (padrão 90, ajustável pelo gestor em Regras, aba Parâmetros, [ADR 0018](0018-modulos-e-parametros-em-tempo-de-execucao.md)). Uma rotina de hora em hora apaga do armazenamento e limpa a referência no banco. A versão borrada fica.
- **Módulo.** O vídeo é um módulo da cidade que o gestor liga e desliga ([ADR 0018](0018-modulos-e-parametros-em-tempo-de-execucao.md)); `MODULO_VIDEO=false` no `.env` trava o vídeo desligado na instalação; `GET /config` informa os limites e o app só oferece o que o servidor aceita.
- **Demo.** As fotos e os vídeos dos chamados simulados são gerados por IA, embutidos no binário e carimbados com o aviso de imagem gerada por IA.

## Alternativas consideradas
- **Só quadros, sem guardar o vídeo.** Mais seguro, mas perde o movimento (água jorrando, fio balançando), que é o que o vídeo acrescenta à triagem humana.
- **Borrar o vídeo com ffmpeg num contêiner à parte.** É o caminho certo para abrir o vídeo a mais gente; fica para depois do piloto, com ADR próprio.
- **URL pré-assinada do S3 (ADR 0008).** Exporia o SeaweedFS à internet; o link HMAC servido pelo Go mantém um endereço só.

## Consequências
Substitui, do ADR 0008, a leitura por URL pré-assinada e passa a cumprir a retenção de 90 dias. O vídeo original é visto sem borrão por quem opera, com trilha de auditoria: é uma exceção assumida, a rever quando houver borrão de vídeo. Gravação com áudio é recusada, então o app precisa gravar pelo navegador sem microfone; vídeo escolhido da galeria quase sempre tem áudio e não entra. Vídeos aumentam o uso de disco: 25 MB por relato no pior caso, limitado pela retenção.
