# SOP 07: Deploy do MVP
Um servidor só por cidade (VPS pequena com Linux, 2 vCPU e 4 GB, a confirmar), com o mesmo `docker-compose.yml` do desenvolvimento ([ADR 0018](../adr/0018-modulos-e-parametros-em-tempo-de-execucao.md) e [ADR 0021](../adr/0021-cidade-como-dado-e-escala.md)).

1. Instale Docker com Compose e `make`; abra só as portas 80 e 443.
2. Clone o repositório e rode `make env`: ele cria o `.env` com segredos aleatórios. Ajuste `CIDADE`, `CIDADE_NOME`, `CIDADE_CENTRO` e, se quiser a cerca, `CIDADE_CAIXA`. Cole as chaves do Jev e da IA só nesse `.env`, nunca no Git.
3. `make subir` constrói a imagem (o painel é construído dentro dela e servido pelo Go) e sobe `postgres`, `seaweedfs` e `api`, esperando ficarem saudáveis.
4. HTTPS: ponha um proxy com certificado automático (por exemplo Caddy) na frente da porta 8080 e ligue `PROXY_CONFIAVEL=true` para o limite por IP ler o cabeçalho do proxy. Para teste rápido sem domínio, `make tunel` dá um link https temporário.
5. App Expo: aponte `EXPO_PUBLIC_API_URL` para o domínio e publique por build interno; build própria para Android precisa da chave do Google Maps ([app/README.md](../../app/README.md)).
6. Backup diário com `make backup` e cópia para fora da máquina; restauração testada com `make restaurar` ([SOP 08](08-backup-e-voltar.md)).
7. Teste de fumaça: `make fumaca` e `make conferir` contra o servidor (`API=https://dominio make fumaca`); depois um relato real pelo celular e o pino chegando na central.
8. Acompanhe pela aba Operação (login gestor) e por `make logs`. Com `ALERTA_URL` no `.env`, o vigia avisa no celular quando banco ou fotos caem, a triagem para ou os erros sobem.
9. Deu problema na versão nova? `make voltar` põe a anterior no ar, sem build ([SOP 08](08-backup-e-voltar.md)).

## Migrações só acrescentam

Para a versão anterior continuar rodando no banco migrado (e o `make voltar` ser seguro), toda migração é **expandir e depois contrair**:
- coluna nova sempre opcional ou com valor padrão; tabela nova à vontade;
- remover, renomear ou trocar o tipo de coluna só numa versão seguinte, quando nenhuma versão no ar usa mais aquilo, com a linha `-- contrair: <motivo>` no arquivo;
- o teste `TestMigracoesSoAcrescentam` (`backend/internal/banco`) recusa a migração destrutiva sem essa marca.
