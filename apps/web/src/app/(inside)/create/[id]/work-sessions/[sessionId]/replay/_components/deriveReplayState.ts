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

/** Estado visível após aplicar o prefixo interactions[0..stepIndex - 1]. */
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
        content: i.modelResponse?.trim()
          ? i.modelResponse
          : "(Aguardando resposta...)",
      });
    }
  }

  let code = "";
  let stdin = "";
  let stdout = "";
  for (const i of prefix) {
    if (i.interactionType === "code_run") {
      if (i.code != null) code = i.code;
      if (i.stdin != null) stdin = i.stdin;
      if (i.stdout != null) stdout = i.stdout;
    }
  }

  const lastInteractionAt =
    prefix.length > 0 ? prefix[prefix.length - 1]!.createdAt : null;

  return { messages, code, stdin, stdout, lastInteractionAt };
}
