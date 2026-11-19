# Arquitetura e fluxos

Visões C4 em Mermaid, com nomes que existem no repositório. Linha pontilhada é integração opcional.

## Contexto

```mermaid
flowchart LR
  M[Morador] -->|fotos, vídeo curto, fala, GPS| S[Sistema MOGI]
  C[Central: operador] <-->|fila, revisão, despacho| S
  E[Equipe de campo] <-->|chamados da secretaria, foto do depois| S
  G[Gestor] <-->|indicadores, regras, usuários, parâmetros| S
  S -.->|texto tratado e foto borrada| J[Jev ou IA de visão]
  S -.->|coordenadas| N[Nominatim]
  S -->|mapa base| O[OpenFreeMap]
```

## Contêineres

```mermaid
flowchart TB
  U[Morador: web /relatar ou app Expo] -->|HTTPS| API
  P[Central e gestor: painel React] -->|REST e WebSocket| API
  F[Equipe de campo: /campo] -->|REST e WebSocket| API
  API[Go: API e arquivos web] --> DB[(PostgreSQL 16, PostGIS e H3)]
  API --> OBJ[(SeaweedFS, compatível com S3)]
  DB -->|LISTEN e NOTIFY| API
  API -.-> J[Jev ou IA de visão]
  API -.-> N[Nominatim]
```

O Compose sobe Postgres, SeaweedFS e a API (perfil `app`), mais o túnel opcional para o teste no celular (`make tunel`). O Go recebe as mídias, borra, guarda e entrega por link assinado; não há upload direto ao armazenamento.

## Componentes da API

```mermaid
flowchart LR
  HTTP[Rotas HTTP, X-Request-Id, limites] --> AUTH[Login, JWT, papéis]
  HTTP --> OC[Ocorrências: envio, fila, campo, morador]
  HTTP --> ADM[Admin: regras, categorias, usuários]
  HTTP --> CID[Cidade e parâmetros]
  HTTP --> OBS[Observa: métricas, telemetria, relatório]
  OC --> MID[Mídia: borrão, vídeo sem áudio, links]
  OC --> TRI[Triagem]
  TRI --> CLS[Jev, IA ou classificador local]
  TRI --> LUA[Regras Lua e GUT]
  OC --> REP[Repositório e eventos]
  REP --> DB[(Postgres)]
  MID --> S3[(SeaweedFS)]
  DB --> RT[Hub WebSocket filtrado por secretaria]
```

## Jornadas por usuário

**Morador** (cadastro com CPF ou CNPJ feito uma vez, ADR 0024; o envio continua repetível, ADR 0020):

```mermaid
flowchart TD
  Z[Primeira vez: cadastro e código de recuperação] --> A
  A[Abre o mapa] --> B[Toca na câmera: até 4 fotos, ou segura: vídeo de 15 s sem áudio]
  B --> C[Fala ou escreve, opcional]
  C --> D[Envia com chave de idempotência]
  D --> E{Já tem chamado perto?}
  E -->|sim| F[Soma ao chamado: mais urgência]
  E -->|não| G[Chamado novo e triagem]
  F --> H[Recibo: protocolo e chave]
  G --> H
  H --> I[Acompanha pelo protocolo]
  A --> J[Vê um pino perto e toca em Também vi]
```

**Operador da central:**

```mermaid
flowchart TD
  A[Entra no painel] --> B[Mapa e fila ao vivo, com som no crítico]
  B --> C{Precisa de revisão?}
  C -->|sim| D[Confere ou muda a urgência]
  C -->|não| E[Despacha para a secretaria]
  D --> E
  E --> F[Acompanha até resolver ou reabre]
```

**Equipe de campo** (papel `campo`, ADR 0016):

```mermaid
flowchart TD
  A[Abre /campo no celular] --> B[Vê só os chamados da própria secretaria]
  B --> C[Vai ao local com o mapa]
  C --> D{Encontrou?}
  D -->|sim| E[Resolve com foto do depois]
  D -->|não| F[Marca não encontrado]
  E --> G[Morador vê resolvido no acompanhamento]
```

**Gestor:**

```mermaid
flowchart TD
  A[Entra no painel] --> B[Indicadores e aba Operação]
  B --> C[Edita e simula a regra Lua]
  C --> D{Cenários passam?}
  D -->|sim| E[Salva com autor no histórico]
  D -->|não| C
  B --> F[Usuários e parâmetros da cidade]
```

A simulação confere que a regra roda e bate com os cenários; não substitui a aprovação da política pública. **Ainda não implementado:** notificação ativa ao morador, pergunta automática e despacho automático citados no [fluxo do agente](../fluxo-do-agente.md) como próximos passos.
