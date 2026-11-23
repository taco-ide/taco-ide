# Resource access policy

Access is evaluated against the resource's current classroom and organization. A role in a different organization, an old work session, or the `scope` query parameter does not grant access.

- Platform administrators can manage resources across active organizations.
- Organization administrators (including Better Auth `owner`) and coordinators can manage their organization's resources.
- Teachers can manage challenges they created or whose classroom they lead. Classroom management and teacher chat require responsibility for that classroom.
- Students and enrolled teachers can read and practice challenges in their current classrooms. Membership in the organization and a non-deleted enrollment are required. Learners receive only their own enrollment record; classroom staff can access the roster.
- Unassigned challenges are available for practice to authenticated users. Only their creator or a platform administrator can manage them. Assignment also requires management access to the destination classroom.
- Deleted users, challenges and classrooms and inactive users and organizations are unavailable. Student SSE chat also refuses inactive teaching assistants. Deleting a classroom hides its challenges without deleting child records.

Classroom and challenge lists apply this policy before filters, pagination and counts. `scope=all` means all resources the caller can access. `scope=mine` narrows classroom lists to lead/enrolled classrooms and challenge lists to accessible classroom-bound challenges. `scope=org` narrows classroom lists to the active organization; it never grants additional access. Classroom and tag filters use the same count and result predicates.

Direct knowledge-base lists, detail, search, document and entry operations also check the current classroom boundary. Reads require participation or staff responsibility; management requires the creator, responsible teacher or organization staff. Creating a knowledge base requires management access to the destination classroom. Existing route permission preHandlers remain in place.

Challenge knowledge-base management checks the target challenge for every role. List/search results and internal agent search only use knowledge bases belonging to the challenge's current active classroom and organization. Removing a classroom assignment preserves associations in storage, but makes old associations unavailable to search and list operations. Permanent cleanup/cascading of associations is a separate lifecycle change.

The legacy student and teacher SSE chat endpoints enforce the same current access policy. Student SSE and JSON chat share a per-user/work-session limit of 25 messages per minute; teacher SSE uses the same limiter per user/classroom. The limiter is process-local, so a multi-instance deployment needs shared storage. Observability failure is logged and cannot prevent stream termination; interaction persistence failure also terminates the stream. Internal 5xx errors, including authentication errors, return a generic message while details remain in server logs.

Anonymous teaching-assistant rating statistics and their CSV export (`/v1/organizations/:id/teaching-assistant-evaluations/*`, #99) require a platform administrator or a current teacher, coordinator or administrator of the active organization. Membership is checked before the organization lookup, so non-members get 403 whether or not the organization exists; only platform administrators see 404 for a missing or inactive one. Ratings are scoped through the TA's owning organization; global TAs are excluded. Responses never join ratings to users, work sessions or classrooms.

Rating figures use small-cell suppression, because staff can see when each student submitted and could otherwise match a tiny group to a known student. The smallest published unit is the group of ratings of one TA in one week. Groups with fewer than `TA_RATING_MIN_GROUP_SIZE` ratings (default 5; 1 disables suppression) are withheld. Every published number (total, mean, grade distribution, weekly buckets, per-TA rows and CSV rows) is computed only from groups that reach the threshold. Date filters snap to whole weeks, so subtracting one response from another cannot isolate a withheld group. Withheld figures are returned as `null` with `suppressed: true`. The weekly series is zero-filled, and a withheld week is reported as withheld, never as zero. The CSV has one aggregated row per week and TA (count, mean, count per grade), never one row per rating. Withheld groups appear only as a row with empty figures and `suppressed=true`. The CSV starts with a UTF-8 BOM, and cells that start with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'`. Residual risk: a group that reaches the threshold but where everyone gave the same grade still shows that grade. This is k-anonymity, not l-diversity or differential privacy.

## Regression verification

Tests use the real Fastify app, Better Auth sessions and a disposable PostgreSQL database. LLM agents, embeddings/search and observability are simulated to avoid external calls. Coverage includes cross-organization list/detail/management access, assignment-only changes, source/destination authorization, current enrollment and roster privacy, `owner` normalization, platform administrators, knowledge-base management, deleted classrooms/inactive organizations, SSE access, telemetry failures, shared rate limits and generic error responses.

Run `npm run typecheck --workspaces --if-present`, `npm run lint`, and the API test suite with a disposable `DATABASE_URL` and placeholder LLM credentials. The API global setup recreates the database suffixed `_test`; never point it at a live database.

Tracking: issue #73; related #49, #31, #14 and #15. The non-destructive visibility fixes reference #53, whose full cleanup lifecycle remains outside this change.
