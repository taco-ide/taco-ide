# Membros e Papéis (Roles)

Este documento descreve como o painel administrativo gerencia membros de uma
organização e o flag global `is_platform_admin`. Cobre listagem, vinculação de
usuários existentes, alteração de papel, remoção, transferência entre
organizações e o toggle de Platform Admin.

Documentos relacionados:

- Convites por email -> `invitations.md`
- Importação em massa via CSV -> `csv-import.md`
- Auto-link por domínio de email -> `email-domains.md`
- Emails consolidados -> `emails.md`

---

## 1. Visão geral

Um membro é o vínculo entre `user` e `organization` (tabela `member`).
Permissões dentro da org vêm do **`member.role`**. Em paralelo, existe um
eixo global e independente: o flag **`user.is_platform_admin`**, que
libera o painel administrativo e operações cross-org.

Os eixos são independentes: um Platform Admin não precisa ser membro de
uma org para gerenciá-la; um `admin` de uma org não é, automaticamente,
Platform Admin.

---

## 2. Roles e personas

### 2.1 Roles de organização (`member.role`)

Definidos em `packages/infra/src/auth/permissions.ts`. A hierarquia é
estritamente ordenada: `student < teacher < coordinator < admin`.

| Role          | Hierarquia | O que pode fazer (resumo)                                                                                                          |
| ------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `student`     | 0          | Acesso somente leitura aos recursos liberados pelo professor. Sem permissões de escrita.                                            |
| `teacher`     | 1          | Cria/edita salas, desafios e bases de conhecimento; pode criar convites e adicionar membros, mas não remove nem altera papéis.      |
| `coordinator` | 2          | Tudo do `teacher` + atualiza dados da org, gerencia membros (criar/atualizar/remover), cancela convites.                            |
| `admin`       | 3          | Todas as permissões do `coordinator` + apagar a organização.                                                                       |

O endpoint `PUT /v1/organizations/:id/members/:userId` exige no mínimo
`coordinator` no escopo da org (ou Platform Admin). Já as rotas exclusivas
do painel administrativo (`POST /members`, `DELETE /members/:userId`,
`POST /members/:userId/move`, `POST /members/import-csv`) usam o
middleware `requirePlatformAdmin()`.

### 2.2 Flag global (`user.is_platform_admin`)

`boolean` em `user`. Concede acesso ao painel `/admin` e permite agir
sobre qualquer organização sem ser membro dela. Diferença em relação a
`member.role`: este é por org (um mesmo usuário pode ser `teacher` em
uma e `student` em outra); `is_platform_admin` é global.

### 2.3 Origem do vínculo (`joinedVia`)

O `GET /v1/organizations/:id/members` calcula `joinedVia` por linha,
sem consulta extra por membro:

| Valor        | Critério                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `domain`     | O domínio do email do membro está cadastrado em `organizationEmailDomain` com o mesmo papel.       |
| `invitation` | Existe um convite (`invitation`) emitido para este email nesta organização.                       |
| `manual`     | Caso contrário (vínculo direto via "Vincular usuário existente" ou CSV).                          |

---

## 3. Listar membros

```
GET /v1/organizations/:id/members
```

Quem pode chamar:

- Platform Admin: qualquer organização.
- Demais usuários: precisam ser `teacher`+ e a `:id` deve coincidir com a
  `activeOrganizationId` da sessão.

### Querystring

| Parâmetro | Tipo                                                  | Descrição                                       |
| --------- | ----------------------------------------------------- | ----------------------------------------------- |
| `q`       | `string`, opcional                                    | Busca por nome ou email (`ILIKE %q%`).          |
| `role`    | `student \| teacher \| coordinator \| admin`, opcional | Filtra pelo papel dentro da organização.        |

### Resposta `200`

```json
{
  "success": true,
  "data": [
    {
      "id": "mbr_...",
      "userId": "usr_...",
      "name": "Maria Lima",
      "email": "maria@escola.org",
      "role": "teacher",
      "createdAt": "2026-04-12T13:55:00.000Z",
      "lastActiveAt": "2026-05-15T09:01:12.000Z",
      "joinedVia": "domain"
    }
  ]
}
```

Erros: `401` sem sessão; `403` quando o caller não é Platform Admin nem
`teacher`+ na org ativa correspondente.

---

## 4. Vincular usuário existente

Adiciona um `user` já cadastrado como membro da organização sem disparar
convite por email (use convite quando o destinatário ainda não tem conta).

```
POST /v1/organizations/:id/members
```

Restrita a Platform Admin (`requirePlatformAdmin()`).

### Body

| Campo   | Tipo                                                  | Obrigatório | Descrição                                          |
| ------- | ----------------------------------------------------- | ----------- | -------------------------------------------------- |
| `email` | `string` (email)                                      | sim         | Email do usuário existente. Case-insensitive.      |
| `role`  | `student \| teacher \| coordinator \| admin`           | sim         | Papel inicial dentro da organização.               |

### Comportamento

1. Confere a organização (`404` se não existe).
2. Busca o usuário por email (`ILIKE`, case-insensitive). `404` se ele
   ainda não tem conta — neste caso, use o fluxo de convite.
3. Verifica `member(organization_id, user_id)` (`409` se já é membro).
4. Insere a linha. Em corrida, captura a violação do `UNIQUE(organization_id,
   user_id)` (PostgreSQL `23505`) e responde `409` em vez de `500`
   (fix `589fb076`).

Resposta `201` com `{ id, userId, organizationId, role, createdAt }`.

Não dispara nenhum email — o usuário passa a enxergar a nova org ao
trocar de `activeOrganizationId`.

---

## 5. Alterar papel (inline)

```
PUT /v1/organizations/:id/members/:userId
```

Quem pode chamar:

- Platform Admin (bypass total).
- Caller com `member.role >= coordinator` cuja `activeOrganizationId` é
  exatamente `:id`.

### Body

| Campo  | Tipo                                                  | Obrigatório |
| ------ | ----------------------------------------------------- | ----------- |
| `role` | `student \| teacher \| coordinator \| admin`           | sim         |

### Comportamento

- Platform Admin: update direto em `member` via Drizzle.
- Coordenador/admin da própria org: delega a `auth.api.updateMemberRole`
  do Better Auth, que aplica as regras internas de RBAC.

Guard de último admin: <!-- TODO: `updateMemberRole` não tem guard
explícito contra rebaixar o último admin. Confirmar se o Better Auth
bloqueia internamente; caso contrário, documentar como gap conhecido. -->

Efeito em sessões: a rota **não** revoga sessões. O `member.role` é
cacheado no cookie do Better Auth por até 5 minutos, então mudanças
podem demorar para refletir em permissões avaliadas a partir do cookie.
Para aplicação imediata, o alvo deve sair e entrar novamente.

---

## 6. Remover membro

```
DELETE /v1/organizations/:id/members/:userId
```

Restrita a Platform Admin.

### Comportamento

Toda a operação roda em uma transação:

1. Busca `member(organizationId, userId)`.
2. Se o papel é `admin`, faz `SELECT ... FOR UPDATE` nos admins da org e
   bloqueia (`409`) caso só exista um. O `FOR UPDATE` serializa
   remoções concorrentes.
3. Apaga a linha de `member`.
4. **Cleanup de sessão**: zera `session.active_organization_id` para as
   sessões do `userId` que ainda apontavam para essa org (commit
   `c7809dc8`). O usuário não fica "preso" a uma org da qual não é mais
   membro.

Erro de último admin:

```
409 { "message": "Cannot remove the last admin of the organization. Promote another member to admin first." }
```

Não dispara email.

---

## 7. Mover membro entre organizações

```
POST /v1/organizations/:id/members/:userId/move
```

Restrita a Platform Admin. Faz delete + insert em uma única transação,
garantindo atomicidade.

### Body

| Campo                | Tipo                                                  | Obrigatório | Descrição                                              |
| -------------------- | ----------------------------------------------------- | ----------- | ------------------------------------------------------ |
| `toOrganizationId`   | `string`                                              | sim         | Organização destino (deve estar ativa).                |
| `newRole`            | `student \| teacher \| coordinator \| admin`           | sim         | Papel no destino.                                      |

### Comportamento

1. Recusa se origem == destino (`400`).
2. Confere se a org destino existe (`404`) e está ativa (`409`).
3. Em transação:
   - Busca `member` na origem (`404` se não existe).
   - Se o papel na origem é `admin`, faz `FOR UPDATE` nos admins e
     bloqueia (`409`) caso seja o último.
   - Confere se o usuário já é membro do destino (`409`, evitando erro
     genérico do `UNIQUE`).
   - Apaga a linha de origem e insere a nova no destino com `newRole`.

Resposta `200`: novo `member` (id, userId, organizationId, role,
createdAt).

Efeito em sessões: <!-- TODO: a rota `move` não atualiza
`session.active_organization_id` quando o usuário tinha a org de origem
como ativa. Confirmar se é intencional (o usuário troca de org
manualmente) ou se deve seguir o cleanup de `remove.ts`. -->

Não dispara email.

---

## 8. Platform Admin: promover e despromover

```
PATCH /v1/users/:id/platform-admin
```

Restrita a Platform Admin.

### Body

| Campo              | Tipo      | Obrigatório |
| ------------------ | --------- | ----------- |
| `isPlatformAdmin`  | `boolean` | sim         |

### Guards

A rota tem dois guards distintos, ambos retornando `409`:

#### 8.1 Self-demote (fix `8d8edd5b`)

Um Platform Admin não pode remover o próprio status, mesmo havendo
outros admins. Outro Platform Admin precisa fazê-lo:

```
409 { "message": "You cannot remove your own Platform Admin status. Ask another Platform Admin to do it." }
```

Razões: manter trilha de auditoria (a operação revoga as sessões do
alvo) e evitar lock-outs acidentais.

#### 8.2 Último Platform Admin

Antes de gravar `isPlatformAdmin=false`, a rota faz `SELECT ... FOR
UPDATE` em todos os `user` com `is_platform_admin=true`. Se houver
apenas um:

```
409 { "message": "Cannot demote the only Platform Admin" }
```

### Revogação de sessões

Na alteração bem-sucedida, **todas** as sessões do alvo são apagadas
(`DELETE FROM session WHERE user_id = :id`). O cookie do Better Auth
tem cache de claims de até 5 minutos; sem revogar, o `isPlatformAdmin`
antigo persistiria nesse intervalo. O alvo precisa fazer login de novo.

### Endpoint auxiliar: busca global de usuários

Para identificar quem promover, o painel usa
`GET /v1/users?q=<query>&page=<n>&perPage=<m>` (também restrito a
Platform Admin). Retorna `id`, `name`, `email`, `isPlatformAdmin`,
`isActive` e as `memberships` (org + role) de cada usuário.

---

## 9. Códigos de erro por ação

| Ação                                | Código | Cenário                                                                          |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Listar membros                      | `401`  | Sem sessão.                                                                      |
|                                     | `403`  | Não é Platform Admin e a org não bate com `activeOrganizationId` ou role < teacher. |
| Vincular existente                  | `403`  | Caller não é Platform Admin.                                                     |
|                                     | `404`  | Organização ou usuário não encontrado.                                           |
|                                     | `409`  | Usuário já é membro (inclui corrida pelo `UNIQUE`).                              |
| Alterar role                        | `400`  | Role inválido.                                                                   |
|                                     | `403`  | Não é Platform Admin e a org não bate com a ativa, ou role < coordinator.        |
|                                     | `404`  | Membro não encontrado.                                                           |
| Remover membro                      | `403`  | Caller não é Platform Admin.                                                     |
|                                     | `404`  | Membro não encontrado.                                                           |
|                                     | `409`  | Último admin da organização.                                                     |
| Mover entre orgs                    | `400`  | Origem e destino iguais.                                                         |
|                                     | `403`  | Caller não é Platform Admin.                                                     |
|                                     | `404`  | Org destino ou membro de origem não encontrado.                                  |
|                                     | `409`  | Org destino inativa, último admin da origem, ou já é membro do destino.          |
| Toggle Platform Admin               | `403`  | Caller não é Platform Admin.                                                     |
|                                     | `404`  | Usuário não encontrado.                                                          |
|                                     | `409`  | Self-demote ou último Platform Admin.                                            |

---

## 10. Emails disparados

Nenhuma das ações deste documento envia email. Apenas o fluxo de
convites (`invitations.md`) usa Resend. Em particular: vincular
usuário existente assume que ele já tem conta (use convite para um
onboarding com email); alterar role, remover membro e mover entre orgs
são silenciosos; o toggle de Platform Admin é silencioso, mas revoga
as sessões do alvo (seção 8). Consulte `emails.md` para a visão
consolidada.

---

## 11. Exemplos `curl`

Os exemplos abaixo assumem que o cookie de sessão de um Platform Admin
já está em `~/.taco/cookies.txt` (via `curl -c` no login). Substitua
`$ORG_ID` e `$USER_ID` pelos valores reais.

### 11.1 Vincular usuário existente (sucesso)

```bash
curl -X POST "http://localhost:3344/v1/organizations/$ORG_ID/members" \
  -H "Content-Type: application/json" \
  -b ~/.taco/cookies.txt \
  -d '{ "email": "maria@escola.org", "role": "teacher" }'
```

Resposta esperada: `201` com o `member` criado.

### 11.2 Vincular usuário já membro (`409`)

```bash
curl -i -X POST "http://localhost:3344/v1/organizations/$ORG_ID/members" \
  -H "Content-Type: application/json" \
  -b ~/.taco/cookies.txt \
  -d '{ "email": "maria@escola.org", "role": "teacher" }'
```

Resposta esperada:

```
HTTP/1.1 409 Conflict
{ "success": false, "message": "User is already a member of this organization" }
```

### 11.3 Alterar role (sucesso)

```bash
curl -X PUT "http://localhost:3344/v1/organizations/$ORG_ID/members/$USER_ID" \
  -H "Content-Type: application/json" \
  -b ~/.taco/cookies.txt \
  -d '{ "role": "coordinator" }'
```

### 11.4 Remover último admin (`409`)

```bash
curl -i -X DELETE "http://localhost:3344/v1/organizations/$ORG_ID/members/$USER_ID" \
  -b ~/.taco/cookies.txt
```

Resposta esperada:

```
HTTP/1.1 409 Conflict
{
  "success": false,
  "message": "Cannot remove the last admin of the organization. Promote another member to admin first."
}
```

### 11.5 Self-demote de Platform Admin (`409`)

Logado como você mesmo (`$MY_USER_ID`), tentando se rebaixar:

```bash
curl -i -X PATCH "http://localhost:3344/v1/users/$MY_USER_ID/platform-admin" \
  -H "Content-Type: application/json" \
  -b ~/.taco/cookies.txt \
  -d '{ "isPlatformAdmin": false }'
```

Resposta esperada:

```
HTTP/1.1 409 Conflict
{
  "success": false,
  "message": "You cannot remove your own Platform Admin status. Ask another Platform Admin to do it."
}
```

### 11.6 Mover membro entre orgs

```bash
curl -X POST "http://localhost:3344/v1/organizations/$ORG_ID/members/$USER_ID/move" \
  -H "Content-Type: application/json" \
  -b ~/.taco/cookies.txt \
  -d '{ "toOrganizationId": "org_destino", "newRole": "student" }'
```

---

## 12. Apontadores de UI

- Tabela de membros: `apps/web/src/app/(inside)/admin/organizations/[id]/members/_components/members-table.tsx`
- Página da listagem com filtros e ações: `apps/web/src/app/(inside)/admin/organizations/[id]/members/page.tsx`
- Combobox de role inline: `apps/web/src/components/admin/role-select.tsx`
- Dialog "Vincular usuário existente": `apps/web/src/components/admin/link-existing-user-dialog.tsx`
- Dialog "Mover para outra organização": `apps/web/src/components/admin/move-user-dialog.tsx`
- Lista global de usuários e busca: `apps/web/src/app/(inside)/admin/users/page.tsx`
- Toggle Platform Admin: `apps/web/src/components/admin/admin-toggle.tsx`
- Modal de confirmação (com texto de self-demote): `apps/web/src/components/admin/toggle-admin-dialog.tsx`
