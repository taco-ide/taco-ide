# Self-service authentication boundaries

The Better Auth configuration enforces these rules for both `/api/auth` and the versioned `/v1/auth` alias. The routes use the same auth instance; security rules live in the infrastructure package rather than in an individual Fastify alias.

## Administrative user fields

`isActive`, `deletedAt`, and `isPlatformAdmin` are server-controlled fields. Signup and self-service profile updates reject requests that supply any of them with HTTP 400, including `false` and `null`. A rejected request does not partially update the public profile or create an account.

All three additional fields also use Better Auth's `input: false` setting. The explicit before hook makes rejection consistent where Better Auth would otherwise ignore a value or substitute a default. Normal signup retains `isActive: true`, `isPlatformAdmin: false`, and an empty deletion timestamp. Active users may continue updating their name and image.

Self-service profile updates require a valid session and load the current account from the database. Disabled, deleted, or missing accounts receive HTTP 403; a cookie issued before deactivation does not permit subsequent profile writes. Requests without a session receive HTTP 401.

Administrative changes remain the responsibility of the platform's dedicated management routes and trusted database operations.

## Organization creation

The organization plugin requires an active, non-deleted platform admin to create an organization, matching the custom API's platform-admin creation policy. Per-organization `admin` membership does not grant this global permission.

Eligibility is loaded from the current user row for each creation request, so promotions and revocations take effect without waiting for Better Auth's session-cookie cache. Allowed creators retain the plugin's `admin` membership in their new organization.

The creation callback throws an authorization error when eligibility fails. This also enforces the policy on server-only `userId` calls, which Better Auth otherwise treats as system actions exempt from a callback returning `false`.

## Verification

`apps/api/src/http/routes/v1/auth/__tests__/boundaries.test.ts` uses real Fastify requests, real password login, signed Better Auth cookies, and an isolated PostgreSQL test database. It checks both aliases, accepted public-profile changes, rejected administrative writes without partial persistence, deactivated accounts, allowed and denied organization creation, privilege changes after login, and server-only calls.

These changes address the self-service field and organization-creation boundaries. They do not claim that all organization-plugin operations or all account lifecycle endpoints have been audited.
