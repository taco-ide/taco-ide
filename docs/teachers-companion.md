# Teachers' Companion — Implementation & UI Roadmap

## What is it?

The Teachers' Companion is an AI agent (LangGraph ReAct) that helps teachers with classroom tasks: creating exercise drafts, evaluating student submissions, suggesting test cases, and reviewing classroom progress. It is the teacher-facing counterpart to the student-facing Teaching Assistant.

---

## Current State (Backend Only)

### Agent

**File:** `apps/api/src/agents/teachers-companion/`

| File | Purpose |
|------|---------|
| `agent.ts` | Builds a LangGraph ReAct agent with `MemorySaver` checkpointer |
| `prompt.ts` | Builds the system prompt with classroom name/description injected |
| `tools.ts` | Defines the 5 tools available to the agent |

The agent is instantiated per-request via `buildTeachersCompanionAgent(llmInstance)` and uses `thread_id = "teacher-{classroomId}-{userId}"` for in-memory history across turns within the same process lifetime. Because `MemorySaver` lives in RAM, history is lost on server restart.

### Tools

| Tool | What it does | Persistence |
|------|-------------|-------------|
| `createChallengeDraft` | Returns a JSON draft `{ title, description, difficulty, testCases, solution }` | None — draft is returned to the LLM, never saved |
| `listSubmissions` | Queries `challengeSolution` + `user` tables with pagination | Read-only |
| `evaluateSubmission` | Loads a submission + its `userInteractionOnChallenge` history | Read-only |
| `suggestTestCases` | Makes a nested LLM call to generate 6–10 structured test cases | None |
| `getClassroomInfo` | Reads classroom context from LangGraph `config.configurable` | Read-only |

### API Endpoints

**File:** `apps/api/src/http/routes/v1/chat/`

```
POST /v1/chat/teacher/message
  Body:    { classroomId: string, message: string }
  Auth:    session cookie required; user must be member of classroom's org
  Response: SSE stream (text/event-stream)
  Events:  { type: "text", content }  — streaming token
           { type: "done", full_response }  — final assembled text
           { type: "error", content }  — on failure/timeout

GET  /v1/chat/teacher/history/:classroomId
  Returns: { success: true, data: [] }  — placeholder, always empty
```

Authorization note: the route checks `member.organizationId` but does **not** verify that the user has a teacher/coordinator/admin role. Any org member (including students) can currently call it.

### Observability

Langfuse traces are emitted with:
- `userId` = session user ID
- `sessionId` = `"teacher-{classroomId}-{userId}"`
- `tags` = `["agent:tc"]`
- `metadata` = `{ classroomId }`

### What is NOT implemented

- No database table for teacher chat history — messages are ephemeral.
- `teacher-history.ts` always returns an empty array (placeholder).
- No "accept draft" flow — `createChallengeDraft` returns a JSON blob to the LLM but there is no endpoint or UI to persist it to `challenge`.
- No role check — any org member can call the teacher endpoint.

---

## Comparison: Teachers' Companion vs Teaching Assistant

| | Teaching Assistant (Student) | Teachers' Companion |
|---|---|---|
| Entry point | `POST /v1/chat/student/message` | `POST /v1/chat/teacher/message` |
| Transport | SSE | SSE |
| History source | DB (`userInteractionOnChallenge`) | In-memory `MemorySaver` (lost on restart) |
| History persisted | Yes, after each turn | No |
| Frontend | `ChatPanel.tsx` on problem page | **None** |
| Context | `workSessionId` → challenge, TA config | `classroomId` → classroom name/description |
| Tools | `runCode`, `getChallengeInfo`, `searchKnowledgeBase` | 5 tools (see above) |
| Role gate | Any authenticated user with a work session | Any org member (bug — should be teacher+) |

---

## Implementing the UI

### Recommended placement

A collapsible **side panel or drawer** on the Classroom page (`/classrooms/[id]`). This is the logical home because:
- The agent receives `classroomId` as its only context parameter.
- Teachers spend most of their time on this page managing challenges and enrollments.
- A floating chat button (like the student drawer) keeps the existing page layout intact.

### SSE streaming pattern

The student-facing `POST /v1/work-sessions/:id/chat` returns JSON (non-streaming). The teacher route returns **SSE**, so the frontend needs a raw `fetch` + `ReadableStream` consumer — not a React Query mutation.

Reference pattern:

```ts
async function streamTeacherMessage(
  classroomId: string,
  message: string,
  onToken: (token: string) => void
): Promise<string> {
  const res = await fetch(`${API_URL}/v1/chat/teacher/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ classroomId, message }),
  });

  if (!res.ok || !res.body) throw new Error("Request failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === "text") {
        onToken(event.content);
        fullResponse += event.content;
      }
      if (event.type === "error") throw new Error(event.content);
    }
  }

  return fullResponse;
}
```

### UI component plan

```
apps/web/src/app/(inside)/classrooms/[id]/
├── page.tsx                        ← existing, add <TeacherCompanionPanel>
└── _components/
    └── TeacherCompanionPanel.tsx   ← new
```

`TeacherCompanionPanel` manages:
- `messages: { role: "user" | "assistant"; content: string }[]` — local state (ephemeral, mirrors backend)
- `streamingContent: string` — accumulated tokens during a live stream
- `isStreaming: boolean` — disables input while receiving
- Calls `streamTeacherMessage(classroomId, message, onToken)` on submit

The existing `ChatBubble`, `ChatMessageList`, `ChatInput` components from `apps/web/src/components/ui/chat/` can be reused directly — same components the student `ChatPanel` uses.

### Handling `createChallengeDraft`

When the agent calls `createChallengeDraft`, the tool returns a JSON blob that becomes part of the agent's text response. To make drafts actionable:

1. The agent's final text response will contain a structured JSON block (or the LLM will narrate the draft inline).
2. Parse the response for a draft block and render an **"Accept draft"** card below the message.
3. Accepting calls a new endpoint: `POST /v1/challenges/create` (already exists for the challenge wizard) with the draft fields pre-filled.

This is optional for a first iteration — the companion is useful even without "accept draft" if the teacher can copy/paste from the chat.

### Backend gaps to fix before shipping

| Gap | Fix |
|-----|-----|
| No role check on `POST /v1/chat/teacher/message` | Add `member.role IN ('teacher', 'coordinator', 'admin')` check |
| `MemorySaver` history lost on restart | Migrate to `PostgresSaver` from `@langchain/langgraph-checkpoint-postgres`, or store turns in a new `teacherChatHistory` table |
| `GET /v1/chat/teacher/history/:classroomId` returns empty | Implement real history query once persistence is in place |
| `createChallengeDraft` returns draft to LLM only | Add `POST /v1/challenges/create-from-draft` (or reuse existing create) for the "accept" action |

### Suggested delivery order

1. **Wire the UI (read-only, ephemeral)** — `TeacherCompanionPanel` on the classroom page, calling the existing SSE endpoint. History resets on page reload. Low risk, unblocks teacher testing.
2. **Fix the role gate** — One-line change in `teacher-message.ts`.
3. **Persist history** — Add `teacherChatHistory` table (or use `PostgresSaver`) and implement the history endpoint. Enables page-reload continuity.
4. **Accept draft flow** — Parse draft blocks from the response and surface a pre-filled challenge creation form.
