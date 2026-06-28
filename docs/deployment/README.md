# Deploy do TACO-IDE com Docker

Guia para (1) **testar a plataforma inteira localmente** com o Docker Desktop e
(2) **subir nas VMs** em produção. Backend (Fastify) e frontend (Next.js) rodam
em containers; o **banco em produção é externo** (você fornece a `DATABASE_URL`).

---

## Arquitetura

```
                 ┌───────────────────────── rede docker ─────────────────────────┐
  navegador ───► │  caddy (80/443, só prod)                                        │
   (HTTPS)       │     ├─ /v1/* /api/* /docs ─► api  (Fastify, :4000)              │
                 │     └─ resto ─────────────► web  (Next.js standalone, :4001)    │
                 │                               │                                  │
                 │                          migrate (job único: migrations + seed)  │
                 └───────────────────────────────┼──────────────────────────────  ┘
                                                  ▼
                                         PostgreSQL + pgvector
                                  (LOCAL: container | PROD: externo)
```

- **Origem única (prod):** web e API são servidos pelo **mesmo domínio HTTPS**
  via Caddy. Isso evita qualquer dor de cookie cross-site no login.
- **`migrate`** roda **uma vez** antes da API: aplica as migrations do Drizzle
  (incluindo `CREATE EXTENSION vector`) e o seed. É idempotente.
- **`uploads`** (arquivos do Knowledge Base) ficam num volume Docker.

### Arquivos desta infra

| Arquivo | Para quê |
|---|---|
| `compose.yaml` | Stack **local** completo (inclui o banco em container) |
| `compose.prod.yaml` | Stack de **produção** (só back+front+Caddy, banco externo) |
| `apps/api/Dockerfile` | Imagem da API (alvos `runner` e `migrate`); instala `pandoc` |
| `apps/web/Dockerfile` | Imagem do web (Next standalone; `NEXT_PUBLIC_API_URL` no build) |
| `deploy/Caddyfile` | Reverse proxy de origem única + HTTPS automático |
| `.dockerignore` | Mantém o build context enxuto |
| `.env.docker.example` | Modelo de variáveis de ambiente |

---

## Parte A — Testar localmente (Docker Desktop)

Pré-requisitos: **Docker Desktop** rodando. Nada de Node/Postgres/Pandoc na
máquina — está tudo nas imagens.

```bash
# 1. (opcional) variáveis. O stack local sobe com defaults; só precisa de
#    LLM_API_KEY se for exercitar as features de IA.
cp .env.docker.example .env       # edite LLM_API_KEY se quiser IA

# 2. Sobe tudo (db -> migrate -> api -> web). A 1ª vez compila as imagens.
docker compose up --build

# (em outro terminal) acompanhe quando ficar pronto:
#   db        healthy
#   migrate   exited (0)
#   api       healthy
#   web       running
docker compose ps
```

Acesse:

- **Web:** http://localhost:4001
- **API / Swagger:** http://localhost:4000/docs
- **Health da API:** http://localhost:4000/v1/status

**Contas de demo** (criadas pelo seed dev local):

- Professor: `professor@taco-demo.local`
- Aluno: `aluno@taco-demo.local`
- Senha padrão das fixtures de dev: `Teste123!@`

> Localmente o stack roda com `NODE_ENV=development`: o cookie de sessão **não**
> é `Secure` (funciona em HTTP) e a verificação de e-mail fica desligada — dá pra
> cadastrar/logar na hora. `localhost:4001` e `localhost:4000` são o **mesmo
> site** para o navegador, então o cookie `SameSite=Lax` é enviado normalmente.

### Comandos úteis (local)

```bash
docker compose logs -f api          # logs da API
docker compose logs -f web          # logs do web
docker compose restart api          # reinicia um serviço
docker compose down                 # para tudo (mantém os dados no volume)
docker compose down -v              # para tudo e APAGA o banco/uploads (reset total)

# Reaplicar migrations/seed manualmente (ex.: recriou o banco):
docker compose run --rm migrate

# Rodar só o seed de fixtures de demo de novo:
docker compose run --rm -e NODE_ENV=development migrate \
  npx tsx src/db/seeds/dev.ts
```

> O Postgres local é publicado em **`localhost:5433`** (host) → `5432` (container),
> pra não colidir com um Postgres já rodando na 5432. Para abrir o Drizzle Studio
> ou um cliente SQL apontando pro banco do container, use
> `postgresql://postgres:postgres@localhost:5433/taco`.

---

## Parte B — Deploy nas VMs (produção, domínio + HTTPS)

### B.0 Pré-requisitos

Na VM:
- **Docker Engine + Docker Compose v2** instalados.
- Portas **80 e 443** abertas (Caddy faz o HTTPS automático).
- Um **domínio** (ex.: `taco.suaescola.edu`) com **registro DNS A/AAAA**
  apontando para o IP da VM. (Sem isso o Let's Encrypt não emite o certificado.)

Externo:
- Um **PostgreSQL** acessível pela VM, **com a extensão pgvector disponível**.
  - Postgres gerenciado (RDS/Azure/Cloud SQL) normalmente exige **habilitar a
    extensão antes** (ex.: RDS `rds.allowed_extensions`, Azure `azure.extensions`)
    e que o usuário do `DATABASE_URL` possa rodar `CREATE EXTENSION`.
  - Use SSL: acrescente `?sslmode=require` na `DATABASE_URL`.

### B.1 Trazer o código e configurar o `.env`

```bash
git clone <repo> taco-ide && cd taco-ide
cp .env.docker.example .env
```

Edite o `.env` com os valores **reais**. Mínimo obrigatório em produção:

```env
DOMAIN=taco.suaescola.edu
DATABASE_URL=postgresql://USER:PASS@db-host:5432/taco?sslmode=require
BETTER_AUTH_SECRET=<openssl rand -base64 48>
LLM_API_KEY=<chave Azure OpenAI / provedor LLM>
```

Fortemente recomendado em produção (senão usuários novos não verificam e-mail e
**não conseguem logar**):

```env
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@suaescola.edu
```

Opcional: `EMBEDDING_*` (busca semântica do Knowledge Base), `PLATFORM_ADMIN_*`
(cria um admin de plataforma no primeiro `migrate`), `LANGFUSE_*`.

> O `compose.prod.yaml` deriva `BETTER_AUTH_URL`, `FRONTEND_URL` e o
> `NEXT_PUBLIC_API_URL` (build do web) a partir de `https://${DOMAIN}` — origem
> única. Se algum obrigatório faltar, o `docker compose` **falha na hora**
> dizendo qual variável setar.

### B.2 Subir

```bash
docker compose -f compose.prod.yaml up -d --build
```

Ordem garantida: **`migrate` roda as migrations + seed → API sobe → web sobe →
Caddy publica em HTTPS**. Acompanhe:

```bash
docker compose -f compose.prod.yaml logs -f migrate   # deve terminar em exit 0
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs -f caddy      # emissão do certificado
```

Pronto: acesse `https://taco.suaescola.edu`. API em
`https://taco.suaescola.edu/docs`.

### B.3 Admin de plataforma

Se você setou `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` (≥12 chars) /
`PLATFORM_ADMIN_NAME`, o `migrate` já criou o admin (verificado e ativo).
Reexecutar o `migrate` com uma senha nova **rotaciona** a senha.

### B.4 Atualizar (novo deploy)

```bash
git pull
docker compose -f compose.prod.yaml up -d --build
```

- As migrations rodam de novo automaticamente (idempotentes).
- **Se mudou o `DOMAIN`**, o web precisa ser reconstruído (o `--build` já faz):
  o `NEXT_PUBLIC_API_URL` é embutido no bundle em tempo de build.

### B.5 Backup / dados

- **Banco:** é externo → use o backup do seu provedor.
- **Uploads do Knowledge Base:** volume `uploads`. Backup:
  ```bash
  docker run --rm -v taco-ide-prod_uploads:/data -v "$PWD":/out alpine \
    tar czf /out/uploads-backup.tgz -C /data .
  ```

---

## Variáveis de ambiente (resumo)

Legenda: **B** = usado no *build*, **R** = usado em *runtime*.

| Variável | Serviço | Quando | Obrigatória | Observação |
|---|---|---|---|---|
| `DOMAIN` | web(B)/caddy/api | B+R | ✅ prod | Origem única HTTPS |
| `DATABASE_URL` | api/migrate | R | ✅ | Postgres externo + `?sslmode=require` |
| `BETTER_AUTH_SECRET` | api/migrate | R | ✅ (≥32) | Igual em todas as réplicas |
| `LLM_API_KEY` | api/migrate | R | ✅ | API **não sobe** sem isso |
| `NEXT_PUBLIC_API_URL` | web | **B** | ✅ | Embutido no build (= `https://DOMAIN`) |
| `RESEND_API_KEY` + `EMAIL_FROM` | api | R | ⚠️ prod | Sem isso, verificação de e-mail trava login |
| `BETTER_AUTH_URL` | api | R | auto | `https://DOMAIN` (derivado) |
| `FRONTEND_URL` | api | R | auto | `https://DOMAIN` (derivado); usado no CORS e nos links de e-mail |
| `EMBEDDING_*` | api | R | ❌ | Knowledge Base; mantenha `EMBEDDING_DIMENSIONS=1536` |
| `PLATFORM_ADMIN_*` | migrate | R | ❌ | Cria admin no 1º migrate |
| `LANGFUSE_*`, `OPENROUTER_API_KEY`, `CLOUDFLARE_TURNSTILE_SECRET`, `CODE_EXEC_API_URL` | api | R | ❌ | Opcionais |
| `PORT` / `HOSTNAME` | api/web | R | auto | `4000` / `4001` / `0.0.0.0` |

---

## Troubleshooting

**API em crash-loop logo no start (`Invalid environment variables`).**
Falta uma var obrigatória (`DATABASE_URL`, `BETTER_AUTH_SECRET` ≥32,
`BETTER_AUTH_URL`, `LLM_API_KEY`). O `env.ts` valida tudo na importação. Cheque
o `.env`.

**`migrate` falha em `CREATE EXTENSION "vector"`.**
O usuário do `DATABASE_URL` não tem privilégio, ou a extensão não está
liberada no Postgres gerenciado. Habilite pgvector (allow-list) e/ou use um
usuário com permissão. Nunca use `db:push` num banco zerado — ele pula os
arquivos SQL e não cria a extensão; sempre `migrate` (é o que o job faz).

**Loop de redirect pro `/auth/login` em produção (usuário logado é "deslogado").**
É o bug do nome do cookie em HTTPS. Já corrigido (o middleware lê
`__Secure-better-auth.session_token`). Garanta que está rodando o código
atualizado e reconstrua o web.

**Chamadas do front vão pra `localhost:4000` em produção.**
O `NEXT_PUBLIC_API_URL` foi embutido errado no build. Ele é **build-time**:
reconstrua o web com `--build` após ajustar `DOMAIN`.

**CORS bloqueando o front / links de e-mail apontando pra localhost.**
`FRONTEND_URL` está errado. Na origem única ele é `https://DOMAIN` (derivado);
confirme o `DOMAIN`.

**Upload de documento grande falha (413).**
A API aceita até 10MB por arquivo; o Caddyfile já libera 12MB no proxy. Se usar
outro proxy na frente, ajuste o `client_max_body_size`/limite equivalente.

**Caddy não emite certificado.**
DNS do `DOMAIN` precisa apontar pra VM e as portas 80/443 abertas. Veja
`docker compose -f compose.prod.yaml logs caddy`.

**Air-gapped / sem internet de saída.**
IA, embeddings e execução de código chamam serviços externos (Azure OpenAI,
endpoint de embeddings, Piston em `emkc.org`). Se a saída for restrita,
auto-hospede e sobrescreva `LLM_API_BASE` / `EMBEDDING_API_URL` /
`CODE_EXEC_API_URL`.

---

## Notas de design (por que assim)

- **`node --import tsx/esm` na API:** o `tsup` externaliza o pacote `@repo/infra`,
  que é distribuído como `.ts` cru (sem build). Por isso a imagem carrega o
  `tsx` e o `packages/infra/src` e inicia com esse loader — `node dist/index.js`
  puro não resolveria esses imports.
- **`output: "standalone"` no Next + `outputFileTracingRoot`:** gera um bundle
  self-contained com o `node_modules` mínimo traçado a partir da raiz do
  monorepo. Imagem web pequena.
- **Banco só local:** em produção você aponta a `DATABASE_URL` para o Postgres
  externo; o `compose.prod.yaml` não sobe banco.
