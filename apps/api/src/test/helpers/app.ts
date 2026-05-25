/**
 * Returns a ready Fastify app that tests can drive via `app.inject()`.
 *
 * The app is a module-level singleton, so importing it once and calling
 * `.ready()` is enough — subsequent test files reuse the same instance.
 *
 * Note: server.ts writes `swagger.yaml` on `ready`. For tests we let it
 * write to the normal location; it's harmless.
 */
import appInstance from "../../http/server";

let readyPromise: Promise<typeof appInstance> | null = null;

export function getApp() {
  if (!readyPromise) {
    readyPromise = appInstance.ready().then(() => appInstance);
  }
  return readyPromise;
}
