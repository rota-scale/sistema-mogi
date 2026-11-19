# Mudanças do Sistema MOGI

As versões seguem `MAIOR.MENOR.CORREÇÃO`. Enquanto o MOGI estiver em piloto, a versão maior fica em 0.

## Em andamento: demo separada dos relatos reais

- **Lista do painel com filtro `?demo=`** (`incluir`, `ocultar`, `so`). Sem o parâmetro, o servidor decide: com `DEMO_CHAMADOS=0` a central vê só relatos reais.
- **Chave "Mostrar chamados simulados"** na ajuda do painel (tecla `?`), guardada no aparelho. Chamado simulado aparece com a marca **Simulado** na fila e no detalhe.
- **Trava no servidor:** chamado simulado não grava cadastro de morador, aparelho nem chave de idempotência (`ErrOrigemMisturada`). Relato real continua entrando com `demo = false`, `morador_id` e `aparelho`.
- **Testes novos:** filtro e trava da demo (Go), borrão de região e cascata de rostos com imagens sintéticas (Go), preferência e URL da lista (painel), e o `make conferir` confere que relato real chega com `demo = false` e que o filtro separa as duas listas.
- **Licença Apache-2.0** (`LICENSE`), com copyright de ROTA, equipe ROTA Scale. O `NOTICE` deixa o nome MOGI e a pasta `brand/` fora da licença.

## v0.3.3: pronto para evoluir (18/11/2026)

Fecha o protótipo com as 7 decisões técnicas do "MVP que evolui" (Mestres da Web). Cada uma, e onde está:

1. **Hipótese e métrica:** [docs/hipotese.md](docs/hipotese.md), com métrica e condição de abandono.
2. **Limites do domínio:** monólito modular, um pacote Go por assunto (ADR 0002). Já estava.
3. **Dados:** IDs estáveis, migrações versionadas, auditoria e retenção. Novo: as migrações **só acrescentam**, e o teste `TestMigracoesSoAcrescentam` recusa as destrutivas.
4. **Integrações que falham:** prazos, IA de reserva, idempotência e um adaptador por fornecedor. Já estava.
5. **Segurança mínima:** papéis, CPF cifrado, segredos no `.env` e auditoria. Novo: o **Dependabot** atualiza as dependências toda semana.
6. **Observabilidade:**
   - **vigia de alertas:** avisa quando banco ou fotos caem, a triagem para ou os erros sobem, no log, no topo da aba Operação e por webhook (`ALERTA_URL`, ex. ntfy no celular);
   - **funil do relato** na aba Operação: abriu, cadastrou, fotografou, enviou. Sem dado pessoal.
7. **Publicar, reverter e continuar:**
   - `make backup` e `make restaurar`, testados com 76 chamados e as fotos apagados e restaurados;
   - `make voltar` põe a versão anterior no ar;
   - cada módulo ligável tem dono e data para rever ([SOP 08](docs/sops/08-backup-e-voltar.md)).

## v0.3.2: cadastro sem código e "Onde você mora" claro (18/11/2026)

### Morador
- **Sem o código de recuperação no protótipo.** O cadastro termina direto no mapa e some o "Já tenho cadastro". O código virou o módulo `recuperacao`, que o gestor liga na Administração; vem desligado.
- **"Onde você mora"**: CEP, cidade e bairro num grupo só, com a frase "Pode ser diferente de onde você está agora".
  - Nada é preenchido sozinho pela localização: com o GPS de agora aparece o botão "Usar minha localização: Cidade - UF", e só o toque preenche. Antes, sem GPS, o cadastro usava o centro de Itamogi e preenchia cidade e bairro errados.
  - O CEP continua preenchendo cidade e bairro.
  - A busca da cidade só abre com 2 letras ou mais e não dá mais preferência à cidade da prefeitura; a cidade do GPS só desempata.
- Mesmo CPF em outro celular: a mensagem pede para a prefeitura liberar. Continua sem token e sem dados (a correção da v0.2.1 segue valendo).

### Prefeitura
- **Liberar CPF:** no "Quem relatou", o gestor apaga o cadastro de quem trocou de celular, com confirmação na própria linha. O relato fica no chamado e o histórico registra quem liberou (`DELETE /api/ocorrencias/{id}/relatos/{relato}/morador`).
- Módulo "Código de recuperação" na Administração.

### Qualidade
- Conferência da API: 113 / 0. Ponta a ponta: tudo ok, com os passos novos (GPS só sugere, busca de 1 letra, CPF repetido, gestor libera, cadastro de novo).

### Depois
- Face ID (passkey) entra com o domínio fixo (issue #40): a chave fica presa ao endereço, e o link do túnel muda a cada `make tunel`.

## v0.3.1: CEP, cidade com busca e diagramação revisada (17/11/2026)

### Morador
- **CEP no cadastro (opcional):** com 8 números, preenche a cidade e o bairro sozinho, pelo ViaCEP ([issue #42](https://github.com/rota-scale/cidade-inteligente-akcit/issues/42)).
- **Cidade com busca:** os 5.570 municípios do IBGE. Acha sem acento, aceita um erro de digitação ("itamgi" acha Itamogi) e o estado no fim ("santa rita sp"). A cidade da prefeitura e a do GPS aparecem primeiro.
- O GPS também preenche a cidade. Morar em outra cidade não impede o cadastro: um aviso diz que o MOGI atende Itamogi por enquanto.
- O Perfil mostra e edita a cidade.

### Diagramação e acessibilidade
- A tela "Anote seu código" saía do eixo em tela larga: as colunas agora são centralizadas pelo container, e o código quebra só entre os grupos.
- Com letra a 200%, os botões quebram de linha em vez de vazar; os telefones de emergência viram botões de 48 px.
- O app segue o tamanho de letra do celular (`meta text-scale`).
- Auditoria automática de diagramação em 6 larguras e com letra a 200%, em todas as telas do morador e da prefeitura: 0 falhas.
- Referência: Modern Web Guidance do Google (css-layout, responsive-design, respect-os-text-scale).

### Servidor
- `GET /api/cep/{cep}` com cache no Postgres; `GET /api/endereco` devolve também cidade e UF.
- Migração 0010: `cep`, `municipio`, `uf` e `municipio_ibge` no cadastro, todos opcionais.

## v0.3.0: protótipo final para Itamogi e o AKCIT (16/11/2026)

Primeiro contato pensado para quem não lida com tecnologia, no morador e na prefeitura, e a fundação do app Android.

### Morador
- **Boas-vindas em 3 slides** com desenhos 3D (gerados por IA, com aviso na Ajuda), no lugar do texto longo da Ajuda. O tom é sério diante do vazamento de água, por causa do racionamento na cidade.
- **Tour no mapa de verdade:** a área ensinada fica iluminada, uma frase por passo; arrastar e aproximar o mapa avançam sozinhos.
- **Cadastro em 2 passos:**
  - os dados, com o bairro preenchido pelo GPS e, opcional, sexo e idade;
  - os termos de ciência em tópicos curtos, com "Li e concordo".
- **Boneco do mapa:** mulher, homem, menina, menino, senhora ou senhor, pelo cadastro ou pela escolha no Perfil, com 3 tons de pele. Fica só no celular.
- **Ajuda curta:** rever o passo a passo e a apresentação; emergência sempre à vista.
- **Som no celular corrigido:** o áudio agora destrava no toque que o celular aceita.
- Apagar a conta leva direto ao cadastro.
- **Mapa em qualquer lugar do mundo** pelo GPS. Fora da cidade, um aviso diz que os relatos só chegam à prefeitura da cidade; sem GPS, o texto diz isso.
- Tour mais leve por cima do mapa 3D (o mapa travava no iPhone) e sem abrir no modo de marcar o lugar.

### Prefeitura
- **Guia de primeiro uso** para operador, gestor e equipe de campo; dá para rever pelo menu ou pelo botão Ajuda.
- Rota `GET /api/endereco` para o bairro pelo GPS, com o cache do geocodificador.
- **Quem relatou** no detalhe do chamado: nome e documento mascarado; "Ver documento" só para o gestor, registrado no histórico.
- Cerca da cidade (`CIDADE_CAIXA`) ligada por padrão com a caixa de Itamogi; `make env` acrescenta.

### Android
- ADRs 0025 (Expo com TypeScript, projeto nativo gerado) e 0026 (distribuição em três degraus).
- APK de teste gerado pelo CI (`com.rotascale.mogi`), com microfone, armazenamento e sobreposição bloqueados.

### Documentação e visita
- Registro de evidências: cada número com natureza, fonte, data e amostra.
- Kit da visita de 18/11 em linguagem simples, com a folha do prefeito.

### Limites conhecidos
- O app Expo, o do APK, ainda não tem cadastro, tour nem boneco (#30); por enquanto o celular usa o app web.
- O mapa do APK precisa do segredo `GOOGLE_MAPS_ANDROID_KEY`.
- Ninguém confere ainda se o CPF é de quem cadastra (gov.br, #26).

PRs desta versão: #34 a #37 e #39.

## v0.2.1: correção de segurança do cadastro (16/11/2026)

### Segurança
- **Ninguém mais pega a conta de outra pessoa só com o CPF** ([issue #26](https://github.com/rota-scale/cidade-inteligente-akcit/issues/26)). Na v0.2.0, cadastrar de novo um CPF já cadastrado devolvia o token daquela conta. Agora:
  - documento repetido responde 409, sem token e sem nenhum dado;
  - o cadastro novo mostra, uma vez só, um **código de recuperação** (`ABCD-EFGH-JKMN`), e o banco guarda só uma marca dele;
  - **"Já tenho cadastro"**: entrar em outro celular pede documento e código; erro dá sempre a mesma resposta, para não revelar quem tem cadastro;
  - 5 erros seguidos travam a entrada por 15 minutos;
  - entrar num celular novo derruba o acesso dos outros.
- **Risco que continua:** ninguém confere se o CPF é de quem cadastra. Só o gov.br resolve, por isso a issue #26 segue aberta.

### Qualidade
- CI agora roda também os tipos e os testes do app Expo.
- Números do teste do Jev descritos como são: 10 de 11 casos fictícios, escritos pelo time.
- Spec atualizada: RAG (RF13) e function calling (RF14) feitos, a validar com a base oficial da prefeitura.

## v0.2.0: primeira versão funcional (16/11/2026)

O MOGI roda de ponta a ponta: o morador relata pelo celular, a IA tria, a central confere e despacha, a equipe de campo resolve com foto e o gestor acompanha tudo ao vivo.

### Morador
- **Mapa primeiro**, como no Waze:
  - o boneco segue o GPS;
  - o mapa aceita os gestos 3D (arrastar, pinçar, girar e inclinar);
  - a bússola põe o norte para cima ou segue a direção de quem anda.
- **Câmera:**
  - toque para foto, segurar para vídeo de até 15 s sem som;
  - até 4 fotos por relato;
  - fala no lugar de digitar.
- **Cadastro com CPF ou CNPJ:**
  - o documento é guardado cifrado e mostrado mascarado;
  - o morador pode apagar a conta.
- **Perfil** com o histórico: enviados, resolvidos e tempo médio.
- **Meu bairro**, com os problemas resolvidos perto de você.
- **"O que é o problema?"** depois da foto, com tipo, sugestões e texto ou voz.
- **Acompanhamento** pelo protocolo, em quatro marcos: recebido, conferido, equipe a caminho, resolvido.
- **"Também vi"**, para confirmar um problema já relatado.
- **Ajuda** com os passos, acessibilidade e números de emergência (193, 192 e 190).

### Inteligência
- **Triagem em cadeia:** Jev, depois a IA de reserva, depois o classificador local, sempre com uma pessoa no circuito nos níveis 4 e 5.
- **Regra de prioridade da prefeitura em Lua**, editável no painel, com teste antes de salvar.
- **Agente de contexto:**
  - **RAG:** orientações da prefeitura e casos parecidos da cidade;
  - **function calling:** chamados abertos perto, casos parecidos, orientação.
- **Espaço público ou dentro de imóvel:** foto de dentro de casa vai para conferência e não vira pino público.
- **Agrupamento:** relatos do mesmo problema a até 50 m viram um chamado só e sobem a urgência.

### Prefeitura
- **Central:**
  - mapa ao vivo com a urgência por cor e por forma;
  - fila com foto e "há quanto tempo";
  - confirmar, despachar, resolver, reabrir e desfazer.
- **Equipe de campo:** só os chamados da própria secretaria, com rota, foto do depois e "não encontrei".
- **Gestor:**
  - indicadores e aba Operação;
  - usuários, categorias, parâmetros e módulos sem reiniciar;
  - regras em Lua;
  - "O que a IA consultou".

### Privacidade
- Rostos e placas protegidos antes de qualquer pessoa ou IA ver a foto.
- O texto do relato perde e-mail, CPF, telefone e placa antes de ir à IA.
- Vídeo sem som, aberto só com registro de quem viu; originais apagadas em 90 dias.
- O documento do morador só abre para o gestor, com registro.

### Operação e qualidade
- `make subir` e `make tunel` sobem tudo em contêiner, com link `https` para o celular.
- CI no GitHub Actions: testes do servidor, do painel e do app, mais o sistema de pé com teste de fumaça e mais de 60 conferências da API.
- 24 ADRs, SOPs, visão enterprise, custo na AWS, comparação com o atendimento legado e estimativa de tempo economizado.
- Vídeo de apresentação de 85 s e pacote para a visita à prefeitura.

### Limites conhecidos
- O app Expo ainda não tem o cadastro: ele orienta o morador a usar o app web.
- O borrão de rostos e placas ainda precisa ser validado com fotos reais de Itamogi.
- O link do túnel muda a cada `make tunel`; o endereço fixo depende do domínio da Rota.
- A licença de uso público da trilha do vídeo ainda está a confirmar.

PRs desta versão: #13, #14, #16 a #19, #21 a #23 e a do cadastro.

## v0.1.0: arquitetura e spec do MVP (01/11/2026)
Proposta para Itamogi, arquitetura, ADRs 0001 a 0009, pesquisa, fluxo do agente, plano, BMC e pitch.
