# SOP 01: Setup do ambiente local
Conferido no `Makefile` em 15/11/2026.

1. Instale Git, Docker com Compose, `make`, Go 1.26 ou mais novo e Node.js 22 ou mais novo. Para o app nativo, o Expo Go no celular.
2. Clone o repositório privado (pedir acesso ao Russo) e entre na pasta.
3. `make env` cria o `.env` a partir do `.env.example`, com segredos locais aleatórios para o banco, o SeaweedFS, o JWT e os três logins: `SEED_SENHA` (gestor), `OPERADOR_SENHA` (operador) e `CAMPO_SENHA` (equipe de campo, secretaria "Obras e vias"). Num `.env` de versão anterior, ele só acrescenta o usuário da equipe. Chaves reais (`TYPESAFE_API_KEY`, `IA_CHAVE`) ficam fora do Git e são pedidas ao Russo por canal privado.
4. Tudo em contêiner: `make subir` sobe Postgres (PostGIS e H3, porta 5433), SeaweedFS e o MOGI em http://localhost:8080 e mostra os logins. `make senhas` mostra os três logins de novo.
5. Para desenvolver: `make dev` sobe só a infraestrutura no Docker e roda o Go (porta 8080, aplica as migrações e cria os usuários) e o Vite (http://localhost:5173) fora dele.
6. App nativo: `make app` (mesma Wi-Fi) ou `make app API_URL=https://link-do-tunel`, e leia o QR com o Expo Go ([app/README.md](../../app/README.md)).
7. Confira: `curl localhost:8080/saude` responde com banco e mídia `ok`, e o painel abre o mapa de Itamogi.
8. Antes de um PR: `make teste` (vet e testes Go, tipos, lint e testes do painel), `make fumaca` e `make conferir` com o sistema de pé. No app: `npx tsc --noEmit`, `npx expo lint` e `npm test` dentro de `app/`.
