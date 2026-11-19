# Auditoria do MOGI antes do teste de campo (14/11/2026)

Três leituras completas do código, feitas em 14/11/2026 sobre o commit `927421f` (build de teste na main): painel da prefeitura, app web do morador e backend com a documentação de decisões. Cada achado tem onde está, a gravidade e em que onda do plano ele é tratado.

Gravidade: **alta** quebra o teste de campo ou expõe dado; **média** atrapalha operar; **baixa** é acabamento.

Situação: **feito** nesta entrega (Onda 0); os demais levam o número da onda em que entram.

## 1. App do morador (`painel/src/relatar/`)

| # | Achado | Onde | Gravidade | Situação |
|---|---|---|---|---|
| M1 | Reenvio depois de tempo esgotado duplicava o relato e, ao agrupar, subia a prioridade sozinho | `envio.ts`, `repositorio.go` (agrupar) | alta | feito: chave de idempotência |
| M2 | GPS negado ou indisponível travava o envio para sempre | `logica.ts`, `localizacao.ts` | alta | feito: marcar o ponto no mapa |
| M3 | Foto que o navegador não consegue reduzir (HEIC, por exemplo) seguia crua e voltava recusada, sem saída | `foto.ts` | alta | feito: pede outra foto |
| M4 | Limite de 12 envios por IP punia vizinhos na mesma operadora (CGNAT) | `main.go`, `httpx.go` | alta | feito: limite por aparelho e teto por IP |
| M5 | Depois de enviar, o protocolo não leva a lugar nenhum | `Relatar.tsx` | alta | Onda 2: acompanhar por protocolo (a chave já é entregue) |
| M6 | Leitura de GPS de 2 km era aceita como "Localização ok" | `logica.ts` | média | feito: acima de 100 m pede o mapa |
| M7 | Formulário decidia se a categoria era obrigatória antes de a configuração chegar | `Relatar.tsx` | média | feito |
| M8 | Sem barra de progresso em rede lenta | `envio.ts` | média | feito |
| M9 | Mensagens de erro técnicas ("erro 502", texto do servidor) | `logica.ts` | média | feito: frase por código |
| M10 | Aviso "O MOGI não guarda o áudio" dava a entender que o áudio não sai do aparelho; o ditado é do navegador | `Relatar.tsx` | média | feito |
| M11 | PWA incompleto: sem service worker, sem ícones 192 e 512, sem fila sem rede, fonte de terceiro | `manifest.webmanifest`, `relatar.html` | média | Onda 2 |
| M12 | "Seus últimos relatos" congelados no nível da hora do envio | `envio.ts` | média | Onda 2 (status ao vivo) |
| M13 | Uma foto só; sem vídeo | `Relatar.tsx`, `handlers.go` | média | Onda 1 |
| M14 | Morador não vê se o problema já foi relatado perto dele | (não existe) | média | Onda 2: "Perto de você" |
| M15 | Textos de 12 a 14 px, botão desabilitado com pouco contraste, fichas sem papel de grupo de opções | `relatar.css` | baixa | feito |
| M16 | Link "Sou da prefeitura" na tela do morador | `Relatar.tsx` | baixa | feito: removido |

O app Expo (`app/`) está num único commit e atrás do web em tudo (sem configuração do servidor, sem voz, sem histórico, tema antigo). Decisão do Russo em 14/11: manter os dois; o Expo alcança a paridade na Onda 4.

## 2. Painel da prefeitura (`painel/src/`)

| # | Achado | Onde | Gravidade | Situação |
|---|---|---|---|---|
| P1 | Token vencido (12 h) deixava o painel em "Reconectando" para sempre, com dado velho e sem pedir login | `api.ts` | alta | feito |
| P2 | Foto principal quebrava depois de 6 h com a aba aberta (link antigo vencia sobre o novo) | `Painel.tsx` | alta | feito |
| P3 | "Marcar como resolvido" fechava em um clique, sem confirmar e sem volta | `Painel.tsx`, `repositorio.go` | alta | feito: confirmação, desfazer e reabrir |
| P4 | Nível 5 novo sem alerta próprio (som, notificação, contador) | `App.tsx` | alta | Onda 2 |
| P5 | Corrida entre a lista inicial e os eventos ao vivo | `App.tsx` | média | Onda 2 |
| P6 | Sair numa tela do gestor e entrar como operador deixava a área em branco | `App.tsx` | média | feito |
| P7 | Falha de rede ao abrir a página deslogava o usuário | `App.tsx` | média | feito |
| P8 | Fila sem busca, sem filtro de categoria, secretaria ou bairro, sem ordenar por prazo; cortada em 200 sem aviso | `Painel.tsx` | média | aviso do corte feito; busca e filtros na Onda 2 |
| P9 | Filtro de nível valia só para o mapa | `App.tsx` | média | Onda 2 |
| P10 | "Seguir ao vivo" arrancava a câmera com um detalhe aberto | `Mapa.tsx` | média | feito |
| P11 | Animação do mapa redesenhando a 60 quadros por segundo sem parar | `Mapa.tsx` | média | feito |
| P12 | Prazo só virava "vencido" quando chegava um evento | `Painel.tsx` | média | feito |
| P13 | Sem histórico do chamado, sem observação no despacho, sem motivo na resolução | `Painel.tsx` | média | feito (tabela `eventos`) |
| P14 | Celular: detalhe abaixo da dobra, controles do mapa sobrepostos, legenda cobrindo o topo, alvos de 30 px | `index.css` | média | Onda 2: folha deslizante |
| P15 | "Despachar equipe" só mudava o status; não existe equipe de campo nem foto do depois | `repositorio.go` | média | Onda 2: papel de campo |
| P16 | Miniaturas dos relatos não ampliam; sem galeria | `Painel.tsx` | média | Onda 1 |
| P17 | Fila dizia "Nada esperando revisão" enquanto ainda carregava; erro do detalhe engolido | `Painel.tsx` | média | feito |
| P18 | Número branco sobre amarelo e laranja na legenda | `App.tsx`, `index.css` | média | feito |
| P19 | Operador via custo e provedor de IA | `Painel.tsx` | baixa | feito: só gestor |
| P20 | Ícone da aba era o do Vite; login vinha preenchido | `index.html`, `App.tsx` | baixa | feito |
| P21 | Sem atalhos de teclado, sem rota até o local | `Painel.tsx` | baixa | Onda 2 |

## 3. Backend (`backend/`)

| # | Achado | Onde | Gravidade | Situação |
|---|---|---|---|---|
| B1 | Foto de poucos KB que declara 30000 x 30000 pixels pedia gigabytes de memória, em rota aberta | `borrador.go`, `seletivo.go`, `jev.go` | alta | feito: pacote `imagem`, teto de 40 megapixels e fila de 3 fotos por vez |
| B2 | Limite de envio burlável trocando o cabeçalho `X-Forwarded-For` | `httpx.go` | alta | feito: cabeçalho só vale com `PROXY_CONFIAVEL` |
| B3 | Resposta ao morador devolvia o chamado inteiro; ao agrupar, vazava texto, foto e endereço de outra pessoa | `handlers.go` | alta | feito: recibo enxuto |
| B4 | Corte de texto por bytes gerava UTF-8 inválido e derrubava a gravação | `handlers.go`, `servico.go`, `jev.go` | alta | feito: pacote `texto` |
| B5 | Login sem limite de tentativas | `auth.go` | média | feito: 8 senhas erradas a cada 10 min por IP e login |
| B6 | Dois primeiros relatos simultâneos do mesmo problema criavam dois chamados | `repositorio.go` | média | feito: trava por categoria na transação |
| B7 | Texto do relato gravado com telefone, CPF, e-mail ou placa | `handlers.go` | média | feito: limpo antes de gravar |
| B8 | Prazo recomeçava na hora da revisão | `handlers.go` | média | feito: conta do relato |
| B9 | `/saude` respondia ok sem olhar banco nem armazenamento | `main.go` | média | feito |
| B10 | Servidor sem tempo máximo para corpo lento | `main.go` | média | feito |
| B11 | Sem cerca da cidade: aceitava relato de qualquer lugar do mundo | `handlers.go` | média | feito, desligado por padrão (`CIDADE_CAIXA`) |
| B12 | Sem histórico de eventos nem reabertura | `repositorio.go` | média | feito |
| B13 | Triagem dentro da requisição pode somar dezenas de segundos | `servico.go` | média | Onda 3: orçamento de tempo e fila |
| B14 | Geocodificação em fila de 1 por segundo dentro da requisição; coordenada exata vai ao Nominatim público | `geo.go` | média | Onda 3 |
| B15 | Original guardada para sempre (ADR 0008 fala em 90 dias); sem apagar no S3 | `repositorio.go` | média | Onda 1: retenção |
| B16 | Sem métricas, sem identificador de requisição, erro do celular não chega ao servidor | `main.go` | média | Onda 3 |
| B17 | JWT de 12 h sem renovação nem revogação; WebSocket não confere o token depois de abrir | `auth.go`, `temporeal.go` | média | Onda 3 |
| B18 | Migrações sem trava para mais de uma réplica | `banco.go` | média | Onda 3 |
| B19 | Novo relato pior não sobe o nível ao agrupar (só a tendência é reforçada) | `repositorio.go` | média | Onda 2 |
| B20 | Categorias, prazos, raio de 50 m, janela de 30 dias e "Itamogi" fixos no código | vários | média | Onda 3: cidade e parâmetros como dado |
| B21 | Mesmo segredo para o JWT e para os links de mídia; link sem dono | `main.go` | baixa | Onda 1 (assinatura por mídia) |
| B22 | Sem CSP nem HSTS | `main.go` | baixa | Onda 3 |
| B23 | Sem testes em `ocorrencias`, `auth`, `admin`, `temporeal`; sem CI | | média | primeiros testes de `ocorrencias` feitos; CI na Onda 3 |

Não foram encontrados caminho de arquivo manipulável nem pedido a endereço escolhido por quem chama.

## 4. Decisões e documentação

- As ADRs em `docs/adr/` não acompanharam a versão 2 aceita em 02/11 nem o código: 0002 fala em TypeScript (o código é Go), 0008 em URL pré-assinada (é link HMAC servido pelo Go), 0009 em eventos que não existem, 0013 em fila de triagem e upload pré-assinado. Como ADR aceita não se reescreve (SOP 04), as correções entram em ADRs novas, a partir da 0014.
- Decisões que estavam só no código ou em `conversas/`: borrão seletivo, link HMAC, app web do morador, envio anônimo com limite, parâmetros do agrupamento, triagem síncrona, papéis e permissões. As ADRs 0014 a 0021 do plano cobrem essas lacunas.
- `decisoes-e-pendencias.md` tinha o backlog todo desmarcado apesar de quase tudo estar feito; atualizado nesta entrega.
- SOPs 03, 05, 06 e 07 citam comandos e campos que mudaram. Ficam para revisão junto da Onda 3.

## 5. O que esta entrega (Onda 0) muda para quem usa

- **Morador:** pode tentar de novo sem medo de duplicar, vê o progresso do envio, marca o ponto no mapa quando o GPS falha e recebe mensagens que dizem o que fazer.
- **Operador:** sessão vencida pede login em vez de travar; resolver pede confirmação e tem volta; cada chamado mostra o histórico de quem fez o quê.
- **Gestor:** `/saude` diz a verdade sobre banco e armazenamento; o relato de um morador não expõe o de outro.
