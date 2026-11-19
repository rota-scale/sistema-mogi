# Imagem única do Sistema MOGI (SOP 07): o Go serve a API, o painel da
# prefeitura e o app web do morador no mesmo endereço.

FROM node:22-bookworm-slim AS painel
WORKDIR /src
COPY painel/package.json painel/package-lock.json ./
RUN npm ci
COPY painel/ ./
RUN npm run build

FROM golang:1.26-bookworm AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# Distroless: só o binário, certificados e fuso horário, sem shell.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=api /out/api /out/seed /app/
COPY --from=painel /src/dist /app/web
# As regras vão na imagem; o Compose põe um volume por cima, que nasce com
# este conteúdo e guarda o que o gestor salvar no Admin (C5).
COPY --chown=nonroot:nonroot backend/regras /app/regras
ENV WEB_DIR=/app/web REGRAS_DIR=/app/regras API_ENDERECO=0.0.0.0:8080
EXPOSE 8080
# Sem shell na imagem, o próprio binário confere a saúde.
HEALTHCHECK --interval=5s --timeout=3s --retries=30 CMD ["/app/api", "-saude"]
CMD ["/app/api"]
