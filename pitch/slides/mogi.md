---
marp: true
size: 16:9
theme: default
paginate: true
footer: MOGI　/　ROTA SCALE　　　　　　　　　AKCIT CAMP SUL 2026
style: |
  section {background:#f7f6f1;color:#17372e;font:30px Arial,sans-serif;padding:58px 74px 66px;justify-content:flex-start;}
  h1 {font-size:67px;line-height:1.03;letter-spacing:-3px;color:#17372e;margin:20px 0 40px;}
  h2 {font-size:19px;letter-spacing:2px;text-transform:uppercase;color:#785339;margin:0;}
  section:after {font:15px Arial;color:#697770;}
  footer {left:74px;bottom:26px;font-size:15px;color:#53655b;}
  .row {display:flex;gap:20px;align-items:stretch;}
  .tile {flex:1;border-top:4px solid #347854;padding:17px 0;font-size:32px;font-weight:bold;}
  small {display:block;font-size:22px;font-weight:normal;line-height:1.3;margin-top:10px;}
  .tag {display:inline-block;background:#e6efdb;border-radius:40px;padding:7px 17px;color:#29543e;font-size:20px;font-weight:bold;}
  .photo {width:100%;height:190px;object-fit:cover;border-radius:9px;margin:0 0 10px;}
  .shot {width:585px;height:330px;object-fit:contain;align-self:center;}
  .flow {display:flex;align-items:center;gap:15px;margin:24px 0;}
  .flow b {background:#dbead4;border-radius:8px;padding:20px 23px;font-size:30px;}
  .flow i {font-style:normal;color:#67846d;}
  .spec {font-size:21px;color:#57695c;}
  .big {font-size:103px;letter-spacing:-7px;line-height:1;font-weight:bold;}
  .dot {display:inline-block;width:29px;height:29px;border-radius:50%;background:#287553;margin-right:5px;}
  .miss {background:#f8f6ef;box-shadow:inset 0 0 0 3px #9c5037;}
  .box {background:#fff;border-radius:13px;padding:27px 30px;flex:1;border:1px solid #d3d9cd;font-weight:bold;}
  .steps {list-style:none;padding:0;margin:8px 0;counter-reset:s;}
  .steps .step {counter-increment:s;margin:16px 0;font-weight:bold;}
  .steps .step:before {content:counter(s);background:#214f3d;color:white;border-radius:50%;padding:6px 12px;font-size:20px;margin-right:14px;}
  .market {display:flex;align-items:center;gap:48px;}
  .rings {width:370px;height:370px;background:#c7dac1;border-radius:50%;display:grid;place-items:center;}
  .rings b {width:240px;height:240px;border-radius:50%;background:#79a384;display:grid;place-items:center;}
  .rings em {width:105px;height:105px;border-radius:50%;background:#214d3c;}
  .market li {margin:18px 0;}
  section.close {background:#173b30;color:white;}
  section.close h1, section.close h2 {color:#fbf6dd;}
  section.close .tile {border-color:#acc99d;}
  section.close footer {color:#d4decf;}
  section.reserve h1 {margin-bottom:20px;}
  section.reserve .box {font-size:23px;padding:17px 21px;}
  section.reserve small {font-size:20px;margin-top:6px;}
---
## Problema

# Três chamados. Quem vai primeiro?

<div class="row"><div style="flex:1"><img class="photo" src="../../brand/casos-de-uso/fotos/1-cano-estourado-ia-2048.jpg"><span class="tag">Cano estourado</span></div><div style="flex:1"><img class="photo" src="../../brand/casos-de-uso/fotos/2-poste-queimado-ia-2048.jpg"><span class="tag">Poste apagado</span></div><div style="flex:1"><img class="photo" src="../../brand/casos-de-uso/fotos/3-lixo-parado-ia-2048.jpg"><span class="tag">Lixo na rua</span></div></div>

Uma equipe precisa decidir a ordem de atendimento.

<span class="spec">Cenas ilustrativas geradas por IA.</span>

<!-- Exportação offline: npx @marp-team/marp-cli --html --allow-local-files pitch/slides/mogi.md --pdf -->

<!-- 0:00–0:20 · Renan. Imagine os três pedidos chegando por telefone ou mensagem. Qual deles tem água jorrando? Qual é o endereço certo? Quem já mandou alguém até lá? Quando essas informações ficam espalhadas, ordenar a fila depende de ligar de volta. É essa decisão que o MOGI ajuda a tomar. -->

---

## Solução

# Um protocolo liga as três pontas.

<div class="flow"><b>Morador</b><i>→</i><b>Central</b><i>→</i><b>Equipe de rua</b></div><div class="row"><div class="tile">Foto e localização<small>O morador mostra onde está o problema.</small></div><div class="tile">Prioridade e motivo<small>A central confere e despacha.</small></div><div class="tile">Foto do conserto<small>A equipe registra o serviço.</small></div></div>

**↳ O resultado volta ao morador pelo mesmo protocolo.**

<!-- 0:20–0:40 · Renan. Para quem mora na cidade, basta abrir o link e mostrar o problema. Para quem trabalha na central, muda o que chega à mesa. Há um ponto no mapa, uma descrição e uma prioridade que a pessoa pode conferir. Russo vai mostrar o caminho de um único chamado. -->

---

## Funcionamento / MVP

# Do mapa à foto do conserto.

<div class="row"><img class="shot" src="../../docs/img/painel-v2.png"><div class="steps"><div class="step">Enviar o relato</div><div class="step">Conferir no mapa</div><div class="step">Despachar e resolver</div><div class="step">Acompanhar o resultado</div></div></div>

<span class="spec">Central do MOGI · dados de demonstração</span>

<!-- 0:40–1:50 · Russo. Abrir o relato de teste com foto protegida. Mostrar o protocolo. Abrir o mesmo chamado na central e explicar o motivo da prioridade. Na seção O que a IA consultou, distinguir Base, Caso e Função. Só dizer que Claude chamou uma ferramenta se houver a linha Função com sucesso. Despachar para a equipe, registrar a resolução e voltar ao acompanhamento do morador. Se usar gravação, identificá-la. -->

---

## Funcionamento / Evidência

# Quem define a urgência?

<div class="flow"><b>Claude · visão</b><i>→</i><b>Jev · classificação</b><i>→</i><b>Lua · prioridade</b></div><div class="row"><div class="big">10/11</div><div><div><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot miss"></i></div><small>Casos no nível esperado no teste com Jev.</small></div></div>

<span class="spec">11 relatos fictícios de texto · teste do time em 15/11/2026 · docs/evidencias.md</span>

<!-- 1:50–2:15 · Russo. A orquestração separa percepção, classificação e decisão. O RAG recupera orientações e casos semelhantes. Claude pode solicitar uma consulta adicional por function calling. Em cada protocolo conseguimos conferir o que ocorreu. Os dez acertos que mostramos são do teste com Jev, feito com exemplos escritos por nós. O desempenho com moradores ainda será medido. -->

---

## Mercado

# Quem pode contratar o MOGI?

<div class="market"><div class="rings"><b><em></em></b></div><div><span class="tag">Segmentos · sem escala quantitativa</span><ul><li><b>Mercado</b> · Prefeituras e consórcios</li><li><b>Foco inicial</b> · Municípios pequenos</li><li><b>Primeira conversa</b> · Itamogi, MG</li></ul><small>18/11 · Prefeito avaliou o protótipo. Piloto a formalizar.</small></div></div>

<!-- 2:15–2:30 · Renan. Começamos pela prefeitura pequena porque uma mesma equipe precisa atender prioridades concorrentes. A conversa em Itamogi abriu espaço para avaliar o protótipo. O próximo passo comercial é verificar quem decide a contratação e quanto custa hoje fazer essa triagem. Fonte da visita: docs/evidencias.md. -->

---

## Modelo de negócio

# A prefeitura contrata. O morador usa.

<span class="tag">Hipótese comercial · preço a validar</span>

<div class="row"><div class="box">Implantação<small>Configurar regras locais e treinar a central.</small></div><div class="box">Assinatura anual<small>Hospedagem, uso de IA e suporte por município.</small></div></div>

**Morador**　Acesso gratuito para relatar e acompanhar.

<!-- 2:30–2:43 · Renan. A hipótese é cobrar de quem opera o serviço. A assinatura cobre a operação e a implantação adapta a triagem à realidade local. Vamos validar o preço com a prefeitura e medir o custo conjunto de Claude e Jev. Fonte: bmc/README.md. -->

---

<!-- _class: close -->
## Próximos passos / Pedido à banca

# Uma ponte com uma prefeitura.

<div class="row"><div class="tile">01　Acordar<small>Definir a central, a equipe de rua e as condições de privacidade.</small></div><div class="tile">02　Testar<small>Acompanhar chamados reais do relato à resolução.</small></div><div class="tile">03　Medir<small>Comparar a prioridade com a avaliação humana e medir o tempo até o despacho.</small></div></div>

<!-- 2:43–3:00 · Renan. Nosso pedido é uma apresentação à secretaria que recebe esses chamados. Com um responsável na central e outro em campo, podemos combinar as condições de privacidade, acompanhar relatos reais e devolver à prefeitura o que mudou no tempo e na qualidade da triagem. Encerrar aqui. O slide seguinte é reserva. -->

---

<!-- _class: reserve -->
## Reserva / Perguntas da banca

# Respostas para a conversa.

<div class="row"><div class="box">Privacidade e CPF<small>Foto protegida e texto limpo para a IA. CPF cifrado no cadastro. Borrão em campo a validar.</small></div><div class="box">Custo de IA<small>Jev: cerca de R$ 0,0003 por texto no teste de 11 casos. Custo com Claude a medir.</small></div></div>

<div class="row"><div class="box">Modelos e regra Lua<small>Claude interpreta, Jev classifica, Lua aplica a regra municipal. Revisão humana nos críticos.</small></div><div class="box">Ferramentas e papéis<small>RAG lexical busca orientações e casos. Claude pode pedir consultas. O serviço coordena os papéis.</small></div></div>

<div class="row"><div class="box">Escala e aceite<small>Instalação por cidade. A visita de 18/11 avaliou o protótipo. Acordo municipal pendente.</small></div><div class="box">Real e simulado<small>Telas do sistema com dados de demonstração. Teste do time documentado em docs/evidencias.md.</small></div></div>

<!-- Referências para consulta: docs/evidencias.md, bmc/README.md, docs/fluxo-do-agente.md, docs/sops/06-checklist-lgpd.md e estudo do curso na PR 5. A evidência de custo não mede o custo total de operação. A ligação entre agentes não demonstra negociação autônoma. -->
