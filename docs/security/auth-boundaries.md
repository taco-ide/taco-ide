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

## Organization plugin endpoints

Organizations, members and invitations are managed only through the product routes under `/v1/organizations/**`. Those routes apply the product role rules (coordinator+ for invitations and role changes, platform admin for member removal and organization updates) before they write or call `auth.api.*`. The Better Auth organization endpoints apply only the access-control statements in `permissions.ts`, so they stay closed to direct HTTP callers.

`packages/infra/src/auth/organization-endpoints.ts` enforces an allowlist in Better Auth's `before` hook, so it covers both aliases and uses the canonical endpoint path after routing. Any `/organization/*` endpoint not listed returns HTTP 403, including endpoints added by later Better Auth versions:

| Endpoint | Direct HTTP | Why |
| --- | --- | --- |
| `set-active` | Allowed | The web app selects the active organization. Better Auth only accepts organizations the caller belongs to. |
| `accept-invitation`, `reject-invitation` | Allowed | The invitee answers an invitation addressed to their own email. Invitations are created only through the product route. |
| `create`, `update`, `delete` | Denied | Product routes (`POST /v1/organizations`, `PATCH /v1/organizations/:id`, deactivation) are platform-admin-only. |
| `invite-member`, `cancel-invitation` | Denied | Product invitation routes require coordinator+. |
| `update-member-role`, `remove-member`, `leave` | Denied | Product member routes own role changes, the last-admin guard and removals. The app offers no self-service leave. |
| `get-full-organization`, `list`, `get-organization`, `list-members`, `list-invitations`, `list-user-invitations`, `get-invitation`, `get-active-member`, `get-active-member-role`, `check-slug`, `has-permission` | Denied | Not used by the web app. `list-members` and `get-full-organization` would expose member emails to students; the product listing requires teacher+. |

Platform admins get no exception: the admin panel uses product routes only. Server-side `auth.api.*` calls have no incoming request and are not affected; the product routes that make them (`createInvitation`, `cancelInvitation`, `updateMemberRole`) authorize the caller first.

The plugin also sets `disableOrganizationDeletion: true`. Organizations are deactivated through `PATCH /v1/organizations/:id/active`, never hard-deleted, even by server-side calls.

### Role statements

`permissions.ts` matches the product rules. Better Auth checks these statements inside the server-side calls above, and the API and web read them through `roleHasPermission`.

| Role | `member` | `invitation` | `organization` |
| --- | --- | --- | --- |
| `student`, `teacher` | none | none | none |
| `coordinator`, `admin` | `create`, `update` | `create`, `cancel` | none |

No organization role has `member:delete`, `organization:update` or `organization:delete`: those operations are platform-admin-only product routes or are disabled.

### Granting and removing `admin`

Only platform admins and current `admin` members of the organization may grant or remove the organization `admin` role. Better Auth applies the same rule to its creator role, but two product routes write roles directly and now check it themselves, reading the caller's membership from the database rather than the session cache:

- `PUT /v1/organizations/:id/members/:userId` returns 403 when a coordinator promotes a member to `admin` or changes an admin's role, even if another admin remains.
- `POST /v1/organizations/:id/members/import-csv` returns 403 for the whole file, dry runs included, when a coordinator imports any row with role `admin`. No row is written.

Inviting someone as `admin` follows the same rule: the coordinator path goes through `auth.api.createInvitation`, which rejects the creator role for non-admins.

## Verification

`apps/api/src/http/routes/v1/auth/__tests__/boundaries.test.ts` uses real Fastify requests, real password login, signed Better Auth cookies, and an isolated PostgreSQL test database. It checks both aliases, accepted public-profile changes, rejected administrative writes without partial persistence, deactivated accounts, closed HTTP organization creation, allowed and denied server-side creation, privilege changes after login, and server-only calls.

`apps/api/src/http/routes/v1/auth/__tests__/organization-endpoints.test.ts` uses the same setup. Through both aliases it checks that each bypass from #140 returns 403 without writing (teacher and coordinator invitations, member removal, organization update and deletion, role changes, invitation cancellation, leave, unused reads, platform-admin creation), and that `set-active`, `accept-invitation` and `reject-invitation` still work. It also checks disabled deletion for server-side calls, the role statements, the product invitation routes, and the admin-role rules in the member-role and CSV-import routes.

These changes do not claim that all account lifecycle endpoints have been audited.
