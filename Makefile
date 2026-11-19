# Sistema MOGI: atalhos para rodar e desenvolver.
SHELL := /bin/bash

.PHONY: subir tunel link senhas logs demo limpar-demo dev infra env backend painel app ip parar limpar teste fumaca conferir relatorio backup restaurar voltar guardar-versao

CARREGA_ENV := set -a && . ./.env && set +a

## make subir: tudo em contêiner, pronto para usar em http://localhost:8080
## (API, painel da prefeitura em / e app do morador em /relatar).
subir: env guardar-versao
	docker compose --profile app up -d --build --wait
	@echo ""
	@echo "Painel da prefeitura: http://localhost:8080"
	@echo "App do morador:       http://localhost:8080/relatar"
	@$(MAKE) --no-print-directory senhas

## make tunel: sobe tudo e abre um link https público e temporário para
## testar no celular (câmera e GPS do navegador exigem https).
tunel: env guardar-versao
	PROXY_CONFIAVEL=true docker compose --profile tunel up -d --build --wait
	@$(MAKE) --no-print-directory link senhas

## Mostra o link https do túnel (demora alguns segundos para aparecer).
link:
	@./scripts/link-do-tunel.sh

## Mostra os logins iniciais do painel (ficam só no .env local).
senhas:
	@$(CARREGA_ENV) && echo "" \
	  && echo "Login gestor:   $$SEED_LOGIN / $$SEED_SENHA" \
	  && echo "Login operador: $$OPERADOR_LOGIN / $$OPERADOR_SENHA" \
	  && echo "Login equipe:   $$CAMPO_LOGIN / $$CAMPO_SENHA (campo, $$CAMPO_SECRETARIA)" \
	  && if [ -n "$$PREFEITO_SENHA" ]; then echo "Login prefeito: $${PREFEITO_LOGIN:-prefeito} / $$PREFEITO_SENHA (gabinete, só leitura)"; fi

logs:
	docker compose --profile tunel logs -f --tail 50 api

## Chamados simulados: make demo cria mais 80, make limpar-demo apaga todos.
demo:
	docker compose --profile app exec api /app/seed -chamados 80

limpar-demo:
	docker compose --profile app exec api /app/seed -apagar

## make dev: desenvolvimento, com o Go e o Vite fora do Compose.
dev: infra
	@$(MAKE) -j2 backend painel

## Gera o .env a partir do exemplo, com segredos locais aleatórios.
env:
	@if [ ! -f .env ]; then \
	  cp .env.example .env; \
	  for k in POSTGRES_PASSWORD S3_ACCESS_KEY S3_SECRET_KEY SEED_SENHA OPERADOR_SENHA CAMPO_SENHA JWT_SEGREDO DOCUMENTO_CHAVE; do \
	    if [ $$k = JWT_SEGREDO ] || [ $$k = DOCUMENTO_CHAVE ]; then v=$$(openssl rand -hex 32); else v=$$(openssl rand -hex 16); fi; \
	    sed -i.bak "s|^$$k=.*|$$k=$$v|" .env; \
	  done; rm -f .env.bak; \
	  echo ".env criado com segredos locais aleatórios"; \
	fi
	@# .env de uma versão anterior: acrescenta o usuário da equipe de campo.
	@if ! grep -q '^CAMPO_SENHA=' .env; then \
	  printf '\n# Equipe de campo (acrescentado pelo make env)\nCAMPO_LOGIN=equipe\nCAMPO_SENHA=%s\nCAMPO_SECRETARIA="Obras e vias"\n' "$$(openssl rand -hex 8)" >> .env; \
	  echo "usuário da equipe de campo acrescentado ao .env"; \
	fi
	@# .env sem a cerca da cidade: acrescenta a caixa aproximada de Itamogi, para
	@# aviso mandado de fora do município não entrar na fila da prefeitura.
	@if ! grep -q '^CIDADE_CAIXA=.' .env; then \
	  grep -v '^CIDADE_CAIXA=$$' .env > .env.novo; mv .env.novo .env; \
	  printf '\n# Cerca de Itamogi, aproximada (acrescentada pelo make env)\nCIDADE_CAIXA=-47.20,-21.22,-46.90,-20.95\n' >> .env; \
	  echo "cerca da cidade acrescentada ao .env"; \
	fi
	@# .env anterior ao cadastro do morador (ADR 0024): acrescenta a chave do documento.
	@if ! grep -q '^DOCUMENTO_CHAVE=.' .env; then \
	  grep -v '^DOCUMENTO_CHAVE=$$' .env > .env.novo; mv .env.novo .env; \
	  printf '\n# Chave do documento do morador (acrescentada pelo make env)\nDOCUMENTO_CHAVE=%s\n' "$$(openssl rand -hex 32)" >> .env; \
	  echo "chave do documento do morador acrescentada ao .env"; \
	fi

## Sobe Postgres + PostGIS + H3 e SeaweedFS e espera ficarem saudáveis.
infra: env
	docker compose up -d --build --wait

## Backend Go na porta 8080 (aplica migrações e cria os usuários iniciais).
backend: env
	@cd backend && go build -o bin/api ./cmd/api
	@$(CARREGA_ENV) && cd backend && WEB_DIR= ./bin/api

## Painel React + Vite em http://localhost:5173 (proxy /api para o backend).
painel:
	@cd painel && ([ -d node_modules ] || npm install) && npm run dev

## IP da máquina na rede local (o celular precisa estar na mesma Wi-Fi).
## No WSL2 esse IP é interno: para o celular, use make tunel.
IP ?= $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | cut -d" " -f1)

ip:
	@echo "Backend para o celular: http://$(IP):8080"

## App Expo apontando para o backend. Leia o QR com o Expo Go.
## Outro endereço: make app API_URL=https://link-do-tunel
API_URL ?= http://$(IP):8080
app:
	@test -n "$(IP)" || (echo "sem IP de rede; use make app API_URL=http://IP:8080" && exit 1)
	@echo "EXPO_PUBLIC_API_URL=$(API_URL)" > app/.env
	@echo "app falando com $(API_URL)"
	@cd app && ([ -d node_modules ] || npm install) && npx expo start --lan

teste:
	cd backend && go vet ./... && go test ./...
	cd painel && npx tsc -b && npm run lint && npm test

## Teste de fumaça contra o servidor rodando (make subir ou make dev).
fumaca:
	@./scripts/fumaca.sh

## Confere as rotas do morador e da equipe de campo (acompanhar, perto,
## papéis, foto do depois, usuários) contra o servidor rodando.
conferir:
	@./scripts/conferir-api.py

## Relatório do teste de campo: uma linha por chamado real, sem texto do
## relato, sem coordenada e sem login. make relatorio DIAS=3 muda o período.
DIAS ?= 1
relatorio:
	@./scripts/relatorio.sh $(DIAS)

parar:
	docker compose --profile tunel down

## make backup: banco, fotos e regras em backups/AAAA-MM-DD_HHMM (veja docs/sops/08).
backup:
	@./scripts/backup.sh

## make restaurar PASTA=backups/...: põe um backup no lugar do que está no ar.
restaurar:
	@./scripts/restaurar.sh "$(PASTA)"

## Antes de cada build, a imagem que estava no ar vira mogi-api:anterior.
guardar-versao:
	@docker image inspect mogi-api:local >/dev/null 2>&1 && docker image tag mogi-api:local mogi-api:anterior || true

## make voltar: deu problema na versão nova? Volta para a anterior, sem build.
## Seguro porque as migrações só acrescentam (docs/sops/07-deploy-mvp.md).
voltar:
	@docker image inspect mogi-api:anterior >/dev/null 2>&1 || { echo "não há versão anterior guardada"; exit 1; }
	docker image tag mogi-api:anterior mogi-api:local
	docker compose up -d --no-build --no-deps --wait api
	@echo "Voltou para a versão anterior. Confira em /saude."

## Apaga também os volumes (banco, mídia e regras salvas no Admin).
limpar:
	docker compose --profile tunel down -v
