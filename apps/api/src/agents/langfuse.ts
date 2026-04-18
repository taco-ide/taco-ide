import { env } from "@repo/infra/env";
import { CallbackHandler } from "langfuse-langchain";

export type LangfuseContext = {
  userId?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, string>;
};

export function getLangfuseCallback(
  ctx: LangfuseContext = {},
): CallbackHandler | null {
  if (
    !env.LANGFUSE_ENABLED ||
    !env.LANGFUSE_PUBLIC_KEY ||
    !env.LANGFUSE_SECRET_KEY
  ) {
    return null;
  }

  if (!env.LANGFUSE_BASEURL) {
    console.warn(
      "[langfuse] LANGFUSE_ENABLED=true but LANGFUSE_BASEURL is not set — " +
        "traces will be sent to https://cloud.langfuse.com. " +
        "Set LANGFUSE_BASEURL if you are using a self-hosted instance.",
    );
  }

  return new CallbackHandler({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_BASEURL,
    flushAt: 1,
    flushInterval: 0,
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    tags: ctx.tags,
    metadata: ctx.metadata,
  });
}
