# Auditoria Completa da Plataforma TACO-IDE

> **Data:** 2026-02-20
> **Branch auditada:** `feat--explore-api-and-problem-api`
> **Ultimo commit:** `1480255e` - feat(api): add challenges API endpoints

---

## Status de Implementacao (Semana 1 - 2026-02-22)

| Item da Auditoria | Status | Detalhes |
|-------------------|--------|----------|
| 2.2 Middleware NAO aplica RBAC | **RESOLVIDO** | `authMiddleware` agora carrega `role` e `activeOrganizationId` da tabela `member`. Factories `requireRole()` e `requirePermission()` criadas em `authorization.ts` |
| 2.3 Rate Limiting Inexistente | Pendente (semana 2+) | - |
| 2.4 Global Error Handler Ausente | Pendente (semana 2+) | - |
| 5.2 `hasAccess={true}` Hardcoded | **RESOLVIDO** | `Header.tsx` agora usa `useRole()` hook para determinar acesso |
| 5.6 Pagina `/profile` Nao Existe | **RESOLVIDO** | Criada em `apps/web/src/app/(inside)/profile/page.tsx` com formulario de edicao |
| 10.1.1 Middleware RBAC | **RESOLVIDO** | Role carregada no middleware, tipos expandidos |
| 10.1.2 Helper `requireRole` | **RESOLVIDO** | `requireRole()` e `requirePermission()` em `authorization.ts` |
| 10.1.6 Protecao `/create` por role | **RESOLVIDO** | `RoleGuard` com `minimumRole="teacher"` aplicado na pagina |
| 10.4.3 Pagina `/profile` | **RESOLVIDO** | `PUT /v1/users/me` + pagina frontend com formulario |
| 10.4.5 `hasAccess` permissoes reais | **RESOLVIDO** | Hook `useRole()` substitui hardcoded `true` |

### Novos Artefatos Criados

| Arquivo | Descricao |
|---------|-----------|
| `.env.example` | Template de variaveis de ambiente |
| `apps/api/src/http/middlewares/authorization.ts` | Factories `requireRole()` e `requirePermission()` |
| `apps/api/src/http/routes/v1/users/update.ts` | `PUT /v1/users/me` - atualizar perfil |
| `apps/web/src/hooks/usePermission.ts` | Hooks `useRole()`, `useHasMinimumRole()`, `useHasPermission()` |
| `apps/web/src/components/guards/RoleGuard.tsx` | Guard component por hierarquia de role |
| `apps/web/src/components/guards/PermissionGuard.tsx` | Guard component por permissao especifica |
| `apps/web/src/app/(inside)/profile/page.tsx` | Pagina de perfil do usuario |

### Proximos Passos

- **Semana 2:** Organizations CRUD, Classrooms CRUD, Challenges CUD, Teaching Assistants CRUD, Models CRUD (equipe)
- **Semana 2:** Integrar RBAC middleware nas novas rotas via `requirePermission()`
- **Semana 2:** Testes unitarios para middlewares de autorizacao
- **Semana 3:** Knowledge Base CRUD, paginas de gestao, Conversation Replays

---

## Indice

1. [Resumo Executivo](#1-resumo-executivo)
2. [RBAC e Seguranca](#2-rbac-e-seguranca)
3. [Rotas de API - Mapa Completo](#3-rotas-de-api---mapa-completo)
4. [Tabelas do Banco vs Rotas Implementadas](#4-tabelas-do-banco-vs-rotas-implementadas)
5. [Frontend - Funcionalidades Fake ou Incompletas](#5-frontend---funcionalidades-fake-ou-incompletas)
6. [Navegacao e Links Quebrados](#6-navegacao-e-links-quebrados)
7. [Infraestrutura e Middleware](#7-infraestrutura-e-middleware)
8. [TODOs e Debitos Tecnicos](#8-todos-e-debitos-tecnicos)
9. [Cross-Reference: Frontend x Backend](#9-cross-reference-frontend-x-backend)
10. [Plano de Acao Priorizado](#10-plano-de-acao-priorizado)

---

## 1. Resumo Executivo

A plataforma possui um nucleo funcional solido (login, resolver problemas, executar codigo, chat com TA), mas apresenta **lacunas significativas** em:

- **Seguranca**: RBAC definido mas nunca aplicado nas rotas
- **CRUD incompleto**: 5 tabelas sem nenhuma rota, 3 modulos com CRUD parcial
- **Frontend fake**: Formulario de criacao de problema inerte, dados hardcoded, botoes sem acao
- **Infraestrutura**: Sem rate limiting, sem error handler global

| Categoria | Criticos | Altos | Medios | Baixos | Total |
|-----------|----------|-------|--------|--------|-------|
| Seguranca / RBAC | 3 | - | - | - | 3 |
| Rotas API faltando | 3 | 2 | 2 | 1 | 8 |
| Frontend fake/incompleto | 2 | 3 | 3 | 2 | 10 |
| Navegacao/links | - | 1 | 2 | 1 | 4 |
| Infraestrutura | 1 | 1 | 1 | - | 3 |
| **Total** | **9** | **7** | **8** | **4** | **28** |

---

## 2. RBAC e Seguranca

### 2.1 Roles Definidos (OK)

**Arquivo:** `packages/infra/src/auth/permissions.ts`

```
studentRole       -> sem permissoes (apenas consumidor)
teacherRole       -> classroom: create/update
                     challenge: create/update/delete
                     teachingAssistant: create/update
                     member: create
                     invitation: create
coordinatorRole   -> tudo de teacher + organization: update
                     member: update/delete, invitation: cancel
                     classroom: delete, teachingAssistant: delete
adminRole         -> mesmo que coordinator
```

O Better Auth organization plugin esta configurado corretamente em `packages/infra/src/auth/index.ts:108-122` com os 4 roles mapeados.

### 2.2 [CRITICO] Middleware NAO aplica RBAC

**Arquivo:** `apps/api/src/http/middlewares/auth.ts`

O middleware de autenticacao:
- Valida sessao via Better Auth (linha 23)
- Verifica se usuario esta ativo (linha 25-51)
- Anexa dados ao `request.user` (linha 55-63)

**Problema:** O campo `role` NAO e carregado. O objeto `request.user` contem:

```typescript
// auth.ts:55-63
request.user = {
  id,        // string
  email,     // string
  name,      // string
  emailVerified, // boolean
  isActive,  // boolean
  createdAt, // Date
  updatedAt, // Date
}
// FALTA: role, organizationId
```

Nenhuma rota verifica permissoes. Um estudante pode fazer as mesmas operacoes que um professor ou admin.

### 2.3 [CRITICO] Rate Limiting Inexistente

**Arquivo:** `apps/api/src/http/server.ts`

Nenhum rate limiting configurado. Endpoints vulneraveis:

| Endpoint | Risco |
|----------|-------|
| `POST /v1/auth/sign-in/email` | Brute force de login |
| `POST /v1/auth/request-password-reset` | Spam de reset |
| `POST /v1/work-sessions/:id/chat` | Abuso de custo (OpenRouter API) |

### 2.4 [CRITICO] Global Error Handler Ausente

**Arquivo:** `apps/api/src/http/server.ts`

Nao ha `app.setErrorHandler()`. Erros nao capturados podem:
- Vazar stack traces em producao
- Retornar respostas inconsistentes
- Causar crashes silenciosos

### 2.5 IDOR - Verificacao Parcial

| Rota | Verifica ownership? |
|------|---------------------|
| `GET /v1/work-sessions/:id` | SIM (session.userId === user.id) |
| `POST /v1/work-sessions/:id/chat` | SIM (via session check) |
| `GET /v1/challenges` (scope=all) | PARCIAL - estudante ve tudo? |
| `GET /v1/challenges/:id` | NAO - qualquer usuario ve qualquer challenge |
| `PUT /v1/challenges/:id/solution` | SIM (upsert por userId) |

---

## 3. Rotas de API - Mapa Completo

### 3.1 Rotas Existentes

**Arquivo:** `apps/api/src/http/routes/v1/index.ts`

```
Modulos registrados:
  authRoutes           -> /v1/auth/* (Better Auth)
  statusRoutes         -> /v1/status
  usersRoutes          -> /v1/users/*
  challengesRoutes     -> /v1/challenges/*
  workSessionsRoutes   -> /v1/work-sessions/*
```

#### Challenges (`apps/api/src/http/routes/v1/challenges/`)

| Metodo | Rota | Status | Arquivo |
|--------|------|--------|---------|
| GET | `/v1/challenges` | Implementado | `list.ts` |
| GET | `/v1/challenges/:id` | Implementado | `getById.ts` |
| POST | `/v1/challenges` | **NAO EXISTE** | - |
| PUT | `/v1/challenges/:id` | **NAO EXISTE** | - |
| DELETE | `/v1/challenges/:id` | **NAO EXISTE** | - |

#### Solutions (`apps/api/src/http/routes/v1/solutions/`)

| Metodo | Rota | Status | Arquivo |
|--------|------|--------|---------|
| GET | `/v1/challenges/:id/solution` | Implementado | `get.ts` |
| PUT | `/v1/challenges/:id/solution` | Implementado | `upsert.ts` |
| DELETE | `/v1/challenges/:id/solution` | **NAO EXISTE** | - |

#### Work Sessions (`apps/api/src/http/routes/v1/work-sessions/`)

| Metodo | Rota | Status | Arquivo |
|--------|------|--------|---------|
| POST | `/v1/work-sessions` | Implementado | `create.ts` |
| GET | `/v1/work-sessions/:id` | Implementado | `getById.ts` |
| GET | `/v1/work-sessions/by-challenge?challengeId=` | Implementado | `getByChallenge.ts` |
| POST | `/v1/work-sessions/:id/interactions` | Implementado | `addInteraction.ts` |
| POST | `/v1/work-sessions/:id/chat` | Implementado | `chat.ts` |
| GET | `/v1/work-sessions` (listar) | **NAO EXISTE** | - |
| POST | `/v1/work-sessions/:id/end` | **NAO EXISTE** | - |
| DELETE | `/v1/work-sessions/:id` | **NAO EXISTE** | - |

#### Users (`apps/api/src/http/routes/v1/users/`)

| Metodo | Rota | Status |
|--------|------|--------|
| GET | `/v1/users/me` | Implementado |

### 3.2 Modulos Completamente Ausentes

Estas tabelas existem no banco mas nao possuem **nenhuma rota**:

| Modulo | Tabela(s) | Operacoes Necessarias |
|--------|-----------|----------------------|
| Classrooms | `classroom`, `userClassroom` | CRUD classroom + enroll/unenroll |
| Teaching Assistants | `teachingAssistant`, `challengeTeachingAssistant` | CRUD TA + assign/unassign a challenges |
| Models | `model` | CRUD model (LLM configs) |
| Knowledge Base | `knowledgeBase` | CRUD KB entries |
| Conversation Replay | `conversationReplay`, `replayInteraction` | Create replay, list, get with interactions |
| Organizations/Members | `organization`, `member` | List members, update roles, invite |

---

## 4. Tabelas do Banco vs Rotas Implementadas

### Schema Completo (`packages/infra/src/db/schema/`)

#### Tabelas de Aplicacao (`app.ts`)

| Tabela | Colunas Principais | Tem Rotas? | CRUD Status |
|--------|-------------------|------------|-------------|
| `classroom` | id, organizationId, title, description, deletedAt | NAO | 0/5 |
| `userClassroom` | userId, classroomId, enrolledAt, deletedAt | NAO | 0/3 |
| `model` | id, version, name, description, modelParameters | NAO | 0/5 |
| `teachingAssistant` | id, alias, version, modelId, systemPrompt, isActive | NAO | 0/5 |
| `challenge` | id, classroomId, title, difficulty, tags, possibleSolutions | PARCIAL | 2/5 |
| `challengeTeachingAssistant` | challengeId, teachingAssistantId, isDefault | NAO | 0/3 |
| `workSession` | id, userId, challengeId, teachingAssistantId, endedAt | PARCIAL | 5/8 |
| `userInteractionOnChallenge` | id, workSessionId, interactionType, code, stdin, stdout | PARCIAL | 1/2 |
| `challengeSolution` | id, userId, challengeId, chatHistory, code | SIM | 2/3 |
| `knowledgeBase` | id, organizationId, content (embedding omitido) | NAO | 0/4 |
| `conversationReplay` | id, originalWorkSessionId, replayTeachingAssistantId | NAO | 0/3 |
| `replayInteraction` | id, replayId, originalInteractionId | NAO | 0/2 |

#### Tabelas de Auth (`auth.ts` - Better Auth managed)

| Tabela | Gerenciada por | Tem Rotas? |
|--------|---------------|------------|
| `user` | Better Auth + custom fields (isActive, deletedAt) | SIM (via /users/me) |
| `session` | Better Auth | SIM (automatico) |
| `account` | Better Auth | SIM (automatico) |
| `verification` | Better Auth | SIM (automatico) |
| `organization` | Better Auth organization plugin | NAO (custom routes) |
| `member` | Better Auth organization plugin | NAO (custom routes) |
| `invitation` | Better Auth organization plugin | NAO (custom routes) |

### Nota sobre Knowledge Base

A tabela `knowledgeBase` tem o campo `embedding` comentado no schema:

```typescript
// packages/infra/src/db/schema/app.ts:218
// embedding column omitted - requires pgvector extension
```

Isso impede implementacao de RAG (Retrieval-Augmented Generation). A extensao `pgvector` nao esta instalada no PostgreSQL.

---

## 5. Frontend - Funcionalidades Fake ou Incompletas

### 5.1 [CRITICO] Formulario de Criacao de Problema Inerte

**Arquivo:** `apps/web/src/app/(inside)/create/page.tsx`

O formulario possui campos visuais mas **nao envia dados**:

| Campo | Tem State? | Envia para API? |
|-------|-----------|-----------------|
| Problem Title (Input) | Nao verificado | NAO |
| Short Description (Input) | Nao verificado | NAO |
| Difficulty (Select) | Nao verificado | NAO |
| Tags (Input + badges) | Nao verificado | NAO |
| Reference Material (File) | Nao verificado | NAO |
| Assistant Personality (Select) | Nao verificado | NAO |
| Problem Description (Textarea + MD preview) | Nao verificado | NAO |

**Botoes sem handler:**

```typescript
// Linha 202-206 - Botao Cancel
<Button variant="outline">
  <X className="w-4 h-4" /> Cancel     // <- SEM onClick
</Button>

// Linha 208-212 - Botao Create
<Button>
  <Save className="w-4 h-4" /> Create Problem   // <- SEM onClick
</Button>
```

**Causa raiz:** O endpoint `POST /v1/challenges` nao existe no backend, entao nao ha para onde enviar os dados.

### 5.2 [CRITICO] `hasAccess={true}` Hardcoded

**Arquivo:** `apps/web/src/app/problem/[id]/_components/Header.tsx:27`

```typescript
<LanguageSelector hasAccess={true} />
```

O `LanguageSelector` usa `hasAccess` para decidir quais linguagens ficam bloqueadas. Com `true` hardcoded, **todas as linguagens estao sempre liberadas**, ignorando qualquer restricao de acesso.

O componente (`LanguageSelector.tsx:30,92`) tem logica para bloquear linguagens quando `!hasAccess && lang.id !== "javascript"`, mas essa logica nunca e ativada.

### 5.3 [ALTO] Classes Hardcoded no Explore

**Arquivo:** `apps/web/src/app/(inside)/explore/page.tsx:37-40`

```typescript
const ClassesDatabase = [
  { id: 1, name: "CS-201", description: "Advanced Algorithms",
    instructor: "Prof. Dr. John Doe" },
  { id: 2, name: "CS-305", description: "Computational Theory",
    instructor: "Prof. Dr. Jane Smith" },
];
```

A secao "Turmas em Destaque" mostra dados fictcios. Nao existe endpoint `/v1/classrooms` para buscar dados reais.

### 5.4 [ALTO] Botao Profile na Pagina de Problema Nao Funciona

**Arquivo:** `apps/web/src/app/problem/[id]/_components/HeaderProfileBtn.tsx:1-15`

```typescript
function HeaderProfileBtn() {
  return (
    <button className="...">
      <User className="w-5 h-5 text-gray-300" />
      <span>Profile</span>
    </button>       // <- SEM onClick, SEM Link, SEM navegacao
  );
}
```

### 5.5 [ALTO] Pagina `/problem` e um Stub Vazio

**Arquivo:** `apps/web/src/app/problem/page.tsx:1-7`

```typescript
export default function ProblemPage() {
  return (
    <div>
      <h1>Problema</h1>
    </div>
  );
}
```

A rota `/problem` (sem ID) renderiza apenas um titulo. Deveria redirecionar para `/explore` ou listar problemas.

### 5.6 [MEDIO] Pagina `/profile` Nao Existe

**Referenciada em:** `apps/web/src/app/(inside)/_components/navbar.tsx:69`

```typescript
<Link href="/profile">Perfil</Link>
```

O link existe no dropdown do usuario mas a pagina nao foi criada. Resulta em 404.

### 5.7 [MEDIO] Code Editor Store - Debug em Producao

**Arquivo:** `apps/web/src/store/useCodeEditorStore.ts`

```typescript
// Linha 115
console.log("data back from piston:", data);

// Linha 166
console.log("Error running code:", error);
```

Logs de debug vazam dados para o console do browser.

---

## 6. Navegacao e Links Quebrados

### 6.1 Mapa de Rotas do Frontend

```
PAGINAS PUBLICAS
  /                          -> Landing page (home)         OK
  /auth/login                -> Login                       OK
  /auth/signup               -> Cadastro                    OK
  /auth/verify               -> Verificacao de email        OK
  /auth/reset-password       -> Reset de senha              OK

AREA AUTENTICADA (layout: (inside))
  /explore                   -> Lista de challenges         OK
  /create                    -> Criar problema              INERTE (sem submit)
  /profile                   -> Perfil do usuario           NAO EXISTE (404)

AREA DE PROBLEMA (layout: problem/[id])
  /problem                   -> Stub vazio                  INCOMPLETO
  /problem/[id]              -> Resolver problema           OK
```

### 6.2 Links Quebrados

| Local | Link | Problema |
|-------|------|----------|
| `apps/web/src/app/(inside)/_components/navbar.tsx:69` | `/profile` | Pagina nao existe |
| `apps/web/src/app/auth/layout.tsx:30` | `#` (Terms of Service) | Placeholder sem destino |
| `apps/web/src/app/auth/layout.tsx:30` | `#` (Privacy Policy) | Placeholder sem destino |
| `apps/web/src/app/(inside)/_components/footer.tsx:19` | `#recursos` | Ancora inexistente na pagina |

### 6.3 Navegacao Funcional (OK)

- `/explore` -> clique em challenge -> `/problem/[id]` (funciona)
- `/problem/[id]` -> botao "Voltar" -> `/explore` (funciona)
- Login bem-sucedido -> redirect para `/explore` (funciona)
- Usuario autenticado acessa `/auth/*` -> redirect para `/explore` (funciona)
- Landing page anchors (`#features`, `#collaborators`) (funcionam)
- Logout -> redirect para `/auth/login` (funciona)

### 6.4 Protecao de Rotas (Middleware)

**Arquivo:** `apps/web/src/middleware.ts`

```
Rotas publicas:  /  (home exata), /auth/*
Rotas protegidas: tudo mais (verifica cookie better-auth.session_token)
Redirect:        usuario nao autenticado -> /auth/login?redirect=<url>
                 usuario autenticado em /auth -> /explore
```

Protecao funciona corretamente para autenticacao. Porem **nao ha protecao por role** (ex: so professor acessa `/create`).

---

## 7. Infraestrutura e Middleware

### 7.1 Servidor Fastify (`apps/api/src/http/server.ts`)

| Recurso | Status | Detalhe |
|---------|--------|---------|
| CORS | OK | Origin: `env.FRONTEND_URL`, credentials: true |
| Cookies | OK | `@fastify/cookie` registrado |
| Auth Hook Global | OK | Public routes definidas, demais passam por `authMiddleware` |
| Swagger/OpenAPI | OK | UI em `/docs`, JSON em `/docs/json`, YAML exportado |
| Rate Limiting | **AUSENTE** | Nenhum plugin de rate limit |
| Error Handler | **AUSENTE** | Sem `app.setErrorHandler()` |
| Request Logging | Fastify default | Sem logging customizado |
| Timeout Config | Nao verificado | - |

### 7.2 Validacao de Ambiente (`packages/infra/src/env.ts`)

| Variavel | Obrigatoria? | Tipo |
|----------|-------------|------|
| `NODE_ENV` | Nao | enum (development/test/production) |
| `DATABASE_URL` | **Sim** | URL |
| `BETTER_AUTH_SECRET` | **Sim** | string (min 32 chars) |
| `BETTER_AUTH_URL` | **Sim** | URL |
| `FRONTEND_URL` | Nao (default: localhost:3000) | URL |
| `RESEND_API_KEY` | Nao | string |
| `EMAIL_FROM` | Nao (default: noreply@taco-ide.com) | email |
| `CLOUDFLARE_TURNSTILE_SECRET` | Nao | string |
| `OPENROUTER_API_KEY` | Nao | string |

**Nota:** `OPENROUTER_API_KEY` e opcional na validacao mas **obrigatoria** para o chat com TA funcionar. O endpoint retorna 503 em runtime se nao configurada (`chat.ts:79-86`).

### 7.3 Better Auth Config (`packages/infra/src/auth/index.ts`)

| Recurso | Status |
|---------|--------|
| Email/password auth | OK |
| Email verification | OK (obrigatoria) |
| Password reset | OK |
| Organization plugin | OK (com AC roles) |
| Session config | 7 dias expiracao, 1 dia update age |
| CORS (auth) | Alinhado com `FRONTEND_URL` |

---

## 8. TODOs e Debitos Tecnicos

### 8.1 TODOs no Codigo

| Arquivo | Linha | TODO |
|---------|-------|------|
| `apps/web/src/store/useCodeEditorStore.ts` | 52 | `TODO: Save code based on the problem on the database` |
| `apps/web/src/store/useCodeEditorStore.ts` | 99 | `TODO: update this to use our own API in the future` |

### 8.2 Console.logs em Producao

| Arquivo | Linha | Conteudo |
|---------|-------|---------|
| `apps/web/src/store/useCodeEditorStore.ts` | 115 | `console.log("data back from piston:", data)` |
| `apps/web/src/store/useCodeEditorStore.ts` | 166 | `console.log("Error running code:", error)` |

### 8.3 Debitos Tecnicos Conhecidos

| Item | Detalhe | Impacto |
|------|---------|---------|
| Piston API externo | Execucao de codigo usa API publica (emkc.org) em vez de infra propria | Dependencia externa, latencia, limites |
| Codigo nao persiste | Codigo do usuario nao salva no banco entre sessoes | Perda de trabalho |
| pgvector nao instalado | Impossibilita RAG/busca semantica no Knowledge Base | Feature bloqueada |
| Markdown nao renderizado | Create page mostra raw markdown na preview em alguns casos | UX degradada |

---

## 9. Cross-Reference: Frontend x Backend

### 9.1 Frontend chama API que NAO existe

| Pagina Frontend | API chamada | Existe? | Impacto |
|-----------------|-------------|---------|---------|
| `/create` | `POST /v1/challenges` | **NAO** | Formulario inerte |
| `/explore` (classes) | `GET /v1/classrooms` | **NAO** | Dados hardcoded |
| `/profile` | `GET /v1/users/me` (parcial) | Parcial | Pagina nao existe |

### 9.2 API existe mas Frontend NAO usa

| Endpoint | Frontend usa? | Nota |
|----------|--------------|------|
| `PUT /v1/challenges/:id/solution` | SIM | Salva solucao |
| `GET /v1/challenges/:id/solution` | SIM | Carrega solucao |
| `POST /v1/work-sessions` | SIM | Cria sessao |
| `POST /v1/work-sessions/:id/interactions` | SIM | Salva interacao |
| `POST /v1/work-sessions/:id/chat` | SIM | Chat com TA |

### 9.3 Fluxos Completos (End-to-End)

| Fluxo | Status | Gaps |
|-------|--------|------|
| Login -> Dashboard -> Explore | OK | - |
| Explore -> Selecionar Challenge -> Resolver | OK | - |
| Resolver -> Executar Codigo -> Ver Output | OK | Usa Piston externo |
| Resolver -> Chat com TA -> Receber Resposta | OK | - |
| Resolver -> Salvar Solucao | OK | - |
| **Criar Challenge (professor)** | **QUEBRADO** | Sem API, sem submit |
| **Editar Challenge** | **INEXISTENTE** | Sem rota, sem pagina |
| **Deletar Challenge** | **INEXISTENTE** | Sem rota, sem UI |
| **Gerenciar Turmas** | **INEXISTENTE** | Sem API, sem paginas |
| **Gerenciar TAs** | **INEXISTENTE** | Sem API, sem paginas |
| **Ver Perfil** | **QUEBRADO** | Link existe, pagina nao |
| **Gerenciar Membros** | **INEXISTENTE** | Sem API, sem paginas |

---

## 10. Plano de Acao Priorizado

### Onda 1: Seguranca e Infraestrutura

**Objetivo:** Proteger a aplicacao antes de adicionar mais features.

| # | Tarefa | Onde | Esforco |
|---|--------|------|---------|
| 1.1 | Implementar middleware RBAC: carregar role do `member` table e anexar em `request.user` | `apps/api/src/http/middlewares/auth.ts` | Medio |
| 1.2 | Criar helper `requireRole(roles[])` para proteger rotas por role | `apps/api/src/http/middlewares/` | Pequeno |
| 1.3 | Aplicar RBAC em todas as rotas existentes (challenges, work-sessions) | Rotas em `apps/api/src/http/routes/v1/` | Medio |
| 1.4 | Adicionar `@fastify/rate-limit` com configs por rota | `apps/api/src/http/server.ts` | Pequeno |
| 1.5 | Implementar `app.setErrorHandler()` global | `apps/api/src/http/server.ts` | Pequeno |
| 1.6 | Protecao de rota `/create` no frontend por role (so professor+) | `apps/web/src/middleware.ts` ou guard component | Pequeno |

### Onda 2: Core Features - CRUD de Challenges

**Objetivo:** Permitir que professores criem e gerenciem problemas.

| # | Tarefa | Onde | Esforco |
|---|--------|------|---------|
| 2.1 | Criar `POST /v1/challenges` (com RBAC: teacher+) | `apps/api/src/http/routes/v1/challenges/create.ts` | Medio |
| 2.2 | Criar `PUT /v1/challenges/:id` (com IDOR check + RBAC) | `apps/api/src/http/routes/v1/challenges/update.ts` | Medio |
| 2.3 | Criar `DELETE /v1/challenges/:id` (soft delete, RBAC) | `apps/api/src/http/routes/v1/challenges/delete.ts` | Pequeno |
| 2.4 | Conectar formulario `/create` com React Hook Form + Zod | `apps/web/src/app/(inside)/create/page.tsx` | Grande |
| 2.5 | Integrar submit do formulario com `POST /v1/challenges` | Mesmo arquivo | Medio |
| 2.6 | Rodar `npm run kubb` para gerar tipos e hooks | `apps/api/` | Automatico |

### Onda 3: Core Features - Classrooms e TAs

**Objetivo:** CRUD completo de turmas e assistentes de ensino.

| # | Tarefa | Onde | Esforco |
|---|--------|------|---------|
| 3.1 | CRUD completo de Classrooms (5 rotas) | `apps/api/src/http/routes/v1/classrooms/` | Grande |
| 3.2 | Enrollment de alunos em turmas (enroll/unenroll) | Mesmo modulo | Medio |
| 3.3 | CRUD completo de Teaching Assistants (5 rotas) | `apps/api/src/http/routes/v1/teaching-assistants/` | Grande |
| 3.4 | Assign/unassign TA a challenges | Mesmo modulo | Medio |
| 3.5 | CRUD de Models (LLM configs) | `apps/api/src/http/routes/v1/models/` | Medio |
| 3.6 | Substituir `ClassesDatabase` hardcoded por API call | `apps/web/src/app/(inside)/explore/page.tsx` | Pequeno |
| 3.7 | Paginas de gestao de turmas no frontend | `apps/web/src/app/(inside)/classrooms/` | Grande |

### Onda 4: Work Sessions, Profile e UX

**Objetivo:** Completar fluxos existentes e corrigir UX.

| # | Tarefa | Onde | Esforco |
|---|--------|------|---------|
| 4.1 | `GET /v1/work-sessions` (listar sessoes do usuario) | `apps/api/src/http/routes/v1/work-sessions/list.ts` | Medio |
| 4.2 | `POST /v1/work-sessions/:id/end` (encerrar sessao) | `apps/api/src/http/routes/v1/work-sessions/end.ts` | Pequeno |
| 4.3 | Criar pagina `/profile` | `apps/web/src/app/(inside)/profile/page.tsx` | Medio |
| 4.4 | Corrigir `HeaderProfileBtn` (navegar ou abrir menu) | `apps/web/src/app/problem/[id]/_components/HeaderProfileBtn.tsx` | Pequeno |
| 4.5 | Corrigir `hasAccess` para buscar permissoes reais | `apps/web/src/app/problem/[id]/_components/Header.tsx` | Pequeno |
| 4.6 | Redirecionar `/problem` para `/explore` | `apps/web/src/app/problem/page.tsx` | Trivial |
| 4.7 | Remover `console.log` de debug | `apps/web/src/store/useCodeEditorStore.ts` | Trivial |

### Onda 5: Polish e Features Secundarias

**Objetivo:** Limpar debitos tecnicos e preparar features avancadas.

| # | Tarefa | Onde | Esforco |
|---|--------|------|---------|
| 5.1 | Corrigir links `#` (Terms, Privacy) ou criar paginas | `apps/web/src/app/auth/layout.tsx` | Pequeno |
| 5.2 | Corrigir link `#recursos` no footer | `apps/web/src/app/(inside)/_components/footer.tsx` | Trivial |
| 5.3 | CRUD de Knowledge Base | Backend + Frontend | Grande |
| 5.4 | Instalar pgvector e implementar embeddings | `packages/infra/` | Grande |
| 5.5 | Conversation Replay (rotas + UI) | Backend + Frontend | Grande |
| 5.6 | Gestao de membros da organizacao | Backend + Frontend | Grande |
| 5.7 | Substituir Piston por API propria de execucao | Infra + Backend | Grande |
| 5.8 | Persistir codigo do usuario no banco | Backend + Store | Medio |

---

## Apendice A: Arquivos Criticos para Revisao

```
SEGURANCA
  packages/infra/src/auth/permissions.ts      -> Roles definidos (OK)
  packages/infra/src/auth/index.ts            -> Better Auth config (OK)
  apps/api/src/http/middlewares/auth.ts        -> FALTA RBAC
  apps/api/src/http/server.ts                 -> FALTA rate-limit + error handler

ROTAS EXISTENTES
  apps/api/src/http/routes/v1/index.ts        -> Registry de modulos
  apps/api/src/http/routes/v1/challenges/     -> GET only (falta CUD)
  apps/api/src/http/routes/v1/work-sessions/  -> CRUD parcial
  apps/api/src/http/routes/v1/solutions/      -> GET + upsert

ROTAS QUE PRECISAM SER CRIADAS
  apps/api/src/http/routes/v1/classrooms/     -> NAO EXISTE
  apps/api/src/http/routes/v1/teaching-assistants/ -> NAO EXISTE
  apps/api/src/http/routes/v1/models/         -> NAO EXISTE
  apps/api/src/http/routes/v1/knowledge-base/ -> NAO EXISTE
  apps/api/src/http/routes/v1/organizations/  -> NAO EXISTE

FRONTEND PROBLEMATICO
  apps/web/src/app/(inside)/create/page.tsx    -> Form inerte
  apps/web/src/app/(inside)/explore/page.tsx   -> Classes hardcoded
  apps/web/src/app/problem/page.tsx            -> Stub vazio
  apps/web/src/app/problem/[id]/_components/Header.tsx -> hasAccess hardcoded
  apps/web/src/app/problem/[id]/_components/HeaderProfileBtn.tsx -> Sem acao
  apps/web/src/store/useCodeEditorStore.ts     -> TODOs + console.logs

SCHEMA
  packages/infra/src/db/schema/app.ts          -> 11 tabelas de app
  packages/infra/src/db/schema/auth.ts         -> 7 tabelas de auth
  packages/infra/src/env.ts                    -> Validacao de env vars
```

## Apendice B: Variaveis de Ambiente

```env
# Obrigatorias
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taco_dev
BETTER_AUTH_SECRET=<min 32 chars>
BETTER_AUTH_URL=http://localhost:3333

# Opcionais (com defaults)
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
EMAIL_FROM=noreply@taco-ide.com

# Opcionais (sem default - features degradam sem elas)
RESEND_API_KEY=               # Email sending (verificacao, reset)
CLOUDFLARE_TURNSTILE_SECRET=  # Bot protection
OPENROUTER_API_KEY=           # Chat com TA (retorna 503 sem ela)
```
