# ADR 0016: Ciclo de vida do chamado, papéis e equipe de campo
**Status:** Proposta · **Data:** 14/11/2026

## Contexto
Até a build de teste só existiam dois papéis, operador e gestor, e os dois podiam tudo, menos o Admin. "Despachar equipe" só mudava o status: não havia equipe para receber, resolver não aceitava prova do serviço, não existia reabrir nem histórico, e o morador não tinha como saber o que aconteceu com o relato. Nada disso tinha ADR; os papéis estavam só no código ([auditoria](../auditoria-2026-11-14.md), itens P3, P13, P15, M5 e M14).

O benchmark do Waze ([documento](../benchmark-waze.md)) mostrou o que faltava para fechar o ciclo: quem passa confirma, quem atende navega até o ponto, e quem relatou recebe a devolutiva.

## Decisão
**Papéis.**
| Papel | O que faz |
|---|---|
| `gestor` | Tudo do operador, mais regras, categorias, indicadores e usuários |
| `operador` | Revisa, despacha (podendo trocar a secretaria), resolve, reabre, vê indicadores |
| `campo` | A equipe na rua. Pertence a uma secretaria; lista, abre e resolve só os chamados dela. Não revisa, não despacha, não vê indicadores nem Admin |

O papel e a secretaria valem os do banco a cada requisição, não os do token: rebaixar ou desligar um usuário vale na hora. O gestor cria e desliga usuários em `/admin/usuarios`; ninguém tira o próprio acesso de gestor. Usuário desligado não é apagado, para o histórico continuar apontando para alguém.

**Ciclo de vida.** Os status não mudam (`a_classificar`, `revisao`, `aberta`, `em_atendimento`, `resolvida`). As transições passam a ser:
- revisar: `revisao` ou `a_classificar` para `aberta` (operador, gestor);
- despachar: `aberta` para `em_atendimento`, com observação e troca opcional de secretaria (operador, gestor);
- resolver: `aberta` ou `em_atendimento` para `resolvida`, com o que foi feito e até 3 **fotos do depois** (qualquer papel; a equipe de campo, só na própria secretaria);
- não encontrado: `em_atendimento` para `revisao`, com motivo obrigatório (a equipe foi e não achou);
- reabrir: `resolvida` para `aberta`, com motivo obrigatório (operador, gestor).

**Histórico.** Toda transição grava uma linha em `eventos`, com tipo, autor, dados e hora, na mesma transação. Também ficam lá o relato agrupado, o "Também vi" e cada abertura de vídeo (ADR 0015). É a linha do tempo do painel e a trilha de auditoria.

**Fotos do depois.** Passam pelo mesmo borrão das fotos do morador; só a versão borrada é guardada, como mídia do tipo `depois`.

**Tempo real por secretaria.** O WebSocket da equipe de campo só recebe eventos dos chamados da secretaria dela.

**Morador depois do envio.**
- Acompanhar: `GET /acompanhar/{protocolo}?k=chave`. A chave é o segredo entregue no recibo do envio e guardado no aparelho. A resposta tem o andamento em quatro passos (recebido, conferido, equipe a caminho, resolvido), o prazo, o que foi feito e as fotos do depois. Nada de texto, foto ou endereço de outro relato.
- Perto de você: `GET /perto?lat=&lng=` devolve no máximo 5 chamados reais e abertos no raio do parâmetro `raio_perto_m` (padrão 80 m, [ADR 0018](0018-modulos-e-parametros-em-tempo-de-execucao.md)), só com tipo, distância arredondada de 10 em 10 m, hora cheia e quantos relatos. Sem mapa público (decisão do Russo em 14/11).
- Também vi: `POST /perto/confirmacao` soma uma confirmação ao chamado, sem foto, uma por aparelho, e só para quem está a até 150 m. Conta como mais um relato e reforça a tendência (ADR 0010). Quem confirma recebe a própria chave para acompanhar.
- Relato novo pior: ao agrupar, se o relato novo foi triado sozinho num nível mais alto, o chamado sobe para ele.

## Alternativas consideradas
- Permissão por secretaria também para o operador: mais fiel a uma prefeitura grande, mas em Itamogi a central é uma só.
- Status novos (`a_caminho`, `nao_encontrada`): mais estados para a mesma informação, que já cabe no histórico.
- Notificar o morador por push ou SMS: exige contato ou app nativo; fica para depois (o acompanhamento por link resolve sem dado pessoal).
- Mapa público dos chamados: recusado por expor todos os problemas abertos e a vizinhança de quem relatou.

## Consequências
O despacho passa a ter destino e a resolução, prova. A consulta de usuário a cada requisição custa uma leitura por chave primária, irrelevante neste porte. "Perto de você" permite, com muitas consultas, estimar onde há chamados abertos; por isso a resposta é arredondada e as consultas têm teto por IP. A secretaria é texto livre vindo das categorias: renomear uma secretaria exige atualizar os usuários de campo dela (a tratar quando secretaria virar tabela, ADR 0021).
