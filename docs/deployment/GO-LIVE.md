# Runbook de Go-Live (deploy real nas VMs)

Checklist operacional para o dia de subir o TACO-IDE em produção. Para o guia de
referência (arquitetura, matriz de env, troubleshooting) veja
[`README.md`](./README.md). Aqui é só o passo a passo, em ordem.

Topologia: **origem única HTTPS** (Caddy) → web + API no mesmo domínio; **banco
PostgreSQL externo** (não containerizamos o banco).

---

## 0. Pré-requisitos (confirme ANTES de começar)

- [ ] **VM** com Docker Engine + Docker Compose v2 (`docker compose version`).
- [ ] **Portas 80 e 443** abertas no firewall/security group da VM.
- [ ] **Domínio** (ex.: `taco.suaescola.edu`) com **registro DNS A/AAAA** já
      apontando para o **IP público da VM**. Verifique:
      `dig +short taco.suaescola.edu` → deve retornar o IP da VM.
- [ ] **PostgreSQL externo** acessível pela VM, e a extensão **pgvector**
      habilitada/permitida (RDS: `rds.allowed_extensions`; Azure: `azure.extensions`).
      O usuário do `DATABASE_URL` precisa poder rodar `CREATE EXTENSION` OU a
      extensão já estar criada por um admin.
- [ ] **Chaves em mãos:** `LLM_API_KEY` (Azure OpenAI), `RESEND_API_KEY` (e-mail),
      e, se for usar busca semântica do KB, `EMBEDDING_*`.

> Teste a conexão com o banco a partir da VM antes de seguir:
> `docker run --rm postgres:16 psql "$DATABASE_URL" -c 'select 1'`

---

## 1. Trazer o código e gerar segredos

```bash
git clone git@github.com:taco-ide/taco-ide.git && cd taco-ide
git checkout main          # ou a tag/release que for subir

cp .env.docker.example .env

# Gere o secret do Better Auth (>= 32 chars) e cole no .env:
openssl rand -base64 48
```

---

## 2. Preencher o `.env`

Edite o `.env` na raiz. **Obrigatórios** em produção:

```env
DOMAIN=taco.suaescola.edu
DATABASE_URL=postgresql://USER:PASS@db-host:5432/taco?sslmode=require
BETTER_AUTH_SECRET=<cole o openssl rand acima>
LLM_API_KEY=<chave do provedor LLM>
```

**Fortemente recomendados** (sem e-mail, usuários novos não verificam a conta e
não conseguem logar):

```env
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@suaescola.edu
```

**Opcionais:** `EMBEDDING_*` (KB), `PLATFORM_ADMIN_EMAIL/PASSWORD/NAME` (cria o
admin de plataforma já no primeiro deploy), `LANGFUSE_*`.

> `BETTER_AUTH_URL`, `FRONTEND_URL` e o `NEXT_PUBLIC_API_URL` (build do web) são
> derivados de `https://${DOMAIN}` automaticamente — não precisa setar.

Checagem rápida de que o compose lê tudo certo (não sobe nada):
```bash
docker compose -f compose.prod.yaml config >/dev/null && echo "env OK"
```
Se faltar um obrigatório, ele falha aqui dizendo qual variável.

---

## 3. Subir

```bash
docker compose -f compose.prod.yaml up -d --build
```

Ordem garantida: **`migrate` (migrations + seed) → `api` → `web` → `caddy`**.

---

## 4. Verificar (nesta ordem)

```bash
# 4.1 migrate terminou em exit 0 (rodou as migrations + seed):
docker compose -f compose.prod.yaml logs migrate | tail -20

# 4.2 todos os serviços de pé; api "healthy":
docker compose -f compose.prod.yaml ps

# 4.3 Caddy emitiu o certificado TLS (procure "certificate obtained"):
docker compose -f compose.prod.yaml logs caddy | grep -i "certificate\|tls\|error" | tail

# 4.4 health da API pela internet:
curl -fsS https://taco.suaescola.edu/v1/status

# 4.5 site no ar:
curl -s -o /dev/null -w "%{http_code}\n" https://taco.suaescola.edu/
```

- [ ] `migrate` exit 0
- [ ] `api` healthy, `web`/`caddy` up
- [ ] certificado HTTPS emitido (cadeado válido no navegador)
- [ ] `/v1/status` responde 200
- [ ] consegue logar com o admin (ou criar/verificar um usuário)

---

## 5. Pós-deploy

- **Admin:** se setou `PLATFORM_ADMIN_*`, o admin já foi criado. Senão, crie o
  primeiro usuário e promova conforme o fluxo da plataforma.
- **Smoke test funcional:** logar, criar uma turma, criar um desafio, subir um
  documento no Knowledge Base (valida `pandoc` + uploads + embeddings).

---

## 6. Atualizar (próximos deploys)

```bash
cd taco-ide
git pull                 # ou checkout da nova tag
docker compose -f compose.prod.yaml up -d --build
```

- Migrations rodam de novo automaticamente (idempotentes).
- **Mudou o `DOMAIN`?** o web é reconstruído pelo `--build` (o `NEXT_PUBLIC_API_URL`
  é embutido no bundle em tempo de build).

---

## 7. Rollback

```bash
# Voltar para a versão anterior do código:
git checkout <tag-ou-commit-anterior>
docker compose -f compose.prod.yaml up -d --build
```

⚠️ **Migrations não têm rollback automático.** Se uma migration nova quebrou,
restaure o banco a partir do backup do provedor ANTES de voltar o código.
Por isso: **faça backup do banco antes de cada deploy** que inclua migration.

---

## 8. Operação do dia a dia

```bash
docker compose -f compose.prod.yaml logs -f api      # logs ao vivo
docker compose -f compose.prod.yaml restart api      # reiniciar um serviço
docker compose -f compose.prod.yaml down             # parar tudo (mantém volumes)
docker compose -f compose.prod.yaml ps               # status
```

**Backup dos uploads do Knowledge Base** (volume `uploads`):
```bash
docker run --rm -v taco-ide-prod_uploads:/data -v "$PWD":/out alpine \
  tar czf /out/uploads-$(date +%F).tgz -C /data .
```

**Onde ficam os dados:**
- Banco → externo (backup pelo provedor).
- Uploads do KB → volume Docker `uploads` na VM.
- Certificados TLS → volume Docker `caddy_data` (renovação automática pelo Caddy).

---

## Se algo der errado

| Sintoma | Causa provável | Ação |
|---|---|---|
| `migrate` falha em `CREATE EXTENSION vector` | usuário do DB sem privilégio / pgvector não liberado | habilitar pgvector no provedor; usar usuário com permissão |
| API em crash-loop, `Invalid environment variables` | falta var obrigatória no `.env` | conferir `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32), `LLM_API_KEY` |
| Caddy não pega certificado | DNS não aponta pra VM / 80-443 fechadas | `dig` o domínio, liberar portas, ver `logs caddy` |
| Login entra em loop pra `/auth/login` | rodando código sem a correção do cookie `__Secure-` | usar `main` atualizada e rebuildar |
| Front chama `localhost:4000` | `NEXT_PUBLIC_API_URL` embutido errado | rebuildar o web com `--build` após ajustar `DOMAIN` |
| Upload grande dá 413 | limite de body | já liberado 12MB no Caddyfile; ajustar se trocar de proxy |

Detalhes e mais casos em [`README.md`](./README.md#troubleshooting).
