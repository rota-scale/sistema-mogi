# ADR 0024: Cadastro do morador com CPF ou CNPJ, com o documento protegido
**Status:** Aceita (decisão do Russo em 16/11/2026; em produção desde a v0.2.0, código de recuperação na v0.2.1) · **Data:** 16/11/2026 · **Substitui:** [ADR 0020](0020-envio-anonimo-e-idempotente.md) na parte do envio anônimo

## Contexto
Russo testou o app no celular em 16/11/2026 e achou que faltava perfil: o morador não sabia o que já tinha enviado, não via o resultado no bairro e uma foto de dentro de casa podia virar chamado. Depois de ouvir os riscos de guardar documento de pessoa, ele decidiu:
- **cadastro com CPF obrigatório para relatar** (CNPJ para empresa);
- **uma versão mínima da comunidade** agora ("Meu bairro").

O ADR 0020 tinha decidido o envio anônimo. A idempotência, os dois limites de envio, o recibo sem dado do chamado e os códigos de erro do 0020 continuam valendo. Muda só a identificação: agora o relato sabe de quem veio.

O CPF é dado pessoal e é a primeira coisa que a banca vai perguntar. Por isso o cadastro nasce com as medidas de LGPD no código, não num documento.

## Decisão
- **Cadastro mínimo.** `POST /moradores` com tipo (pessoa física, pessoa jurídica ou servidor público), nome, CPF ou CNPJ, profissão e bairro opcionais e o aceite do termo. Os dígitos verificadores são conferidos no servidor e no app. Documento já cadastrado responde 409 `documento_cadastrado`, sem token e sem nenhum dado da conta (correção da issue #26, ver abaixo).
- **Código de recuperação (issue #26).** O cadastro novo devolve, uma vez só, um código de 12 letras e números (`ABCD-EFGH-JKMN`, sem 0, O, 1, I e L). O banco guarda só o HMAC do código amarrado ao documento (`codigo_hash`). Para entrar em outro aparelho, `POST /moradores/entrar` com documento e código. Documento sem cadastro e código errado dão o mesmo 401 `credenciais_invalidas`, para não revelar quem tem cadastro. Cinco erros seguidos travam a entrada por 15 minutos (`falhas_entrada`, `bloqueado_ate`), além do limite de pedidos por IP.
- **Sessão por aparelho.** O token leva o número da sessão (`ses`). Entrar com o código sobe a sessão no banco e derruba o token dos outros aparelhos: quem pegou um token antigo perde o acesso.
- **Token de morador.** JWT assinado com o `JWT_SEGREDO`, papel `morador`, guardado no aparelho por até 90 dias. Ele não abre nenhuma rota da equipe: `auth.Atual` recusa o papel `morador` antes de olhar o banco, e o token da equipe não vale como morador.
- **Relatar exige o cadastro.** `POST /ocorrencias` e o "Também vi" sem token respondem 401 com `codigo: "cadastro_obrigatorio"`. O módulo `cadastro` (Regras, aba Parâmetros) vem ligado; desligado, o envio volta a ser aberto como no ADR 0020.
- **Documento cifrado.** O CPF ou CNPJ é gravado com AES-256-GCM (`documento_cifrado`), com a chave `DOCUMENTO_CHAVE` do `.env`, que o `make env` gera. Sem ela, a chave sai do `JWT_SEGREDO` com aviso no log, para o `.env` antigo continuar funcionando.
- **Hash para achar sem abrir.** `documento_hash` é um HMAC-SHA256 com chave própria. Ele impede o cadastro duplicado e acha a pessoa sem decifrar nada. Sem a chave, não dá para testar CPFs um a um contra o banco.
- **Máscara em toda tela.** O app, o painel e o detalhe do chamado mostram só `***.456.789-**` ou `**.345.678/0001-**` (`documento_final`).
- **Acesso ao documento completo auditado.** Só o gestor abre, com "Ver documento" (`POST /ocorrencias/{id}/relatos/{relato}/documento`), e cada abertura vira um evento `documento_visto` no histórico do chamado, com o login de quem abriu e sem o número. Igual ao vídeo sem borrão. A equipe de campo não vê quem relatou.
- **A IA nunca recebe o cadastro.** Ao Jev e à IA de reserva continuam indo só a foto borrada, o texto sem dados pessoais (`SemDadosPessoais`), a categoria e o bairro do endereço.
- **Exclusão.** `DELETE /eu` apaga o cadastro. Os relatos continuam nos chamados, com `morador_id` nulo (`ON DELETE SET NULL`). Retenção: nome e documento ficam enquanto a conta existir.
- **Onde mora (v0.3.1).** CEP, município, UF e código do IBGE, todos opcionais e fora do documento cifrado: não identificam a pessoa sozinhos e ajudam a prefeitura a saber de onde vêm os relatos. `cidade` continua sendo a prefeitura que atende; `municipio` pode ser outro. O CEP é consultado no ViaCEP pelo servidor, com cache, e só os dígitos do CEP saem.
- **Código de recuperação como módulo (v0.3.2).** No protótipo só a equipe testa, e anotar 12 letras atrapalhava mais do que protegia. O módulo `recuperacao` (parâmetro da cidade, desligado por padrão) controla o código: desligado, o cadastro não gera código (`codigo_hash` nulo), `POST /moradores/entrar` responde 404 `modulo_desligado` e o CPF repetido continua dando 409 sem token. Quem troca de celular pede à prefeitura: o gestor apaga o cadastro pelo "Quem relatou" (`DELETE /ocorrencias/{id}/relatos/{relato}/morador`), o relato fica sem dono e o evento `cadastro_apagado` guarda quem apagou. **Face ID** (passkey, WebAuthn) é o substituto do código para o piloto público, mas depende do domínio fixo (issue #40), porque a chave fica presa ao endereço.
- **Termo em linguagem simples** no primeiro acesso: "a prefeitura vê seu nome e o documento só quando precisa falar com você; a IA nunca recebe".
- **Histórico em qualquer aparelho.** `GET /eu/relatos` devolve os últimos 50 relatos, o total, os resolvidos e o tempo médio até resolver, com a chave que abre o acompanhamento de sempre.
- **Meu bairro.** `GET /comunidade?lat&lng` conta os resolvidos nos últimos 30 dias e os abertos num raio de 1,5 km e lista até 10 resolvidos com a foto do depois. Sem nome, protocolo, texto ou posição exata (distância de 10 em 10 metros).
- **Espaço público.** A triagem ganhou a pergunta `local_publico`. Abaixo de 0,3, o chamado vai para a conferência com o motivo "parece local privado", não agrupa, não aparece em "Perto de você" nem em "Meu bairro", e o recibo vem com `fora_do_escopo: true`.

## Alternativas consideradas
- **Manter o envio anônimo (ADR 0020).** Menos dado pessoal e menos atrito, mas sem perfil, sem histórico entre aparelhos e sem como a prefeitura voltar a falar com quem relatou. Fica disponível desligando o módulo `cadastro`.
- **Login gov.br.** É o caminho certo para o piloto real: identidade verificada e sem senha nossa. Exige o credenciamento da prefeitura no gov.br, que não cabe até 21/11. Fica como próximo passo.
- **Telefone com código por SMS.** Prova que a pessoa controla o número, mas custa por mensagem e depende de um provedor externo.
- **Guardar o CPF em texto puro.** Mais simples, e inaceitável: um vazamento do banco entregaria o documento de toda a cidade.

## Consequências
- O relato fica mais confiável e a prefeitura pode retornar ao morador. Em troca, a base guarda dado pessoal e passa a ter de responder a pedidos de acesso e exclusão (a exclusão já está no app).
- **Corrigido em 16/11 (issue #26):** antes, quem soubesse o CPF de alguém recebia o token dessa pessoa ao "cadastrar" de novo. Agora o documento repetido não entrega nada e entrar exige o código.
- **Risco que continua:** ninguém confere se o CPF é mesmo de quem cadastra. Alguém pode cadastrar primeiro o CPF de outra pessoa, e a dona do CPF ficaria impedida de se cadastrar. Só o gov.br resolve isso; até lá, a equipe do MOGI apaga o cadastro indevido quando a pessoa reclamar.
- **Perdeu o código, perdeu a entrada.** Ainda não há tela para a prefeitura gerar um código novo; no piloto, a equipe do MOGI faz isso direto no banco, com registro.
- Trocar a `DOCUMENTO_CHAVE` depois de ter cadastros deixa os documentos gravados ilegíveis e faz o mesmo CPF virar cadastro novo. A chave precisa de backup junto com o banco.
- O app Expo ainda não tem a tela de cadastro: ao receber 401, ele orienta a usar o app web. Paridade pendente.
- Encarregado de dados, base legal e o texto final do termo dependem da prefeitura de Itamogi ([SOP 06](../sops/06-checklist-lgpd.md)).
