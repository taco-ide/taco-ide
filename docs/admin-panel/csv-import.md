# Importação de membros via CSV

Documentação operacional da importação em lote de membros para uma
organização, suportada pelo endpoint `POST /v1/organizations/{id}/members/import-csv`
e pela modal "Importar membros de CSV" do painel administrativo.

A implementação está em:

- API: `apps/api/src/http/routes/v1/organizations/members/importCsv.ts`
- UI: `apps/web/src/components/admin/csv-import-modal.tsx`

---

## 1. Visão geral

A importação CSV permite criar e/ou vincular vários usuários a uma
organização em uma única requisição. O fluxo é resiliente a erros parciais:
linhas inválidas são relatadas, mas não bloqueiam as linhas válidas
("best-effort processing"). A senha é opcional — quando ausente, a API gera
uma senha aleatória e a devolve no relatório para que o administrador a
distribua por fora do sistema.

Casos de uso típicos:

- Onboarding inicial de uma turma a partir de uma planilha pt-BR exportada
  do Excel ou Google Sheets.
- Vincular alunos e professores já existentes na plataforma a uma nova
  organização.
- Validar um CSV antes de aplicar (modo `dryRun=true`).

---

## 2. Endpoint

| Item | Valor |
| --- | --- |
| Método | `POST` |
| Caminho | `/v1/organizations/{id}/members/import-csv` |
| Content-Type | `multipart/form-data` |
| Campo do arquivo | `file` (único, único arquivo `.csv`) |
| Query opcional | `?dryRun=true` (apenas valida, não persiste) |
| Autenticação | Cookie de sessão Better Auth (`credentials: "include"`) |
| Autorização | Platform admin OU role `coordinator+` na organização ativa correspondente ao `id` da URL |
| Resposta de sucesso | `200 OK` com `{ success: true, data: { dryRun, summary, rows } }` |

A modal envia o arquivo via `FormData` para esse mesmo endpoint, com
`credentials: "include"` para anexar o cookie de sessão.

---

## 3. Formato do arquivo

### Tamanho máximo

- Arquivo: **1 MB** (`1 * 1024 * 1024` bytes). Acima disso a API responde `413`.
- Linhas: **100** linhas de dados (sem contar o cabeçalho). Acima responde `413`
  com a mensagem `CSV exceeds maximum of 100 rows`.

> A UI tem um próprio limite de pré-validação de 1 MB no upload. Ela
> também mostra apenas as **50 primeiras** linhas na tabela de prévia,
> mas o backend é a fonte de verdade do limite real.

### Delimitadores suportados

A API tenta detectar automaticamente entre `,` (locale US) e `;` (locale
Excel pt-BR). Não é necessário sinalizar o delimitador.

### BOM (UTF-8)

O parser tem `bom: true`, então o BOM (`U+FEFF`) que o Excel pt-BR
prepende a arquivos UTF-8 é removido antes do parsing. Cabeçalhos como
`Nome` em arquivos exportados do Excel funcionam sem ajuste manual.

### Cabeçalhos — normalização e aliases

Antes da validação, cada cabeçalho passa por `normalizeHeader`:

1. Remove BOM inicial.
2. `trim()`.
3. `toLowerCase()`.
4. `normalize("NFD")` + remoção de combining marks (`U+0300`–`U+036F`),
   eliminando acentos.

Em seguida, o nome normalizado é mapeado para o nome canônico via
`HEADER_ALIASES`:

| Cabeçalho aceito (qualquer caixa/acento) | Nome canônico |
| --- | --- |
| `name`, `nome` | `name` |
| `email`, `e-mail` | `email` |
| `password`, `senha` | `password` |
| `role`, `funcao`, `papel` (cobre `Função`, `FUNÇÃO`, `Papel`, `papel`) | `role` |

Exemplos válidos: `Nome,E-mail,Senha,Função`, `NAME;EMAIL;SENHA;PAPEL`,
`nome, e-mail, funcao` — todos colapsam para `name,email,password,role`.

Colunas desconhecidas passam adiante já normalizadas e são ignoradas
pelo schema Zod, sem causar erro.

### Coluna `password` é opcional

- Se o cabeçalho `Senha`/`password` estiver presente mas a célula vier
  vazia (após `trim`), o pré-processamento Zod a trata como ausente.
- Linhas sem senha que precisem **criar** um usuário recebem uma senha
  gerada por `randomBytes(16).toString("base64url")` (~22 caracteres
  base64url).
- A senha gerada aparece apenas em linhas com status `created`.
- Senhas fornecidas precisam ter no mínimo **12 caracteres** (mensagem
  `Password must be at least 12 characters`).

---

## 4. Schema Zod das linhas

Após a normalização do cabeçalho, cada linha é validada por `CsvRowSchema`:

| Campo | Tipo | Regras |
| --- | --- | --- |
| `name` | `string` | mínimo 2 caracteres |
| `email` | `string` | formato e-mail (`z.string().email`); transformado para `toLowerCase()` |
| `password` | `string \| undefined` | opcional; string vazia/whitespace é tratada como ausente; quando presente, mínimo 12 caracteres |
| `role` | enum | `student` \| `teacher` \| `coordinator` \| `admin` |

E-mails duplicados dentro do mesmo CSV são detectados após a validação:
a primeira ocorrência prevalece, ocorrências posteriores são marcadas como
`error` com mensagem `Duplicate email in CSV (first seen on line N)`.

---

## 5. Permissões

O pre-handler `requirePlatformAdminOrCoordinator` aplica:

1. Sem sessão -> `401 Not authenticated`.
2. Usuário com `isPlatformAdmin === true` -> autorizado.
3. Caso contrário, exige:
   - `activeOrganizationId` definido na sessão;
   - `activeOrganizationId === params.id` (o id da URL deve coincidir com
     a org ativa);
   - role mínima `coordinator` (`hasMinimumRole(usr.role, "coordinator")`).

Falhas dessas validações retornam `403` com mensagens específicas:

- `No active organization selected`
- `Organization ID must match your active organization`
- `Insufficient role permissions`

---

## 6. Fluxo da UI

A modal `CsvImportModal` orquestra três passos via `CsvStepper`:

### Passo 1 — Upload

- Título: **"Importar membros de CSV"**
- Subtítulo: **"Adicione usuários em massa a esta organização."**
- Área de drop com fallback de clique. Aceita drag-and-drop e seleção
  manual.
- Validações no cliente antes de enviar:
  - Extensão `.csv` (mensagem: `O arquivo deve ter extensão .csv`).
  - Tipo MIME aceito: vazio, `text/csv`, `application/vnd.ms-excel`,
    `application/csv`.
  - Tamanho `<= 1 MB` (mensagem: `O arquivo excede o limite de 1 MB (X KB).`).
- Painel "Formato esperado" mostra o cabeçalho exemplo
  `Nome,E-mail,Senha,Funcao` e duas linhas, incluindo uma com a célula
  de senha em branco para evidenciar a geração automática.
- Botão **"Baixar template.csv"** (`template-importacao-membros.csv`) com
  duas linhas de exemplo, sendo a segunda sem senha.
- Botões: **"Cancelar"** e **"Continuar para prévia"** (desabilitado sem
  arquivo).

### Passo 2 — Prévia (dry run)

- Título: **"Prévia e validação"**
- Subtítulo: **"Revise o que será aplicado para cada linha antes de importar."**
- Dispara `POST .../import-csv?dryRun=true`.
- Durante a chamada: spinner com texto **"Validando o arquivo no servidor..."**.
- Em sucesso, mostra:
  - 4 cards de estatística: **Vai criar**, **Vai vincular**, **Vai ignorar**,
    **Erros**.
  - Banner amarelo quando há erros: `N linhas têm problemas` /
    `Linhas com erros serão ignoradas. Você pode corrigi-las e enviar de novo,
    ou prosseguir e importar apenas as M linhas válidas.`.
  - Tabela com até 50 linhas (`PREVIEW_ROW_LIMIT`) com colunas
    `#`, `Status`, `Email`, `Linha`, `Detalhe`.
- Em erro de rede ou 4xx/5xx: banner vermelho **"Não foi possível validar
  o arquivo"** + botão **"Tentar novamente"**.
- Botões inferiores: **"Voltar"**, indicador `X linhas serão importadas ·
  Y linhas serão ignoradas`, **"Confirmar e importar N linhas"** (desabilitado
  quando `importableCount === 0`).

### Passo 3 — Resultado

- Título: **"Importação concluída"**
- Subtítulo: **"Resumo do que foi aplicado a esta organização."**
- Dispara `POST .../import-csv` (sem `dryRun`).
- Spinner: **"Importando membros para a organização..."**.
- Em sucesso:
  - Banner verde `N de M linhas importadas com sucesso`. Quando há
    senhas geradas, complementa com **"Linhas sem senha receberam uma
    senha gerada — baixe o relatório abaixo para compartilhá-la com cada
    usuário."**.
  - Cards: **Criados**, **Vinculados**, **Ignorados**, **Falharam**.
  - Filtro por status: `Todos`, `Criados`, `Vinculados`, `Ignorados`, `Erros`.
  - Tabela com todas as linhas; senha gerada exibida em `<code>` âmbar
    abaixo da mensagem.
- Toast `sonner` com `N linha(s) importada(s)` em sucesso, ou
  `Falha ao importar membros` em erro.
- Botões: **"Baixar relatório.csv"** (sempre disponível com dados),
  **"Tentar novamente"** (em caso de erro), **"Concluído"**.
- Ao concluir com sucesso, a query
  `getV1OrganizationsIdMembersQueryKey(organizationId)` é invalidada para
  refrescar a lista de membros da organização.

> O diálogo é **bloqueado** durante o import real
> (`importMutation.isPending`) para evitar perda de estado.

---

## 7. Relatório de importação

A resposta do endpoint é:

```ts
{
  success: true,
  data: {
    dryRun: boolean,
    summary: {
      total: number,
      created: number,
      linked: number,
      skipped: number,
      errors: number,
    },
    rows: Array<{
      line: number,              // 2 = primeira linha de dados
      email: string,
      status: "created" | "linked" | "skipped" | "error",
      message?: string,
      generatedPassword?: string // só em rows "created" cuja senha foi gerada
    }>
  }
}
```

### Status por linha

| Status | Quando ocorre | Mensagem típica |
| --- | --- | --- |
| `created` | Usuário não existia; foi criado e adicionado à org. | (vazia) ou `Password auto-generated — share it with the user out-of-band` |
| `linked` | Usuário já existia globalmente e foi vinculado à org. | (vazia) |
| `skipped` | Usuário já era membro desta organização. | `User is already a member of this organization` |
| `error` | Falha na linha (validação Zod, e-mail duplicado, falha de persistência etc.). | Mensagem do Zod ou erro do banco (truncada em 200 caracteres) |

Em `dryRun=true`, as linhas que seriam persistidas recebem mensagens
informativas: `Dry run — no changes persisted` ou
`Dry run — password will be auto-generated`. Nenhuma escrita acontece e
nenhuma senha real é gerada nesse modo.

### Campo `generatedPassword`

- Aparece **somente** quando `status === "created"` e o CSV não trouxe
  senha para aquela linha.
- Senhas fornecidas pelo administrador **nunca** são devolvidas no relatório
  (o servidor jamais ecoa o plaintext informado).
- O administrador é responsável por entregar a senha gerada ao usuário
  por canal externo (e-mail manual, mensagem direta, etc.). Veja a seção
  "Emails" abaixo.

### Download do relatório (UI)

O botão **"Baixar relatório.csv"** gera `relatorio-importacao-membros.csv`
com as colunas:

```
linha,email,status,mensagem,senha_gerada
```

A coluna `senha_gerada` só é preenchida nas linhas em que a API a
devolveu. Valores são escapados (aspas duplas dobradas) quando contêm
`,`, `"`, `\n` ou `\r`.

---

## 8. Idempotência

- O CSV inteiro pode ser reenviado sem efeitos colaterais nas linhas já
  importadas: usuários que já são membros caem em `skipped`.
- Em uma race condition em que dois imports tentam criar/vincular o mesmo
  e-mail simultaneamente, o `inArray` pré-check pode não detectar e o
  insert pode disparar uma violação de unique constraint. Como cada linha
  roda em sua própria transação, apenas a linha perdedora vira `error`;
  as demais permanecem aplicadas. (Comportamento alinhado ao fix
  `addExistingMember` que mapeia `23505` para `409`.)

---

## 9. Códigos de erro

| Código | Causa | Mensagem |
| --- | --- | --- |
| `400` | Nenhum arquivo enviado | `No file uploaded` |
| `400` | Extensão diferente de `.csv` | `File must have a .csv extension` |
| `400` | Falha de parse do CSV | `Failed to parse CSV: <detalhe>` |
| `400` | Coluna obrigatória ausente | `Missing required column(s): name, email, role` |
| `401` | Sem sessão válida | `Not authenticated` |
| `403` | Sem org ativa | `No active organization selected` |
| `403` | Org ativa diferente do `id` da URL | `Organization ID must match your active organization` |
| `403` | Role abaixo de `coordinator` | `Insufficient role permissions` |
| `413` | Arquivo > 1 MB | `CSV file exceeds maximum size of 1MB` |
| `413` | > 100 linhas | `CSV exceeds maximum of 100 rows` |

Erros de validação **por linha** (Zod, e-mail inválido, role fora do
enum, senha curta, e-mail duplicado, falha de transação) não viram HTTP
4xx/5xx: o status global continua `200` e cada linha problemática vira
`status: "error"` com `message` específica.

---

## 10. Exemplos

### Exemplo 1 — CSV mínimo em inglês

```csv
name,email,role
Maria Silva,maria@exemplo.edu.br,student
Joao Santos,joao@exemplo.edu.br,teacher
```

### Exemplo 2 — CSV exportado do Excel pt-BR (BOM + `;` + cabeçalhos pt-BR)

Geração via shell (mostrando o BOM explicitamente):

```bash
printf '\xEF\xBB\xBFNome;E-mail;Senha;Função\nMaria Silva;maria@exemplo.edu.br;SenhaForte123!;student\nJoão Santos;joao@exemplo.edu.br;;teacher\n' > membros.csv
```

A primeira linha tem `Nome;E-mail;Senha;Função` precedida do BOM UTF-8
(bytes `EF BB BF`). A segunda linha de dados deixa a senha em branco —
a API gerará uma senha aleatória e a devolverá em `generatedPassword`
para Joao Santos.

### Exemplo 3 — CSV sem coluna password (senha 100% gerada)

```csv
Nome,E-mail,Função
Ana Souza,ana@exemplo.edu.br,student
Bruno Lima,bruno@exemplo.edu.br,coordinator
```

As duas linhas serão `created` com `generatedPassword` preenchido.

### Exemplo 4 — chamada `curl`

Validar sem persistir:

```bash
curl -X POST \
  "http://localhost:3344/v1/organizations/<orgId>/members/import-csv?dryRun=true" \
  -H "Cookie: better-auth.session_token=<token>" \
  -F "file=@membros.csv;type=text/csv"
```

Importar de verdade:

```bash
curl -X POST \
  "http://localhost:3344/v1/organizations/<orgId>/members/import-csv" \
  -H "Cookie: better-auth.session_token=<token>" \
  -F "file=@membros.csv;type=text/csv"
```

---

## 11. Emails

**Não há envio automático de e-mail** quando a importação cria um usuário,
mesmo nos casos em que a senha é gerada pela API. O design é deliberado:
a senha plaintext aparece **uma única vez** no relatório
(`generatedPassword`) e na coluna `senha_gerada` do CSV de relatório,
para que o administrador a compartilhe **out-of-band** (mensagem direta,
sistema institucional, e-mail manual etc.).

<!-- TODO: vincular a `docs/admin-panel/emails.md` quando o documento
de e-mails do painel administrativo for criado. -->

---

## 12. Limites e edge cases conhecidos

- **Concorrência de hashing**: `scrypt` (`hashPassword`) é CPU-bound; a
  rota processa hashes em chunks de `HASH_CONCURRENCY = 8`. Isso evita
  travar o event loop, mas implica que imports muito próximos do limite
  de 100 linhas podem ter latência perceptível.
- **Transação por linha**: cada linha tem sua própria transação. Falhas
  isoladas (e.g., unique constraint em race) não abortam o lote.
- **Senha plaintext nunca persistida**: senhas fornecidas viram hash via
  `scrypt`; as geradas só existem na memória da requisição e no payload
  da resposta — não há gravação em log de auditoria, não há reenvio.
  Se o relatório for perdido, será necessário reset de senha pelo fluxo
  normal Better Auth.
- **Sem retomada de import**: se a requisição for cancelada no meio,
  parte das linhas pode já ter sido persistida. Reenviar o mesmo CSV é
  seguro (idempotência via `skipped`), porém quem tinha senha gerada
  e não foi capturada precisará passar por reset.
- **UI x API alinhadas em 100 linhas**: tanto a UI quanto a API aplicam
  `MAX_ROWS = 100` (a API é a fonte da verdade — ver
  `apps/api/src/http/routes/v1/organizations/members/importCsv.ts`). A UI
  também limita a prévia a `PREVIEW_ROW_LIMIT = 50` linhas exibidas.
- **Coluna `password` mas vazia**: aceita; tratada como ausente
  graças ao `OptionalPasswordSchema` (preprocess que normaliza string
  vazia para `undefined`).
- **Cabeçalhos desconhecidos**: passam pelo parser e são ignorados
  silenciosamente pelo Zod (chaves extras não disparam erro).

<!-- TODO: confirmar/limitar quais arquivos do painel administrativo
linkam para este documento (lista de membros, página da organização,
sidebar de admin). -->
