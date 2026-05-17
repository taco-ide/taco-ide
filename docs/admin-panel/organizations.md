# Organizations — Admin Panel

Documentação completa do CRUD de organizações no Admin Panel do TACO-IDE. Cobre listagem, criação, edição e ativação/desativação. Membros, domínios, convites e importação por CSV têm documentos próprios.

Documentos relacionados:

- `members-and-roles.md` — membros e papéis dentro da organização
- `email-domains.md` — domínios de e-mail para auto-vínculo
- `invitations.md` — convites por e-mail
- `csv-import.md` — importação em massa via CSV

---

## 1. Visão geral

Organização é a unidade de tenancy. Cada turma, desafio, membro, domínio e convite pertence a uma organização. CRUD é restrito a **platform admins**.

Baseado no plugin de organização do Better Auth com extensões TACO:

- `isActive` permite **soft-deactivation** sem apagar dados.
- Counters (`memberCount`, `classroomCount`, `domainCount`) são calculados via subquery correlacionada, não persistidos.

UI: `apps/web/src/app/(inside)/admin/organizations/`.

---

## 2. Estrutura de dados

Tabela `organization` (`packages/infra/src/db/schema/auth.ts`):

| Campo        | Tipo        | Obrigatório | Notas |
|--------------|-------------|-------------|-------|
| `id`         | `text` (PK) | Sim         | Gerado pelo Better Auth (não é UUID estrito) |
| `name`       | `text`      | Sim         | Nome de exibição; 1–120 chars |
| `slug`       | `text`      | Sim, único  | 1–60 chars, regex `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, persistido em lowercase |
| `logo`       | `text`      | Não         | URL absoluta para PNG/SVG quadrado |
| `metadata`   | `text`      | Não         | Texto livre (uso interno) |
| `isActive`   | `boolean`   | Sim         | Default `true`; `false` desativa a org |
| `createdAt`  | `timestamp` | Sim         | Default `now()` |
| `updatedAt`  | `timestamp` | Sim         | Atualizado em cada PUT/PATCH |

Counters retornados pela API (não são colunas):

| Campo            | Definição |
|------------------|-----------|
| `memberCount`    | `count(*)` em `member` onde `organization_id = organization.id` |
| `classroomCount` | `count(*)` em `classroom` onde `organization_id = organization.id AND deleted_at IS NULL` |
| `domainCount`    | `count(*)` em `organization_email_domain` (apenas em `getById`) |

> Implementação: subqueries usam referências literais `member.organization_id = organization.id` em vez de interpolar `${member.organizationId}`. Interpolação em `sql\`\`` emite apenas o nome bare da coluna, que colidiria com a tabela interna do subquery e zeraria o count. Fix: commit `e610aaef`.

---

## 3. Permissões resumidas

| Ação                          | Quem pode | Como é verificado |
|-------------------------------|-----------|-------------------|
| `GET /v1/organizations`       | Platform admin | `requirePlatformAdmin()` |
| `GET /v1/organizations/:id`   | Platform admin **ou** membro da org | `platformAdminOrMember` (`getById.ts`) |
| `POST /v1/organizations`      | Platform admin | `requirePlatformAdmin()` |
| `PUT /v1/organizations/:id`   | Platform admin | `requirePlatformAdmin()` |
| `PATCH /v1/organizations/:id/active` | Platform admin | `requirePlatformAdmin()` |

`isPlatformAdmin` é um campo cross-organization em `user`, separado de `member.role`. Definido como additional field do Better Auth com `input: false` (impede self-promotion). Sem sessão → **401**; sessão sem privilégio → **403**.

---

## 4. Endpoints

Todas as respostas seguem o envelope padrão da API:

```json
{ "success": true, "data": { /* ... */ } }
{ "success": false, "message": "..." }
```

### 4.1 `GET /v1/organizations` — listagem

Lista paginada de organizações com counters. Hide-by-default para inativas.

Querystring (schema `.strict()`):

| Campo             | Tipo    | Default | Notas |
|-------------------|---------|---------|-------|
| `page`            | number  | `1`     | `>= 1` |
| `perPage`         | number  | `20`    | `1–100` |
| `q`               | string  | —       | Busca por `ilike` em `name` ou `slug` |
| `includeInactive` | boolean | `false` | Quando `false`, filtra `isActive = true` |

Ordenação: `createdAt DESC`.

Resposta `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "org_abc123",
      "name": "Instituto Federal de São Paulo",
      "slug": "ifsp",
      "logo": null,
      "isActive": true,
      "createdAt": "2026-04-12T19:30:00.000Z",
      "memberCount": 42,
      "classroomCount": 7
    }
  ],
  "pagination": { "total": 8, "page": 1, "perPage": 20, "totalPages": 1 }
}
```

Erros: `401`, `403`.

### 4.2 `GET /v1/organizations/:id` — detalhe

Retorna uma organização específica com `memberCount`, `classroomCount` e `domainCount` em uma única query.

Resposta `200`:

```json
{
  "success": true,
  "data": {
    "id": "org_abc123",
    "name": "Instituto Federal de São Paulo",
    "slug": "ifsp",
    "logo": null,
    "metadata": null,
    "isActive": true,
    "createdAt": "2026-04-12T19:30:00.000Z",
    "updatedAt": "2026-05-10T11:08:21.000Z",
    "memberCount": 42,
    "classroomCount": 7,
    "domainCount": 2
  }
}
```

Erros: `401`, `403` (não é admin nem membro), `404`.

### 4.3 `POST /v1/organizations` — criar

Body schema (`.strict()` — campos extras retornam `400`):

| Campo  | Tipo   | Obrigatório | Validação |
|--------|--------|-------------|-----------|
| `name` | string | Sim         | `min 1, max 120` |
| `slug` | string | Sim         | `min 1, max 60`, regex `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, normalizado para lowercase |
| `logo` | string | Não         | URL válida |

Fluxo:

1. Pré-check: se o `slug` já existe, retorna **409**.
2. Transação: insere `organization` (id via `randomUUID()`, `isActive=true`) e insere `member` vinculando o platform admin chamador como `role="admin"` (preserva `creatorRole=admin` do Better Auth).
3. Fallback: unique violation (`PostgreSQL 23505`) também retorna **409** (race condition).

Resposta `201` retorna `{ id, name, slug, logo, isActive, createdAt }`.

Erros: `400` (validação Zod, incluindo campo extra), `401`, `403`, `409`.

### 4.4 `PUT /v1/organizations/:id` — editar

Body schema (`.strict()` + `refine` exigindo ao menos um campo):

| Campo      | Tipo            | Notas |
|------------|-----------------|-------|
| `name`     | string opcional | `min 1, max 120` |
| `slug`     | string opcional | mesma regex/length do create |
| `logo`     | `string \| null` opcional | URL válida ou `null` para limpar |
| `metadata` | `string \| null` opcional | texto livre ou `null` |

Regras:

- Ao menos um campo precisa estar presente; caso contrário, **400**.
- Slug enviado é checado contra `slug = $1 AND id != :id`. Conflito → **409**.
- `updatedAt` é atualizado sempre.

Resposta `200` retorna `{ id, name, slug, logo, metadata, isActive, updatedAt }`.

Erros: `400`, `401`, `403`, `404`, `409`.

### 4.5 `PATCH /v1/organizations/:id/active` — ativar/desativar

Body schema (`.strict()`):

| Campo      | Tipo    | Obrigatório |
|------------|---------|-------------|
| `isActive` | boolean | Sim         |

Fluxo:

1. Se não existe, **404**.
2. Se `existing.isActive === isActive`, no-op: retorna `200` com `clearedSessions: 0` e `canceledInvitations: 0` sem transação.
3. Transação: atualiza `isActive` e `updatedAt`; se desativando, executa `UPDATE session SET active_organization_id = NULL` em todas as sessions que apontavam para esta org e, na mesma transação, marca todas as `invitation` da org com `status = 'pending'` como `canceled`. `clearedSessions` e `canceledInvitations` são os `rowCount` de cada update.
4. Reativar **não** restaura o `activeOrganizationId` das sessões nem reabre convites cancelados (estados terminais não voltam).

Resposta `200`: `{ id, isActive, clearedSessions, canceledInvitations }`.

Erros: `400`, `401`, `403`, `404`.

---

## 5. UI

UI em `apps/web/src/app/(inside)/admin/organizations/`.

### 5.1 Listagem (`/admin/organizations`)

`page.tsx` + `_components/organizations-table.tsx`.

- Colunas: Organização (avatar + nome + slug), Status, Membros, Turmas, Criada em, Ações.
- Busca por nome/slug com debounce 250 ms (envia `q`).
- Filtro segmentado **Todas** / **Ativas** / **Inativas**:
  - `Ativas`: `includeInactive=false` (default).
  - `Todas`: `includeInactive=true`.
  - `Inativas`: `includeInactive=true` + filtro client-side. O pager é **escondido** porque o total não reflete o universo completo nesse modo.
- Ações por linha: Ver (`/admin/organizations/:id`), Editar (dialog), Desativar/Reativar (toggle inline).
- Botão **Nova organização** abre o dialog de criação.

### 5.2 Criar (`CreateOrganizationDialog`)

`_components/create-organization-dialog.tsx`. Aberto pelo botão **Nova organização**. Usa `OrganizationFormFields` com `autoSlug={true}`.

Auto-geração do slug via `slugify(name)`: lowercase, NFD para remover acentos, sequências de não-alfanuméricos viram `-`, hífens no começo/fim são removidos.

**Regra crítica**: o slug só é re-gerado **enquanto `dirtyFields.slug === false`**. Quando o usuário toca no campo, `dirtyFields.slug` vira `true` e a auto-geração para — alterações em `name` não sobrescrevem mais o slug digitado.

Em erro **409**, usa `form.setError("slug", ...)` para mensagem inline focada no campo (sem toast). Outros erros caem em `toast.error`.

### 5.3 Editar (`EditOrganizationDialog`)

`_components/edit-organization-dialog.tsx`. Aberto pelo ícone de lápis. Reaproveita `OrganizationFormFields` **sem** `autoSlug` (slug nunca é re-gerado na edição). Reseta com os valores atuais quando `open && org` mudam. Envia `name`, `slug` e `logo` (string ou `null` quando vazia) via `PUT /v1/organizations/:id`. Mesma estratégia para **409**: erro inline no campo `slug`.

### 5.4 Form fields (`OrganizationFormFields`)

`_components/organization-form-fields.tsx`. Schema cliente:

| Campo | Validação cliente |
|-------|-------------------|
| `name` | `min 2`, `max 120` |
| `slug` | `min 1`, `max 60`, regex `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` |
| `logo` | URL válida, `max 500` ou string vazia |

Note que o cliente exige `name` com `min 2` enquanto a API aceita `min 1` — validação mais restritiva no formulário, mais permissiva no contrato HTTP. O slug é exibido com prefixo `taco.dev/o/` para evidenciar uso em URLs.

---

## 6. Regras de validação do slug

Regex (idêntica em API e UI):

```
^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$
```

- Apenas `a-z`, `0-9` e `-`.
- Não pode começar nem terminar com hífen.
- Comprimento 1–60.
- `create.ts` normaliza para lowercase via `.transform((v) => v.toLowerCase())`. <!-- TODO: update.ts não aplica o mesmo transform; um PUT com maiúsculas (a regex usa flag /i) pode persistir com case original — confirmar comportamento esperado. -->

Válidos: `ifsp`, `escola-tecnica-01`, `usp2026`. Inválidos: `-ifsp`, `ifsp-`, `IF SP`, `ifsp_demo`.

---

## 7. Códigos de erro comuns

| Código | Quando ocorre |
|--------|---------------|
| `400`  | Body inválido (Zod): tipo errado, campo faltando, regex de slug não bate, ou **campo extra rejeitado pelo `.strict()`**. No update, também ocorre quando nenhum campo é enviado. |
| `401`  | Sem sessão / cookie ausente / token expirado |
| `403`  | Sessão válida sem `isPlatformAdmin` (ou, no `getById`, sem membership) |
| `404`  | Org com o `id` informado não existe |
| `409`  | Slug duplicado: pré-check no `create`, conflito de update, ou unique violation (`PostgreSQL 23505`) por race |

---

## 8. Exemplos `curl`

Substitua `<TACO_DEMO_ID>` pelo id real. Assume cookie de sessão de platform admin em `cookies.txt`.

### Criar organização

```bash
curl -X POST http://localhost:3344/v1/organizations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Instituto Federal de São Paulo",
    "slug": "ifsp"
  }'
```

Resposta esperada: `201` com o objeto criado.

### Slug duplicado (esperar 409)

```bash
curl -X POST http://localhost:3344/v1/organizations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "IFSP duplicado",
    "slug": "ifsp"
  }'
```

Resposta esperada:

```json
{ "success": false, "message": "Organization slug already exists" }
```

### Body com campo extra (esperar 400 .strict)

```bash
curl -X POST http://localhost:3344/v1/organizations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Org com hackerField",
    "slug": "org-hackerfield",
    "isPlatformAdmin": true
  }'
```

Resposta esperada: `400` com mensagem do Zod indicando chave não reconhecida (`isPlatformAdmin`).

### Listar com busca e filtro

```bash
curl -G http://localhost:3344/v1/organizations \
  -b cookies.txt \
  --data-urlencode "q=ifsp" \
  --data-urlencode "includeInactive=true" \
  --data-urlencode "page=1" \
  --data-urlencode "perPage=20"
```

### Detalhe da organização

```bash
curl http://localhost:3344/v1/organizations/<TACO_DEMO_ID> \
  -b cookies.txt
```

### Editar nome e slug

```bash
curl -X PUT http://localhost:3344/v1/organizations/<TACO_DEMO_ID> \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "IFSP — Campus São Paulo",
    "slug": "ifsp-sp"
  }'
```

### Desativar

```bash
curl -X PATCH http://localhost:3344/v1/organizations/<TACO_DEMO_ID>/active \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "isActive": false }'
```

Resposta esperada: `200` com `clearedSessions` (quantas sessões tiveram `activeOrganizationId` limpo) e `canceledInvitations` (quantos convites pendentes foram marcados como `canceled`).

### Reativar

```bash
curl -X PATCH http://localhost:3344/v1/organizations/<TACO_DEMO_ID>/active \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "isActive": true }'
```

---

## 9. Efeito de desativação em sessões e membros

Ao **desativar** (`isActive=false`):

- Org **não é apagada**. `member`, `classroom`, `invitation`, `organizationEmailDomain`, `challenge`, `knowledgeBase` permanecem intactos.
- Para cada `session` cujo `activeOrganizationId` aponta para esta org, a coluna é setada para `NULL` em um único `UPDATE` na mesma transação. `clearedSessions` é o rowCount.
- **Sem revogação de sessão**: usuário continua logado, mas perde o contexto de "org ativa" e precisa re-selecionar na próxima navegação. <!-- TODO: confirmar UX do seletor de org quando activeOrganizationId é NULL. -->
- A org some do filtro `Ativas`; continua visível em `Todas` e `Inativas`.
- Membros e papéis permanecem; ao reativar, voltam a operar normalmente.
- Convites pendentes **são cancelados** (`status = 'canceled'`) na mesma transação. `canceledInvitations` no response retorna a quantidade afetada. Convites já `accepted`/`rejected`/`expired` não são tocados.

Ao **reativar** (`isActive=true`):

- `clearedSessions` retorna `0`.
- `activeOrganizationId` das sessões previamente limpas **não é restaurado**.
- A org volta ao filtro `Ativas`.

No-op: se o estado já é o solicitado, retorna `200` com `clearedSessions: 0` sem transação.
