# Resource access policy

Access is evaluated against the resource's current classroom and organization. A role in a different organization, an old work session, or the `scope` query parameter does not grant access.

- Platform administrators can manage resources across active organizations.
- Organization administrators (including Better Auth `owner`) and coordinators can manage their organization's resources.
- Teachers can manage challenges they created or whose classroom they lead. Classroom management and teacher chat require responsibility for that classroom.
- Students and enrolled teachers can read and practice challenges in their current classrooms. Membership in the organization and a non-deleted enrollment are required. Learners receive only their own enrollment record; classroom staff can access the roster.
- Unassigned challenges are available for practice to authenticated users. Only a platform administrator, or their creator while they hold teacher or higher in at least one active organization, can manage them (unassigned challenges have no organization of their own, so a creator demoted to student everywhere or removed from every organization loses access). Assignment also requires management access to the destination classroom.
- Deleted users, challenges and classrooms and inactive users and organizations are unavailable. Student SSE chat also refuses inactive teaching assistants. Deleting a classroom hides its challenges without deleting child records.

Classroom and challenge lists apply this policy before filters, pagination and counts. `scope=all` means all resources the caller can access. `scope=mine` narrows classroom lists to lead/enrolled classrooms and challenge lists to accessible classroom-bound challenges. `scope=org` narrows classroom lists to the active organization; it never grants additional access. Classroom and tag filters use the same count and result predicates.

Direct knowledge-base lists, detail, search, document and entry operations also check the current classroom boundary. Reads require participation or staff responsibility; management requires the creator, responsible teacher or organization staff. Creating a knowledge base requires management access to the destination classroom.

## Staff role source

Staff roles are always read from the caller's current membership in the organization that owns the resource: the classroom's organization for classroom, challenge, submission, work-session, reference-solution and knowledge-base routes, and the `:id` organization for `/v1/organizations/:id/*` routes. The session's active organization (`request.user.role`) only drives UI defaults and `scope=org`; it never grants or denies access to another organization's resources (#118). A teacher in organization A who is a student in the active organization B can manage their organization-A resources, and a coordinator of B who is only a student (or not a member) in A is denied.

- Resource routes resolve the resource first (missing or deleted → `404`), then authorize with the resource-access services (`work-session-access.ts`, `knowledge-base-access.ts`) → `403` when the caller lacks membership or responsibility. Their role checks are a subset of the access-control statements in `packages/infra/src/auth/permissions.ts` (management requires teacher responsibility, coordinator or admin; students never manage).
- Organization routes use `requirePlatformAdminOrOrgRole(minimumRole)`: missing organization → `404`, otherwise the role in that organization (Better Auth `owner` counts as `admin`; inactive organizations and users are denied) must meet the minimum. Listing members requires `teacher`; member role changes, invitations, CSV import and email domains require `coordinator`.
- Revoking a membership takes effect on the next request; no session refresh is needed.

The former active-organization gates (`requirePermission`, `requireRole`, inline `usr.role` checks) were removed.

Challenge knowledge-base management checks the target challenge for every role. List/search results and internal agent search only use knowledge bases belonging to the challenge's current active classroom and organization. Removing a classroom assignment preserves associations in storage, but makes old associations unavailable to search and list operations. Permanent cleanup/cascading of associations is a separate lifecycle change.

The legacy student and teacher SSE chat endpoints enforce the same current access policy. Student SSE and JSON chat share a per-user/work-session limit of 25 messages per minute; teacher SSE uses the same limiter per user/classroom. The limiter is process-local, so a multi-instance deployment needs shared storage. Observability failure is logged and cannot prevent stream termination; interaction persistence failure also terminates the stream. Internal 5xx errors, including authentication errors, return a generic message while details remain in server logs.

## Regression verification

Tests use the real Fastify app, Better Auth sessions and a disposable PostgreSQL database. LLM agents, embeddings/search and observability are simulated to avoid external calls. Coverage includes cross-organization list/detail/management access, multi-organization staff whose active organization differs from the resource's (including organization switching, revoked membership and demotion), unassigned-challenge creators who were demoted or removed, assignment-only changes, source/destination authorization, current enrollment and roster privacy, `owner` normalization, platform administrators, knowledge-base management, deleted classrooms/inactive organizations, SSE access, telemetry failures, shared rate limits and generic error responses.

Run `npm run typecheck --workspaces --if-present`, `npm run lint`, and the API test suite with a disposable `DATABASE_URL` and placeholder LLM credentials. The API global setup recreates the database suffixed `_test`; never point it at a live database.

Tracking: issues #73 and #118; related #49, #31, #14 and #15. Middleware unit tests (#31) live in `apps/api/src/http/middlewares/__tests__/authorization.test.ts`. The non-destructive visibility fixes reference #53, whose full cleanup lifecycle remains outside this change.
