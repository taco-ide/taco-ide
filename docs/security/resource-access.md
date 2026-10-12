# Resource access policy

Access is evaluated against the resource's current classroom and organization. A role in a different organization, an old work session, or the `scope` query parameter does not grant access.

- Platform administrators can manage resources across active organizations.
- Organization administrators (including Better Auth `owner`) and coordinators can manage their organization's resources.
- Teachers can manage challenges they created or whose classroom they lead. Classroom management and teacher chat require responsibility for that classroom.
- Students and enrolled teachers can read and practice challenges in their current classrooms. Membership in the organization and a non-deleted enrollment are required. Learners receive only their own enrollment record; classroom staff can access the roster.
- Unassigned challenges are available for practice to authenticated users. Only their creator or a platform administrator can manage them. Assignment also requires management access to the destination classroom.
- Deleted users, challenges and classrooms and inactive users and organizations are unavailable. Student SSE chat also refuses inactive teaching assistants. Deleting a classroom hides its challenges without deleting child records.

Classroom and challenge lists apply this policy before filters, pagination and counts. `scope=all` means all resources the caller can access. `scope=mine` narrows classroom lists to lead/enrolled classrooms and challenge lists to accessible classroom-bound challenges. `scope=org` narrows classroom lists to the active organization; it never grants additional access. Classroom and tag filters use the same count and result predicates.

Challenge knowledge-base management checks the target challenge for every role. List/search results and internal agent search only use knowledge bases belonging to the challenge's current active classroom and organization. Removing a classroom assignment preserves associations in storage, but makes old associations unavailable to search and list operations. Permanent cleanup/cascading of associations is a separate lifecycle change.

The legacy student and teacher SSE chat endpoints enforce the same current access policy. Student SSE and JSON chat share a per-user/work-session limit of 25 messages per minute; teacher SSE uses the same limiter per user/classroom. The limiter is process-local, so a multi-instance deployment needs shared storage. Observability failure is logged and cannot prevent stream termination; interaction persistence failure also terminates the stream. Internal 5xx errors, including authentication errors, return a generic message while details remain in server logs.

## Regression verification

Tests use the real Fastify app, Better Auth sessions and a disposable PostgreSQL database. LLM agents, embeddings/search and observability are simulated to avoid external calls. Coverage includes cross-organization list/detail/management access, assignment-only changes, source/destination authorization, current enrollment and roster privacy, `owner` normalization, platform administrators, knowledge-base management, deleted classrooms/inactive organizations, SSE access, telemetry failures, shared rate limits and generic error responses.

Run `npm run typecheck --workspaces --if-present`, `npm run lint`, and the API test suite with a disposable `DATABASE_URL` and placeholder LLM credentials. The API global setup recreates the database suffixed `_test`; never point it at a live database.

Tracking: issue #73; related #49, #31, #14 and #15. The non-destructive visibility fixes reference #53, whose full cleanup lifecycle remains outside this change.
