# SOP 08: Backup, restauração e voltar versão

Decisão 7 do "MVP que evolui": publicar sem medo é saber restaurar e voltar.

## Backup
1. Com o sistema no ar: `make backup`. Sai em `backups/AAAA-MM-DD_HHMM/`:
   - `banco.dump`: o Postgres inteiro (`pg_dump -Fc`), com chamados, moradores (CPF cifrado), eventos e parâmetros;
   - `seaweed.tgz`: as fotos e vídeos;
   - `regras.tgz`: as regras Lua salvas no Admin;
   - `LEIA.txt` (versão e commit) e `SHA256SUMS` (a conferência da restauração).
2. **Copie a pasta para fora da máquina** (outro disco ou nuvem cifrada). Backup no mesmo disco não salva de disco queimado.
3. O backup tem o CPF cifrado; a chave `DOCUMENTO_CHAVE` fica só no `.env`. Guarde o `.env` num cofre separado: sem a chave, o CPF do backup não abre.
4. Copiar as fotos com o SeaweedFS gravando pode pegar um arquivo pela metade. Para um backup sem esse risco: `PARAR_MIDIA=1 make backup` (as fotos ficam fora uns segundos) ou faça fora do horário de uso.

Backup diário (exemplo de cron, às 3h):
```
0 3 * * * cd /caminho/do/mogi && PARAR_MIDIA=1 make backup >> backups/cron.log 2>&1
```

## Restaurar
`make restaurar PASTA=backups/AAAA-MM-DD_HHMM` confere o SHA256, para a API, restaura banco, fotos e regras e sobe de novo. **Apaga o que está no ar agora.**

Teste a restauração de vez em quando, numa máquina separada: um backup que nunca foi restaurado não é backup. Em 18/11/2026 o teste foi: 76 chamados e as fotos apagados de propósito e restaurados iguais.

## Voltar versão
Todo `make subir` e `make tunel` guarda a imagem que estava no ar como `mogi-api:anterior`. Se a nova der problema:
```
make voltar
```
Volta sem build, em segundos. É seguro porque as migrações só acrescentam ([SOP 07](07-deploy-mvp.md#migrações-só-acrescentam)): a versão anterior roda no banco já migrado.

## Alertas
Com `ALERTA_URL` no `.env` (por exemplo um tópico do ntfy.sh, com o app ntfy no celular), o servidor avisa quando abre e quando fecha:
- banco ou armazenamento de fotos fora do ar;
- relato esperando a triagem há mais de 10 minutos;
- muitos erros no servidor nos últimos 15 minutos.

Sem a URL, os alertas ficam no log e no topo da aba Operação.
