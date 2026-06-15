/**
 * Demo scenario for the dev seed: a richer challenge ("Validador de senha
 * forte") with three students whose journeys exercise every demo-worthy
 * surface of the product:
 *
 * - Reference solutions panel (brute_force + refined, both pre-rendered)
 * - Work-session chat replay (varied lengths and tone per student)
 * - Submissions list with grades pending
 * - Structured auto-review with the three severity profiles:
 *     · strong   — mostly strengths, minor suggestions
 *     · medium   — works but verbose, mixed problems
 *     · struggling — multiple high-severity problems, constructive sugestões
 *
 * The auto-review JSON below is hand-crafted, not LLM-generated, so the seed
 * stays deterministic and doesn't need to call the model. The markdown
 * column is left null on purpose — the UI prefers the structured JSON and
 * only renders the markdown fallback when JSON is absent.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../index";
import {
  account,
  challenge,
  challengeReferenceSolution,
  challengeTeachingAssistant,
  member,
  submission,
  user,
  userClassroom,
  userInteractionOnChallenge,
  workSession,
} from "../schema";
import { safeInsert, SEED_TA_ID } from "./base";

// ===== Fixed IDs (reproducible) =====

const SEED_CHALLENGE_PASSWORD = "00000000-0000-0000-0000-0000000000a0";

const SEED_REF_BRUTE_FORCE = "99999999-9999-9999-9999-999999990001";
const SEED_REF_REFINED = "99999999-9999-9999-9999-999999990002";

const SEED_USER_STUDENT_MARIA = "33333333-3333-3333-3333-333333330004";
const SEED_USER_STUDENT_JOAO = "33333333-3333-3333-3333-333333330005";
const SEED_ACCOUNT_STUDENT_MARIA = "44444444-4444-4444-4444-444444440004";
const SEED_ACCOUNT_STUDENT_JOAO = "44444444-4444-4444-4444-444444440005";
const SEED_MEMBER_STUDENT_MARIA = "55555555-5555-5555-5555-555555550004";
const SEED_MEMBER_STUDENT_JOAO = "55555555-5555-5555-5555-555555550005";

const SEED_WS_DEMO_PWD = "77777777-7777-7777-7777-7777777700a1";
const SEED_WS_MARIA_PWD = "77777777-7777-7777-7777-7777777700a2";
const SEED_WS_JOAO_PWD = "77777777-7777-7777-7777-7777777700a3";

const SEED_SUB_DEMO_PWD = "88888888-8888-8888-8888-8888888800a1";
const SEED_SUB_MARIA_PWD = "88888888-8888-8888-8888-8888888800a2";
const SEED_SUB_JOAO_PWD = "88888888-8888-8888-8888-8888888800a3";

// English copies — Mary (strong, mirrors Maria) and John (struggling, mirrors João)
const SEED_USER_STUDENT_MARY = "33333333-3333-3333-3333-333333330006";
const SEED_USER_STUDENT_JOHN = "33333333-3333-3333-3333-333333330007";
const SEED_ACCOUNT_STUDENT_MARY = "44444444-4444-4444-4444-444444440006";
const SEED_ACCOUNT_STUDENT_JOHN = "44444444-4444-4444-4444-444444440007";
const SEED_MEMBER_STUDENT_MARY = "55555555-5555-5555-5555-555555550006";
const SEED_MEMBER_STUDENT_JOHN = "55555555-5555-5555-5555-555555550007";
const SEED_WS_MARY_PWD = "77777777-7777-7777-7777-7777777700a4";
const SEED_WS_JOHN_PWD = "77777777-7777-7777-7777-7777777700a5";
const SEED_SUB_MARY_PWD = "88888888-8888-8888-8888-8888888800a4";
const SEED_SUB_JOHN_PWD = "88888888-8888-8888-8888-8888888800a5";

// ===== Challenge content =====

const CHALLENGE_DESCRIPTION = `# Strong password validator

Implement a function \`is_strong(password: str) -> bool\` that returns \`True\` when the password satisfies **all** of the rules below:

1. At least **8 characters**
2. At least **one uppercase letter** (\`A-Z\`)
3. At least **one lowercase letter** (\`a-z\`)
4. At least **one digit** (\`0-9\`)
5. At least **one special character** from \`!@#$%^&*\`

## Input

One password per line, ending at EOF.

## Output

For each password read, print \`VALID\` or \`INVALID\`.

## Example

\`\`\`
Input:
Passw0rd!
abc
HelloWorld1

Output:
VALID
INVALID
INVALID
\`\`\`

> The second one is invalid because it is short and has no uppercase or special character.
> The third is invalid because it has no special character.

## Edge cases to consider

- Empty password
- Leading/trailing spaces (use \`strip\`/\`rstrip\` carefully — it may betray what the user typed)
- Blank lines at the end of the file
`;

const REF_BRUTE_FORCE_CODE = `import sys


def is_strong(password):
    if len(password) < 8:
        return False
    has_upper = False
    has_lower = False
    has_digit = False
    has_special = False
    specials = "!@#$%^&*"
    for ch in password:
        if ch.isupper():
            has_upper = True
        if ch.islower():
            has_lower = True
        if ch.isdigit():
            has_digit = True
        if ch in specials:
            has_special = True
    if has_upper and has_lower and has_digit and has_special:
        return True
    return False


for line in sys.stdin:
    pwd = line.rstrip("\\n")
    print("VALID" if is_strong(pwd) else "INVALID")
`;

const REF_REFINED_CODE = `import sys

SPECIALS = set("!@#$%^&*")


def is_strong(password: str) -> bool:
    return (
        len(password) >= 8
        and any(c.isupper() for c in password)
        and any(c.islower() for c in password)
        and any(c.isdigit() for c in password)
        and any(c in SPECIALS for c in password)
    )


for line in sys.stdin:
    print("VALID" if is_strong(line.rstrip("\\n")) else "INVALID")
`;

// ===== Student code snapshots =====
//
// Each student has a progression of code versions (V1 -> final). The replay
// code column shows the last snapshot at each step, so attaching a snapshot
// to (almost) every interaction makes the code evolve visibly across the
// timeline — the point of the replay. The final constant (no suffix) is the
// one stored on the submission row.

// --- Maria (strong): skeleton -> working -> idiomatic refine ---

const MARIA_CODE_V1 = `import sys


def is_strong(pwd):
    # TODO: 5 regras
    return False


for line in sys.stdin:
    print("VALID" if is_strong(line) else "INVALID")
`;

const MARIA_CODE_V2 = `import sys


def is_strong(pwd):
    if len(pwd) < 8:
        return False
    return (
        any(c.isupper() for c in pwd)
        and any(c.islower() for c in pwd)
        and any(c.isdigit() for c in pwd)
        and any(c in "!@#$%^&*" for c in pwd)
    )


for line in sys.stdin:
    print("VALID" if is_strong(line) else "INVALID")
`;

const MARIA_CODE = `import sys

SPECIALS = "!@#$%^&*"


def is_strong(pwd: str) -> bool:
    if len(pwd) < 8:
        return False
    return (
        any(c.isupper() for c in pwd)
        and any(c.islower() for c in pwd)
        and any(c.isdigit() for c in pwd)
        and any(c in SPECIALS for c in pwd)
    )


for line in sys.stdin:
    print("VALID" if is_strong(line.rstrip()) else "INVALID")
`;

// --- Mary (strong, EN): English copy of Maria's progression ---

const MARY_CODE_V1 = `import sys


def is_strong(pwd):
    # TODO: 5 rules
    return False


for line in sys.stdin:
    print("VALID" if is_strong(line) else "INVALID")
`;

const MARY_CODE_V2 = `import sys


def is_strong(pwd):
    if len(pwd) < 8:
        return False
    return (
        any(c.isupper() for c in pwd)
        and any(c.islower() for c in pwd)
        and any(c.isdigit() for c in pwd)
        and any(c in "!@#$%^&*" for c in pwd)
    )


for line in sys.stdin:
    print("VALID" if is_strong(line) else "INVALID")
`;

const MARY_CODE = `import sys

SPECIALS = "!@#$%^&*"


def is_strong(pwd: str) -> bool:
    if len(pwd) < 8:
        return False
    return (
        any(c.isupper() for c in pwd)
        and any(c.islower() for c in pwd)
        and any(c.isdigit() for c in pwd)
        and any(c in SPECIALS for c in pwd)
    )


for line in sys.stdin:
    print("VALID" if is_strong(line.rstrip()) else "INVALID")
`;

// --- Aluno Demo (medium): echo -> validation+rstrip bug -> verbose final ---

const DEMO_CODE_V1 = `import sys

for line in sys.stdin:
    print(line)
`;

const DEMO_CODE_V2 = `import sys


def is_strong(p):
    if len(p) < 8:
        return False
    upper = False
    lower = False
    digit = False
    special = False
    for c in p:
        if c >= "A" and c <= "Z":
            upper = True
        elif c >= "a" and c <= "z":
            lower = True
        elif c >= "0" and c <= "9":
            digit = True
        elif c in "!@#$%^&*":
            special = True
    return upper and lower and digit and special


linhas = sys.stdin.read().split("\\n")
for l in linhas:
    if is_strong(l):
        print("VALID")
    else:
        print("INVALID")
`;

const DEMO_CODE = `import sys


def is_strong(p):
    if len(p) < 8:
        return False
    upper = False
    lower = False
    digit = False
    special = False
    for c in p:
        if c >= "A" and c <= "Z":
            upper = True
        elif c >= "a" and c <= "z":
            lower = True
        elif c >= "0" and c <= "9":
            digit = True
        elif c in "!@#$%^&*":
            special = True
    if upper == True and lower == True and digit == True and special == True:
        return True
    else:
        return False


linhas = sys.stdin.read().split("\\n")
for l in linhas:
    if is_strong(l.rstrip()):
        print("VALID")
    else:
        print("INVALID")
`;

// --- João (struggling): echo -> length-only -> stdin attempt -> revert ---

const JOAO_CODE_V1 = `senha = input()
print(senha)
`;

const JOAO_CODE_V2 = `senha = input()

if len(senha) >= 8:
    print("VALID")
else:
    print("INVALID")
`;

const JOAO_CODE_V3 = `import sys

# o TA falou pra usar sys.stdin
for linha in sys.stdin:
    if len(linha) >= 8:
        print("VALID")
    else:
        print("INVALID")
`;

const JOAO_CODE = `# tentativa 4 ainda nao funciona direito :(
# voltei pro input() pq o sys.stdin me confundiu
senha = input()

if len(senha) >= 8:
    print("VALID")
else:
    print("INVALID")
`;

// --- John (struggling, EN): English copy of João's progression ---

const JOHN_CODE_V1 = `password = input()
print(password)
`;

const JOHN_CODE_V2 = `password = input()

if len(password) >= 8:
    print("VALID")
else:
    print("INVALID")
`;

const JOHN_CODE_V3 = `import sys

# the TA told me to use sys.stdin
for line in sys.stdin:
    if len(line) >= 8:
        print("VALID")
    else:
        print("INVALID")
`;

const JOHN_CODE = `# attempt 4 still doesn't work right :(
# went back to input() because sys.stdin confused me
password = input()

if len(password) >= 8:
    print("VALID")
else:
    print("INVALID")
`;

// ===== Chat / code-run interactions =====

type Interaction = {
  type: "chat" | "code_run";
  userPrompt: string;
  modelResponse: string;
  code?: string;
  stdin?: string;
  stdout?: string;
  minutesAgo: number;
};

const MARIA_INTERACTIONS: Interaction[] = [
  {
    type: "chat",
    userPrompt:
      "Posso usar `any()` com geradores ou prefere que eu escreva loops manuais?",
    modelResponse:
      "Use o que ficar mais legível pra você. `any(c.isupper() for c in pwd)` é idiomático e cobre a regra; um loop com flag também é válido. O que importa é cobrir as cinco regras.",
    code: MARIA_CODE_V1,
    minutesAgo: 34,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: MARIA_CODE_V2,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    // sem rstrip ainda: o \n não atrapalha aqui porque nenhuma regra usa o
    // tamanho exato, mas Maria percebe e adiciona rstrip na versão final
    stdout: "VALID\nINVALID\nINVALID\n",
    minutesAgo: 26,
  },
  {
    type: "chat",
    userPrompt:
      "Funcionou. Vou extrair os especiais numa constante e tipar a função, fica mais limpo né?",
    modelResponse:
      "Perfeito. Extrair `SPECIALS` e anotar `-> bool` deixa a intenção explícita e evita recriar a string a cada caractere. Boa prática.",
    code: MARIA_CODE_V2,
    minutesAgo: 20,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: MARIA_CODE,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    stdout: "VALID\nINVALID\nINVALID\n",
    minutesAgo: 15,
  },
];

const DEMO_INTERACTIONS: Interaction[] = [
  {
    type: "chat",
    userPrompt: "Como leio várias linhas em Python? sys.stdin?",
    modelResponse:
      "Sim, `for line in sys.stdin:` itera linha a linha até EOF; cada linha vem com o `\\n` no final, então use `rstrip` antes de comparar. Se preferir ler tudo de uma vez, `sys.stdin.read().splitlines()`.",
    code: DEMO_CODE_V1,
    minutesAgo: 50,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: DEMO_CODE_V1,
    stdin: "Passw0rd!\n",
    stdout: "Passw0rd!\n\n",
    minutesAgo: 46,
  },
  {
    type: "chat",
    userPrompt: "o que conta como caractere especial?",
    modelResponse:
      "Só os listados no enunciado: `!@#$%^&*`. Outros símbolos não contam — bom verificar exatamente com `c in \"!@#$%^&*\"` ou um set.",
    code: DEMO_CODE_V1,
    minutesAgo: 42,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: DEMO_CODE_V2,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    // split("\n") devolve uma string vazia final -> 1 INVALID a mais
    stdout: "VALID\nINVALID\nINVALID\nINVALID\n",
    minutesAgo: 33,
  },
  {
    type: "chat",
    userPrompt:
      "as 3 senhas estão certas mas tem um INVALID a mais no final, de onde vem?",
    modelResponse:
      "Do `split(\"\\n\")`: como o arquivo termina em `\\n`, ele devolve uma string vazia no fim da lista, e `\"\"` vira mais um INVALID. Use `splitlines()` (não devolve a vazia final) ou itere direto com `for line in sys.stdin:`.",
    code: DEMO_CODE_V2,
    minutesAgo: 28,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: DEMO_CODE,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    // a aluna adicionou .rstrip() (inofensivo aqui) mas manteve o split,
    // então o INVALID extra persiste -> bug ainda presente na submissão
    stdout: "VALID\nINVALID\nINVALID\nINVALID\n",
    minutesAgo: 12,
  },
];

const JOAO_INTERACTIONS: Interaction[] = [
  {
    type: "chat",
    userPrompt: "tô perdido, por onde começo?",
    modelResponse:
      "Comece pela função `is_strong(password)`. Pense em cada regra como uma verificação separada e retorne `True` só se todas passarem. Depois você pluga ela num loop que lê do `sys.stdin`.",
    minutesAgo: 72,
  },
  {
    type: "chat",
    userPrompt: "como leio a senha digitada?",
    modelResponse:
      "Pra começar você pode usar `input()` pra ler uma linha. Mas lembre que o enunciado pede várias senhas até o EOF — daqui a pouco a gente troca por um loop no `sys.stdin`.",
    code: JOAO_CODE_V1,
    minutesAgo: 64,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: JOAO_CODE_V1,
    stdin: "Passw0rd!\n",
    stdout: "Passw0rd!\n",
    minutesAgo: 58,
  },
  {
    type: "chat",
    userPrompt: "como vejo se tem letra maiúscula?",
    modelResponse:
      "Cada caractere tem `.isupper()`, que devolve True quando é maiúscula. Dá pra varrer com um `for` ou usar `any(c.isupper() for c in senha)`. Faça uma regra de cada vez.",
    code: JOAO_CODE_V2,
    minutesAgo: 50,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: JOAO_CODE_V2,
    stdin: "Passw0rd!\n",
    stdout: "VALID\n",
    minutesAgo: 46,
  },
  {
    type: "chat",
    userPrompt: "agora só lê uma senha. como faz pra ler várias?",
    modelResponse:
      "`input()` lê só uma linha por chamada. Troque por `for line in sys.stdin:` (com `import sys` no topo) — assim ele itera até o EOF e processa cada senha.",
    code: JOAO_CODE_V2,
    minutesAgo: 40,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: JOAO_CODE_V3,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    // só checa tamanho: 8+ chars -> VALID
    stdout: "VALID\nINVALID\nVALID\n",
    minutesAgo: 30,
  },
  {
    type: "chat",
    userPrompt: "tá printando VALID pra tudo que é grande, oq fiz de errado?",
    modelResponse:
      "Você só está checando o **tamanho**. Faltam as outras quatro regras (maiúscula, minúscula, dígito e especial). Sem elas, qualquer senha com 8+ caracteres vira VALID. Tente adicionar uma regra de cada vez e rodar o exemplo do enunciado pra comparar.",
    code: JOAO_CODE_V3,
    minutesAgo: 22,
  },
  {
    type: "chat",
    userPrompt: "o sys.stdin me confundiu, voltei pro input(). depois eu termino as regras :(",
    modelResponse:
      "Sem problema — submeta o que tem e marque pra revisar com a monitoria. Quando voltar, faça uma regra por vez e teste cada uma isolada antes de juntar.",
    code: JOAO_CODE,
    minutesAgo: 12,
  },
];

// English copy of MARIA_INTERACTIONS (same beats, translated).
const MARY_INTERACTIONS: Interaction[] = [
  {
    type: "chat",
    userPrompt:
      "Can I use `any()` with generators, or would you rather I write manual loops?",
    modelResponse:
      "Use whatever reads best for you. `any(c.isupper() for c in pwd)` is idiomatic and covers the rule; a loop with a flag is fine too. What matters is covering all five rules.",
    code: MARY_CODE_V1,
    minutesAgo: 34,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: MARY_CODE_V2,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    stdout: "VALID\nINVALID\nINVALID\n",
    minutesAgo: 26,
  },
  {
    type: "chat",
    userPrompt:
      "It worked. I'll extract the specials into a constant and type the function — cleaner, right?",
    modelResponse:
      "Perfect. Extracting `SPECIALS` and annotating `-> bool` makes the intent explicit and avoids rebuilding the string on every character. Good practice.",
    code: MARY_CODE_V2,
    minutesAgo: 20,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: MARY_CODE,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    stdout: "VALID\nINVALID\nINVALID\n",
    minutesAgo: 15,
  },
];

// English copy of JOAO_INTERACTIONS (same beats, translated).
const JOHN_INTERACTIONS: Interaction[] = [
  {
    type: "chat",
    userPrompt: "i'm lost, where do i start?",
    modelResponse:
      "Start with the `is_strong(password)` function. Think of each rule as a separate check and return `True` only if all of them pass. Then you plug it into a loop that reads from `sys.stdin`.",
    minutesAgo: 72,
  },
  {
    type: "chat",
    userPrompt: "how do i read the typed password?",
    modelResponse:
      "To start you can use `input()` to read one line. But remember the statement asks for several passwords until EOF — soon we'll switch to a loop over `sys.stdin`.",
    code: JOHN_CODE_V1,
    minutesAgo: 64,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: JOHN_CODE_V1,
    stdin: "Passw0rd!\n",
    stdout: "Passw0rd!\n",
    minutesAgo: 58,
  },
  {
    type: "chat",
    userPrompt: "how do i check if there's an uppercase letter?",
    modelResponse:
      "Every character has `.isupper()`, which returns True for an uppercase letter. You can scan with a `for` or use `any(c.isupper() for c in password)`. Do one rule at a time.",
    code: JOHN_CODE_V2,
    minutesAgo: 50,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: JOHN_CODE_V2,
    stdin: "Passw0rd!\n",
    stdout: "VALID\n",
    minutesAgo: 46,
  },
  {
    type: "chat",
    userPrompt: "now it only reads one password. how do i read several?",
    modelResponse:
      "`input()` reads only one line per call. Switch to `for line in sys.stdin:` (with `import sys` at the top) — that way it iterates until EOF and processes every password.",
    code: JOHN_CODE_V2,
    minutesAgo: 40,
  },
  {
    type: "code_run",
    userPrompt: "",
    modelResponse: "",
    code: JOHN_CODE_V3,
    stdin: "Passw0rd!\nabc\nHelloWorld1\n",
    stdout: "VALID\nINVALID\nVALID\n",
    minutesAgo: 30,
  },
  {
    type: "chat",
    userPrompt: "it's printing VALID for everything that's long, what did i do wrong?",
    modelResponse:
      "You're only checking the **length**. The other four rules are missing (uppercase, lowercase, digit and special). Without them, any password with 8+ characters becomes VALID. Try adding one rule at a time and run the statement's example to compare.",
    code: JOHN_CODE_V3,
    minutesAgo: 22,
  },
  {
    type: "chat",
    userPrompt: "sys.stdin confused me, i went back to input(). i'll finish the rules later :(",
    modelResponse:
      "No problem — submit what you have and flag it for review during TA hours. When you come back, do one rule at a time and test each in isolation before combining.",
    code: JOHN_CODE,
    minutesAgo: 12,
  },
];

// ===== Pre-computed structured auto-reviews =====

type Severity = "baixa" | "media" | "alta";
interface Review {
  pontosFortes: string[];
  problemas: {
    tipo: string;
    gravidade: Severity;
    linha: number | null;
    descricao: string;
  }[];
  sugestoes: string[];
  avaliacaoGeral: string;
}

const MARIA_REVIEW: Review = {
  pontosFortes: [
    "Solução enxuta usando `any()` com geradores — cobre cada regra em uma linha legível.",
    "Tipagem explícita em `is_strong(pwd: str) -> bool` ajuda quem for ler depois.",
    "Constante `SPECIALS` definida fora da função evita realocar a cada chamada.",
  ],
  problemas: [
    {
      tipo: "qualidade",
      gravidade: "baixa" as const,
      linha: null,
      descricao:
        "`SPECIALS` poderia ser um `set(...)` em vez de string para tornar `c in SPECIALS` O(1), embora aqui não faça diferença prática.",
    },
  ],
  sugestoes: [
    "Comentar brevemente que `line.rstrip()` é importante porque o `\\n` contaria como caractere especial se ficasse.",
    "Se for evoluir, considere imprimir uma mensagem por regra que falhou — útil em contexto pedagógico.",
  ],
  avaliacaoGeral:
    "Solução correta, idiomática e bem estruturada. A aluna formulou raciocínio próprio — interagiu pouco com o TA e só para confirmar uma escolha estilística. Está pronta para problemas mais avançados nesta turma.",
};

const DEMO_REVIEW: Review = {
  pontosFortes: [
    "A lógica das cinco regras está correta para as senhas em si.",
    "Boa atitude de depuração: a aluna percebeu a linha `INVALID` extra e foi atrás da causa com o TA.",
  ],
  problemas: [
    {
      tipo: "qualidade",
      gravidade: "media" as const,
      linha: null,
      descricao:
        "Quatro variáveis booleanas (`upper`, `lower`, `digit`, `special`) com flag manual quando `any()` resolveria em uma linha cada — código fica verboso.",
    },
    {
      tipo: "correção",
      gravidade: "media" as const,
      linha: 26,
      descricao:
        "`sys.stdin.read().split(\"\\n\")` deixa uma string vazia final quando o arquivo termina em newline, e a saída tem uma linha `INVALID` extra para a string vazia. Compare com a saída esperada do enunciado.",
    },
    {
      tipo: "estilo",
      gravidade: "baixa" as const,
      linha: 20,
      descricao:
        "`if upper == True and lower == True ...` é redundante — `if upper and lower ...` basta.",
    },
  ],
  sugestoes: [
    "Trocar as flags por `any(c.isupper() for c in p)` etc.; o código fica metade do tamanho e mais legível.",
    "Trocar `split(\"\\n\")` por `splitlines()` (que não devolve a string vazia final) ou iterar diretamente com `for line in sys.stdin:`.",
    "Pedir ao aluno para escrever 1-2 casos de teste cobrindo entrada vazia e linha em branco no fim do arquivo.",
  ],
  avaliacaoGeral:
    "Submissão funcional no caminho feliz, mas com verbosidade desnecessária e um bug sutil na linha vazia final. A interação com o TA foi produtiva — a aluna fez perguntas focadas e corrigiu rumo. Boa para conversa em sala sobre estilo idiomático Python.",
};

const JOAO_REVIEW: Review = {
  pontosFortes: [
    "O aluno perseverou: voltou ao TA várias vezes em vez de desistir, e o último código pelo menos roda sem erro de sintaxe.",
  ],
  problemas: [
    {
      tipo: "correção",
      gravidade: "alta" as const,
      linha: 5,
      descricao:
        "Só verifica o **tamanho** da senha. As regras de maiúscula, minúscula, dígito e caractere especial estão completamente ausentes — qualquer senha com 8+ caracteres vira `VALID`.",
    },
    {
      tipo: "correção",
      gravidade: "alta" as const,
      linha: 3,
      descricao:
        "Usa `input()` que lê **apenas uma linha**. O enunciado pede leitura até EOF (várias senhas).",
    },
    {
      tipo: "autonomia",
      gravidade: "media" as const,
      linha: null,
      descricao:
        "Pediu ajuda em quase todos os passos sem testar hipóteses sozinho. O TA precisou guiar do começo ao fim.",
    },
  ],
  sugestoes: [
    "Antes de submeter, rode o exemplo do enunciado e compare a saída esperada — neste caso, a saída teria mostrado o problema imediatamente.",
    "Quebrar o problema em 5 funções pequenas (`tem_maiuscula`, `tem_minuscula`, ...) e testar cada uma antes de juntar.",
    "Conversar em monitoria sobre como ler até EOF (`for line in sys.stdin:`) — vale revisar o material da semana 2.",
    "Sugerir um exercício menor de pré-requisito (ex.: contar vogais numa string) antes de tentar este novamente.",
  ],
  avaliacaoGeral:
    "Submissão incompleta — implementa só uma das cinco regras e lê apenas uma linha. O aluno mostrou engajamento (várias mensagens) mas pouca autonomia. Recomenda-se revisão guiada antes de avançar; o desafio está acima do nível atual de domínio.",
};

// English copy of MARIA_REVIEW.
const MARY_REVIEW: Review = {
  pontosFortes: [
    "Lean solution using `any()` with generators — covers each rule in one readable line.",
    "Explicit typing on `is_strong(pwd: str) -> bool` helps whoever reads it later.",
    "The `SPECIALS` constant defined outside the function avoids reallocating on each call.",
  ],
  problemas: [
    {
      tipo: "quality",
      gravidade: "baixa" as const,
      linha: null,
      descricao:
        "`SPECIALS` could be a `set(...)` instead of a string to make `c in SPECIALS` O(1), though it makes no practical difference here.",
    },
  ],
  sugestoes: [
    "Briefly note that `line.rstrip()` matters because the `\\n` would count as a special character if left in.",
    "If extending it, consider printing a message per failed rule — useful in a teaching context.",
  ],
  avaliacaoGeral:
    "Correct, idiomatic and well-structured solution. The student reasoned independently — interacted little with the TA and only to confirm a stylistic choice. Ready for more advanced problems in this class.",
};

// English copy of JOAO_REVIEW.
const JOHN_REVIEW: Review = {
  pontosFortes: [
    "The student persevered: came back to the TA several times instead of giving up, and the final code at least runs without a syntax error.",
  ],
  problemas: [
    {
      tipo: "correctness",
      gravidade: "alta" as const,
      linha: 5,
      descricao:
        "Only checks the password **length**. The uppercase, lowercase, digit and special-character rules are completely absent — any password with 8+ characters becomes `VALID`.",
    },
    {
      tipo: "correctness",
      gravidade: "alta" as const,
      linha: 3,
      descricao:
        "Uses `input()`, which reads **only one line**. The statement asks for reading until EOF (several passwords).",
    },
    {
      tipo: "autonomy",
      gravidade: "media" as const,
      linha: null,
      descricao:
        "Asked for help at almost every step without testing hypotheses alone. The TA had to guide from start to finish.",
    },
  ],
  sugestoes: [
    "Before submitting, run the statement's example and compare the expected output — here, it would have revealed the problem immediately.",
    "Break the problem into 5 small functions (`has_upper`, `has_lower`, ...) and test each before combining.",
    "Talk in TA hours about reading until EOF (`for line in sys.stdin:`) — worth reviewing week 2's material.",
    "Suggest a smaller prerequisite exercise (e.g., counting vowels in a string) before attempting this again.",
  ],
  avaliacaoGeral:
    "Incomplete submission — implements only one of the five rules and reads only one line. The student showed engagement (many messages) but little autonomy. Guided review is recommended before moving on; the challenge is above the current mastery level.",
};

// ===== Helpers =====

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

const credential = "credential";

const DEV_PASSWORD = "Teste123!@";

// ===== Main entry =====

interface Args {
  organizationId: string;
  classroomId: string;
  teacherUserId: string;
  existingStudentUserId: string; // "Aluno Demo" who is already created upstream
}

export async function seedPasswordDemoScenario({
  organizationId,
  classroomId,
  teacherUserId,
  existingStudentUserId,
}: Args) {
  console.log(
    "\n[dev-demo] Seeding password-validator demo (challenge + 3 student journeys)..."
  );

  const passwordHash = await hashPassword(DEV_PASSWORD);

  // --- New students: Maria (strong), João (struggling) ---
  await safeInsert("user maria (strong student)", () =>
    db.insert(user).values({
      id: SEED_USER_STUDENT_MARIA,
      name: "Maria Oliveira",
      email: "maria@taco-demo.local",
      emailVerified: true,
      isActive: true,
    })
  );
  await safeInsert("user joao (struggling student)", () =>
    db.insert(user).values({
      id: SEED_USER_STUDENT_JOAO,
      name: "João Pereira",
      email: "joao@taco-demo.local",
      emailVerified: true,
      isActive: true,
    })
  );

  await safeInsert("account maria", () =>
    db.insert(account).values({
      id: SEED_ACCOUNT_STUDENT_MARIA,
      accountId: "maria@taco-demo.local",
      providerId: credential,
      userId: SEED_USER_STUDENT_MARIA,
      password: passwordHash,
    })
  );
  await safeInsert("account joao", () =>
    db.insert(account).values({
      id: SEED_ACCOUNT_STUDENT_JOAO,
      accountId: "joao@taco-demo.local",
      providerId: credential,
      userId: SEED_USER_STUDENT_JOAO,
      password: passwordHash,
    })
  );

  await safeInsert("member maria", () =>
    db.insert(member).values({
      id: SEED_MEMBER_STUDENT_MARIA,
      userId: SEED_USER_STUDENT_MARIA,
      organizationId,
      role: "student",
    })
  );
  await safeInsert("member joao", () =>
    db.insert(member).values({
      id: SEED_MEMBER_STUDENT_JOAO,
      userId: SEED_USER_STUDENT_JOAO,
      organizationId,
      role: "student",
    })
  );

  // --- English copies: Mary (strong), John (struggling) ---
  await safeInsert("user mary (strong student, EN)", () =>
    db.insert(user).values({
      id: SEED_USER_STUDENT_MARY,
      name: "Mary Bennett",
      email: "mary@taco-demo.local",
      emailVerified: true,
      isActive: true,
    })
  );
  await safeInsert("user john (struggling student, EN)", () =>
    db.insert(user).values({
      id: SEED_USER_STUDENT_JOHN,
      name: "John Carter",
      email: "john@taco-demo.local",
      emailVerified: true,
      isActive: true,
    })
  );

  await safeInsert("account mary", () =>
    db.insert(account).values({
      id: SEED_ACCOUNT_STUDENT_MARY,
      accountId: "mary@taco-demo.local",
      providerId: credential,
      userId: SEED_USER_STUDENT_MARY,
      password: passwordHash,
    })
  );
  await safeInsert("account john", () =>
    db.insert(account).values({
      id: SEED_ACCOUNT_STUDENT_JOHN,
      accountId: "john@taco-demo.local",
      providerId: credential,
      userId: SEED_USER_STUDENT_JOHN,
      password: passwordHash,
    })
  );

  await safeInsert("member mary", () =>
    db.insert(member).values({
      id: SEED_MEMBER_STUDENT_MARY,
      userId: SEED_USER_STUDENT_MARY,
      organizationId,
      role: "student",
    })
  );
  await safeInsert("member john", () =>
    db.insert(member).values({
      id: SEED_MEMBER_STUDENT_JOHN,
      userId: SEED_USER_STUDENT_JOHN,
      organizationId,
      role: "student",
    })
  );

  // Enroll all students in the classroom
  for (const uid of [
    existingStudentUserId,
    SEED_USER_STUDENT_MARIA,
    SEED_USER_STUDENT_JOAO,
    SEED_USER_STUDENT_MARY,
    SEED_USER_STUDENT_JOHN,
  ]) {
    await safeInsert(`enroll ${uid} in ${classroomId}`, () =>
      db.insert(userClassroom).values({ userId: uid, classroomId })
    );
  }

  // --- Challenge ---
  await safeInsert("challenge password-validator", async () => {
    await db.insert(challenge).values({
      id: SEED_CHALLENGE_PASSWORD,
      classroomId,
      title: "Strong password validator",
      description: CHALLENGE_DESCRIPTION,
      difficulty: "medium",
      tags: ["Strings", "Validation", "Edge Cases"],
      createdByUserId: teacherUserId,
    });
    await db.insert(challengeTeachingAssistant).values({
      challengeId: SEED_CHALLENGE_PASSWORD,
      teachingAssistantId: SEED_TA_ID,
      isDefault: true,
    });
  });

  // --- Reference solutions ---
  await safeInsert("ref brute_force", () =>
    db.insert(challengeReferenceSolution).values({
      id: SEED_REF_BRUTE_FORCE,
      challengeId: SEED_CHALLENGE_PASSWORD,
      kind: "brute_force",
      language: "python",
      code: REF_BRUTE_FORCE_CODE,
      status: "complete",
      createdBy: "manual",
      generatedAt: minutesAgo(60 * 24),
    })
  );
  await safeInsert("ref refined", () =>
    db.insert(challengeReferenceSolution).values({
      id: SEED_REF_REFINED,
      challengeId: SEED_CHALLENGE_PASSWORD,
      kind: "refined",
      language: "python",
      code: REF_REFINED_CODE,
      status: "complete",
      createdBy: "manual",
      generatedAt: minutesAgo(60 * 24),
    })
  );

  // --- Three work sessions + interactions + submissions ---
  type Journey = {
    label: string;
    sessionId: string;
    submissionId: string;
    studentUserId: string;
    interactions: Interaction[];
    code: string;
    stdin: string;
    stdout: string;
    review: Review;
  };

  const journeys: Journey[] = [
    {
      label: "Maria (strong)",
      sessionId: SEED_WS_MARIA_PWD,
      submissionId: SEED_SUB_MARIA_PWD,
      studentUserId: SEED_USER_STUDENT_MARIA,
      interactions: MARIA_INTERACTIONS,
      code: MARIA_CODE,
      stdin: "Passw0rd!\nabc\nHelloWorld1\n",
      stdout: "VALID\nINVALID\nINVALID\n",
      review: MARIA_REVIEW,
    },
    {
      label: "Alex Morgan (medium)",
      sessionId: SEED_WS_DEMO_PWD,
      submissionId: SEED_SUB_DEMO_PWD,
      studentUserId: existingStudentUserId,
      interactions: DEMO_INTERACTIONS,
      code: DEMO_CODE,
      stdin: "Passw0rd!\nabc\nHelloWorld1\n",
      stdout: "VALID\nINVALID\nINVALID\nINVALID\n",
      review: DEMO_REVIEW,
    },
    {
      label: "João (struggling)",
      sessionId: SEED_WS_JOAO_PWD,
      submissionId: SEED_SUB_JOAO_PWD,
      studentUserId: SEED_USER_STUDENT_JOAO,
      interactions: JOAO_INTERACTIONS,
      code: JOAO_CODE,
      stdin: "Passw0rd!\nabc\nHelloWorld1\n",
      // input() lê só a 1.ª linha; o programa imprime um resultado e encerra
      stdout: "VALID\n",
      review: JOAO_REVIEW,
    },
    {
      label: "Mary (strong, EN)",
      sessionId: SEED_WS_MARY_PWD,
      submissionId: SEED_SUB_MARY_PWD,
      studentUserId: SEED_USER_STUDENT_MARY,
      interactions: MARY_INTERACTIONS,
      code: MARY_CODE,
      stdin: "Passw0rd!\nabc\nHelloWorld1\n",
      stdout: "VALID\nINVALID\nINVALID\n",
      review: MARY_REVIEW,
    },
    {
      label: "John (struggling, EN)",
      sessionId: SEED_WS_JOHN_PWD,
      submissionId: SEED_SUB_JOHN_PWD,
      studentUserId: SEED_USER_STUDENT_JOHN,
      interactions: JOHN_INTERACTIONS,
      code: JOHN_CODE,
      stdin: "Passw0rd!\nabc\nHelloWorld1\n",
      // input() reads only the 1st line; the program prints one result and exits
      stdout: "VALID\n",
      review: JOHN_REVIEW,
    },
  ];

  for (const j of journeys) {
    const sessionStart = minutesAgo(
      Math.max(...j.interactions.map((i) => i.minutesAgo)) + 5
    );
    const sessionEnd = minutesAgo(2);
    await safeInsert(`work session ${j.label}`, () =>
      db.insert(workSession).values({
        id: j.sessionId,
        userId: j.studentUserId,
        challengeId: SEED_CHALLENGE_PASSWORD,
        classroomId,
        teachingAssistantId: SEED_TA_ID,
        createdAt: sessionStart,
        updatedAt: sessionEnd,
        lastMessageAt: minutesAgo(
          Math.min(...j.interactions.map((i) => i.minutesAgo))
        ),
        endedAt: sessionEnd,
      })
    );

    for (const it of j.interactions) {
      await safeInsert(
        `interaction ${j.label}/${it.type}@${it.minutesAgo}m`,
        () =>
          db.insert(userInteractionOnChallenge).values({
            id: randomUUID(),
            workSessionId: j.sessionId,
            challengeId: SEED_CHALLENGE_PASSWORD,
            interactionType: it.type,
            userPrompt: it.userPrompt,
            modelResponse: it.modelResponse,
            code: it.code ?? null,
            stdin: it.stdin ?? null,
            stdout: it.stdout ?? null,
            createdAt: minutesAgo(it.minutesAgo),
          })
      );
    }

    await safeInsert(`submission ${j.label}`, () =>
      db.insert(submission).values({
        id: j.submissionId,
        workSessionId: j.sessionId,
        challengeId: SEED_CHALLENGE_PASSWORD,
        studentUserId: j.studentUserId,
        code: j.code,
        stdin: j.stdin,
        stdout: j.stdout,
        submittedAt: sessionEnd,
        autoReview: null,
        autoReviewJson: j.review,
        autoReviewAt: sessionEnd,
        autoReviewStatus: "complete",
        autoReviewError: null,
      })
    );
  }

  console.log("[dev-demo] Password-validator demo seeded.");
  console.log(
    `  Students added: maria@taco-demo.local, joao@taco-demo.local, mary@taco-demo.local, john@taco-demo.local (senha: ${DEV_PASSWORD})`
  );
  console.log(
    `  Challenge: Strong password validator (id ${SEED_CHALLENGE_PASSWORD})`
  );
}
