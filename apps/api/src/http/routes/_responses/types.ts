import { z } from "zod";

// Base success response
export const BaseSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});

// Base error response
export const BaseErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errors: z.record(z.string(), z.array(z.string()).or(z.string())).optional(),
});

// Success responses by status code
export const ResponseSchema200 = BaseSuccessResponseSchema.extend({
  data: z.unknown(),
  pagination: z
    .object({
      total: z.number(),
      page: z.number(),
      perPage: z.number(),
      totalPages: z.number(),
    })
    .optional(),
});

export const ResponseSchema201 = BaseSuccessResponseSchema.extend({
  data: z.unknown(),
});

export const ResponseSchema204 = BaseSuccessResponseSchema;

// Error responses by status code
export const ResponseSchema400 = BaseErrorResponseSchema;
export const ResponseSchema401 = BaseErrorResponseSchema;
export const ResponseSchema403 = BaseErrorResponseSchema;
export const ResponseSchema404 = BaseErrorResponseSchema;
export const ResponseSchema409 = BaseErrorResponseSchema;
// Rate limiter responses add `code` and `retryAfterSeconds` (also sent as the
// Retry-After header); route-specific cooldowns send the base shape.
export const ResponseSchema429 = BaseErrorResponseSchema.extend({
  code: z.literal("RATE_LIMITED").optional(),
  retryAfterSeconds: z.number().int().nonnegative().optional(),
});
export const ResponseSchema413 = BaseErrorResponseSchema;
export const ResponseSchema500 = BaseErrorResponseSchema;
export const ResponseSchema503 = BaseErrorResponseSchema;

// Type exports
export type SuccessResponse = z.infer<typeof BaseSuccessResponseSchema>;
export type ErrorResponse = z.infer<typeof BaseErrorResponseSchema>;
