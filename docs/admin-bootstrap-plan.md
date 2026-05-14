# Plano de Bootstrap Administrativo

**Issues cobertas:** #61, #62, #63, #64, #65
**Branch sugerido:** `feat/admin-bootstrap` (com sub-PRs por fase)
**Data:** 2026-04-29
**Status:** rascunho — aguardando aprovação das decisões abertas (§3)

---

## 1. Sumário executivo

Este plano consolida os 5 issues de "fluxo administrativo" em uma única entrega coordenada. As issues compartilham infraestrutura (schema, middleware, área `/admin`, padrões de form/tabela), então fazê-las juntas reduz retrabalho, mantém o modelo de segurança coerente e fecha o ciclo "admin entra → cria org → adiciona pessoas (manual / CSV / domínio)" antes do MVP.

A entrega é dividida em **6 fases** com 6 PRs (Fase 0+1 podem ir juntas). Cada fase fecha 1 issue, exceto a Fase 0 que é prerequisito técnico compartilhado.

**Conceitos novos introduzidos:**

- `user.isPlatformAdmin: boolean` — papel **fora** do escopo de organização. Hoje o role `admin` do Better Auth é por-organização (vive em `member.role`). Para operações cross-org (criar nova org, mover usuário entre orgs, alternar admin global) precisamos de um sinal independente.
- `organization.isActive: boolean` — soft-deactivation. O Better Auth não trata o conceito.
- `organizationEmailDomain` — nova tabela para o auto-vínculo do #65.
- Middleware `requirePlatformAdmin` — análogo a `requireRole`, mas **não** depende de `activeOrganizationId`.

**Risco principal:** o cookie de sessão tem cache de 5 min (`cookieCache.maxAge=300`). Promover/rebaixar um platform admin não tem efeito imediato — exige `revokeUserSession` ou aguardar o TTL. Documentar isso na UI.

---

## 2. Issues em escopo

| # | Título | Fase | Saída esperada |
|---|---|---|---|
| #61 | Seed de usuário admin (dev + prod) | 1 | Script idempotente + envs novas + admin com login funcionando |
| #62 | Página admin para gerenciar organizações | 2 | `/admin/organizations` (lista, criar, detalhe, editar, desativar) |
| #63 | Gerenciar usuários, organizações e papéis | 3 | Aba Membros completa + `/admin/users` + toggle platform admin |
| #64 | Importação CSV de usuários por organização | 4 | Modal CSV com prévia, validação, relatório por linha |
| #65 | Domínios de email por organização e papel | 5 | Aba Domínios + hook `databaseHooks.user.create.after` |

---

## 3. Decisões de design (em aberto)

> Estas decisões precisam ser confirmadas antes do início da implementação. Cada uma vem com a recomendação técnica baseada na investigação.

### D1. Conceito de admin: global vs por-organização

**Recomendação:** adicionar `user.isPlatformAdmin: boolean` (custom field via Better Auth `additionalFields` com `input: false` para impedir auto-promoção), separado do `member.role`.

**Por quê:** o `creatorRole` está configurado como `"admin"` (`packages/infra/src/auth/index.ts:133`), então qualquer criador de org já é "admin daquela org". Reaproveitar essa string para "admin global" misturaria permissões e quebraria a regra "último admin não pode ser removido" (`crud-members.mjs:163-170`).

**Alternativa rejeitada:** instalar o plugin `better-auth/plugins/admin`. Adiciona `role`, `banned`, `banReason`, `banExpires` à tabela `user` e endpoints prontos (`setRole`, `banUser`, `impersonateUser`). Não usamos porque (a) conflita semanticamente com o `role` por-org do organization plugin, (b) introduz colunas que não vamos usar agora, (c) impersonation/ban estão fora do escopo do MVP.

### D2. CSV: transação atômica vs best-effort

**Recomendação:** **best-effort com prévia obrigatória**. Validação completa antes do insert (Zod por linha + checagem de duplicatas e domínios), exibida na prévia. Apenas linhas válidas são inseridas em uma única transação. Erros impedem só as linhas com problema; o restante segue.

**Por quê:** "all-or-nothing" força o coordenador a corrigir o CSV inteiro para reaproveitar até as linhas boas. Best-effort com prévia é o padrão da indústria (Stripe, Linear, Notion). A transação ainda existe para garantir atomicidade do *batch validado*.

### D3. Escopo do `UNIQUE` no `organizationEmailDomain`

**Recomendação:** `UNIQUE(domain, role)` **global** (mesmo domínio + role só pode existir em uma org da plataforma).

**Por quê:** a issue #65 fala em "evitar conflitos como o mesmo domínio apontando para organizações diferentes ou papéis incompatíveis". Tratar como global é a leitura mais defensiva. Se no futuro precisarmos de multi-tenant (mesmo domínio em N orgs), trocamos por `UNIQUE(organizationId, domain, role)` numa migration.

**Alternativa rejeitada:** `UNIQUE(domain)` sozinho. Bloquearia "usp.br → student" e "usp.br → teacher" coexistirem na mesma org, o que é justamente o caso útil (sub-domínios `@aluno.usp.br` e `@professor.usp.br`).

### D4. CSV síncrono vs job/fila

**Recomendação:** **síncrono**, limitado a 500 linhas (1 MB efetivo), retornando o relatório no próprio response. Sem Trigger.dev ou similar.

**Por quê:** processar 500 linhas Drizzle leva &lt;5s. Adicionar fila multiplica complexidade (status pooling no front, persistência do relatório, retry). Para o MVP, síncrono é suficiente.

### D5. Sonner toast: instalar agora?

**Recomendação:** **sim**, instalar e montar `<Toaster />` em `apps/web/src/app/layout.tsx`. Migrar admin para usar toasts; deixar páginas legadas (profile, classroom create) com `<Alert>` inline — refatoração separada.

**Por quê:** os fluxos administrativos têm muitas mensagens curtas de sucesso/erro (membro adicionado, role alterado, domínio removido). `<Alert>` inline em cada página fica visualmente poluído. É a menor convenção a introduzir e beneficia o resto do app.

### D6. `requirePlatformAdmin` versus composição com `requireRole`

**Recomendação:** rotas de `/v1/admin/*` (cross-org) usam **só** `requirePlatformAdmin`. Rotas existentes de `/v1/organizations/:id/*` (escopo de org) continuam com `requireRole` + checagem de `activeOrganizationId === params.id`.

**Por quê:** compor os dois força o platform admin a estar logado em alguma org específica para operar nela, derrubando o ponto de ter um admin global. Para ações de admin global em uma org específica (ex: adicionar membro a outra org), criamos rotas espelhadas dedicadas (ex: `POST /v1/admin/organizations/:id/members`) que pulam a checagem de active-org.

---

## 4. Arquitetura: peças transversais

### 4.1. Better Auth — extensões

**Arquivo:** `packages/infra/src/auth/index.ts`

```ts
// 1. Adicionar isPlatformAdmin em additionalFields (input: false impede self-promote)
user: {
  additionalFields: {
    isActive:        { type: "boolean", defaultValue: true,  required: false },
    deletedAt:       { type: "date",                          required: false },
    isPlatformAdmin: { type: "boolean", defaultValue: false, required: false, input: false },
  },
},

// 2. Hook do #65 — top-level, não dentro de plugins
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        // ver §9 (Fase 5)
      },
    },
  },
},
```

**Arquivo:** `packages/infra/src/auth/client.ts` — adicionar `inferAdditionalFields` para tipar o campo no client:

```ts
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./index";

createAuthClient({
  baseURL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient({ ac, roles: { ... } }),
  ],
});
```

**Gotcha — cookie cache:** `cookieCache.maxAge=300s`. Após `PATCH /v1/users/:id/platform-admin`, a sessão do alvo só reflete o novo valor após o TTL. Mitigação: revogar sessões com `db.delete(session).where(eq(session.userId, id))` na própria rota.

### 4.2. Schema — adições

**Arquivo:** `packages/infra/src/db/schema/auth.ts`

```ts
// user (após linha 16)
isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),

// organization (no objeto da tabela)
isActive: boolean("is_active").notNull().default(true),
updatedAt: timestamp("updated_at").notNull().defaultNow(),  // alinhar com BA org plugin
```

**Indexes a adicionar em `member`** (atualmente sem nenhum):

```ts
export const member = pgTable(
  "member",
  { /* ... */ },
  (table) => [
    uniqueIndex("member_org_user_idx").on(table.organizationId, table.userId),
    index("member_user_idx").on(table.userId),
  ]
);
```

**Pré-checagem antes de gerar a migration:**

```sql
SELECT organization_id, user_id, COUNT(*)
FROM member
GROUP BY 1,2
HAVING COUNT(*) > 1;
```

Se retornar linhas, deduplicar antes de aplicar o UNIQUE.

**Arquivo novo:** `packages/infra/src/db/schema/email-domains.ts`

```ts
import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const organizationEmailDomain = pgTable(
  "organization_email_domain",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_email_domain_domain_role_idx").on(table.domain, table.role),
    index("organization_email_domain_org_idx").on(table.organizationId),
  ]
);

export type OrganizationEmailDomain = typeof organizationEmailDomain.$inferSelect;
export type NewOrganizationEmailDomain = typeof organizationEmailDomain.$inferInsert;
```

**`packages/infra/src/db/schema/index.ts`** — adicionar `export * from "./email-domains";`.

### 4.3. Middleware `requirePlatformAdmin`

**Arquivo:** `apps/api/src/http/middlewares/authorization.ts` (estender, não criar arquivo novo).

```ts
export function requirePlatformAdmin() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false as const,
        message: "Not authenticated",
      });
    }
    if (!request.user.isPlatformAdmin) {
      return reply.status(403).send({
        success: false as const,
        message: "Platform admin access required",
      });
    }
  };
}
```

**Propagar `isPlatformAdmin` em `request.user`:**

- `apps/api/src/http/middlewares/auth.ts:34-47` — incluir a coluna no `db.select(...)`
- `apps/api/src/http/@types/fastify.d.ts:5-22` — adicionar `isPlatformAdmin: boolean` ao tipo `AuthUser`

### 4.4. Frontend — gates e navegação

**Arquivo:** `apps/web/src/contexts/UserContext.tsx:19-29` — adicionar `isPlatformAdmin: boolean` ao `User`.

**Arquivo novo:** `apps/web/src/components/guards/PlatformAdminGuard.tsx` — espelho de `RoleGuard.tsx`:

```tsx
"use client";
import { useUser } from "@/contexts/UserContext";

export function PlatformAdminGuard({
  children,
  fallback = null,
}: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { user, isLoading } = useUser();
  if (isLoading) return null;
  if (!user?.isPlatformAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
```

**Arquivo:** `apps/web/src/app/(inside)/_components/navbar.tsx` — adicionar link "Admin" envolto em `<PlatformAdminGuard>`.

**Arquivo novo:** `apps/web/src/app/(inside)/admin/layout.tsx` — gate em layout, com `<AccessDenied>` (espelho do padrão em `classrooms/create/page.tsx:30-42`).

### 4.5. Componentes UI ausentes — instalar via shadcn CLI

Antes da Fase 2, rodar:

```bash
cd apps/web
npx shadcn@latest add dialog dropdown-menu command tooltip sonner
# data-table: implementar manualmente sobre TanStack Table (ou postergar para um wrapper simples)
```

Depois, montar `<Toaster richColors />` em `apps/web/src/app/layout.tsx` (root).

### 4.6. Variáveis de ambiente

**Arquivo:** `packages/infra/src/env.ts`

```ts
PLATFORM_ADMIN_EMAIL: z.string().email().optional(),
PLATFORM_ADMIN_PASSWORD: z.string().min(12).optional(),
PLATFORM_ADMIN_NAME: z.string().min(2).optional(),
```

Todas opcionais — o seed só cria o admin se as 3 estiverem definidas; senão loga warning e pula.

**`.env.example`** — adicionar as 3 com placeholders + comentário explicando que rodar `db:seed` sem elas resulta em skip.

### 4.7. Dependências a adicionar

| Pacote | Onde | Por quê |
|---|---|---|
| `csv-parse` | `apps/api` | Parse do CSV (#64). API síncrona via `csv-parse/sync`. |
| `sonner` | `apps/web` | Toast (D5). |
| Componentes shadcn | `apps/web` | Dialog, DropdownMenu, Command, Tooltip (§4.5). |

---

## 5. Fase 0 — Fundações

> Não fecha issue diretamente; é o pré-requisito de #61–#65. Sai junto da Fase 1 num único PR para evitar merge conflicts.

**Checklist:**

- [ ] Adicionar `csv-parse` em `apps/api/package.json` e `sonner` em `apps/web/package.json`
- [ ] Instalar componentes shadcn faltantes (Dialog, DropdownMenu, Command, Tooltip)
- [ ] Montar `<Toaster richColors />` em `apps/web/src/app/layout.tsx`
- [ ] Estender schema (§4.2): `isPlatformAdmin`, `organization.isActive`/`updatedAt`, indexes em `member`, novo arquivo `email-domains.ts`
- [ ] Re-exportar em `schema/index.ts`
- [ ] Estender `auth/index.ts`: `additionalFields.isPlatformAdmin` (com `input: false`)
- [ ] Estender `auth/client.ts`: adicionar `inferAdditionalFields<typeof auth>()`
- [ ] Adicionar 3 envs admin em `env.ts` + `.env.example`
- [ ] Estender `apps/api/src/http/middlewares/auth.ts` para selecionar `isPlatformAdmin` e popular em `request.user`
- [ ] Atualizar `fastify.d.ts` com o novo campo
- [ ] Criar `requirePlatformAdmin` em `authorization.ts`
- [ ] Criar `PlatformAdminGuard.tsx`
- [ ] Adicionar `isPlatformAdmin` no tipo `User` do `UserContext.tsx`
- [ ] Adicionar campo no response de `GET /v1/users/me`
- [ ] Pré-checar duplicatas em `member(orgId, userId)` antes da migration
- [ ] `cd packages/infra && npm run db:generate` (lembrete: **nunca** `db:push`)
- [ ] Inspecionar `drizzle/0003_*.sql`
- [ ] `npm run db:migrate`
- [ ] `cd apps/api && npm run kubb` (regenera tipos para o `/me` atualizado)
- [ ] Atualizar `packages/infra/CLAUDE.md` documentando os novos campos

**Critério de aceitação:** type-check passa, lint passa, build passa, app sobe, login existente continua funcionando, `request.user.isPlatformAdmin` está disponível em handlers (testar em algum endpoint existente via log temporário e remover).

---

## 6. Fase 1 — Issue #61: Seed admin

**Arquivo novo:** `packages/infra/src/db/seeds/admin.ts`

```ts
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { user, account } from "../schema/auth";
import { env } from "../../env";

export async function seedPlatformAdmin() {
  if (!env.PLATFORM_ADMIN_EMAIL || !env.PLATFORM_ADMIN_PASSWORD || !env.PLATFORM_ADMIN_NAME) {
    console.warn("[seed:admin] Skipping — PLATFORM_ADMIN_* envs not set");
    return;
  }

  const email = env.PLATFORM_ADMIN_EMAIL.toLowerCase();
  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });

  if (existing) {
    await db.update(user).set({ isPlatformAdmin: true, emailVerified: true, isActive: true })
      .where(eq(user.id, existing.id));
    // Atualiza/insere account credential
    await upsertCredential(existing.id, email, env.PLATFORM_ADMIN_PASSWORD);
    console.log(`[seed:admin] Updated existing platform admin: ${email}`);
    return;
  }

  const userId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    name: env.PLATFORM_ADMIN_NAME,
    email,
    emailVerified: true,
    isActive: true,
    isPlatformAdmin: true,
  });
  await upsertCredential(userId, email, env.PLATFORM_ADMIN_PASSWORD);
  console.log(`[seed:admin] Created platform admin: ${email}`);
}

async function upsertCredential(userId: string, email: string, password: string) {
  const passwordHash = await hashPassword(password);
  const existingAccount = await db.query.account.findFirst({
    where: (a, { and, eq }) => and(eq(a.userId, userId), eq(a.providerId, "credential")),
  });
  if (existingAccount) {
    await db.update(account).set({ password: passwordHash }).where(eq(account.id, existingAccount.id));
  } else {
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: email,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  }
}
```

**Integrar em `seeds/base.ts`** — chamar `seedPlatformAdmin()` no fim. Roda em dev e prod via `npm run db:seed`.

**Idempotência garantida por:**
- Lookup por email (UNIQUE) antes do insert
- Upsert da credential (verificando existência antes)
- Update do hash de senha em re-runs (permite rotação via env)

**Critério de aceitação:**
- `npm run db:seed` executado 2x não duplica usuário nem account
- Login com as credenciais via `POST /v1/auth/sign-in/email` retorna 200 e session válida
- Sessão refletida tem `user.isPlatformAdmin === true`
- Sem env definida, log de skip e nenhum erro
- Documentado em `packages/infra/CLAUDE.md` (seção "Seeds")

---

## 7. Fase 2 — Issue #62: Página admin de organizações

### 7.1. Backend

**Estrutura:** `apps/api/src/http/routes/v1/organizations/` — adicionar arquivos top-level (sem `:id` no prefix).

| Arquivo | Método | Path | Auth | Comportamento |
|---|---|---|---|---|
| `list.ts` | GET | `/v1/organizations` | `requirePlatformAdmin` | Lista paginada (page+perPage, q por nome/slug), com `memberCount` agregado |
| `create.ts` | POST | `/v1/organizations` | `requirePlatformAdmin` | Wrap de `auth.api.createOrganization`; assigna `req.user.id` como criador (vira admin da nova org via `creatorRole`) |
| `getById.ts` | GET | `/v1/organizations/:id` | `requirePlatformAdmin` OR `requireRole("teacher")` na org | Detalhe + counts (membros, domínios) |
| `update.ts` | PUT | `/v1/organizations/:id` | `requirePlatformAdmin` | Atualiza `name`, `slug`, `logo`, `metadata` |
| `deactivate.ts` | PATCH | `/v1/organizations/:id/active` | `requirePlatformAdmin` | Toggle `isActive`. Se `isActive=false`, também `UPDATE session SET active_organization_id=NULL WHERE active_organization_id=:id` (evita sessões zumbi — `session.activeOrganizationId` não tem FK) |

**Schemas Zod inline em cada arquivo**, seguindo `apps/api/src/http/routes/v1/challenges/list.ts:13-43`. Nomes únicos para não conflitar no OpenAPI (ex: `ListOrganizationsQuerySchema`, não `QuerySchema`).

**Tag Swagger:** `organizations` (já existe em `server.ts:91-98`).

**Convenções a seguir:**
- Resposta paginada: `{ data, pagination: { total, page, perPage, totalPages } }`
- Erros: `{ success: false, message, errors? }` via `_responses/types.ts`
- Soft-delete em listagens: filtrar `isNull(organization.deletedAt)` se aplicável (org não tem `deletedAt`, então só `isActive=true` por default — query param `includeInactive` opcional)

**Após:** `cd apps/api && npm run kubb` regenera os hooks.

### 7.2. Frontend

**Layout:**

```
apps/web/src/app/(inside)/admin/
  layout.tsx                              # PlatformAdminGuard + sidebar (Organizações | Usuários)
  page.tsx                                # redirect → /admin/organizations
  _components/
    admin-shell.tsx                       # sidebar
    access-denied.tsx                     # mirror de RoleGuard fallback
  organizations/
    page.tsx                              # tabela paginada + botão "Nova organização"
    _components/
      organizations-table.tsx
      create-organization-dialog.tsx      # ui/dialog + RHF + Zod
    [id]/
      layout.tsx                          # carrega org, renderiza Tabs
      page.tsx                            # redirect → ./members
      settings/
        page.tsx                          # form de edição + toggle active
```

**Padrões (checados na investigação):**
- Form: `react-hook-form` + `@hookform/resolvers/zod` (igual `profile/page.tsx:42-77`)
- Tabela: `ui/table.tsx` (raw shadcn — sem DataTable wrapper hoje); aceitável manter raw, mas considerar criar `components/ui/data-table.tsx` mínimo se for repetido em #63
- Hooks Kubb: `useGetV1Organizations`, `usePostV1Organizations`, `usePutV1OrganizationsId`, `usePatchV1OrganizationsIdActive`
- Toast: `sonner` em `onSuccess`/`onError` das mutations
- Loading: `<Loader2 className="animate-spin" />` igual `explore/page.tsx:132-140`

**Critério de aceitação:**
- Platform admin acessa `/admin/organizations` e vê lista
- Usuário não-platform-admin acessa `/admin/*` e vê AccessDenied
- Criar org cria registro + atribui criador como admin daquela org (efeito do `creatorRole`)
- Editar nome/slug persiste e refresca lista
- Desativar org limpa `session.active_organization_id` dos usuários afetados
- Link "Admin" aparece no Navbar **só** para platform admins
- Build, type-check e lint passam

---

## 8. Fase 3 — Issue #63: Gestão de usuários e papéis

### 8.1. Backend

**Novas rotas em `apps/api/src/http/routes/v1/organizations/members/`:**

| Arquivo | Método | Path | Auth | Comportamento |
|---|---|---|---|---|
| `addExisting.ts` | POST | `/v1/organizations/:id/members` | `requirePlatformAdmin` | Body `{ email, role }`. Busca user existente. Se não existe → 404. Se já é membro → 409. Senão `db.insert(member)` direto (bypassa `membershipLimit` do plugin). |
| `remove.ts` | DELETE | `/v1/organizations/:id/members/:userId` | `requirePlatformAdmin` | Bloqueia remoção do último admin da org (consultar `crud-members.mjs:163-170` para a regra). |
| `move.ts` | POST | `/v1/organizations/:id/members/:userId/move` | `requirePlatformAdmin` | Body `{ toOrganizationId, newRole }`. Transação: delete + insert. |

**Novas rotas em `apps/api/src/http/routes/v1/users/` (módulo a criar se não existir):**

| Arquivo | Método | Path | Auth | Comportamento |
|---|---|---|---|---|
| `search.ts` | GET | `/v1/users` | `requirePlatformAdmin` | Query: `q` (ilike em name/email), `page`, `perPage`. Retorna `id, name, email, isPlatformAdmin, isActive`, e `memberships: [{orgId, orgName, role}]`. |
| `setPlatformAdmin.ts` | PATCH | `/v1/users/:id/platform-admin` | `requirePlatformAdmin` | Body `{ isPlatformAdmin: boolean }`. **Bloqueia auto-rebaixamento** se for o último platform admin. **Revoga sessões do alvo** após mudança (`db.delete(session).where(eq(session.userId, id))`). |

**Atualizar:**
- `apps/api/src/http/routes/v1/organizations/members/list.ts:35` — adicionar suporte a chamada por platform admin (skip da checagem `req.user.activeOrganizationId === params.id` se `isPlatformAdmin`)

### 8.2. Frontend

**Adições:**

```
apps/web/src/app/(inside)/admin/
  organizations/[id]/
    members/
      page.tsx                            # tabela + actions
      _components/
        members-table.tsx
        member-row-actions.tsx            # ui/dropdown-menu (alterar role, mover, remover)
        link-existing-user-dialog.tsx     # ui/command para buscar user por email
        move-user-dialog.tsx              # select de org destino + role
  users/
    page.tsx                              # busca global + tabela
    _components/
      users-search.tsx                    # ui/command-style (debounced)
      users-table.tsx
      toggle-platform-admin-cell.tsx      # AlertDialog para confirmar
```

**Critério de aceitação:**
- Platform admin lista membros de qualquer org sem ser membro dela
- Alterar role na linha funciona e atualiza inline
- Mover usuário entre orgs faz delete+insert atômico (verificar com query manual após)
- Toggle de platform admin revoga sessão do alvo (verificar com login forçado a re-autenticar)
- "Último platform admin" não pode rebaixar a si mesmo (UI desabilita + API bloqueia)
- "Último admin de org" não pode ser removido (mensagem clara)

---

## 9. Fase 4 — Issue #64: Importação CSV

### 9.1. Backend

**Arquivo novo:** `apps/api/src/http/routes/v1/organizations/members/importCsv.ts`

**Especificação:**

- Método: `POST /v1/organizations/:id/members/import-csv`
- Auth: `requirePlatformAdmin` OR `requireRole("coordinator")` na org
- Multipart: `await request.file()` (já configurado em `server.ts:54-59`, limite 10 MB)
- Limite efetivo: 1 MB / 500 linhas (validar manualmente após parse)
- Cabeçalho obrigatório: `name,email,password,role`
- Parser: `csv-parse/sync` com `{ columns: true, skip_empty_lines: true, trim: true }`

**Pipeline:**

```ts
1. Parse → array de objetos
2. Validação por linha (Zod):
   - email: válido + lowercase
   - role: ∈ {student, teacher, coordinator, admin}
   - password: min 12 chars
3. Lookup existente:
   - User existe? (email)
   - User é membro desta org? (member.organizationId + userId)
4. Categorizar:
   - "create": user novo → cria user + account + member
   - "link":  user existe + não é membro → cria só member (regra explícita; conflito se já era membro de outra org com role conflitante? deixar passar)
   - "skip":  user já é membro → ignora
   - "error": validação falhou
5. Em transação Drizzle, processar todos "create" + "link":
   - hashPassword via better-auth/crypto
   - db.insert direto (bypassa membershipLimit do plugin)
6. Retornar relatório:
   {
     summary: { total, created, linked, skipped, errors },
     rows: [{ line, email, status: "created"|"linked"|"skipped"|"error", message? }]
   }
```

**Schema de resposta:**

```ts
const ImportCsvResponseSchema = ResponseSchema200.extend({
  data: z.object({
    summary: z.object({
      total: z.number(),
      created: z.number(),
      linked: z.number(),
      skipped: z.number(),
      errors: z.number(),
    }),
    rows: z.array(z.object({
      line: z.number(),
      email: z.string(),
      status: z.enum(["created", "linked", "skipped", "error"]),
      message: z.string().optional(),
    })),
  }),
});
```

### 9.2. Frontend

**Arquivo novo:** `csv-import-dialog.tsx` na pasta de members.

**Fluxo UX (3 estados):**

1. **Upload** — drag&drop ou input file. Valida client-side: extensão `.csv`, tamanho ≤ 1 MB.
2. **Prévia** — após `POST .../import-csv?dryRun=true` (adicionar query param que **valida mas não insere**), exibir tabela com primeiras 50 linhas e badges de status. Botão "Confirmar" só habilita se há linhas válidas.
3. **Resultado** — após `POST` real, mostrar `summary` + `rows` (filtros por status). Toast de sucesso.

**Template CSV:** servir como link estático em `apps/web/public/templates/users-import.csv`.

**Critério de aceitação:**
- CSV de 100 linhas processa em &lt;3s
- Linhas inválidas não bloqueiam o batch das válidas
- Re-upload do mesmo CSV não duplica (linhas já-membro viram "skipped")
- Senha no CSV gera hash compatível com Better Auth (login via API funciona)
- Relatório por linha legível e baixável (CSV ou JSON)

---

## 10. Fase 5 — Issue #65: Domínios automáticos

### 10.1. Backend

**Novas rotas em `apps/api/src/http/routes/v1/organizations/email-domains/` (módulo novo):**

| Arquivo | Método | Path | Auth | Comportamento |
|---|---|---|---|---|
| `list.ts` | GET | `/v1/organizations/:id/email-domains` | `requirePlatformAdmin` OR `requireRole("coordinator")` | Lista domínios da org |
| `create.ts` | POST | `/v1/organizations/:id/email-domains` | mesmo | Body `{ domain, role }`. Normaliza domain para lowercase. UNIQUE(domain, role) global → 409 com mensagem. |
| `delete.ts` | DELETE | `/v1/organizations/:id/email-domains/:domainId` | mesmo | Hard delete |

**Tag OpenAPI:** `organizations` (mantém junto) ou `email-domains` (separar). Decisão: **`organizations`** (não polui o Swagger UI com mais uma seção).

**Hook do auto-vínculo** em `packages/infra/src/auth/index.ts`:

```ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        try {
          const domain = user.email.split("@")[1]?.toLowerCase();
          if (!domain) return;

          const rules = await db.select()
            .from(organizationEmailDomain)
            .where(eq(organizationEmailDomain.domain, domain));

          if (rules.length === 0) return;

          // Se múltiplas rules (mesmo domain, roles diferentes), prioridade:
          // student < teacher < coordinator < admin (mais permissivo ganha)
          // ou regra explícita: pegar a primeira em ordem de createdAt.
          // Recomendação: pegar a primeira (createdAt asc) — comportamento previsível.
          const rule = rules.sort((a, b) => +a.createdAt - +b.createdAt)[0];

          await db.insert(member).values({
            id: crypto.randomUUID(),
            userId: user.id,
            organizationId: rule.organizationId,
            role: rule.role,
            createdAt: new Date(),
          });
        } catch (err) {
          console.error("[user.create.after] domain auto-assign failed", err);
          // Não relança — vamos preferir cadastro funcionar com vínculo manual depois
          // a quebrar o signup inteiro por uma regra mal-configurada.
        }
      },
    },
  },
},
```

**Decisão de regra para múltiplos roles no mesmo domain:** primeira `createdAt` ASC. Documentar.

**Pitfalls confirmados na investigação:**
- Inserir em `member` direto via Drizzle **bypassa** `organizationHooks.beforeAddMember/afterAddMember` do plugin — ok, é o que queremos (não queremos disparar emails).
- Hook recebe `user` já completo. Roda **dentro da transação do create do user** — se levantar exceção, o cadastro inteiro reverte. Por isso o `try/catch`.
- O `context` pode ser `null` quando o hook é chamado fora de uma request HTTP — não dereferenciar `context.headers`.

### 10.2. Frontend

**Adição:**

```
apps/web/src/app/(inside)/admin/organizations/[id]/
  domains/
    page.tsx                              # lista + form de adição
    _components/
      domains-table.tsx
      add-domain-form.tsx                 # input domain + select role
```

**Critério de aceitação:**
- Coordenador da org adiciona domínio + role e vê na lista
- Conflito UNIQUE retorna 409 com mensagem "Este domínio já está em uso por outra organização"
- Novo signup com email matching faz vínculo automático em `member` (verificar via UI da org)
- Signup com email sem matching continua normal (sem `member`, vai para fluxo de "sem organização" do #66 — fora deste plano)
- Erro no hook não quebra signup (logado, usuário vai sem vínculo)
- Deletar domínio não remove membros já criados (apenas para de criar novos)

---

## 11. Riscos e gotchas (consolidado da investigação)

| Risco | Origem | Mitigação |
|---|---|---|
| Cookie cache 5min mascara mudança de `isPlatformAdmin` | `auth/index.ts:103` (`cookieCache.maxAge=300`) | Revogar sessões do alvo na rota `setPlatformAdmin` |
| `removeMember` espera `memberIdOrEmail`, não `userId` | `crud-members.mjs:109-200` | Em #63, **não** chamar `auth.api.removeMember`; usar Drizzle direto |
| `auth.api.createUser` não existe (precisaria do plugin admin) | inspeção do `node_modules` | Seed via Drizzle direto (já é o que fazemos) |
| Inserir em `member` via `auth.api.addMember` enforce `membershipLimit=100` | `crud-members.mjs:63-67` | CSV (#64) e hook (#65) usam Drizzle direto |
| Hook `user.create.after` que lança quebra signup | `init-options.d.mts:1050-1093` | `try/catch` no hook |
| `organization` table não tem `updatedAt` | `auth.ts:67-74` | Adicionar na Fase 0 (`updatedAt: timestamp().notNull().defaultNow()`) |
| `session.activeOrganizationId` não é FK — orphan possível | `auth.ts:32` | Em `deactivate.ts` (#62), `UPDATE session SET active_organization_id=NULL` |
| Member sem unique (org_id, user_id) — duplicatas possíveis | inspeção do schema | Pré-checar com SQL antes de aplicar UNIQUE; bloquear na route se já é membro |
| `inferAdditionalFields` não está no client | `client.ts:14-29` | Adicionar na Fase 0 (sem ele, `isPlatformAdmin` chega untyped) |
| `creatorRole: "admin"` (não `"owner"`) confunde regra "último creator" | `index.ts:133` + `crud-members.mjs:163-170` | Documentar; bloquear remoção do último `role="admin"` na própria UI |
| MCP `better-auth` retornou Unauthorized durante a investigação | — | Fontes citadas vêm do `node_modules/better-auth/dist`. Validar em runtime se algo for inesperado. |

---

## 12. Sequenciamento e PRs

```
PR #1 — feat(infra): admin bootstrap foundations + seed
        └─ Fase 0 (schema, middleware, types, deps, env, hooks-prep)
        └─ Fase 1 (#61 admin seed)

PR #2 — feat(api,web): admin organizations page (#62)
        └─ Fase 2

PR #3 — feat(api,web): user/role management (#63)
        └─ Fase 3

PR #4 — feat(api,web): csv user import (#64)
        └─ Fase 4

PR #5 — feat(api,web): email domain auto-assign (#65)
        └─ Fase 5

PR #6 (opcional) — refactor(web): introduce data-table primitive
        └─ Se ficar repetitivo nas Fases 2/3
```

**Regras:**
- Cada PR fecha 1 issue (PR #1 fecha #61). Linkar na descrição.
- PR #1 é o maior; revisão crítica antes do merge porque é base de tudo.
- PR #2–#5 são paralelizáveis depois do #1, mas o front consome hooks Kubb gerados pelo back, então abrir back primeiro e back+front juntos no mesmo PR é o caminho mais ergonômico.
- Cada PR roda `npm run kubb` se mexer em rota nova/alterada e commita os arquivos gerados (fluxo já estabelecido no projeto).

**Estimativa grosseira (coding solo, foco):**

| PR | Estimativa |
|---|---|
| #1 (Fase 0+1) | 1.5 dia |
| #2 (#62) | 1 dia |
| #3 (#63) | 1.5 dia |
| #4 (#64) | 1 dia |
| #5 (#65) | 0.5 dia |
| **Total** | **~5.5 dias** |

---

## 13. Critérios de aceitação globais

- [ ] Type-check e lint passam em `apps/api`, `apps/web`, `packages/infra`
- [ ] `npm run db:generate` não detecta drift após mergear todos os PRs
- [ ] Seed `npm run db:seed` cria/atualiza admin idempotentemente
- [ ] Login do platform admin funciona e a sessão expõe `isPlatformAdmin: true`
- [ ] Não-platform-admin redirecionado/bloqueado em `/admin/*` (UI + API)
- [ ] CSV de 100 linhas processa &lt;3s e retorna relatório completo
- [ ] Signup com email matching domínio cria `member` automaticamente
- [ ] Documentação atualizada: `packages/infra/CLAUDE.md` (seeds, schema), `apps/api/CLAUDE.md` (rotas admin), `apps/web/src/app/CLAUDE.md` (área admin)
- [ ] `.env.example` atualizado com as 3 envs admin
- [ ] Issue #75 (documentar modelo operacional) recebe um update com link para este plano (cobre boa parte do escopo dela)

---

## 14. Pontos abertos — preciso de confirmação antes de começar

1. **D1** — Confirma `isPlatformAdmin` como custom field (rejeita o plugin `admin`)?
2. **D2** — CSV best-effort (não atômico) ok?
3. **D3** — `UNIQUE(domain, role)` global ok? (Não permite mesmo domínio em 2 orgs)
4. **D4** — CSV síncrono limite 500 linhas ok?
5. **D5** — Posso instalar `sonner` agora e migrar admin para toast?
6. **D6** — `requirePlatformAdmin` sem composição com `requireRole` ok?

Adicional:
7. **Issue #73** (revisar permissões) — vamos coordenar para que `requirePlatformAdmin` saia já alinhada com o que ela propõe?
8. **Documentação** — abrir um issue separado linkado ao #75 ou já consolidar parte do que esse plano cobre dentro de #75?

---

## 15. Anexos — investigações detalhadas

Os 4 relatórios de investigação que embasam este plano (Better Auth, Backend API, Frontend, Schema) estão arquivados nas notas da PR #1 quando ela for aberta. Pontos relevantes já foram destilados aqui; quem quiser ver as citações cruzadas ao código (com `path:line`) consulta os transcripts dos sub-agentes ou a issue de tracking.
