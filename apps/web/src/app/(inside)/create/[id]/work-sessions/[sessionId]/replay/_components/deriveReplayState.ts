export type ReplayInteraction = {
  id: string;
  interactionType: string;
  userPrompt: string;
  modelResponse: string;
  code: string | null;
  stdin: string | null;
  stdout: string | null;
  createdAt: string;
};

export type ReplayChatMessage = {
  key: string;
  role: "user" | "assistant";
  content: string;
};

export type DerivedReplayState = {
  messages: ReplayChatMessage[];
  code: string;
  stdin: string;
  stdout: string;
  lastInteractionAt: string | null;
};

/**
 * Estado após as primeiras `stepIndex` interações (`interactions[0..stepIndex-1]`).
 * Passo 0 = antes de qualquer evento; passo 1 = após a 1.ª interação.
 */
export function deriveReplayState(
  interactions: ReplayInteraction[],
  stepIndex: number
): DerivedReplayState {
  const prefix = interactions.slice(0, Math.max(0, stepIndex));
  const messages: ReplayChatMessage[] = [];

  for (const i of prefix) {
    if (i.interactionType === "chat") {
      if (i.userPrompt) {
        messages.push({
          key: `${i.id}-user`,
          role: "user",
          content: i.userPrompt,
        });
      }
      messages.push({
        key: `${i.id}-assistant`,
        role: "assistant",
        // Vazio quando não há resposta: o ReplayChatColumn aplica o fallback
        // traduzido (replay.chat.awaitingResponse).
        content: i.modelResponse?.trim() ? i.modelResponse : "",
      });
    }
  }

  /** Último snapshot por campo (cronológico). Interações `chat` gravam `code`/`stdin`/`stdout` quando enviados. */
  let code = "";
  let stdin = "";
  let stdout = "";
  for (const i of prefix) {
    if (i.code != null) {
      code = i.code;
    }
    if (i.stdin != null) {
      stdin = i.stdin;
    }
    if (i.stdout != null) {
      stdout = i.stdout;
    }
  }

  const lastInteractionAt =
    prefix.length > 0 ? prefix[prefix.length - 1]!.createdAt : null;

  return { messages, code, stdin, stdout, lastInteractionAt };
}
