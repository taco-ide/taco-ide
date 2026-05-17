# Admin Panel

Documentação do Admin Panel introduzido pelo PR #88. Esta pasta concentra a
referência funcional e técnica das telas sob `/admin/*` e dos endpoints
correspondentes em `/v1/organizations/*` e `/v1/users/*`.

## Visão geral

O Admin Panel é a área de back-office da plataforma TACO-IDE. Ele dá a um
**Platform Admin** o controle global sobre organizações, membros, convites,
domínios de email autorizados e a promoção de outros Platform Admins. Cargos
operacionais dentro de uma organização (Owner / Admin / Coordinator / Teacher)
não acessam o painel global — eles continuam usando os fluxos normais do
produto dentro da própria org.

A interface vive sob `/admin/organizations` (a rota raiz `/admin` apenas
redireciona para lá). O layout protege a área no client: se o usuário logado
não for Platform Admin, recebe um componente `AccessDenied` em vez do conteúdo
— mas a fonte de verdade continua sendo a API, que rejeita chamadas com 401 /
403 mesmo se a tela for forçada.

## Personas e níveis de permissão

A plataforma combina dois eixos de autorização:

1. **Platform Admin** — flag global `user.isPlatformAdmin`, fora do modelo
   por-organização. Necessária para tudo que cruza orgs (criar org, listar
   todas, promover outro Platform Admin, etc.).
2. **Role dentro da organização** — campo `member.role` (texto), tipado como
   enum `RoleName = "student" | "teacher" | "coordinator" | "admin"` com
   hierarquia `student(0) < teacher(1) < coordinator(2) < admin(3)`. Os
   statements de Access Control vivem em
   `packages/infra/src/auth/permissions.ts`.

> **Owner não é uma role separada no schema.** Quando a documentação se
> refere a "Owner", trata-se na prática do `admin` da organização (o criador
> recebe `creatorRole=admin` ao criar a org via Better Auth).
> <!-- TODO: confirmar se haverá um papel `owner` distinto no futuro. -->

| Persona | Escopo | Onde é usada |
| --- | --- | --- |
| Platform Admin | Global (cross-org) | Admin Panel inteiro, `/v1/admin/*`, criar/atualizar/desativar org, promover outro Platform Admin |
| Admin (Owner) | Por organização | Gerenciar membros, classrooms, challenges, KB, convites; atualizar e deletar a org |
| Coordinator | Por organização | Mesmo poder operacional do Admin para membros, convites, classrooms, challenges e KB; pode `update` da org mas não `delete` |
| Teacher | Por organização | Criar/editar classrooms e challenges, gerenciar KB, criar membros e convites (alcance reduzido) |
| Student | Por organização | Sem permissões administrativas — apenas consumir conteúdo |

A função `hasMinimumRole(userRole, minimumRole)` é o gate canônico para
verificar hierarquia. `roleHasPermission(role, resource, action)` é o gate
canônico para verificar uma ação específica (statements do AccessControl).

## Matriz RBAC

A tabela abaixo cruza as ações principais do Admin Panel com o gate
correspondente da API. As regras vêm dos `preHandler` em
`apps/api/src/http/routes/v1/organizations/*` e `apps/api/src/http/routes/v1/users/*`
e dos helpers em `apps/api/src/http/middlewares/authorization.ts`.

Convenções:

- "PA" = Platform Admin
- "Coord+" = pelo menos `coordinator` na org (inclui `admin`)
- "Member+" = qualquer membro da org (somente leitura do header da org)
- Onde existe um caminho "PA OU role-na-org", a chamada precisa também
  satisfazer que `params.id === session.activeOrganizationId` para o
  caminho não-PA (a regra é aplicada inline em cada rota — não pelo
  middleware).

| Ação | Endpoint | Permissão |
| --- | --- | --- |
| Listar organizações | `GET /v1/organizations` | Apenas PA |
| Criar organização | `POST /v1/organizations` | Apenas PA |
| Ver detalhe da organização | `GET /v1/organizations/:id` | PA ou Member+ daquela org |
| Atualizar organização (nome, slug, logo) | `PUT /v1/organizations/:id` | Apenas PA |
| Desativar / reativar organização | `PATCH /v1/organizations/:id/active` | Apenas PA |
| Listar membros | `GET /v1/organizations/:id/members` | PA ou Teacher+ da org |
| Adicionar membro existente (sem convite) | `POST /v1/organizations/:id/members` | Apenas PA |
| Alterar role de membro | `PUT /v1/organizations/:id/members/:userId` | PA ou Coord+ da org |
| Remover membro | `DELETE /v1/organizations/:id/members/:userId` | Apenas PA (bloqueia remover último admin) |
| Mover membro entre orgs | `POST /v1/organizations/:id/members/move` | Apenas PA |
| Importar membros via CSV | `POST /v1/organizations/:id/members/import-csv` | PA ou Coord+ da org |
| Listar convites | `GET /v1/organizations/:id/invitations` | PA ou Coord+ da org |
| Criar convite | `POST /v1/organizations/:id/invitations` | PA ou Coord+ da org |
| Cancelar convite | `DELETE /v1/organizations/:id/invitations/:invitationId` | PA ou Coord+ da org |
| Listar domínios de email | `GET /v1/organizations/:id/email-domains` | PA ou Coord+ da org |
| Criar domínio de email | `POST /v1/organizations/:id/email-domains` | PA ou Coord+ da org |
| Remover domínio de email | `DELETE /v1/organizations/:id/email-domains/:domainId` | PA ou Coord+ da org |
| Buscar usuários (cross-org) | `GET /v1/users` | Apenas PA |
| Promover / despromover Platform Admin | `PATCH /v1/users/:id/platform-admin` | Apenas PA (com guard de "último PA" e bloqueio de auto-despromoção) |

> **Sobre o caminho "PA ou Coord+"**: o middleware
> `requirePlatformAdminOrOrgRole("coordinator")` cobre domínios, listar
> convites etc. Já as rotas de `members/updateRole`, `invitations/create`,
> `invitations/delete` e `importCsv` reimplementam a checagem inline porque
> também exigem que `organizationId === activeOrganizationId` no caminho
> não-PA.

## Estrutura de URLs

Mapa real das rotas web sob `apps/web/src/app/(inside)/admin/`:

| URL | Conteúdo |
| --- | --- |
| `/admin` | Redireciona para `/admin/organizations` |
| `/admin/organizations` | Lista paginada com busca e toggle "incluir inativas" |
| `/admin/organizations/[id]` | Detalhe — header com `memberCount`, `classroomCount`, `domainCount` |
| `/admin/organizations/[id]/settings` | Edição de nome/slug/logo e desativação |
| `/admin/organizations/[id]/members` | Tabela de membros (filtro por role e busca) |
| `/admin/organizations/[id]/invitations` | Convites pendentes e formulário de novo convite |
| `/admin/organizations/[id]/domains` | Regras de auto-vínculo por domínio de email |
| `/admin/users` | Busca global de usuários e toggle Platform Admin |

O acesso a qualquer rota sob `/admin` é gateado no client por
`apps/web/src/app/(inside)/admin/layout.tsx`: usuários sem
`user.isPlatformAdmin` veem `AccessDenied`. A API enforça a mesma regra com
401 / 403.

## Padrões de erro da API

O Fastify usa um `setErrorHandler` global em
`apps/api/src/http/server.ts` que normaliza todos os erros para o envelope
`BaseErrorResponseSchema`:

```json
{
  "success": false,
  "message": "Descrição legível",
  "errors": { "campo": ["mensagem"] }
}
```

- `errors` só aparece em respostas **400** geradas por falha de validação Zod
  (o handler usa `hasZodFastifySchemaValidationErrors` e formata por
  `instancePath`).
- Erros `APIError` do Better Auth são mapeados para o `statusCode` real (não
  caem em 500).
- Falhas de serialização de resposta viram 500 com
  `message: "Response serialization failed"`.

Códigos mais comuns no Admin Panel:

| Status | Quando ocorre |
| --- | --- |
| 400 | Body / querystring inválidos (Zod), CSV malformado |
| 401 | Sem sessão válida (`request.user` ausente) |
| 403 | Sessão válida, mas sem permissão (PA ausente, role insuficiente, ou `organizationId` diferente do `activeOrganizationId` no caminho não-PA) |
| 404 | Organização, membro, convite ou domínio inexistentes |
| 409 | Conflito: slug duplicado, email já em uso, último Platform Admin, último admin da org, race em `addExistingMember` (23505 → 409) |
| 413 | Upload de CSV maior que o limite do `fastify-multipart` (10MB) |
| 500 | Falha não tratada — sempre logada como `Unhandled error` |

### Exemplos rápidos

Criar uma organização (apenas PA):

```bash
curl -X POST http://localhost:3344/v1/organizations \
  -H 'Content-Type: application/json' \
  -b 'better-auth.session_token=...' \
  -d '{"name":"Escola Alfa","slug":"escola-alfa"}'
```

Toggle do flag Platform Admin:

```bash
curl -X PATCH http://localhost:3344/v1/users/USER_ID/platform-admin \
  -H 'Content-Type: application/json' \
  -b 'better-auth.session_token=...' \
  -d '{"isPlatformAdmin": true}'
```

## Convenções

- **Schemas `.strict()`** — todo body e querystring sob `/v1/organizations/*`
  e `/v1/users/*` usa `z.object({...}).strict()`. Campos extras geram 400 com
  `errors._: ["Unrecognized key(s) ..."]`. Não envie chaves desconhecidas.
- **Slug de organização** — regex
  `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, normalizado para lowercase via
  `.transform()`. Hifens internos são permitidos; não pode começar nem
  terminar com hifen.
- **`organizationId` vs `activeOrganizationId`** — no caminho não-PA, várias
  rotas exigem que o `:id` da URL seja igual ao `session.activeOrganizationId`.
  Use `POST /v1/organizations/:id/set-active` antes para trocar o contexto.
  <!-- TODO: confirmar nome final da rota de set-active quando documentada. -->
- **React Query** — o `QueryProvider`
  (`apps/web/src/lib/query-provider.tsx`) configura `retry` para **não
  repetir** respostas 4xx. Logo, erros de permissão e validação não geram
  retries silenciosos na UI.
- **Tipos compartilhados** — qualquer alteração de schema das rotas exige
  `cd apps/api && npm run kubb` para regerar tipos em `packages/types/` e
  hooks em `apps/web/src/kubb/hooks/`.
- **Sessões revogadas em mudanças sensíveis** — desativar uma org limpa o
  `session.activeOrganizationId` apontando para ela; alterar
  `isPlatformAdmin` apaga todas as sessões do usuário alvo (cache de cookie
  de 5 min).

## Links rápidos

- [Organizações (CRUD)](./organizations.md)
- [Membros e roles](./members-and-roles.md)
- [Importação CSV](./csv-import.md)
- [Domínios de email](./email-domains.md)
- [Convites](./invitations.md)
- [Emails (triggers)](./emails.md)
