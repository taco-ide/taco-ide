export type EmbeddingFailureReason =
  | "not_configured"
  | "http_error"
  | "network_error"
  | "invalid_response";

/**
 * Raised when the embedding service cannot produce an embedding (missing
 * configuration, HTTP error, network failure or malformed payload). Callers
 * use it to tell "service unavailable" apart from "no matching results".
 */
export class EmbeddingUnavailableError extends Error {
  readonly reason: EmbeddingFailureReason;
  readonly status?: number;

  constructor(
    reason: EmbeddingFailureReason,
    message: string,
    options: { status?: number; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "EmbeddingUnavailableError";
    this.reason = reason;
    this.status = options.status;
  }
}

/** User-facing message for search endpoints when embeddings are unavailable. */
export const EMBEDDING_UNAVAILABLE_MESSAGE =
  "Knowledge base search is temporarily unavailable because the embedding service could not be reached. Please try again later.";
