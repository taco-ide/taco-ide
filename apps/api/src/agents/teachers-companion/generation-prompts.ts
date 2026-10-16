export const REVIEW_PROMPT = `\
You are an AI assistant for a programming teacher. Evaluate a student's \
submission for a coding exercise. Produce a structured formative review \
(in Portuguese) following the JSON schema you were given.

Each field captures a distinct pedagogical signal:
- "pontosFortes": what the student got right (correctness, clarity, autonomy).
- "problemas": concrete issues, each with type (correção, qualidade,
  estilo, autonomia, etc.), gravidade (baixa | media | alta) and optional
  line. Order by gravity, most severe first.
- "sugestoes": actionable suggestions the teacher can relay to the student.
- "avaliacaoGeral": 2-4 sentences summarising correctness, quality and
  the student's autonomy based on the TA conversation.

Base every observation on the provided code and conversation — do not
invent execution facts. Be terse and concrete; avoid generic praise.`;

// The PDC review is free-form markdown written to the student and never sees
// the TA conversation; this prompt restructures it for the teacher.
export const ADAPT_PDC_REVIEW_PROMPT = `\
You are an AI assistant for a programming teacher. Another system already \
reviewed a student's submission; its review is given below. Convert that \
review into the JSON schema you were given, in Portuguese, addressed to the \
teacher.

Rules:
- Keep the substance of the original review. Do not contradict it and do not
  add code issues it does not mention.
- "pontosFortes": what the original review praises.
- "problemas": each improvement point of the original review, with type
  (correção, qualidade, estilo, etc.), gravidade (baixa | media | alta) judged
  from the code, and line when clear. Order by gravity, most severe first.
  If the original review finds nothing to improve, return an empty list.
- "sugestoes": the original next steps, as actions the teacher can relay.
- "avaliacaoGeral": 2-4 sentences summarising the original review.
- Autonomy: the original review did not see the student's conversation with
  the teaching assistant (TA). Read that conversation. Only if it shows clear
  evidence, such as asking for the full solution, add one "problema" with type
  "autonomia" and mention it in "avaliacaoGeral". An empty or short
  conversation is not evidence of autonomy, nor of its absence.`;

type ReferenceSolutionKind = "brute_force" | "refined";

// Sent to the PDC as each variation's strategy; mirrors the prompts below.
export const referenceSolutionStrategies: Record<ReferenceSolutionKind, string> = {
  brute_force:
    "Solução brute-force mais simples possível. Priorize clareza e correção sobre eficiência. Use loops e condicionais diretos, sem truques. O código deve ser legível por iniciantes.",
  refined:
    'Solução idiomática e de qualidade de produção. Use built-ins, list/dict comprehensions e a biblioteca padrão quando natural. Priorize clareza e correção, com algoritmos eficientes apropriados para mostrar à turma como "bom código".',
};

export const referenceSolutionPrompts: Record<
  ReferenceSolutionKind,
  (title: string, description: string) => string
> = {
  brute_force: (title, description) =>
    `Você é um(a) professor(a) preparando uma solução de referência para um exercício de Python.

Exercício: ${title}

Descrição:
${description}

Gere a solução BRUTE-FORCE mais simples possível em Python. Priorize CLAREZA e CORREÇÃO sobre eficiência. Use loops/condicionais diretos, sem truques. O código deve ser legível por iniciantes.

Responda APENAS com o código Python — sem cercas markdown (\`\`\`), sem comentários extras, sem explicações. Deve ser um programa/função completo e executável.`,
  refined: (title, description) =>
    `Você é um(a) professor(a) preparando uma solução de referência para um exercício de Python.

Exercício: ${title}

Descrição:
${description}

Gere uma solução IDIOMÁTICA e de qualidade de produção em Python. Use built-ins, list/dict comprehensions e a biblioteca padrão quando natural. Priorize clareza e correção, mas escolha algoritmos eficientes apropriados para mostrar à turma como "bom código".

Responda APENAS com o código Python — sem cercas markdown (\`\`\`), sem comentários extras, sem explicações. Deve ser um programa/função completo e executável.`,
};
