#!/usr/bin/env bash
# Teste de fumaça do Sistema MOGI (SOP 07, passo 8): saúde, login, cadastro
# do morador, um relato completo e a ocorrência aparecendo no GET, com a
# mídia borrada acessível.
# Uso: make fumaca   (com make dev rodando)
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "falta .env: rode make dev antes"; exit 1; }
set -a; . ./.env; set +a

API="${API:-http://localhost:8080}"
FOTO="scripts/fixtures/foto-agua.jpg"
falha() { echo "FALHOU: $*" >&2; exit 1; }
campo() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }

echo "1. saúde"
SAUDE=$(curl -fsS "$API/saude") || falha "/saude não respondeu 200"
echo "$SAUDE" | grep -q '"banco":"ok"' && echo "$SAUDE" | grep -q '"midia":"ok"' || falha "/saude sem banco ou mídia: $SAUDE"

echo "2. login do usuário inicial"
TOKEN=$(curl -fsS "$API/auth/login" -d "{\"login\":\"${SEED_LOGIN:-gestor}\",\"senha\":\"$SEED_SENHA\"}" | campo "['token']") \
  || falha "login recusado"

# Ponto sorteado perto do centro, para uma execução não agrupar com a anterior.
LAT=$(python3 -c "import random; print(round(-21.0793 + random.uniform(-0.004, 0.004), 6))")
LNG=$(python3 -c "import random; print(round(-47.0486 + random.uniform(-0.004, 0.004), 6))")

uuid() { python3 -c "import uuid; print(uuid.uuid4())"; }
CHAVE_ENVIO=$(uuid)
APARELHO=$(uuid)

echo "2b. cadastro do morador com CPF de teste (ADR 0024)"
CPF=$(python3 scripts/cpf_de_teste.py cpf --mascara)
CPF_DIGITOS=$(echo "$CPF" | tr -dc '0-9')
CADASTRO=$(curl -sS -w '\n%{http_code}' "$API/moradores" \
  -d "{\"tipo\":\"pf\",\"nome\":\"Morador de Teste\",\"documento\":\"$CPF\",\"bairro\":\"Centro\",\"aceite\":true}")
[ "$(echo "$CADASTRO" | tail -1)" = "201" ] || falha "cadastro deveria responder 201: $CADASTRO"
MORADOR=$(echo "$CADASTRO" | head -1 | campo "['token']")
MASCARA=$(echo "$CADASTRO" | head -1 | campo "['morador']['documento_mascarado']")
[ "$MASCARA" = "***.${CPF:4:3}.${CPF:8:3}-**" ] || falha "documento mascarado errado: $MASCARA"
echo "$CADASTRO" | grep -q "$CPF_DIGITOS\|${CPF:0:3}\.${CPF:4:3}" && falha "o cadastro devolveu o CPF completo"
[ "$(curl -s "$API/moradores" -d '{"tipo":"pf","nome":"X Y","documento":"529.982.247-24","aceite":true}' | campo "['codigo']")" = "documento_invalido" ] \
  || falha "CPF inválido deveria ser recusado"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$API/ocorrencias" -F foto=@"$FOTO" -F lat="$LAT" -F lng="$LNG")" = "401" ] \
  || falha "relato sem cadastro deveria dar 401"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$API/ocorrencias" -H "Authorization: Bearer $MORADOR")" = "401" ] \
  || falha "token de morador não pode abrir rota da equipe"

enviar() { # enviar <chave de idempotência> <lng> <texto>
  curl -fsS "$API/ocorrencias" -H "Idempotency-Key: $1" -H "X-Mogi-Aparelho: $APARELHO" -H "Authorization: Bearer $MORADOR" \
    -F foto=@"$FOTO" -F lat="$LAT" -F lng="$2" -F precisao=10 -F categoria=agua -F "texto=$3"
}

echo "3. relato do cano estourado (foto, GPS e texto)"
CRIADA=$(enviar "$CHAVE_ENVIO" "$LNG" "cano estourado jorrando água, meu telefone é (35) 99999-1234 (teste de fumaça)") \
  || falha "POST /ocorrencias"
NIVEL=$(echo "$CRIADA" | campo "['nivel']")
STATUS=$(echo "$CRIADA" | campo "['status']")
PROTOCOLO=$(echo "$CRIADA" | campo "['protocolo']")
echo "   $PROTOCOLO nível $NIVEL, $STATUS"
[ "$NIVEL" = "5" ] || falha "cano estourado deveria sair nível 5 (C2), saiu $NIVEL"
[ "$STATUS" = "revisao" ] || falha "nível 5 deveria ir para revisão humana, foi $STATUS"

echo "$CRIADA" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if len(d.get('chave',''))>=32 and 'id' not in d and 'texto' not in d and 'triagem' not in d else 1)" \
  || falha "o recibo do morador deve trazer a chave e nada do chamado interno"

echo "4. a ocorrência aparece no GET, com o telefone removido do texto"
ID=$(curl -fsS "$API/ocorrencias" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(next((o['id'] for o in json.load(sys.stdin) if o['protocolo']=='$PROTOCOLO'), ''))")
[ -n "$ID" ] || falha "ocorrência $PROTOCOLO não apareceu em GET /ocorrencias"
curl -fsS "$API/ocorrencias/$ID" -H "Authorization: Bearer $TOKEN" | campo "['texto']" | grep -q '99999' \
  && falha "o telefone do morador ficou gravado no texto"

echo "4b. reenviar com a mesma chave não cria outro relato"
REPETIDA=$(curl -sS -w '\n%{http_code}' "$API/ocorrencias" -H "Idempotency-Key: $CHAVE_ENVIO" -H "X-Mogi-Aparelho: $APARELHO" -H "Authorization: Bearer $MORADOR" \
  -F foto=@"$FOTO" -F lat="$LAT" -F lng="$LNG" -F categoria=agua)
[ "$(echo "$REPETIDA" | tail -1)" = "200" ] || falha "reenvio deveria responder 200, veio $(echo "$REPETIDA" | tail -1)"
[ "$(echo "$REPETIDA" | head -1 | campo "['protocolo']")" = "$PROTOCOLO" ] || falha "reenvio devolveu outro protocolo"
[ "$(echo "$REPETIDA" | head -1 | campo "['repetido']")" = "True" ] || falha "reenvio deveria vir marcado como repetido"
[ "$(curl -fsS "$API/ocorrencias/$ID" -H "Authorization: Bearer $TOKEN" | campo "['relatos']")" = "1" ] \
  || falha "o reenvio contou como relato novo"

echo "5. GET sem token é recusado"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$API/ocorrencias")" = "401" ] || falha "GET sem token deveria dar 401"

echo "6. a foto borrada abre pelo link assinado, e link adulterado é recusado"
URL=$(curl -fsS "$API/ocorrencias/$ID" -H "Authorization: Bearer $TOKEN" | campo "['midia_url']")
[ "$(curl -s -o /dev/null -w '%{http_code}' "$API$URL")" = "200" ] || falha "mídia borrada indisponível"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$API${URL}x")" = "403" ] || falha "link de mídia adulterado deveria dar 403"

echo "7. segundo relato do mesmo cano a poucos metros vira o mesmo chamado (C4)"
SEGUNDO=$(enviar "$(uuid)" "$(python3 -c "print($LNG + 0.0002)")" "cano estourado na praça (teste de fumaça)") \
  || falha "POST do segundo relato"
[ "$(echo "$SEGUNDO" | campo "['protocolo']")" = "$PROTOCOLO" ] || falha "o segundo relato deveria entrar no chamado $PROTOCOLO"
[ "$(echo "$SEGUNDO" | campo "['agrupada']")" = "True" ] || falha "o segundo relato deveria vir marcado como agrupado"
[ "$(echo "$SEGUNDO" | campo "['relatos']")" = "2" ] || falha "o chamado deveria ter 2 relatos"
echo "$SEGUNDO" | grep -q 'telefone\|midia_url\|revisado_por' && falha "o recibo vazou dados do chamado de outro morador"
[ "$(curl -fsS "$API/ocorrencias/$ID" -H "Authorization: Bearer $TOKEN" | campo "['relatos_lista'].__len__()")" = "2" ] \
  || falha "o detalhe deveria listar 2 relatos"

echo "8. revisão humana, despacho e resolução"
passo() { curl -fsS -X POST "$API/ocorrencias/$ID/$1" -H "Authorization: Bearer $TOKEN" -d "${2:-{\}}" | campo "['status']"; }
[ "$(passo revisao '{"nivel":5}')" = "aberta" ] || falha "revisão deveria abrir o chamado"
[ "$(passo despacho '{"observacao":"levar registro de 2 polegadas"}')" = "em_atendimento" ] || falha "despacho deveria pôr em atendimento"
[ "$(passo resolucao '{"motivo":"registro trocado"}')" = "resolvida" ] || falha "resolução deveria encerrar"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/ocorrencias/$ID/reabertura" -H "Authorization: Bearer $TOKEN" -d '{}')" = "400" ] \
  || falha "reabrir sem motivo deveria dar 400"
[ "$(passo reabertura '{"motivo":"voltou a vazar"}')" = "aberta" ] || falha "reabertura deveria devolver o chamado para aberta"
[ "$(passo resolucao)" = "resolvida" ] || falha "resolver de novo deveria encerrar"
curl -fsS "$API/ocorrencias/$ID" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; t=[e['tipo'] for e in json.load(sys.stdin)['eventos']]; sys.exit(0 if t==['criada','relato','revisada','despachada','resolvida','reaberta','resolvida'] else print(t) or 1)" \
  || falha "o histórico do chamado não bate com o que foi feito"

echo "8b. relato com 3 fotos e um vídeo curto (ADR 0015)"
VIDEO="scripts/fixtures/video-teste.mp4"
LNG2=$(python3 -c "print($LNG + 0.01)")
MULTI=$(curl -fsS "$API/ocorrencias" -H "Idempotency-Key: $(uuid)" -H "X-Mogi-Aparelho: $APARELHO" -H "Authorization: Bearer $MORADOR" \
  -F foto=@"$FOTO" -F foto=@"$FOTO" -F foto=@"$FOTO" -F video=@"$VIDEO" -F quadro=@"$FOTO" \
  -F lat="$LAT" -F lng="$LNG2" -F categoria=vias -F "texto=buraco fundo na rua (teste de fumaça)") \
  || falha "POST com várias fotos e vídeo"
ID2=$(curl -fsS "$API/ocorrencias" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(next(o['id'] for o in json.load(sys.stdin) if o['protocolo']=='$(echo "$MULTI" | campo "['protocolo']")'))")
DETALHE=$(curl -fsS "$API/ocorrencias/$ID2" -H "Authorization: Bearer $TOKEN")
[ "$(echo "$DETALHE" | python3 -c "import sys,json; print(','.join(m['tipo'] for m in json.load(sys.stdin)['midias']))")" = "foto,foto,foto,video,quadro" ] \
  || falha "o detalhe deveria listar 3 fotos, o vídeo e o quadro"
echo "$DETALHE" | python3 -c "import sys,json; v=[m for m in json.load(sys.stdin)['midias'] if m['tipo']=='video'][0]; sys.exit(0 if 'url' not in v else 1)" \
  || falha "o vídeo original não pode ter link público"
MIDIA=$(echo "$DETALHE" | python3 -c "import sys,json; print([m for m in json.load(sys.stdin)['midias'] if m['tipo']=='video'][0]['id'])")
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/ocorrencias/$ID2/midias/$MIDIA/abertura")" = "401" ] \
  || falha "abrir o vídeo sem login deveria dar 401"
LINK=$(curl -fsS -X POST "$API/ocorrencias/$ID2/midias/$MIDIA/abertura" -H "Authorization: Bearer $TOKEN" | campo "['url']")
[ "$(curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-99' "$API$LINK")" = "206" ] || falha "o vídeo deveria responder a pedido de trecho"
curl -fsS "$API/ocorrencias/$ID2" -H "Authorization: Bearer $TOKEN" | grep -q '"video_visto"' || falha "abrir o vídeo deveria ficar no histórico"
[ "$(curl -s "$API/ocorrencias" -H "Authorization: Bearer $MORADOR" -F foto=@"$FOTO" -F video=@scripts/fixtures/video-com-audio.mp4 -F lat="$LAT" -F lng="$LNG2" | campo "['codigo']")" = "video_com_audio" ] \
  || falha "vídeo com áudio deveria ser recusado"

echo "8c. histórico do morador, quem relatou e o documento auditado (ADR 0024)"
curl -fsS "$API/eu/relatos" -H "Authorization: Bearer $MORADOR" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['relatos']; sys.exit(0 if d['total']==3 and d['resolvidos']==2 and isinstance(d['tempo_medio_horas'],(int,float)) and len(r)==3 and all(x['chave'] for x in r) and r[0]['criado_em']>=r[-1]['criado_em'] else print(d) or 1)" \
  || falha "/eu/relatos deveria ter 3 relatos, 2 resolvidos e o tempo médio"
RELATO=$(curl -fsS "$API/ocorrencias/$ID" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; x=json.load(sys.stdin)['relatos_lista'][0]; m=x['morador']; sys.exit(print(x['id']) if m and m['nome']=='Morador de Teste' and m['documento_mascarado']=='$MASCARA' else 1)") \
  || falha "o detalhe deveria mostrar quem relatou, com o documento mascarado"
[ "$(curl -fsS -X POST "$API/ocorrencias/$ID/relatos/$RELATO/documento" -H "Authorization: Bearer $TOKEN" | campo "['documento']")" = "$CPF" ] \
  || falha "o gestor deveria ver o documento completo"
curl -fsS "$API/ocorrencias/$ID" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; e=[x for x in json.load(sys.stdin)['eventos'] if x['tipo']=='documento_visto']; sys.exit(0 if e and e[-1]['autor']=='${SEED_LOGIN:-gestor}' and '$CPF_DIGITOS' not in json.dumps(e) else 1)" \
  || falha "ver o documento deveria ficar no histórico, com o autor e sem o documento"
curl -fsS "$API/comunidade?lat=$LAT&lng=$LNG" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d['raio_m']>0 and d['resolvidos_30d']>=1 and isinstance(d['abertos'],int) and d['itens'] and all(set(i)=={'categoria','categoria_nome','resolvido_em','foto_depois_url','distancia_m'} for i in d['itens']) else print(d) or 1)" \
  || falha "/comunidade deveria contar o resolvido perto, sem dado pessoal"

echo "9. indicadores e log de etapas (RF11)"
curl -fsS "$API/indicadores?dias=30" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); e={x['etapa'] for x in d['etapas']}; sys.exit(0 if d['total']>0 and {'borrao','classificacao','regra_lua'}<=e else 1)" \
  || falha "indicadores sem total ou sem etapas"

echo "10. admin: regras Lua só para gestor, com simulação na sandbox"
curl -fsS "$API/admin/regras" -H "Authorization: Bearer $TOKEN" | grep -q '_comum.lua' || falha "admin não listou as regras"
ERRO=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$API/admin/regras/agua.lua" -H "Authorization: Bearer $TOKEN" \
  -d '{"conteudo":"function avaliar(t) while true do end end"}')
[ "$ERRO" = "422" ] || falha "regra em laço infinito deveria ser recusada com 422, veio $ERRO"

echo "OK: morador cadastrado; $PROTOCOLO criado, triado, reenviado sem duplicar, agrupado, despachado, resolvido e reaberto; relato com fotos e vídeo conferido"
