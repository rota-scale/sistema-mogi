# Comece aqui: demonstração do MOGI no MacBook e no celular

Guia para mostrar o MOGI funcionando ao prefeito e à banca do AKCIT. Leva uns 20 minutos na primeira vez; depois, 2 minutos.

## Visita ao prefeito: 18/11/2026, 8h
Itamogi é uma cidade enxuta e a conversa é com pessoas que não lidam com tecnologia. **Fale do benefício, não da técnica:** nada de IA, algoritmo ou sistema. É "o morador avisa com uma foto e a prefeitura resolve".

| Parte | Tempo | O que é |
|---|---|---|
| 1. Conversa | 15 min | mostrar funcionando no celular e no computador, entregar a [folha do prefeito](folha-prefeito.md) e ouvir |
| 2. Na rua | 40 min | você manda alguns avisos reais pelo MOGI ([roteiro](teste-de-campo-itamogi.md)) |

**Na véspera (17/11, à noite):** faça a seção 1 se ainda não fez, depois a seção 2 inteira em casa. Faça o cadastro no celular com o seu CPF e **anote o código de recuperação** num papel. Mande um relato de teste e veja o pino chegar. Rode `make limpar` no fim, para chegar com a demo limpa, e imprima o [kit em PDF](pdf/kit-visita-18-11.pdf).

## 1. Preparar o MacBook (só na primeira vez)
1. **Docker Desktop:** baixe em docker.com, instale e abra. Espere a baleia no topo da tela ficar parada.
2. **Ferramentas de linha de comando** (trazem o `git` e o `make`). No Terminal:
```bash
xcode-select --install
```
3. **Baixar o projeto:**
```bash
git clone https://github.com/rota-scale/cidade-inteligente-akcit.git
cd cidade-inteligente-akcit
```
   Se já tiver baixado antes, entre na pasta e atualize com `git pull`.

4. **Chaves da IA** (opcional, mas deixa a demo completa). Abra o arquivo de configuração com `nano .env` e preencha:
```text
TYPESAFE_API_KEY=chave-do-jev
IA_CHAVE=chave-da-anthropic
IA_MODELO=claude-haiku-5-5
```
   Salve com `Ctrl+O`, `Enter` e saia com `Ctrl+X`. Sem as chaves, o MOGI funciona com o classificador local.

## 2. Ligar no dia (2 minutos)
1. Abra o Docker Desktop.
2. No Terminal, dentro da pasta do projeto:
```bash
make limpar
make tunel
```
   `make limpar` recomeça o banco só com os chamados de demonstração. O `make tunel` sobe tudo e mostra um link `https://...trycloudflare.com`.
3. Os logins aparecem com `make senhas`.

## 3. Onde abrir cada tela
| Aparelho | Endereço | Login | Quem é |
|---|---|---|---|
| Celular (iPhone ou Android) | link do túnel + `/relatar` | nenhum | morador |
| MacBook | link do túnel (ou `http://localhost:8080`) | `operador` | central da prefeitura |
| MacBook, outra aba | o mesmo link | `gestor` | gestor (indicadores, regras) |
| MacBook ou celular do prefeito | o mesmo link | `prefeito` | Gabinete do prefeito: a cidade numa tela, só leitura (precisa de `PREFEITO_SENHA` e `PREFEITO_NOME` no `.env`) |
| Celular de outra pessoa (opcional) | link do túnel + `/campo` | `equipe` | equipe de campo |

No celular, aceite a câmera e a localização quando o navegador pedir. No Android, o Chrome oferece "Instalar app": o MOGI ganha ícone na tela inicial. No MacBook, clique uma vez na página da central para o som poder tocar.

## 4. Mostrar funcionando (5 minutos)
1. **A dor (30 s):** "Hoje o pedido chega por telefone e WhatsApp, sem foto e sem endereço, e o urgente se mistura com o resto."
2. **O morador avisa (1 min):** no celular, toque na câmera, fotografe (ou mostre uma foto de exemplo), escolha "Água" e "Cano estourado" e envie. Mostre o número do protocolo.
3. **A prefeitura vê (1 min):** no computador, o aviso aparece no mapa na hora, no topo da lista porque é urgente. Toque em "Sim, confirmar" e "Mandar equipe".
4. **Resolvido (1 min):** a equipe registra a foto do serviço feito e o celular do morador mostra "Resolvido".
5. **O fecho (30 s):** "A ideia é testar aqui em Itamogi, sem custo, com a gente do lado da equipe."

Deixe o cadastro do celular feito antes. Se o prefeito quiser testar no celular dele, use o celular da demo.

## 4b. Ouvir (10 minutos)
Três perguntas, numa conversa normal. Não é entrevista: anote depois, não na frente dele.

1. **Hoje, como chega um pedido de buraco ou de luz queimada, e o que mais dá dor de cabeça?**
2. **Isso ajudaria vocês? O que não serve?**
3. **Se for testar, por onde começaria e quem da prefeitura cuidaria disso?**

Se surgir sozinho na conversa, guarde: quantos pedidos chegam por mês e quem autoriza um teste. Não pergunte de dados pessoais nem de leis; isso fica para uma conversa com a equipe técnica, se o teste andar.

## 5. Plano B
- **Sem internet:** abra o vídeo `MOGI - video 85s.mp4`, que está neste pacote, e diga que é uma gravação.
- **O túnel não mostrou o link:** rode `make link` de novo depois de alguns segundos.
- **O iPhone não abre a câmera:** em Ajustes, Safari, Câmera, escolha "Perguntar" ou "Permitir". Recarregue a página.
- **O pino não chegou:** recarregue a central; confira se o Docker está aberto com `docker compose ps`.

## 6. Checklist antes de sair de casa
- [ ] Kit impresso ([PDF](pdf/kit-visita-18-11.pdf)): duas cópias da folha do prefeito (uma fica com ele), o seu roteiro e a ficha da rua.
- [ ] Código de recuperação anotado em papel.
- [ ] Hotspot 4G de outro celular, como reserva.
- [ ] MacBook carregado, com carregador, e Docker Desktop aberto ao menos uma vez.
- [ ] `make subir` testado em casa, com uma foto enviada pelo iPhone e o pino chegando.
- [ ] iPhone carregado, com o som ligado.
- [ ] Vídeo copiado no MacBook e no iPhone.
- [ ] Este pacote salvo fora do MacBook (pendrive ou nuvem).

## 7. Depois da demonstração
```bash
make parar
```
Isso fecha o túnel: enquanto ele está aberto, quem tiver o link alcança o servidor.

## O que dizer sobre as imagens
As fotos dos chamados de demonstração foram geradas por IA e têm um selo na imagem. Elas não são fotos de Itamogi; as fotos reais vêm do teste de campo.
