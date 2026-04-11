import { env } from "@repo/infra/env";

// Import lazily to avoid hard-failing when the package is absent in some
// build environments. However, since it will be a declared dependency,
// a direct import is acceptable.
import { CallbackHandler } from "langfuse-langchain";

/**
 * Returns a Langfuse CallbackHandler when observability is enabled and all
 * required environment variables are present; otherwise returns null.
 *
 * Usage:
 *   const langfuseCallback = getLangfuseCallback();
 *   const callbacks = langfuseCallback ? [langfuseCallback] : [];
 *   agent.invoke({ messages }, { callbacks });
 */
export function getLangfuseCallback(): CallbackHandler | null {
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
    baseUrl: env.LANGFUSE_BASEURL, // undefined = Langfuse Cloud default
    flushAt: 1, // flush immediately in serverless-like handlers
    flushInterval: 0, // no periodic flush delay
  });
}
