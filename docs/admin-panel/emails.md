# Emails do Admin Panel

Referencia consolidada de todos os emails disparados pelo Admin Panel
(e pela autenticacao subjacente). Esta e a fonte da verdade para
responder a pergunta "quando o sistema envia um email?".

Cada email descrito abaixo tem trigger (acao que dispara), payload
(destinatario, assunto e conteudo), transport (Resend ou log de dev) e
template (arquivo onde o HTML mora). Use a tabela resumo no final para
descobrir rapidamente se uma acao envia ou nao envia email.

---

## 1. Visao geral

- **Provider primario:** [Resend](https://resend.com) via SDK oficial
  (`resend` no `package.json` de `packages/infra`).
- **Fallback em dev:** se `RESEND_API_KEY` nao estiver setada, o codigo
  loga no `stdout` o destinatario, assunto e URL final em vez de
  disparar a chamada HTTP. Isso vale para os 3 emails do sistema
  (verificacao, reset de senha e convite).
- **Variavel que ativa o envio real:** `RESEND_API_KEY`. Com ela
  ausente ou vazia, o cliente Resend e instanciado como `null` e
  todas as funcoes caem no caminho de log.

Arquivos relevantes:

- `packages/infra/src/auth/email.ts` — templates de verificacao e
  reset de senha.
- `packages/infra/src/auth/invitation-email.ts` — template de convite
  + helper `escapeHtml`.
- `packages/infra/src/auth/index.ts` — hooks do Better Auth que
  conectam os templates aos eventos (`emailVerification`,
  `sendResetPassword`, `organization.sendInvitationEmail`).
- `apps/api/src/http/routes/v1/organizations/invitations/create.ts` —
  rota de convite que dispara manualmente o email no caminho Platform
  Admin (Better Auth e bypassado nesse fluxo).
- `packages/infra/src/env.ts` — declaracao das variaveis
  `RESEND_API_KEY` (opcional) e `EMAIL_FROM` (default
  `noreply@taco-ide.com`).

---

## 2. Configuracao

### 2.1. Variaveis de ambiente

Configure no `.env` da raiz do monorepo. Exemplo (`.env.example`):

```env
# --- Email (Resend) - opcional ---
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@taco-ide.com

# URL absoluta usada para montar links de aceite/reset/verificacao
FRONTEND_URL=http://localhost:4001

# Necessario por Better Auth para validar tokens de verificacao/reset
BETTER_AUTH_URL=http://localhost:4000
```

| Variavel           | Obrigatoria   | Default                  | O que controla                                              |
| ------------------ | ------------- | ------------------------ | ----------------------------------------------------------- |
| `RESEND_API_KEY`   | Nao           | `undefined`              | Liga o envio real via Resend. Sem ela, todos os emails caem no log de dev. |
| `EMAIL_FROM`       | Nao           | `noreply@taco-ide.com`   | Endereco no header `From` enviado ao Resend.                |
| `FRONTEND_URL`     | Sim (default) | `http://localhost:4001`  | Monta links absolutos para `/auth/accept-invitation`, etc.  |
| `BETTER_AUTH_URL`  | Sim           | nenhum                   | Base url usada pelo Better Auth para gerar o `url` dos hooks de verificacao e reset. |

### 2.2. Onde fica o setup

- O cliente Resend e instanciado lazy em duas posicoes (uma por
  arquivo de template):

  - `packages/infra/src/auth/email.ts:4`
  - `packages/infra/src/auth/invitation-email.ts:4`

  Ambos com a mesma guarda:

  ```ts
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  ```

- O Better Auth conecta os templates aos eventos em
  `packages/infra/src/auth/index.ts`:

  - `emailVerification.sendVerificationEmail` (linha ~69) chama
    `sendVerificationEmail`.
  - `emailAndPassword.sendResetPassword` (linha ~93) chama
    `sendPasswordResetEmail`.
  - `organization.sendInvitationEmail` (linha ~155) chama
    `sendInvitationEmail`.

---

## 3. Catalogo de emails

### Email: Verificacao de email no signup

- **Trigger**: cadastro via `POST /v1/auth/sign-up/email` (Better
  Auth). O hook `emailVerification.sendOnSignUp: true` e
  `sendVerificationEmail` esta configurado, entao o envio dispara
  apos a criacao do `user` + `account`.
- **Origem (codigo)**: hook em
  `packages/infra/src/auth/index.ts:66-85`; template em
  `packages/infra/src/auth/email.ts:69-117`.
- **Para**: `user.email` recem-cadastrado.
- **Assunto**: `Verify your email - TACO-IDE`.
- **Conteudo**:
  - Saudacao `Hi {userName}` (cai para o prefixo do email se `name`
    for nulo).
  - Botao "Verify Email" apontando para um link absoluto (o codigo
    reescreve o `callbackURL` para iniciar com `FRONTEND_URL`).
  - Aviso "This link will expire in 24 hours".
  - URL textual logo abaixo do botao (acessibilidade).
- **Transport**: Resend quando `RESEND_API_KEY` estiver setada. Caso
  contrario, log via `console.log("[DEV] Verification email for ...")`.
- **Idempotencia**: cada sign-up dispara exatamente um email. Reenvio
  exige uma rota explicita do Better Auth (nao exposta hoje pelo
  Admin Panel).
- **Falhas**: o `try/catch` interno relanca `new Error("Failed to send
  verification email")` apos logar. O hook do Better Auth deixa
  borbulhar — o cliente recebe erro 500 e o sign-up nao roda o
  `databaseHooks.user.create.after` (auto-link por dominio). Operadores
  veem o erro nos logs da API.
- **Observacao sobre produc​ao vs dev**: `emailAndPassword
  .requireEmailVerification` so e `true` em `NODE_ENV=production`
  (`packages/infra/src/auth/index.ts:90`). Em dev o usuario consegue
  logar sem clicar no link.

### Email: Reset de senha

- **Trigger**: `POST /v1/auth/request-password-reset` (rota nativa do
  Better Auth) com um email valido.
- **Origem (codigo)**: hook em
  `packages/infra/src/auth/index.ts:93-109`; template em
  `packages/infra/src/auth/email.ts:18-67`.
- **Para**: `user.email` correspondente.
- **Assunto**: `Reset your password - TACO-IDE`.
- **Conteudo**:
  - Saudacao `Hi {userName}`.
  - Botao "Reset Password" apontando para o link com token gerado
    pelo Better Auth. O `callbackURL` e reescrito para `FRONTEND_URL`
    + `/auth/reset-password` por default.
  - Aviso "If you didn't request this, you can safely ignore this
    email."
  - "This link will expire in 1 hour."
  - URL textual abaixo do botao.
- **Transport**: Resend quando `RESEND_API_KEY` estiver setada; senao
  log `[DEV] Password reset email for ...`.
- **Idempotencia**: cada chamada da rota dispara um email. Nao ha
  debounce/rate-limit aplicado no nivel deste hook — em producao,
  considere proteger a rota com rate limit externo.
- **Falhas**: igual ao email de verificacao — `try/catch` interno
  loga e relanca `Error("Failed to send password reset email")`. O
  hook do Better Auth borbulha o erro e a request retorna 500.

### Email: Convite de organizacao

- **Trigger**: `POST /v1/organizations/:id/invitations` com role
  valido e email novo (sem convite pendente para a mesma org).
- **Origem (codigo)**:
  - Helper compartilhado: `packages/infra/src/auth/invitation-email.ts`
    (funcao `sendInvitationEmail`).
  - Caminho usuario com membership (coordinator+ na propria org): o
    plugin `organization` do Better Auth dispara o hook
    `sendInvitationEmail` em `packages/infra/src/auth/index.ts:155-173`.
  - Caminho Platform Admin (sem `member` row na org alvo): a rota
    insere o `invitation` direto via Drizzle (transacao SERIALIZABLE,
    retry em `40001`) e chama `sendInvitationEmail` manualmente —
    `apps/api/src/http/routes/v1/organizations/invitations/create.ts:232-247`.
    O Better Auth NAO e chamado nesse caminho, por isso o envio
    manual e necessario.
- **Para**: email informado no body (normalizado para lowercase no
  caminho Platform Admin antes do insert).
- **Assunto**: `Invitation to join {organizationName} - TACO-IDE`.
- **Conteudo**:
  - Linha de saudacao: `{inviterName} invited you to join` ou
    fallback `You have been invited to join` quando `inviterName` for
    `undefined` (e.g. convite via Platform Admin sem `name` no `user`).
  - Nome da organizacao + role em negrito.
  - Botao "Accept Invitation" apontando para
    `${FRONTEND_URL}/auth/accept-invitation?id={invitationId}`
    (`invitationId` passa por `encodeURIComponent`).
  - Linha opcional "This invitation expires on {expiresAt.toUTCString()}".
  - URL textual abaixo do botao.
- **Transport**: Resend quando `RESEND_API_KEY` estiver setada; senao
  log estruturado em multi-linhas (organization, role, accept URL,
  expires at). Veja `invitation-email.ts:53-60`.
- **Idempotencia**: a rota previne convites duplicados pendentes
  (mesmo email + mesma org + status `pending`) com transacao
  SERIALIZABLE e mapeia `40001`/`23505` para HTTP 409. Cada criacao
  bem-sucedida dispara exatamente um email.
- **Falhas**:
  - No caminho Better Auth (hook): erros sao "engolidos" e logados
    como `[organization.sendInvitationEmail] failed:` para nao
    abortar o `auth.api.createInvitation` (a row ja foi inserida pelo
    plugin antes do hook).
  - No caminho Platform Admin (rota): tambem sao engolidos e logados
    com `request.log.error(..., "sendInvitationEmail (platform admin)
    failed")`. A request retorna 201 mesmo se o email falhar — o
    operador precisa cancelar e recriar o convite para reenviar.
- **Hardening (XSS)**: `organizationName`, `inviterName`, `role` e
  `expiresAt.toUTCString()` passam pela funcao local `escapeHtml`
  (`invitation-email.ts:6-13`) antes de serem interpolados no HTML.
  O `acceptUrl` nao usa `escapeHtml` porque o `invitationId` ja vai
  via `encodeURIComponent` (apenas atributo `href`, sem corpo de
  texto). Isso fecha a CSV import-driven XSS levantada na QA-1 do PR
  do Admin Panel: mesmo que um operador importe um aluno com
  `name: "<script>alert(1)</script>"` e mais tarde esse aluno
  convide alguem, o nome aparece escapado no email.

---

## 4. Tabela resumo

Resposta rapida para "essa acao do Admin Panel envia email?".

| Acao                                              | Dispara email? | Qual?                                  |
| ------------------------------------------------- | -------------- | -------------------------------------- |
| Criar organizacao                                 | Nao            | —                                      |
| Editar organizacao (rename / metadata)            | Nao            | —                                      |
| Desativar organizacao (`isActive=false`)          | Nao            | —                                      |
| Reativar organizacao                              | Nao            | —                                      |
| Vincular usuario existente (`addExistingMember`)  | Nao            | —                                      |
| Alterar role de um membro                         | Nao            | —                                      |
| Remover membro                                    | Nao            | —                                      |
| Importar CSV (qualquer cenario)                   | Nao            | — (admin compartilha senha gerada)     |
| Criar regra de dominio                            | Nao            | —                                      |
| Editar/remover regra de dominio                   | Nao            | —                                      |
| Auto-link por dominio no signup                   | Depende        | Verificacao Better Auth (so se o signup dispara o hook do `emailVerification`) |
| Criar convite                                     | Sim            | Convite de organizacao (HTML escapado) |
| Reenviar convite (recriacao manual)               | Sim            | Convite de organizacao                 |
| Cancelar convite                                  | Nao            | —                                      |
| Aceitar convite                                   | Nao            | —                                      |
| Promover Platform Admin                           | Nao            | —                                      |
| Self-demote Platform Admin (409)                  | Nao            | — (acao bloqueada)                     |
| Reset de senha (request)                          | Sim            | Reset de senha (Better Auth)           |
| Signup com email/password                         | Sim            | Verificacao de email (Better Auth)     |

Observacoes:

- **CSV import**: a rota gera senhas temporarias para cada usuario
  novo, mas NAO envia email com a credencial. O operador e
  responsavel por entregar a senha (no UI de import o resultado e
  exibido em tabela e permite copiar/exportar). Esse comportamento e
  intencional — emails em massa caem facil em SPAM e o publico-alvo
  do TACO-IDE (turmas) costuma estar em um canal compartilhado fora
  do email.
- **Auto-link por dominio**: o auto-link e feito no
  `databaseHooks.user.create.after` (apos o user existir). O email de
  verificacao e enviado independentemente pelo
  `emailVerification.sendVerificationEmail`, entao a presenca de um
  email apos signup depende SO da rota de signup, nao da regra de
  dominio.
- **Alterar role / remover membro / cancelar convite**: a UX
  intencional e que o operador comunique fora-de-banda. Nao ha
  template nem trigger no codigo.

---

## 5. Como ver emails em dev

### 5.1. Sem `RESEND_API_KEY`

Os 3 helpers detectam `resend === null` e logam no `stdout` do
processo da API. Mensagens:

- **Verificacao**:
  ```
  [DEV] Verification email for {email}:
    Verification URL: {url-com-token}
  ```
- **Reset de senha**:
  ```
  [DEV] Password reset email for {email}:
    Reset URL: {url-com-token}
  ```
- **Convite**:
  ```
  [DEV] Invitation email for {email}:
    Organization: {orgName}
    Role: {role}
    Accept URL: {FRONTEND_URL}/auth/accept-invitation?id={invitationId}
    Expires at: {iso-string}    # somente se expiresAt presente
  ```

Para testar localmente o fluxo completo: copie o `Accept URL` (ou
`Reset URL` / `Verification URL`) do log da API, cole no navegador,
e continue o fluxo no frontend.

### 5.2. Com `RESEND_API_KEY` valida

- Configure `RESEND_API_KEY` no `.env` da raiz.
- Configure `EMAIL_FROM` para um dominio verificado no Resend.
- O Resend exige verificacao de dominio em producao. Em dev voce pode
  usar o sandbox do Resend ou um endereco do tipo
  `onboarding@resend.dev`.
- Verifique entrega no dashboard Resend → Logs.

### 5.3. Inbox de teste

Se voce nao tem um dominio verificado e precisa simular caixas de
entrada de varios usuarios:

- Use um servico tipo Mailtrap, MailHog ou Ethereal e aponte o Resend
  para esse SMTP via `Resend.transport` (nao suportado pelo wrapper
  atual — exigiria PR no `email.ts`/`invitation-email.ts`). Por hora,
  o caminho mais simples e operar em modo `[DEV]` (sem `RESEND_API_KEY`)
  e usar os logs.

---

## 6. Hardening relevante

### 6.1. XSS escape no email de convite (QA-1 do PR)

Strings que vem do banco e que SAO interpoladas como conteudo de tag
HTML passam pelo `escapeHtml`:

```ts
// packages/infra/src/auth/invitation-email.ts
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

Aplicado em:

- `inviterName` (linha 45)
- `organizationName` (linha 47)
- `role` (linha 48)
- `expiresAt.toUTCString()` (linha 50)

O `acceptUrl` nao precisa de `escapeHtml` porque `invitationId` ja
passa por `encodeURIComponent` e nao ha conteudo textual entre
tags — apenas o atributo `href` e o texto da URL (que e segura).

Os templates de verificacao e reset (`email.ts`) interpolam
`userName` direto. Isso e considerado seguro porque o `name` do user
e validado/normalizado pelo Better Auth no signup (limite de
tamanho, sem injecao). Mesmo assim, caso uma rota administrativa
permita alterar `user.name` no futuro, vale aplicar `escapeHtml`
tambem ali — TODO documentado abaixo.

### 6.2. Bounds em concorrencia (CSV import — commit `b94f7df1`)

Embora nao seja um email em si, o CSV import _poderia_ disparar uma
rajada de convites/sign-ups se quisessemos enviar email por linha.
Hoje o import:

- Persiste membros por linha (commit `b94f7df1`).
- Limita a concorrencia do hash de senha para evitar saturacao do
  worker pool.
- **Nao envia email**. Esse e o "guardrail" mais simples contra ser
  marcado como spam: o sistema simplesmente nao gera email em massa.

### 6.3. Engolir erros do hook de email

Os 2 caminhos de convite (Better Auth e Platform Admin) engolem
falhas do `sendInvitationEmail` para preservar idempotencia da
criacao do convite. Operadores devem monitorar logs:

- `[organization.sendInvitationEmail] failed:` (caminho Better Auth)
- `sendInvitationEmail (platform admin) failed` (caminho rota)

Se aparecer com frequencia, verifique `RESEND_API_KEY`,
`EMAIL_FROM` (dominio verificado) e o status do Resend.

---

## 7. TODOs deixados

- Adicionar `escapeHtml` em `userName` nos templates de verificacao
  e reset de senha (`packages/infra/src/auth/email.ts`) — defesa em
  profundidade caso alguma rota administrativa exponha edicao de
  `user.name` no futuro.
- Reenvio de convite: nao ha endpoint dedicado hoje. O fluxo
  recomendado e cancelar + recriar. Se o produto pedir "reenviar"
  como acao explicita, sera preciso uma rota
  `POST /v1/organizations/:id/invitations/:invitationId/resend` que
  reutilize `sendInvitationEmail` com a row existente.
- Notificacao opcional ao remover membro / alterar role: hoje nao
  existe. Discutir com produto se faz sentido para auditoria/UX.
- Rate limit explicito na rota de reset de senha — atualmente
  nenhuma protecao alem do que o Better Auth oferece por padrao.
