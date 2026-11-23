import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/apiClient";

export const RATE_LIMITED_CODE = "RATE_LIMITED";

/** Translated "too many requests, try again in …" for a Retry-After value. */
export function useRateLimitMessage() {
  const t = useTranslations("common.rateLimited");
  return useCallback(
    (retryAfterSeconds?: number) => {
      const seconds = Math.max(1, Math.ceil(retryAfterSeconds ?? 60));
      if (seconds < 60) return t("seconds", { count: seconds });
      if (seconds < 3600) return t("minutes", { count: Math.ceil(seconds / 60) });
      return t("hours", { count: Math.ceil(seconds / 3600) });
    },
    [t]
  );
}

/**
 * Message to show for a failed API call: the translated rate-limit text for
 * `code: "RATE_LIMITED"` errors, otherwise the server message or `fallback`.
 */
export function useApiErrorMessage() {
  const rateLimitMessage = useRateLimitMessage();
  return useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.code === RATE_LIMITED_CODE) {
        return rateLimitMessage(err.retryAfterSeconds);
      }
      return (err instanceof Error && err.message) || fallback;
    },
    [rateLimitMessage]
  );
}
