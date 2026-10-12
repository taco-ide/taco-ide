import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challenge,
  classroom,
  member,
  organization,
  userClassroom,
  user,
  knowledgeBase,
  challengeKnowledgeBase,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createUser,
  enrollStudent,
  createTeachingAssistant,
  createWorkSession,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

const mocks = vi.hoisted(() => ({
  search: vi.fn(async () => []),
  flush: vi.fn(async () => {}),
  student: vi.fn(),
  teacher: vi.fn(),
}));
vi.mock("../../../../../services/knowledge-base-search", () => ({
  searchChallengeKnowledgeBases: mocks.search,
}));
vi.mock("../../../../../agents/llm-factory", () => ({
  createLlm: () => ({}),
  AGENT_TIMEOUT_MS: 1000,
  AgentTimeoutError: class extends Error {},
}));
vi.mock("../../../../../agents/langfuse", () => ({
  getLangfuseCallback: () => ({ flushAsync: mocks.flush }),
}));
vi.mock("../../../../../agents/teaching-assistant/agent", () => ({
  buildTeachingAssistantAgent: () => ({ streamEvents: mocks.student }),
}));
vi.mock("../../../../../agents/teachers-companion/agent", () => ({
  buildTeachersCompanionAgent: () => ({ streamEvents: mocks.teacher }),
}));
vi.mock("../../../../../agents/teachers-companion/reference-solution", () => ({
  generateReferenceSolutions: vi.fn(),
}));

async function* replyStream() {
  yield {
    event: "on_chat_model_stream",
    data: { chunk: { content: "Test response" } },
  };
}
type ListData = {
  data: { id: string }[];
  pagination: { total: number; totalPages: number };
};

describe("current resource access across organizations", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let orgA: Awaited<ReturnType<typeof createOrg>>;
  let orgB: Awaited<ReturnType<typeof createOrg>>;
  let lead: Awaited<ReturnType<typeof createUser>>;
  let learner: Awaited<ReturnType<typeof createUser>>;
  let peer: Awaited<ReturnType<typeof createUser>>;
  let outsider: Awaited<ReturnType<typeof createUser>>;
  let classA: Awaited<ReturnType<typeof createClassroom>>;
  let classB: Awaited<ReturnType<typeof createClassroom>>;
  let chA: Awaited<ReturnType<typeof createChallenge>>;
  let kbId: string;
  let cookies: { lead: string; learner: string; outsider: string };
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.student.mockImplementation(replyStream);
    mocks.teacher.mockImplementation(replyStream);
    mocks.flush.mockResolvedValue(undefined);
    orgA = await createOrg();
    orgB = await createOrg();
    lead = await createUser();
    learner = await createUser();
    peer = await createUser();
    outsider = await createUser();
    await addMember(lead.id, orgA.id, "teacher");
    await addMember(learner.id, orgA.id, "student");
    await addMember(peer.id, orgA.id, "student");
    await addMember(outsider.id, orgB.id, "admin");
    classA = await createClassroom({
      organizationId: orgA.id,
      teacherUserId: lead.id,
    });
    classB = await createClassroom({
      organizationId: orgB.id,
      teacherUserId: outsider.id,
    });
    await enrollStudent(learner.id, classA.id);
    await enrollStudent(peer.id, classA.id);
    chA = await createChallenge({
      classroomId: classA.id,
      createdByUserId: lead.id,
    });
    await createChallenge({
      classroomId: classB.id,
      createdByUserId: outsider.id,
    });
    kbId = randomUUID();
    await db.insert(knowledgeBase).values({
      id: kbId,
      organizationId: orgA.id,
      classroomId: classA.id,
      title: "Test KB",
      createdByUserId: lead.id,
    });
    await db
      .insert(challengeKnowledgeBase)
      .values({ challengeId: chA.id, knowledgeBaseId: kbId });
    cookies = {
      lead: await loginAs({ email: lead.email, password: TEST_PASSWORD }),
      learner: await loginAs({ email: learner.email, password: TEST_PASSWORD }),
      outsider: await loginAs({
        email: outsider.email,
        password: TEST_PASSWORD,
      }),
    };
  });

  it("filters classroom and challenge pages/counts and ignores foreign classroom filters", async () => {
    for (const resource of ["classrooms", "challenges"]) {
      const response = await app.inject({
        url: `/v1/${resource}/?perPage=1`,
        headers: { cookie: cookies.learner },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json<ListData>();
      expect(body.data.map((row) => row.id)).toEqual([
        resource === "classrooms" ? classA.id : chA.id,
      ]);
      expect(body.pagination).toMatchObject({ total: 1, totalPages: 1 });
    }
    const filtered = await app.inject({
      url: `/v1/challenges/?classroomId=${classB.id}`,
      headers: { cookie: cookies.learner },
    });
    expect(filtered.json<ListData>()).toMatchObject({
      data: [],
      pagination: { total: 0 },
    });
    const tagged = await app.inject({
      url: "/v1/challenges/?tags=missing",
      headers: { cookie: cookies.lead },
    });
    expect(tagged.json<ListData>()).toMatchObject({
      data: [],
      pagination: { total: 0 },
    });
  });

  it("denies foreign details and returns only the learner's own roster entry", async () => {
    for (const url of [
      `/v1/classrooms/${classA.id}`,
      `/v1/challenges/${chA.id}`,
    ]) {
      expect(
        (await app.inject({ url, headers: { cookie: cookies.outsider } }))
          .statusCode
      ).toBe(403);
    }
    const student = await app.inject({
      url: `/v1/classrooms/${classA.id}`,
      headers: { cookie: cookies.learner },
    });
    expect(student.statusCode).toBe(200);
    expect(
      student
        .json<{ data: { enrollments: { userId: string }[] } }>()
        .data.enrollments.map((row) => row.userId)
    ).toEqual([learner.id]);
    const teacher = await app.inject({
      url: `/v1/classrooms/${classA.id}`,
      headers: { cookie: cookies.lead },
    });
    expect(
      teacher.json<{ data: { enrollments: unknown[] } }>().data.enrollments
    ).toHaveLength(2);
  });

  it("denies same-org students not currently enrolled", async () => {
    await db
      .update(userClassroom)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(userClassroom.userId, learner.id),
          eq(userClassroom.classroomId, classA.id)
        )
      );
    for (const url of [
      `/v1/classrooms/${classA.id}`,
      `/v1/challenges/${chA.id}`,
    ])
      expect(
        (await app.inject({ url, headers: { cookie: cookies.learner } }))
          .statusCode
      ).toBe(403);
    expect(
      (
        await app.inject({
          url: "/v1/challenges/",
          headers: { cookie: cookies.learner },
        })
      ).json<ListData>().pagination.total
    ).toBe(0);
  });

  it("denies a foreign admin deletion and assignment-only mutation without changing source", async () => {
    const headers = { cookie: cookies.outsider };
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/v1/challenges/${chA.id}`,
          headers,
        })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/v1/challenges/${chA.id}`,
          headers,
          payload: { classroomId: null },
        })
      ).statusCode
    ).toBe(403);
    const [source] = await db
      .select()
      .from(challenge)
      .where(eq(challenge.id, chA.id));
    expect(source).toMatchObject({ classroomId: classA.id, deletedAt: null });
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/v1/challenges/${chA.id}`,
          headers: { cookie: cookies.lead },
          payload: { classroomId: null },
        })
      ).statusCode
    ).toBe(200);
  });

  it("requires management rights on both source and destination when assigning a public challenge", async () => {
    const publicChallenge = await createChallenge({ createdByUserId: lead.id });
    const request = {
      method: "PATCH" as const,
      url: `/v1/challenges/${publicChallenge.id}`,
      headers: { cookie: cookies.lead },
    };
    expect(
      (await app.inject({ ...request, payload: { classroomId: classB.id } }))
        .statusCode
    ).toBe(403);
    expect(
      (await app.inject({ ...request, payload: { classroomId: classA.id } }))
        .statusCode
    ).toBe(200);
  });

  it("allows practice of public challenges but limits management to their creator", async () => {
    const publicChallenge = await createChallenge({ createdByUserId: lead.id });
    const headers = { cookie: cookies.outsider };
    expect(
      (
        await app.inject({
          url: `/v1/challenges/${publicChallenge.id}`,
          headers,
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/v1/challenges/${publicChallenge.id}`,
          headers,
        })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/v1/challenges/${publicChallenge.id}`,
          headers: { cookie: cookies.lead },
        })
      ).statusCode
    ).toBe(204);
  });

  it("normalizes organization owners and lets target-org coordinators manage", async () => {
    await addMember(outsider.id, orgA.id, "coordinator");
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/v1/challenges/${chA.id}`,
          headers: { cookie: cookies.outsider },
          payload: { title: "Coordinator edit" },
        })
      ).statusCode
    ).toBe(200);
    await db
      .update(member)
      .set({ role: "owner" })
      .where(
        and(eq(member.userId, outsider.id), eq(member.organizationId, orgA.id))
      );
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/v1/classrooms/${classA.id}`,
          headers: { cookie: cookies.outsider },
        })
      ).statusCode
    ).toBe(200);
  });

  it("authorizes global platform admins without requiring target memberships", async () => {
    const admin = await createUser({ isPlatformAdmin: true });
    const cookie = await loginAs({
      email: admin.email,
      password: TEST_PASSWORD,
    });
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/v1/challenges/${chA.id}`,
          headers: { cookie },
          payload: { title: "Platform edit" },
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({ url: "/v1/classrooms/", headers: { cookie } })
      ).json<ListData>().pagination.total
    ).toBe(2);
  });

  it.each(["teacher", "coordinator", "admin", "owner"])(
    "protects KB list, search, link and unlink for foreign %s",
    async (role) => {
      await db
        .update(member)
        .set({ role })
        .where(
          and(
            eq(member.userId, outsider.id),
            eq(member.organizationId, orgB.id)
          )
        );
      const requests = [
        {
          method: "GET" as const,
          url: `/v1/challenges/${chA.id}/knowledge-bases/`,
        },
        {
          method: "GET" as const,
          url: `/v1/challenges/${chA.id}/knowledge-bases/search?q=test`,
        },
        {
          method: "POST" as const,
          url: `/v1/challenges/${chA.id}/knowledge-bases/`,
          payload: { knowledgeBaseId: kbId },
        },
        {
          method: "DELETE" as const,
          url: `/v1/challenges/${chA.id}/knowledge-bases/${kbId}`,
        },
      ];
      for (const request of requests)
        expect(
          (
            await app.inject({
              ...request,
              headers: { cookie: cookies.outsider },
            })
          ).statusCode
        ).toBe(403);
      expect(mocks.search).not.toHaveBeenCalled();
      expect(
        (
          await app.inject({
            ...requests[0]!,
            headers: { cookie: cookies.lead },
          })
        ).statusCode
      ).toBe(200);
      expect(
        (
          await app.inject({
            ...requests[1]!,
            headers: { cookie: cookies.lead },
          })
        ).statusCode
      ).toBe(200);
      expect(mocks.search).toHaveBeenCalledOnce();
      expect(
        (
          await app.inject({
            ...requests[3]!,
            headers: { cookie: cookies.lead },
          })
        ).statusCode
      ).toBe(204);
      expect(
        (
          await app.inject({
            ...requests[2]!,
            headers: { cookie: cookies.lead },
          })
        ).statusCode
      ).toBe(201);
    }
  );

  it.each(["deleted classroom", "inactive organization"])(
    "hides children of a %s on all read and chat paths",
    async (kind) => {
      const ta = await createTeachingAssistant({ organizationId: orgA.id });
      const ws = await createWorkSession({
        userId: learner.id,
        challengeId: chA.id,
        classroomId: classA.id,
        teachingAssistantId: ta.id,
      });
      if (kind === "deleted classroom")
        await db
          .update(classroom)
          .set({ deletedAt: new Date() })
          .where(eq(classroom.id, classA.id));
      else
        await db
          .update(organization)
          .set({ isActive: false })
          .where(eq(organization.id, orgA.id));
      const headers = { cookie: cookies.learner };
      for (const url of [
        `/v1/challenges/${chA.id}`,
        `/v1/classrooms/${classA.id}`,
        `/v1/work-sessions/${ws.id}`,
        `/v1/chat/student/history/${ws.id}`,
      ])
        expect((await app.inject({ url, headers })).statusCode).toBe(404);
      expect(
        (await app.inject({ url: "/v1/challenges/", headers })).json<ListData>()
          .pagination.total
      ).toBe(0);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/chat/student/message",
            headers,
            payload: { workSessionId: ws.id, message: "hello" },
          })
        ).statusCode
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/chat/teacher/message",
            headers: { cookie: cookies.lead },
            payload: { classroomId: classA.id, message: "hello" },
          })
        ).statusCode
      ).toBe(404);
      expect(mocks.student).not.toHaveBeenCalled();
      expect(mocks.teacher).not.toHaveBeenCalled();
    }
  );

  it("rechecks participation before SSE chat and always ends streams when telemetry fails", async () => {
    const ta = await createTeachingAssistant({ organizationId: orgA.id });
    const ws = await createWorkSession({
      userId: learner.id,
      challengeId: chA.id,
      classroomId: classA.id,
      teachingAssistantId: ta.id,
    });
    mocks.flush.mockRejectedValue(new Error("Telemetry failed"));
    const request = {
      method: "POST" as const,
      url: "/v1/chat/student/message",
      headers: { cookie: cookies.learner },
      payload: { workSessionId: ws.id, message: "hello" },
    };
    const response = await app.inject(request);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Test response");
    expect(response.body).toContain('"type":"done"');
    expect(
      await db
        .select()
        .from(userInteractionOnChallenge)
        .where(eq(userInteractionOnChallenge.workSessionId, ws.id))
    ).toHaveLength(1);
    const teacherResponse = await app.inject({
      method: "POST",
      url: "/v1/chat/teacher/message",
      headers: { cookie: cookies.lead },
      payload: { classroomId: classA.id, message: "hello" },
    });
    expect(teacherResponse.statusCode).toBe(200);
    expect(teacherResponse.body).toContain('"type":"done"');
    await db
      .update(userClassroom)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(userClassroom.userId, learner.id),
          eq(userClassroom.classroomId, classA.id)
        )
      );
    expect((await app.inject(request)).statusCode).toBe(403);
    expect(mocks.student).toHaveBeenCalledOnce();
  });

  it("requires teacher responsibility and accepts normalized admins for teacher SSE", async () => {
    await addMember(outsider.id, orgA.id, "teacher");
    const request = {
      method: "POST" as const,
      url: "/v1/chat/teacher/message",
      headers: { cookie: cookies.outsider },
      payload: { classroomId: classA.id, message: "hello" },
    };
    expect((await app.inject(request)).statusCode).toBe(403);
    await db
      .update(member)
      .set({ role: "admin" })
      .where(
        and(eq(member.userId, outsider.id), eq(member.organizationId, orgA.id))
      );
    expect((await app.inject(request)).statusCode).toBe(200);
    expect(mocks.teacher).toHaveBeenCalledOnce();
  });

  it("denies sessions for soft-deleted users and removed memberships", async () => {
    await db
      .update(member)
      .set({ role: "unsupported" })
      .where(
        and(eq(member.userId, learner.id), eq(member.organizationId, orgA.id))
      );
    expect(
      (
        await app.inject({
          url: `/v1/challenges/${chA.id}`,
          headers: { cookie: cookies.learner },
        })
      ).statusCode
    ).toBe(403);
    await db
      .delete(member)
      .where(
        and(eq(member.userId, learner.id), eq(member.organizationId, orgA.id))
      );
    expect(
      (
        await app.inject({
          url: `/v1/challenges/${chA.id}`,
          headers: { cookie: cookies.learner },
        })
      ).statusCode
    ).toBe(403);
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, lead.id));
    expect(
      (
        await app.inject({
          url: "/v1/challenges/",
          headers: { cookie: cookies.lead },
        })
      ).statusCode
    ).toBe(403);
  });

  it("checks current participation on legacy solution reads and writes", async () => {
    const url = `/v1/challenges/${chA.id}/solution`;
    const headers = { cookie: cookies.learner };
    expect(
      (
        await app.inject({
          method: "PUT",
          url,
          headers,
          payload: { code: "print(1)" },
        })
      ).statusCode
    ).toBe(201);
    expect((await app.inject({ url, headers })).statusCode).toBe(200);
    expect(
      (await app.inject({ url, headers: { cookie: cookies.outsider } }))
        .statusCode
    ).toBe(403);
    await db
      .update(classroom)
      .set({ deletedAt: new Date() })
      .where(eq(classroom.id, classA.id));
    expect((await app.inject({ url, headers })).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: "PUT",
          url,
          headers,
          payload: { code: "print(2)" },
        })
      ).statusCode
    ).toBe(404);
  });

  it("shares SSE student rate limits with JSON chat", async () => {
    const ta = await createTeachingAssistant({ organizationId: orgA.id });
    const ws = await createWorkSession({
      userId: learner.id,
      challengeId: chA.id,
      classroomId: classA.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const headers = { cookie: cookies.learner };
    for (let i = 0; i < 25; i++)
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/chat/student/message",
            headers,
            payload: { workSessionId: ws.id, message: "hello" },
          })
        ).statusCode
      ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/work-sessions/${ws.id}/chat`,
          headers,
          payload: { message: "hello" },
        })
      ).statusCode
    ).toBe(429);
    expect(mocks.student).not.toHaveBeenCalled();
  });
});
