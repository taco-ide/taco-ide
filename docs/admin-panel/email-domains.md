# Auto-vínculo por domínio de email

Documento de referência sobre `organization_email_domain`: regra que permite que novos cadastros sejam automaticamente vinculados a uma organização quando o domínio do email do usuário bate com uma regra cadastrada.

## 1. Visão geral

A funcionalidade de **vínculo automático por domínio** permite que coordenadores e administradores de plataforma configurem regras do tipo:

> "Todo novo usuário que se cadastrar com email `@dominio.com` deve entrar na organização X com o papel Y."

Casos de uso típicos:

- Onboarding em massa de alunos de uma instituição (`@aluno.escola.edu.br` → `student` na organização da escola).
- Onboarding de equipe pedagógica (`@professor.escola.edu.br` → `teacher`).
- Coordenação acadêmica de um curso (`@coordenacao.escola.edu.br` → `coordinator`).

A regra atua **apenas no signup** (criação do usuário). Usuários já existentes não são reprocessados retroativamente; remover uma regra também **não desvincula** membros já adicionados.

Por motivo de segurança, o papel `admin` **nunca** pode ser concedido via auto-link — qualquer pessoa que controle uma caixa postal naquele domínio se tornaria administradora da organização. Promoções a `admin` continuam sendo feitas manualmente.

## 2. Modelo de dados

Definido em `packages/infra/src/db/schema/email-domains.ts` (tabela `organization_email_domain`).

| Campo            | Tipo                       | Descrição                                                                                     |
|------------------|----------------------------|-----------------------------------------------------------------------------------------------|
| `id`             | `text` (PK)                | UUID gerado pela API (`randomUUID()`).                                                        |
| `organizationId` | `text` (FK `organization`) | Organização que receberá o novo membro. `ON DELETE CASCADE`.                                  |
| `domain`         | `text`                     | Domínio normalizado (lowercase, sem `@` inicial e sem espaços nas pontas).                    |
| `role`           | `text` (`RoleName`)        | Papel a ser atribuído. Validado em runtime via Zod (`student`/`teacher`/`coordinator`).       |
| `createdAt`      | `timestamp`                | Data de criação. Usada para desempate quando há múltiplas regras para o mesmo domínio.        |

Índices:

- `organization_email_domain_domain_role_idx` — **UNIQUE global** em `(domain, role)`.
- `organization_email_domain_org_idx` — índice em `organizationId` (listagem por organização).

### Implicações do UNIQUE `(domain, role)` global

A combinação `(domain, role)` é única em **toda a plataforma**, não apenas por organização. Isso significa:

- A organização A pode ter `escola.edu.br` → `student`, e a organização B pode ter `escola.edu.br` → `teacher` (combinações diferentes).
- Mas duas organizações **não podem** disputar `escola.edu.br` → `student`. Tentar criar a segunda gera `409 Conflict`.
- O signup escolhe a regra com `createdAt` mais antigo quando há múltiplas opções para o mesmo domínio (ver Seção 6).

Os tipos derivados são exportados como `OrganizationEmailDomain` (select) e `NewOrganizationEmailDomain` (insert).

## 3. Permissões

Todas as rotas exigem o middleware `requirePlatformAdminOrOrgRole("coordinator")`, ou seja:

- **Platform admin** (`user.isPlatformAdmin = true`) — acesso a qualquer organização.
- **Coordenador da organização** (`member.role >= coordinator` na organização do `:id`).

Sem sessão válida → `401`. Sem permissão suficiente → `403`. Organização inexistente → `404`.

## 4. Endpoints

Definidos em `apps/api/src/http/routes/v1/organizations/email-domains/`. Todos vivem sob o prefixo da rota da organização (`/v1/organizations/:id/email-domains`).

### 4.1 Listar regras

```
GET /v1/organizations/:id/email-domains
```

**Path params:**

- `id` — `string` (id da organização).

**Resposta `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "domain": "escola.edu.br",
      "role": "teacher",
      "createdAt": "2026-05-01T12:00:00.000Z"
    }
  ]
}
```

Defense-in-depth: se um registro legado ainda tiver `role = "admin"` no banco (não deveria, após a migração 0005), o `list` o rebaixa para `coordinator` antes de devolver — nunca expõe `admin` via API.

Ordenação: `createdAt ASC`.

### 4.2 Criar regra

```
POST /v1/organizations/:id/email-domains
```

**Body (`strict`):**

```json
{
  "domain": "escola.edu.br",
  "role": "teacher"
}
```

Schema (`CreateEmailDomainBodySchema`):

- `domain` — string `3..253`, transformada para lowercase, com `trim()` e remoção do `@` inicial. Regex de validação:
  ```
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
  ```
- `role` — enum `student | teacher | coordinator` (`AutoLinkRoleSchema`). `admin` é **rejeitado** com mensagem específica:
  > `Auto-link rules cannot grant 'admin' role for security reasons.`

Esse bloqueio explícito é o fix da F10 (commit `00b4a428`). Ver também a Seção 7.

**Resposta `201`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "domain": "escola.edu.br",
    "role": "teacher",
    "createdAt": "2026-05-17T13:45:00.000Z"
  }
}
```

**Conflitos (`409`):** ver Seção 9.

### 4.3 Remover regra

```
DELETE /v1/organizations/:id/email-domains/:domainId
```

**Path params:**

- `id` — id da organização.
- `domainId` — id da regra.

**Resposta `204` (No Content).**

Erros:

- `404` se a regra não pertence à organização ou não existe.

**Comportamento ao remover:** a deleção é **hard delete** (não soft delete) e **não afeta membros já vinculados**. Quem entrou via auto-link anteriormente continua na organização com o papel atribuído na ocasião do signup; remover a regra apenas impede que futuros cadastros sejam auto-vinculados por esse `(domain, role)`.

## 5. Validações

### 5.1 Domínio

- Lowercase, sem espaços, sem `@` inicial.
- Mínimo 3, máximo 253 caracteres (limite RFC).
- Regex aceita rótulos `a-z 0-9 -`, separados por `.`, com pelo menos dois rótulos.
- Mensagem de erro: `Invalid domain format` (API) / `Formato de domínio inválido (ex.: exemplo.edu.br)` (UI).

### 5.2 Papel

| Papel atribuível via auto-link | Aceito? | Observação                                                                |
|--------------------------------|---------|---------------------------------------------------------------------------|
| `student`                      | Sim     | Aluno comum.                                                              |
| `teacher`                      | Sim     | Padrão sugerido pela UI.                                                  |
| `coordinator`                  | Sim     | Coordenação acadêmica.                                                    |
| `admin`                        | Não     | **Rejeitado com `400`** e mensagem específica de segurança.               |
| `owner` / `member` (legacy)    | Não     | Não fazem parte do enum de auto-link.                                     |

A rejeição de `admin` acontece via `errorMap` customizado no Zod, que detecta `received === "admin"` e devolve uma mensagem específica em vez do erro genérico de enum.

### 5.3 Body strict

O Zod schema é `.strict()`: qualquer campo extra no body causa `400`.

## 6. Lógica de auto-link no signup

Implementada como `databaseHooks.user.create.after` em `packages/infra/src/auth/index.ts`. Executa **após** o Better Auth gravar o registro do usuário com sucesso.

### 6.1 Pseudo-código resumido

```ts
after(createdUser) {
  try {
    const email = createdUser.email;
    const atIndex = email.lastIndexOf("@");           // tolera local-parts entre aspas
    if (atIndex === -1) return;
    const domain = email.slice(atIndex + 1).toLowerCase().trim();
    if (!domain) return;

    const rule = await db
      .select(...)
      .from(organizationEmailDomain)
      .innerJoin(organization, eq(organization.id, organizationEmailDomain.organizationId))
      .where(and(
        eq(organizationEmailDomain.domain, domain),
        eq(organization.isActive, true),           // ignora orgs inativas
      ))
      .orderBy(asc(organizationEmailDomain.createdAt))  // regra mais antiga vence
      .limit(1)
      .then(rows => rows[0]);

    if (!rule) return;

    // Defense-in-depth: legacy admin -> teacher
    const effectiveRole = rule.role === "admin" ? "teacher" : rule.role;

    await db.insert(member).values({
      id: randomUUID(),
      userId: createdUser.id,
      organizationId: rule.organizationId,
      role: effectiveRole,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[user.create.after] domain auto-assign failed:", err);
    // NUNCA propaga: signup tem prioridade sobre o auto-link
  }
}
```

### 6.2 Comportamento esperado

- **Case-insensitive:** `AutoUser@TESTE.com` é tratado como `autouser@teste.com` → bate com a regra `teste.com`.
- **Subdomínios:** **não** são tratados como `teste.com`. A comparação é estrita: `aluno@sub.teste.com` só bate se existir uma regra para `sub.teste.com`. Não há fallback para o domínio raiz.
- **Domínios com local-part entre aspas:** usa `lastIndexOf("@")` para suportar `"user@name"@example.com` (raro mas válido pela RFC 5321).
- **Organização inativa:** se `organization.isActive = false`, a regra é ignorada e o usuário **não** é auto-vinculado. O signup ainda completa normalmente.
- **Múltiplas regras:** quando o mesmo domínio aparece em mais de uma regra (possível porque o UNIQUE é em `(domain, role)`, não apenas `domain`), vence a de menor `createdAt`. Apenas uma regra é aplicada por signup.
- **Bypass do `membershipLimit`:** a inserção em `member` é direta via Drizzle, **não** via `auth.api.addMember`. Isso evita o limite padrão de 100 membros do plugin de organização do Better Auth.
- **Falha silenciosa:** se a inserção do `member` falhar (ex.: usuário já é membro), o erro é logado e o signup é considerado bem-sucedido. Não há retry automático.

### 6.3 Cap defensivo `admin → teacher`

O hook **rebaixa** `role === "admin"` para `"teacher"` em tempo de execução, mesmo se uma linha legada no banco ainda tiver `admin`. Esse é o terceiro guarda da estratégia "defense-in-depth":

1. **API** (`create.ts`) — Zod bloqueia novos `admin` com `400`.
2. **Dados** (`0005_cap_email_domain_admin_role.sql`) — `UPDATE` rebaixa registros existentes.
3. **Runtime** (`auth/index.ts`) — cap derradeiro no momento do signup.

## 7. Migration `0005_cap_email_domain_admin_role.sql`

Caminho: `packages/infra/drizzle/0005_cap_email_domain_admin_role.sql`.

Conteúdo (data fix histórico):

```sql
UPDATE "organization_email_domain"
SET "role" = 'teacher'
WHERE "role" = 'admin';
```

Contexto: antes do fix F10 era possível criar regras com `role = "admin"`. Como o hook de signup insere uma linha em `member` com o `role` da regra, isso transformava qualquer estranho com email no domínio em **admin real** da organização. A migration faz o backfill rebaixando todos os registros para `teacher` — alto o suficiente para onboarding pedagógico, baixo o suficiente para evitar ações destrutivas a nível de organização.

A migration é apenas de dados (sem DDL). Roda uma única vez na pipeline de migrações; novas regras são impedidas no nível da API.

## 8. UI

### 8.1 Localização

A aba "Domínios" fica em:

```
/admin/organizations/:id/domains
```

Página: `apps/web/src/app/(inside)/admin/organizations/[id]/domains/page.tsx`.
Componentes:

- `_components/add-domain-form.tsx` — formulário de criação.
- `_components/domains-table.tsx` — tabela com listagem, badge de papel e diálogo de remoção.

A página mostra um `Alert` informativo no topo explicando que o vínculo é automático no signup e que a regra mais antiga vence em caso de empate.

### 8.2 Select de papel

O select de papel na UI usa estritamente:

```ts
const ROLE_OPTIONS: AutoLinkRole[] = ["student", "teacher", "coordinator"];
```

`admin` **não** aparece como opção. O tipo é construído como `Exclude<AdminRole, "admin">` para refletir o contrato do backend no nível do tipo.

Padrão default: `teacher`.

### 8.3 Validação client-side

O formulário roda o mesmo schema Zod do backend antes de enviar (lowercase + trim + remove `@` + regex). Erros 409 são mostrados inline (`<p role="alert">`) sem `toast`, para que o coordenador consiga corrigir e tentar novamente sem ruído.

## 9. Códigos de erro

| Status | Quando ocorre                                                                                       | Mensagem (exemplo)                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `400`  | Domínio fora do regex.                                                                              | `Invalid domain format`                                                                                     |
| `400`  | `role` ausente ou fora do enum, exceto `admin`.                                                     | Mensagem padrão do Zod.                                                                                     |
| `400`  | `role = "admin"` (F10).                                                                              | `Auto-link rules cannot grant 'admin' role for security reasons.`                                           |
| `400`  | Campos extras no body (schema `.strict()`).                                                          | Mensagem padrão do Zod.                                                                                     |
| `401`  | Sem sessão válida.                                                                                  | —                                                                                                           |
| `403`  | Usuário não é platform admin nem coordenador da org.                                                | —                                                                                                           |
| `404`  | Organização inexistente; ou, no DELETE, regra inexistente / pertence a outra org.                   | `Email domain rule not found`                                                                               |
| `409`  | `(domain, role)` já existe **na mesma organização**.                                                | `Domain "X" with role "Y" is already configured for this organization`                                      |
| `409`  | `(domain, role)` já existe **em outra organização**.                                                | `Domain "X" with role "Y" is already in use by organization "Nome da Org"`                                  |

Implementação do `409`: o `create.ts` faz um `SELECT` prévio para devolver a mensagem com o nome da organização conflitante. Em caso de race condition entre `SELECT` e `INSERT`, captura `SQLSTATE 23505` (unique_violation) e refaz o lookup para devolver o mesmo 409 com mensagem amigável. Qualquer outro erro do banco é re-lançado (vira `500`) para preservar visibilidade em logs.

## 10. Exemplos

### 10.1 Criar regra `teste.com → student`

```bash
curl -X POST "$API/v1/organizations/$ORG_ID/email-domains" \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json" \
  -d '{"domain":"teste.com","role":"student"}'
```

Resposta `201`:

```json
{
  "success": true,
  "data": {
    "id": "abc-...",
    "domain": "teste.com",
    "role": "student",
    "createdAt": "2026-05-17T14:00:00.000Z"
  }
}
```

### 10.2 Tentativa de criar `role = "admin"` (F10)

```bash
curl -X POST "$API/v1/organizations/$ORG_ID/email-domains" \
  -H "Content-Type: application/json" \
  -d '{"domain":"teste.com","role":"admin"}'
```

Resposta `400`:

```json
{
  "success": false,
  "message": "Auto-link rules cannot grant 'admin' role for security reasons."
}
```

### 10.3 Signup que dispara auto-link

Pré-condições:

- Existe regra `teste.com → student` na organização `Escola X` (ativa).
- Não existe usuário com `email = "AutoUser@TESTE.com"`.

Fluxo:

1. Usuário envia `POST /v1/auth/sign-up/email` com `email = "AutoUser@TESTE.com"`.
2. Better Auth cria o `user`.
3. Hook `user.create.after`:
   - Extrai domínio: `teste.com` (lowercase).
   - Busca regra ativa: encontra `student` em `Escola X`.
   - Insere `member { userId, organizationId, role: "student" }`.
4. Signup retorna `200`. Próxima sessão do usuário já lista `Escola X` entre as organizações dele.

### 10.4 Conflito entre organizações

Organização A tem `teste.com → teacher`. Organização B tenta criar `teste.com → teacher`:

Resposta `409`:

```json
{
  "success": false,
  "message": "Domain \"teste.com\" with role \"teacher\" is already in use by organization \"Escola A\""
}
```

A organização B pode criar `teste.com → student` ou `teste.com → coordinator` (combinações diferentes), pois o UNIQUE é em `(domain, role)`.

## 11. Emails disparados

A criação de uma regra de auto-link **não** dispara emails por si só. O auto-link em si (inserção em `member`) também não envia notificação.

O que pode ocorrer é o fluxo normal do Better Auth no signup:

- **Email de verificação**: configurado em `auth.emailVerification` (`sendOnSignUp: true`). Disparado para todo novo cadastro, independentemente de auto-link.
- **Email de reset de senha**: não relacionado ao auto-link.
- **Email de convite (`sendInvitationEmail`)**: usado pelo plugin de organização do Better Auth em **convites manuais**. Auto-link **não** passa por `auth.api.addMember`, então não dispara esse email.

Para detalhes dos templates e configuração do Resend, consultar `emails.md`. <!-- TODO: confirmar caminho exato do arquivo emails.md no diretório docs/admin-panel/ -->

## Referências de código

- Schema: `packages/infra/src/db/schema/email-domains.ts`.
- Rotas: `apps/api/src/http/routes/v1/organizations/email-domains/{create,list,delete,index}.ts`.
- Hook de signup: `packages/infra/src/auth/index.ts` (`databaseHooks.user.create.after`).
- Migration de data fix: `packages/infra/drizzle/0005_cap_email_domain_admin_role.sql`.
- UI: `apps/web/src/app/(inside)/admin/organizations/[id]/domains/`.
- Commit do fix F10: `00b4a428`.
