# SOP 06: Checklist de LGPD
Conferido no código em 16/11/2026. Marcado: já está no sistema. Em aberto: falta.

- [x] Rostos e placas borrados antes de qualquer exibição ou envio externo (`midia/seletivo.go`, com borrão total de reserva).
- [ ] Borrão validado com fotos reais de Itamogi (rosto de perfil, rosto pequeno, placas). Até lá, `BORRADOR=total` é a opção segura.
- [x] Áudio não chega ao servidor: a fala vira texto no aparelho e vídeo com trilha de áudio é recusado.
- [x] Texto gravado e enviado à IA sem e-mail, CPF, telefone e placa (`SemDadosPessoais`). Nomes próprios podem passar.
- [x] Ao Jev e à IA de reserva vão só a foto borrada, o texto limpo, a categoria e o bairro; nunca a foto original, a coordenada nem quem relatou. `JEV_FOTO=false` manda só texto.
- [x] Cadastro do morador com CPF ou CNPJ (ADR 0024): dígitos verificadores conferidos, documento cifrado com AES-256-GCM (`DOCUMENTO_CHAVE`), achado por HMAC sem decifrar e mostrado só mascarado (`***.456.789-**`).
- [x] Documento completo só para o gestor, em "Ver documento", com cada abertura registrada no histórico do chamado (`documento_visto`, sem o número). A equipe de campo não vê quem relatou.
- [x] O cadastro nunca vai para a IA: Jev e IA de reserva recebem o mesmo de antes, sem nome nem documento.
- [x] Direito de exclusão: "Apagar conta" no perfil (`DELETE /eu`) apaga o cadastro; os relatos ficam no chamado sem ligação com a pessoa.
- [x] Aceite do termo gravado com data e hora (`aceite_em`); sem aceite, não há cadastro.
- [x] O acompanhamento do protocolo continua por um segredo entregue só a quem enviou.
- [ ] Backup da `DOCUMENTO_CHAVE` guardado à parte do backup do banco (sem ela, os documentos não abrem).
- [x] Documento repetido não entrega a conta: entrar em outro aparelho exige o código de recuperação, com trava depois de 5 erros e sessão que derruba os outros aparelhos (issue #26).
- [ ] Login gov.br antes do piloto real: hoje ninguém confere se o CPF é de quem cadastra.
- [x] Foto original sem link; vídeo só por link restrito de 10 minutos para servidor logado, com registro de quem abriu.
- [x] Original da mídia apagada em 90 dias (parâmetro `retencao_dias`, Regras, aba Parâmetros); a versão borrada fica.
- [x] Telemetria dos aparelhos sem IP, sem identificador do aparelho e com o detalhe filtrado; apagada em 30 dias.
- [x] Relatório do campo (`make relatorio`) sem texto do relato, sem coordenada e sem login.
- [x] Dados de demo sem dado pessoal real; imagens geradas por IA marcadas.
- [x] Termo de uso e aviso de privacidade em linguagem simples na primeira abertura do app, antes do cadastro.
- [ ] Texto final do termo revisado pela prefeitura.
- [ ] Encarregado de dados da prefeitura indicado antes do piloto real.
- [ ] Base legal e consentimento da prefeitura registrados.
