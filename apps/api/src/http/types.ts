import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

/**
 * Fastify instance with Zod Type Provider.
 * Use this type in ALL functions that receive the Fastify instance.
 *
 * This enables:
 * - Automatic type inference from Zod schemas in route handlers
 * - Typed request.body, request.params, request.query
 * - Validated responses against defined schemas
 */
export type FastifyTypedInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;
