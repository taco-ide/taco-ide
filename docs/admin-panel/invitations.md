# Convites — Admin Panel

Documentacao do fluxo de convites de membros de organizacao no painel admin do TACO-IDE. Cobre a aba "Convites" da UI, os tres endpoints REST (criar, listar e cancelar), a tabela `invitation` no banco e o disparo de email de convite.

> Escopo: integracao adicionada em `32b61173` (UI + endpoints `GET`/`DELETE`) e fix de idempotencia 409 em `45799967`. As decisoes de papel e dominio que envolvem a aba "Convites" estao em [`organizations.md`](./organizations.md).

---

## 1. Visao geral

Um convite e um registro `invitation` em estado `pending` que permite a uma pessoa entrar em uma organizacao com um papel pre-definido, atraves de um link enviado por email. Caso o convite expire (default 7 dias) ou seja cancelado, o link deixa de funcionar e e necessario criar um novo.

A criacao tem dois caminhos no backend:

1. **Platform Admin** — escreve direto na tabela `invitation` via Drizzle, dentro de uma transacao `SERIALIZABLE` com retry para `40001`. Necessario porque Platform Admins nao precisam ser membros da organizacao alvo e o handler nativo do Better Auth recusaria a chamada.
2. **Coordinator+ da organizacao** — delega para `auth.api.createInvitation` do Better Auth, que ja dispara o hook `sendInvitationEmail` e aplica o RBAC do plugin `organization`.

Ambos os caminhos sao normalizados para retornar **409** em conflitos (convite pendente duplicado ou usuario ja membro), com mensagens estaveis para a UI exibir inline.

---

## 2. Modelo de dados

### 2.1 Tabela `invitation`

Definida em `packages/infra/src/db/schema/auth.ts` (linhas 105-118). E uma tabela do plugin `organization` do Better Auth, mantida com a mesma estrutura para garantir compatibilidade com `auth.api.createInvitation` / `auth.api.acceptInvitation`.

| Coluna           | Tipo        | Notas                                                                 |
| ---------------- | ----------- | --------------------------------------------------------------------- |
| `id`             | `text` PK   | UUID gerado por `randomUUID()` no caminho Platform Admin              |
| `email`          | `text`      | Normalizado para lowercase no caminho Platform Admin                  |
| `inviter_id`     | `text` FK   | `user.id` de quem criou o convite. `ON DELETE CASCADE`                |
| `organization_id`| `text` FK   | `organization.id`. `ON DELETE CASCADE`                                |
| `role`           | `text`      | Papel ao aceitar (`student`, `teacher`, `coordinator`, `admin`)       |
| `status`         | `text`      | Default `"pending"`                                                   |
| `expires_at`     | `timestamp` | TTL de 7 dias a partir da criacao (`INVITATION_TTL_MS`)               |
| `created_at`     | `timestamp` | `defaultNow()`                                                        |

Nao existe `UNIQUE` em `(email, organization_id, status)` no schema atual. A unicidade de convites pendentes e garantida por uma checagem dentro de uma transacao `SERIALIZABLE` + retry. O codigo ja preve queda para `pgCode === "23505"` caso essa constraint seja adicionada no futuro (`create.ts:202`).

### 2.2 Estados

| Status     | Significado                                                              | Origem                              |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `pending`  | Aguardando aceite. Aparece na listagem default da UI.                    | Default ao inserir                  |
| `accepted` | Convite aceito pelo destinatario. Linha permanece para auditoria.        | `auth.api.acceptInvitation`         |
| `rejected` | Convite recusado pelo destinatario.                                      | `auth.api.rejectInvitation`         |
| `canceled` | Cancelado por coordinator+/platform admin via `DELETE`, ou cancelamento em massa quando a organizacao e desativada (`PATCH /v1/organizations/:id/active` com `isActive=false`). | `delete.ts` / `setActive.ts` |
| `expired`  | Passou de `expires_at` sem aceite.                                       | **Lazy expiration**: `GET /v1/organizations/:id/invitations` faz `UPDATE invitation SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()` antes de cada listagem (race-safe via predicate). Nao ha cron job dedicado. |

Transicoes validas (estado atual -> proximo):

- `pending -> accepted` (aceite do usuario)
- `pending -> rejected` (recusa do usuario)
- `pending -> canceled` (admin/coordinator cancela, ou desativacao da organizacao via `PATCH /v1/organizations/:id/active` com `isActive=false` — todos os convites `pending` da org sao marcados como `canceled` na mesma transacao; reativar nao os reabre)
- `pending -> expired` (TTL atingido)

Estados terminais (`accepted`, `rejected`, `canceled`, `expired`) nao sao reabertos — gerar um novo convite cria um novo registro.

---

## 3. Permissoes

| Acao                                | Platform Admin | Coordinator+ da org | Outros |
| ----------------------------------- | -------------- | ------------------- | ------ |
| `POST /v1/organizations/:id/invitations` (criar)        | OK (escrita direta) | OK (Better Auth) | 403 |
| `GET /v1/organizations/:id/invitations` (listar)        | OK             | OK                  | 403    |
| `DELETE /v1/organizations/:id/invitations/:invitationId` (cancelar) | OK (escrita direta) | OK (Better Auth) | 403 |
| `POST /v1/organizations/:id/invitations/:invitationId/resend` (reenviar) | OK | OK | 403 |

Coordinator+ inclui `coordinator` e `admin` (hierarquia em `packages/infra/src/auth/permissions.ts`: `student=0`, `teacher=1`, `coordinator=2`, `admin=3`).

As rotas `GET` e `POST .../resend` usam o middleware `requirePlatformAdminOrOrgRole("coordinator")` que tambem valida a existencia da organizacao (retorna 404 antes do handler se a org nao existe). As rotas `POST` (criar) e `DELETE` fazem a checagem inline com `hasMinimumRole(usr.role, "coordinator")` e tambem exigem que `organizationId === usr.activeOrganizationId` para nao-platform-admins.

---

## 4. Endpoints

### 4.1 `POST /v1/organizations/:id/invitations` — criar

Cria um convite pendente e dispara o email.

**Path params**

| Param | Tipo     | Obrigatorio | Descricao                  |
| ----- | -------- | ----------- | -------------------------- |
| `id`  | `string` | sim         | ID da organizacao alvo     |

**Body** (`application/json`, schema strict)

```json
{
  "email": "pessoa@exemplo.edu.br",
  "role": "teacher"
}
```

| Campo   | Tipo     | Regras                                                                          |
| ------- | -------- | ------------------------------------------------------------------------------- |
| `email` | `string` | `z.string().email()`. Caminho Platform Admin normaliza para lowercase.          |
| `role`  | `enum`   | `student` \| `teacher` \| `coordinator` \| `admin`                              |

> **Nota sobre `role: "admin"`**: convites explicitos podem conceder qualquer papel, inclusive `admin`. Isso difere das regras de auto-link por dominio de email (capadas em `coordinator` — feature F10). Aqui o admin esta selecionando deliberadamente o papel alvo.

**Resposta 201**

```json
{
  "success": true,
  "data": {
    "id": "1f6a...",
    "email": "pessoa@exemplo.edu.br",
    "role": "teacher",
    "status": "pending",
    "expiresAt": "2026-05-23T18:42:11.000Z"
  }
}
```

**Por que dois branches**

| Caso                                   | Mecanismo                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `usr.isPlatformAdmin === true`         | `INSERT INTO invitation ...` direto via Drizzle, dentro de `db.transaction({ isolationLevel: "serializable" })`. Email enviado manualmente via `sendInvitationEmail()`. |
| `usr.role >= coordinator` da org alvo  | `auth.api.createInvitation({ body, headers })` do Better Auth. Email enviado pelo hook `organization.sendInvitationEmail` configurado em `packages/infra/src/auth/index.ts`. |

A separacao existe porque o handler nativo do Better Auth exige que o `inviter` seja membro ativo da organizacao — Platform Admin tipicamente nao e, entao a chamada seria rejeitada com 500.

**Idempotencia 409 (fix `45799967`)**

Ambos os branches mapeiam conflitos para `409`:

| Origem                                                                            | Resposta                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Convite pendente duplicado (mesmo email + org)                                    | `409` `"A pending invitation already exists for this email in this organization."`                      |
| Usuario ja e membro (Better Auth detecta no caminho coordinator+)                 | `409` `"User is already a member of this organization."`                                                |
| Falha PG `23505` (futura UNIQUE em `(email, organization_id, status)`)            | `409` (mesma mensagem do duplicate)                                                                     |
| Outros erros do Better Auth                                                       | Status original do erro, mensagem do `error.body.message`                                               |

**TOCTOU + retry 40001**

No caminho Platform Admin, dois inserts concorrentes para o mesmo `(email, organizationId)` podem ambos passar pelo `SELECT ... WHERE status = 'pending'` antes do `INSERT`. O isolamento `SERIALIZABLE` garante que apenas o primeiro commit tenha sucesso — o segundo levanta `40001` (`serialization_failure`). O codigo:

1. Tenta a transacao.
2. Se `pgCode === "40001"`, aguarda `10–30ms` (jitter) e tenta de novo (ate 5 tentativas, controlado por `maxAttempts`).
3. Na retentativa, o `SELECT` agora ve a linha commitada pelo vencedor e retorna `DUPLICATE_PENDING_INVITATION`, que vira `409` para o cliente.

Codigo em `apps/api/src/http/routes/v1/organizations/invitations/create.ts:175-196`. `maxAttempts = 5`, backoff `10 + Math.random() * 20` ms.

**Expiracao**

`INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7` (7 dias). Aplicado no caminho Platform Admin via `new Date(Date.now() + INVITATION_TTL_MS)`. No caminho Better Auth, o TTL e gerenciado pelo plugin `organization` — atualmente tambem 7 dias por default.

**Codigos de resposta**

| Status | Quando                                                                                       |
| ------ | -------------------------------------------------------------------------------------------- |
| `201`  | Convite criado com sucesso                                                                   |
| `400`  | Body invalido (Zod), `role` invalido, ou erro generico do Better Auth                        |
| `401`  | Sem sessao                                                                                   |
| `403`  | Nao e Platform Admin e nao tem papel >= `coordinator` na org, ou `id` != `activeOrganizationId` |
| `409`  | Convite pendente duplicado, OU usuario ja membro                                              |

### 4.2 `GET /v1/organizations/:id/invitations` — listar

Lista convites da organizacao, paginado e ordenado por `created_at DESC`.

**Path params**: `id` (organizacao).

**Query string** (schema strict)

| Param     | Tipo                  | Default     | Descricao                                                                          |
| --------- | --------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `status`  | `"pending"` \| `"all"` | `"pending"` | `pending` lista somente convites aguardando aceite. `all` inclui todos os estados. |
| `page`    | `number` (int >= 1)   | `1`         | Pagina solicitada (1-indexed).                                                     |
| `perPage` | `number` (int 1..100) | `20`        | Itens por pagina. Capado em 100 para evitar respostas gigantes.                    |

Nomes de parametros (`page` / `perPage`) seguem o mesmo padrao do endpoint `GET /v1/organizations` (`list.ts`) para manter consistencia entre listagens admin.

**Lazy expiration**

Antes do `SELECT` principal, o handler executa um `UPDATE invitation SET status = 'expired' WHERE organization_id = ? AND status = 'pending' AND expires_at < NOW()`. Isso garante que convites cujo TTL ja venceu sejam refletidos como `expired` tanto no resultado da pagina quanto persistentemente no banco — sem precisar de cron job.

A operacao e:

- **Idempotente / race-safe** pelo predicate `status = 'pending'`: apenas o primeiro writer concorrente flipa cada linha; os subsequentes nao tocam nada (a linha ja nao e mais `pending`).
- **Fora de transacao** com o `SELECT`: e um `UPDATE` simples por si so. Nao precisa de atomicidade com a leitura — se outro processo concorrer e adicionar uma linha entre o UPDATE e o SELECT, o pior caso e ela aparecer com status atual (consistente com a janela de tempo da query).

A consequencia direta no comportamento do endpoint: `?status=pending` nunca retorna linhas com `expires_at < NOW()`. Com `?status=all`, essas linhas aparecem com `status: "expired"`.

**Resposta 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "1f6a...",
      "email": "pessoa@exemplo.edu.br",
      "role": "teacher",
      "status": "pending",
      "expiresAt": "2026-05-23T18:42:11.000Z",
      "createdAt": "2026-05-16T18:42:11.000Z",
      "inviterId": "usr_abc",
      "inviterName": "Joana Coord",
      "inviterEmail": "joana@exemplo.edu.br"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "perPage": 20,
    "totalPages": 3
  }
}
```

- `total` reflete o total de linhas que casam com o filtro de `status` (apos a lazy expiration). E calculado via `SELECT count(*)` na mesma WHERE clause do SELECT principal, em paralelo (`Promise.all`).
- `totalPages = max(1, ceil(total / perPage))`.

`inviterName` e `inviterEmail` vem de um `LEFT JOIN` com `user` por `invitation.inviter_id`. Sao `null` se o `inviter` foi removido (a FK e `ON DELETE CASCADE` — entao na pratica o convite tambem some, mas o JOIN e defensivo).

**Permissao**: aplicada pelo `preHandler` `requirePlatformAdminOrOrgRole("coordinator")` em `list.ts`. Retorna 404 se a org nao existe (antes do handler), 403 se o caller nao tem papel >= coordinator e nao e Platform Admin.

### 4.3 `DELETE /v1/organizations/:id/invitations/:invitationId` — cancelar

Marca o convite como `canceled`.

**Path params**

| Param          | Tipo     | Descricao                              |
| -------------- | -------- | -------------------------------------- |
| `id`           | `string` | Organizacao                            |
| `invitationId` | `string` | Convite a cancelar                     |

**Resposta 200**

```json
{
  "success": true,
  "data": {
    "message": "Invitation cancelled successfully"
  }
}
```

**Branches**

- Platform Admin: `UPDATE invitation SET status = 'canceled' WHERE id = ?` direto via Drizzle.
- Coordinator+ da org: delega para `auth.api.cancelInvitation`.

O handler busca o convite primeiro (`SELECT ... WHERE id = ? AND organization_id = ?`) para retornar **404** quando o convite nao pertence a essa organizacao — protege contra IDs adivinhados.

**Codigos de resposta**

| Status | Quando                                                                                       |
| ------ | -------------------------------------------------------------------------------------------- |
| `200`  | Convite cancelado                                                                            |
| `401`  | Sem sessao                                                                                   |
| `403`  | Permissao insuficiente                                                                       |
| `404`  | Convite nao existe ou nao pertence a esta organizacao                                        |
| `400`  | Erro do Better Auth (caminho coordinator+) — mensagem propagada do `error.body.message`      |

### 4.4 `POST /v1/organizations/:id/invitations/:invitationId/resend` — reenviar

Renova o `expires_at` do convite para `NOW() + 7 dias` (`INVITATION_TTL_MS`) e reenvia o email usando `sendInvitationEmail`. **Idempotente**: chamar repetidamente em um convite `pending` apenas estende o TTL e re-dispara o email — nao cria novas linhas. Convites em qualquer estado terminal (`accepted` / `rejected` / `canceled` / `expired`) sao rejeitados com `409`.

**Path params**

| Param          | Tipo     | Descricao                              |
| -------------- | -------- | -------------------------------------- |
| `id`           | `string` | Organizacao                            |
| `invitationId` | `string` | Convite a reenviar                     |

**Body**: nenhum.

**Resposta 200**

```json
{
  "success": true,
  "data": {
    "id": "1f6a...",
    "status": "pending",
    "expiresAt": "2026-05-24T18:42:11.000Z"
  }
}
```

**Fluxo**

1. `requirePlatformAdminOrOrgRole("coordinator")` valida sessao + papel + existencia da org (`404` se a org nao existe).
2. Handler busca o convite por `(id, organization_id)`; retorna `404` se nao encontrado (protege contra IDs adivinhados de outra org).
3. Se `status !== "pending"`, retorna `409` com mensagem `"Cannot resend invitation in status {status}."`.
4. `UPDATE invitation SET expires_at = NOW() + 7d WHERE id = ? AND organization_id = ? AND status = 'pending'` — a clausula `status = 'pending'` defende contra TOCTOU (se outro caller transicionou o convite entre o `SELECT` e o `UPDATE`, o `RETURNING` vem vazio e respondemos `409`).
5. Apos commit, dispara `sendInvitationEmail` fora da transacao (para nao manter lock durante a chamada HTTP ao Resend). Se o envio falhar, o `expires_at` ja foi atualizado e respondemos `500` com mensagem clara — o operador pode reenviar; a UI invalida a lista.

**Helper de autorizacao**: `requirePlatformAdminOrOrgRole("coordinator")` — mesmo padrao da rota `GET`. Diferente das rotas `POST` (criar) e `DELETE`, nao exigimos `organizationId === activeOrganizationId` para nao-platform-admins porque o middleware ja faz a checagem por `membership` no banco (mais robusto contra sessoes desatualizadas).

**Codigos de resposta**

| Status | Quando                                                                                       |
| ------ | -------------------------------------------------------------------------------------------- |
| `200`  | Convite reenviado: `expires_at` atualizado e email despachado                                 |
| `401`  | Sem sessao                                                                                   |
| `403`  | Nao e Platform Admin e nao tem papel >= `coordinator` na org                                  |
| `404`  | Convite nao existe ou nao pertence a esta organizacao (ou org nao existe)                    |
| `409`  | Convite em estado `accepted` / `rejected` / `canceled` / `expired`, ou status mudou em race  |
| `500`  | TTL renovado mas envio de email falhou (registro atualizado, operador pode retentar)         |

**Exemplo curl**

```bash
INV_ID="1f6a..."
curl -i -X POST "$BASE/v1/organizations/$ORG_ID/invitations/$INV_ID/resend" \
  -H "Cookie: $COOKIE"
```

Resposta tipica em sucesso:

```http
HTTP/1.1 200 OK
{"success":true,"data":{"id":"1f6a...","status":"pending","expiresAt":"2026-05-24T18:42:11.000Z"}}
```

Tentando reenviar um convite ja cancelado:

```http
HTTP/1.1 409 Conflict
{"success":false,"message":"Cannot resend invitation in status canceled."}
```

---

## 5. UI

Path: `apps/web/src/app/(inside)/admin/organizations/[id]/invitations/`.

### 5.1 Aba "Convites"

Registrada em `org-tabs-nav.tsx` (linha 14: `{ key: "invitations", label: "Convites", icon: Mail }`). Aparece entre as abas "Membros" e "Dominios" na pagina `/admin/organizations/[id]/invitations`.

A pagina `page.tsx` carrega:

- Detalhes da org via `useGetV1OrganizationsId` (so para exibir o nome).
- Convites pendentes via `useGetV1OrganizationsIdInvitations(orgId, { status: "pending", page, perPage: 20 })`.

A pagina mantem `page` em state local (`useState`). `perPage` e fixo em `20` (constante `PER_PAGE` no topo do `page.tsx`).

> Nota: os parametros `page` / `perPage` ainda nao aparecem no schema Kubb-gerado do hook (`GetV1OrganizationsIdInvitationsQueryParams` so expoe `status`). O `page.tsx` envia o objeto com `as unknown as Parameters<typeof useGetV1OrganizationsIdInvitations>[1]` — o `apiClient` por baixo serializa qualquer chave em `params` como query string, entao a paginacao funciona ja antes da proxima execucao de `npm run kubb`. Apos o regen do Kubb, o cast deixa de ser necessario.

Render:

- Header com titulo "Convites pendentes" + descricao + botao "Novo convite". A descricao inclui o total reportado pelo backend (`{N} no total`).
- Estado de erro: card vermelho com botao "Tentar novamente".
- Estado vazio (zero pendentes na pagina 1): `EmptyState` com icone `Mail`, copy "Nenhum convite pendente" e CTA "Criar primeiro convite".
- Estado normal: `InvitationsTable` + componente `Pager` (`apps/web/src/components/admin/pager.tsx`, mesmo usado em `/admin/organizations`). O `Pager` consome `pagination.{page,perPage,total,totalPages}` e chama `setPage(...)`.

### 5.2 Dialog de criar (`create-invitation-dialog.tsx`)

Campos:

| Campo   | Componente                                                       | Validacao                                                                 |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `email` | `Input type="email"`                                             | `z.string().trim().toLowerCase().email("Email invalido")`                 |
| `role`  | `Select` com opcoes `student`, `teacher`, `coordinator`, `admin` | Default `teacher`. Labels via `getRoleLabel()` (i18n PT-BR)               |

A descricao do dialog informa explicitamente "O convite expira em 7 dias".

**Tratamento de 409 inline**: o handler `onError` da mutacao discrimina entre `duplicate-pending` e `already-a-member` usando regex tolerante (`/ja existe|pending invitation/i` e `/ja[\s\S]*membro|already a member/i`). Cada caso vira `setError(...)` + `toast.error(...)` com copy PT-BR ("Ja existe um convite pendente para este email" / "Este usuario ja e membro da organizacao"). Outros status caem para a mensagem crua do backend.

Em sucesso, invalida a query `getV1OrganizationsIdInvitationsQueryKey(organizationId)` (sem o discriminador de params, para refetchar qualquer filtro de status).

### 5.3 Tabela (`invitations-table.tsx`)

Colunas: Email, Papel (RoleBadge), Expira, Criado em, Acoes.

- Coluna Email mostra tambem "convidado por {inviterName ?? inviterEmail}" abaixo.
- Coluna Expira usa label relativo: `em N min`, `em N h`, `em N d`, ou data formatada se >= 30 dias. Mostra "Expirado" se passou.
- Coluna Acoes tem dois botoes:
  - **Reenviar** (icone `Send`, ambar): dispara `POST /v1/organizations/:id/invitations/:invitationId/resend` direto via `apiClient` (a hook Kubb `usePostV1OrganizationsIdInvitationsInvitationidResend` e gerada na proxima execucao de `npm run kubb`). Estado de loading troca o icone por um `Loader2` enquanto a mutacao roda. Em sucesso: toast `Convite reenviado para "{email}"` + invalidacao da query de listagem. Em `409`: toast com a mensagem do backend (`"Cannot resend invitation in status {status}."`). Em `404`: toast `"Convite nao encontrado. Atualize a lista."` + invalidacao defensiva.
  - **Cancelar** (icone `X`, vermelho): abre um `AlertDialog` de confirmacao "Cancelar convite?".

O confirm dialog de cancelamento tem duas acoes:

- "Manter convite" (`AlertDialogCancel`) — fecha sem cancelar.
- "Sim, cancelar" (`AlertDialogAction`) — dispara `useDeleteV1OrganizationsIdInvitationsInvitationid` com `{ id: organizationId, invitationId }`.

Em sucesso, toast `Convite para "{email}" cancelado` e invalida a query de listagem.

### 5.4 Estado vazio com CTA

Mostrado quando a lista de pendentes esta vazia (e nao houve erro). Mesmo botao "Criar primeiro convite" que abre o dialog.

---

## 6. Email de convite

> Esta secao detalha o disparo de email. Para a configuracao consolidada do transporte de email (Resend, fallback dev, variaveis), veja [`emails.md`](./emails.md). <!-- TODO: criar emails.md se nao existir ainda -->

### 6.1 Quando e disparado

O email e enviado **imediatamente apos** o insert da linha `invitation` retornar com sucesso. Mais especificamente:

- **Caminho Platform Admin**: dentro de um `try/catch` apos o commit da transacao, em `create.ts:220-247`. Falha no envio nao reverte o convite — o registro fica criado, o erro vai para `request.log.error` e o operador pode reenviar manualmente. A resposta 201 e retornada de qualquer forma.
- **Caminho coordinator+**: o Better Auth chama o hook `organization.sendInvitationEmail` configurado em `packages/infra/src/auth/index.ts:155-173`. Esse hook tambem engole erros de envio (`try/catch` com `console.error`) — o convite e considerado criado mesmo se o email falhar.

A funcao usada e a mesma nos dois caminhos: `sendInvitationEmail` em `packages/infra/src/auth/invitation-email.ts`. Isso garante template e comportamento consistentes.

### 6.2 Transport

| Cenario                                        | Comportamento                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `env.RESEND_API_KEY` definido (prod/staging)   | Envia via Resend: `resend.emails.send({ from: env.EMAIL_FROM, to, subject, html })`                |
| `env.RESEND_API_KEY` ausente (dev)             | Stub: imprime no `console.log` o email destino, nome da org, papel, link de aceite e expiracao     |

Variaveis de ambiente envolvidas (`packages/infra/src/env.ts`):

| Variavel           | Default                       | Uso                                                              |
| ------------------ | ----------------------------- | ---------------------------------------------------------------- |
| `RESEND_API_KEY`   | (opcional)                    | Se ausente, ativa o stub de console                              |
| `EMAIL_FROM`       | `noreply@taco-ide.com`        | Header `from` enviado ao Resend                                  |
| `FRONTEND_URL`     | `http://localhost:4001`       | Base do link de aceite: `{FRONTEND_URL}/auth/accept-invitation?id={invitationId}` |

### 6.3 Template

HTML inline (sem template engine), em `invitation-email.ts:67-89`. Conteudo:

- Titulo "You're invited".
- Linha de saudacao: `"{inviterName} invited you to join {orgName} on TACO-IDE as {role}."` ou, se `inviterName` ausente, `"You have been invited to join {orgName} on TACO-IDE as {role}."`.
- Botao CTA "Accept Invitation" -> `{FRONTEND_URL}/auth/accept-invitation?id={invitationId}`.
- Linha de expiracao (se `expiresAt`): `"This invitation expires on {expiresAt.toUTCString()}."`.
- Link textual de fallback caso o botao nao funcione.

Subject: `Invitation to join {organizationName} - TACO-IDE`.

> <!-- TODO: o template esta em ingles. Decidir se traduzir para PT-BR junto com o resto da UI. -->

### 6.4 Escape de HTML (QA-1 do PR `45799967`)

Todos os valores que vem do banco e poderiam conter HTML sao passados por `escapeHtml()` antes de serem interpolados:

- `organizationName` — vem de `organization.name`, editavel por admins
- `inviterName` — vem de `user.name`, editavel pelo proprio usuario
- `role` — vem do registro `invitation.role` (valor do enum, mas ainda escapado por seguranca)
- `expiresAt.toUTCString()` — escapado por uniformidade

Implementacao em `invitation-email.ts:6-13` — escapa `& < > " '`. O link de aceite usa `encodeURIComponent(invitationId)`.

### 6.5 Vendo o email em dev

Sem `RESEND_API_KEY` configurado, o stub imprime:

```
[DEV] Invitation email for pessoa@exemplo.edu.br:
  Organization: Escola Exemplo
  Role: teacher
  Accept URL: http://localhost:4001/auth/accept-invitation?id=1f6a...
  Expires at: 2026-05-23T18:42:11.000Z
```

Para acompanhar em desenvolvimento, deixe o log da API visivel ou redirecione para um arquivo:

```bash
# Se a API estiver rodando via npm run dev em outro terminal, basta olhar la.
# Caso esteja em background no log padrao do projeto:
tail -f /tmp/taco-dev.log
```

### 6.6 Idempotencia do envio

O envio e desacoplado da criacao: falhas no transporte **nao revertem** a criacao do registro. Isso e intencional para evitar perder convites por instabilidade temporaria da Resend.

Quando o email original nao chega (caixa de spam, endereco temporariamente fora do ar, etc.), o operador pode usar o endpoint dedicado `POST /v1/organizations/:id/invitations/:invitationId/resend` (secao 4.4) ou o botao "Reenviar" da tabela (secao 5.3). Reenviar **reaproveita o registro existente** — apenas renova `expires_at` e re-dispara o email. Apos um terminal (`accepted` / `rejected` / `canceled` / `expired`), criar um novo convite e o caminho correto.

---

## 7. Codigos de erro (referencia rapida)

Mensagens estaveis emitidas pelo backend. A UI usa regex tolerantes (com e sem acento, EN/PT) por seguranca.

| Endpoint | Status | Mensagem                                                                          | Causa                                                       |
| -------- | ------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `POST`   | 400    | `Failed to create invitation`                                                     | Erro generico no caminho Platform Admin (apos retries)      |
| `POST`   | 400    | `Invalid role`                                                                    | `role` fora do enum                                         |
| `POST`   | 401    | `Not authenticated`                                                               | Sem sessao                                                  |
| `POST`   | 403    | `Organization ID must match your active organization`                             | `:id` != `activeOrganizationId` (nao platform admin)        |
| `POST`   | 403    | `Insufficient role permissions`                                                   | Papel < `coordinator` (nao platform admin)                  |
| `POST`   | 409    | `A pending invitation already exists for this email in this organization.`        | Convite pendente duplicado                                  |
| `POST`   | 409    | `User is already a member of this organization.`                                  | Email ja vinculado a um membro ativo                        |
| `GET`    | 401    | `Not authenticated`                                                               | —                                                           |
| `GET`    | 403    | `Platform admin or coordinator of this organization required`                     | Permissao insuficiente                                      |
| `GET`    | 404    | `Organization not found`                                                          | Org inexistente                                             |
| `DELETE` | 401    | `Not authenticated`                                                               | —                                                           |
| `DELETE` | 403    | `Organization ID must match your active organization` / `Insufficient role permissions` | — |
| `DELETE` | 404    | `Invitation not found`                                                            | Convite inexistente ou pertencente a outra org              |
| `DELETE` | 400    | `Failed to cancel invitation`                                                     | Erro do Better Auth no caminho coordinator+                 |
| `POST .../resend` | 401 | `Not authenticated`                                                            | —                                                           |
| `POST .../resend` | 403 | `Platform admin or coordinator of this organization required`                  | Permissao insuficiente                                      |
| `POST .../resend` | 404 | `Invitation not found` / `Organization not found`                              | Convite ou org inexistente                                  |
| `POST .../resend` | 409 | `Cannot resend invitation in status {status}.`                                 | Convite em estado terminal                                  |
| `POST .../resend` | 409 | `Cannot resend invitation: status changed concurrently.`                       | Race entre `SELECT` e `UPDATE`                              |
| `POST .../resend` | 500 | `Invitation TTL renewed but email delivery failed.`                            | DB atualizado mas Resend falhou                             |

---

## 8. Exemplos `curl`

Substitua `BASE`, `ORG_ID`, `INV_ID` e `COOKIE` conforme o ambiente.

```bash
BASE="http://localhost:3344"
ORG_ID="org_abc"
COOKIE="better-auth.session_token=<token>"
```

### 8.1 Criar convite (201)

```bash
curl -i -X POST "$BASE/v1/organizations/$ORG_ID/invitations" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"email":"nova.pessoa@exemplo.edu.br","role":"teacher"}'
```

Resposta:

```http
HTTP/1.1 201 Created
{"success":true,"data":{"id":"1f6a...","email":"nova.pessoa@exemplo.edu.br","role":"teacher","status":"pending","expiresAt":"2026-05-23T18:42:11.000Z"}}
```

### 8.2 Convite duplicado (409)

Segundo POST identico, antes do primeiro ser aceito ou cancelado:

```bash
curl -i -X POST "$BASE/v1/organizations/$ORG_ID/invitations" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"email":"nova.pessoa@exemplo.edu.br","role":"teacher"}'
```

Resposta:

```http
HTTP/1.1 409 Conflict
{"success":false,"message":"A pending invitation already exists for this email in this organization."}
```

### 8.3 Usuario ja membro (409)

Convidar um email que ja pertence a um membro ativo da organizacao:

```bash
curl -i -X POST "$BASE/v1/organizations/$ORG_ID/invitations" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"email":"membro.atual@exemplo.edu.br","role":"teacher"}'
```

Resposta (caminho coordinator+; Platform Admin pode passar e criar o convite — <!-- TODO: confirmar se ha checagem equivalente no branch Platform Admin antes do insert; atualmente nao existe -->):

```http
HTTP/1.1 409 Conflict
{"success":false,"message":"User is already a member of this organization."}
```

### 8.4 Listar pendentes (200)

```bash
curl -s "$BASE/v1/organizations/$ORG_ID/invitations?status=pending&page=1&perPage=20" \
  -H "Cookie: $COOKIE" | jq
```

Use `?status=all` para incluir todos os estados. Convites com `expires_at < NOW()` sao migrados para `status: "expired"` no banco no momento da leitura (ver secao 4.2 "Lazy expiration"). `page` (default `1`) e `perPage` (default `20`, max `100`) controlam a paginacao. Resposta inclui um objeto `pagination` com `total`, `page`, `perPage` e `totalPages`.

### 8.5 Cancelar convite (200 / 404)

```bash
INV_ID="1f6a..."
curl -i -X DELETE "$BASE/v1/organizations/$ORG_ID/invitations/$INV_ID" \
  -H "Cookie: $COOKIE"
```

Retorna `200 {"data":{"message":"Invitation cancelled successfully"}}` em sucesso. Convite inexistente ou de outra organizacao retorna `404 {"message":"Invitation not found"}`.

---

## 9. Arquivos relevantes

| Arquivo                                                                                          | Conteudo                                  |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `apps/api/src/http/routes/v1/organizations/invitations/create.ts`                                | `POST` — dois branches + retry 40001      |
| `apps/api/src/http/routes/v1/organizations/invitations/list.ts`                                  | `GET` — preHandler de permissao + JOIN    |
| `apps/api/src/http/routes/v1/organizations/invitations/delete.ts`                                | `DELETE` — dois branches                  |
| `apps/api/src/http/routes/v1/organizations/invitations/resend.ts`                                | `POST .../resend` — renova TTL + reenvia email |
| `apps/api/src/http/routes/v1/organizations/index.ts`                                             | Registro das rotas sob `/:id`             |
| `apps/api/src/http/middlewares/authorization.ts`                                                 | `requirePlatformAdminOrOrgRole`           |
| `packages/infra/src/auth/invitation-email.ts`                                                    | `sendInvitationEmail` + `escapeHtml`      |
| `packages/infra/src/auth/index.ts` (linhas 155-173)                                              | Hook `organization.sendInvitationEmail`   |
| `packages/infra/src/auth/permissions.ts`                                                         | `hasMinimumRole`, hierarquia de papeis    |
| `packages/infra/src/db/schema/auth.ts` (linhas 105-118)                                          | Tabela `invitation`                       |
| `apps/web/src/app/(inside)/admin/organizations/[id]/invitations/page.tsx`                        | Pagina da aba                             |
| `apps/web/src/app/(inside)/admin/organizations/[id]/invitations/_components/create-invitation-dialog.tsx` | Dialog de criar                  |
| `apps/web/src/app/(inside)/admin/organizations/[id]/invitations/_components/invitations-table.tsx` | Tabela + confirm de cancelar             |
| `apps/web/src/app/(inside)/admin/organizations/[id]/_components/org-tabs-nav.tsx`                | Aba "Convites" registrada                 |
