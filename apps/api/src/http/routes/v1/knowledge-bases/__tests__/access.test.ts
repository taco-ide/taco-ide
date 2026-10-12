import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  classroom,
  organization,
  member,
  userClassroom,
  knowledgeBase,
  knowledgeBaseDocument,
  knowledgeBaseChunk,
} from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createUser,
  createOrg,
  createClassroom,
  enrollStudent,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";
const mocks = vi.hoisted(() => ({
  embedding: vi.fn(async () => [1, ...Array<number>(1535).fill(0)]),
  deleteFile: vi.fn(async () => {}),
  saveFile: vi.fn(async () => {}),
}));
vi.mock("../../../../../services/embedding", () => ({
  generateEmbedding: mocks.embedding,
  generateEmbeddings: vi.fn(async () => []),
}));
vi.mock("../../../../../services/file-storage", () => ({
  deleteFile: mocks.deleteFile,
  saveFile: mocks.saveFile,
}));

type ListResponse = {
  data: { id: string }[];
  pagination: { total: number; totalPages: number };
};

describe("direct knowledge-base classroom boundary", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let org: Awaited<ReturnType<typeof createOrg>>;
  let cls: Awaited<ReturnType<typeof createClassroom>>;
  let lead: Awaited<ReturnType<typeof createUser>>;
  let learner: Awaited<ReturnType<typeof createUser>>;
  let unrelatedTeacher: Awaited<ReturnType<typeof createUser>>;
  let foreignAdmin: Awaited<ReturnType<typeof createUser>>;
  let kbId: string;
  let docId: string;
  let entryId: string;
  let cookies: {
    lead: string;
    learner: string;
    nonenrolled: string;
    unrelatedTeacher: string;
    foreignAdmin: string;
  };
  beforeAll(async () => {
    app = await getApp();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.embedding.mockResolvedValue([1, ...Array<number>(1535).fill(0)]);
    org = await createOrg();
    const foreignOrg = await createOrg();
    lead = await createUser();
    learner = await createUser();
    const nonenrolled = await createUser();
    unrelatedTeacher = await createUser();
    foreignAdmin = await createUser();
    await addMember(lead.id, org.id, "teacher");
    await addMember(learner.id, org.id, "student");
    await addMember(nonenrolled.id, org.id, "student");
    await addMember(unrelatedTeacher.id, org.id, "teacher");
    await addMember(foreignAdmin.id, foreignOrg.id, "admin");
    cls = await createClassroom({
      organizationId: org.id,
      teacherUserId: lead.id,
    });
    await enrollStudent(learner.id, cls.id);
    kbId = randomUUID();
    docId = randomUUID();
    entryId = randomUUID();
    await db
      .insert(knowledgeBase)
      .values({
        id: kbId,
        classroomId: cls.id,
        organizationId: org.id,
        title: "Class material",
        createdByUserId: lead.id,
      });
    await db
      .insert(knowledgeBaseDocument)
      .values({
        id: docId,
        knowledgeBaseId: kbId,
        filename: "lesson.txt",
        mimeType: "text/plain",
        fileSize: 10,
        status: "ready",
      });
    await db
      .insert(knowledgeBaseChunk)
      .values({
        id: entryId,
        knowledgeBaseId: kbId,
        content: "Classroom knowledge",
        embedding: [1, ...Array<number>(1535).fill(0)],
      });
    cookies = {
      lead: await loginAs({ email: lead.email, password: TEST_PASSWORD }),
      learner: await loginAs({ email: learner.email, password: TEST_PASSWORD }),
      nonenrolled: await loginAs({
        email: nonenrolled.email,
        password: TEST_PASSWORD,
      }),
      unrelatedTeacher: await loginAs({
        email: unrelatedTeacher.email,
        password: TEST_PASSWORD,
      }),
      foreignAdmin: await loginAs({
        email: foreignAdmin.email,
        password: TEST_PASSWORD,
      }),
    };
  });

  it.each(["foreignAdmin", "nonenrolled", "unrelatedTeacher"] as const)(
    "hides list/count, detail, documents and search from %s",
    async (actor) => {
      const headers = { cookie: cookies[actor] };
      const list = await app.inject({
        url: `/v1/knowledge-bases/?classroomId=${cls.id}&perPage=1`,
        headers,
      });
      expect(list.statusCode).toBe(200);
      expect(list.json<ListResponse>()).toMatchObject({
        data: [],
        pagination: { total: 0, totalPages: 0 },
      });
      for (const url of [
        `/v1/knowledge-bases/${kbId}`,
        `/v1/knowledge-bases/${kbId}/documents/`,
        `/v1/knowledge-bases/${kbId}/search?q=lesson`,
      ])
        expect((await app.inject({ url, headers })).statusCode).toBe(403);
      expect(mocks.embedding).not.toHaveBeenCalled();
    }
  );

  it("allows enrolled learners to read their classroom material with accurate counts", async () => {
    const headers = { cookie: cookies.learner };
    const list = await app.inject({
      url: `/v1/knowledge-bases/?classroomId=${cls.id}&perPage=1`,
      headers,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<ListResponse>()).toMatchObject({
      data: [{ id: kbId }],
      pagination: { total: 1, totalPages: 1 },
    });
    const detail = await app.inject({
      url: `/v1/knowledge-bases/${kbId}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
    expect(
      detail
        .json<{ data: { documents: { id: string }[] } }>()
        .data.documents.map((doc) => doc.id)
    ).toEqual([docId]);
    const docs = await app.inject({
      url: `/v1/knowledge-bases/${kbId}/documents/`,
      headers,
    });
    expect(docs.json<ListResponse>()).toMatchObject({
      data: [{ id: docId }],
      pagination: { total: 1 },
    });
    const search = await app.inject({
      url: `/v1/knowledge-bases/${kbId}/search?q=lesson`,
      headers,
    });
    expect(search.statusCode).toBe(200);
    expect(
      search
        .json<{ data: { content: string }[] }>()
        .data.map((row) => row.content)
    ).toEqual(["Classroom knowledge"]);
  });

  it("revokes existing material access after unenrollment", async () => {
    await db
      .update(userClassroom)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(userClassroom.userId, learner.id),
          eq(userClassroom.classroomId, cls.id)
        )
      );
    const headers = { cookie: cookies.learner };
    expect(
      (await app.inject({ url: `/v1/knowledge-bases/${kbId}`, headers }))
        .statusCode
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: `/v1/knowledge-bases/?classroomId=${cls.id}`,
          headers,
        })
      ).json<ListResponse>().pagination.total
    ).toBe(0);
  });

  it.each([
    "deleted classroom",
    "inactive organization",
    "deleted knowledge base",
  ])("hides all reads for a %s without removing documents", async (kind) => {
    if (kind === "deleted classroom")
      await db
        .update(classroom)
        .set({ deletedAt: new Date() })
        .where(eq(classroom.id, cls.id));
    if (kind === "inactive organization")
      await db
        .update(organization)
        .set({ isActive: false })
        .where(eq(organization.id, org.id));
    if (kind === "deleted knowledge base")
      await db
        .update(knowledgeBase)
        .set({ deletedAt: new Date() })
        .where(eq(knowledgeBase.id, kbId));
    const headers = { cookie: cookies.learner };
    expect(
      (
        await app.inject({
          url: `/v1/knowledge-bases/?classroomId=${cls.id}`,
          headers,
        })
      ).json<ListResponse>().pagination.total
    ).toBe(0);
    for (const url of [
      `/v1/knowledge-bases/${kbId}`,
      `/v1/knowledge-bases/${kbId}/documents/`,
      `/v1/knowledge-bases/${kbId}/search?q=lesson`,
    ])
      expect((await app.inject({ url, headers })).statusCode).toBe(404);
    const [document] = await db
      .select()
      .from(knowledgeBaseDocument)
      .where(eq(knowledgeBaseDocument.id, docId));
    expect(document?.deletedAt).toBeNull();
    expect(mocks.embedding).not.toHaveBeenCalled();
  });

  it.each(["foreignAdmin", "unrelatedTeacher", "learner"] as const)(
    "denies direct mutations and creation by %s",
    async (actor) => {
      const headers = { cookie: cookies[actor] };
      const requests = [
        {
          method: "POST" as const,
          url: "/v1/knowledge-bases/",
          payload: { classroomId: cls.id, title: "Unauthorized KB" },
        },
        {
          method: "PUT" as const,
          url: `/v1/knowledge-bases/${kbId}`,
          payload: { title: "Unauthorized edit" },
        },
        { method: "DELETE" as const, url: `/v1/knowledge-bases/${kbId}` },
        {
          method: "POST" as const,
          url: `/v1/knowledge-bases/${kbId}/documents/`,
        },
        {
          method: "DELETE" as const,
          url: `/v1/knowledge-bases/${kbId}/documents/${docId}`,
        },
        {
          method: "POST" as const,
          url: `/v1/knowledge-bases/${kbId}/entries/`,
          payload: { content: "Unauthorized" },
        },
        {
          method: "PUT" as const,
          url: `/v1/knowledge-bases/${kbId}/entries/${entryId}`,
          payload: { content: "Unauthorized edit" },
        },
        {
          method: "DELETE" as const,
          url: `/v1/knowledge-bases/${kbId}/entries/${entryId}`,
        },
      ];
      for (const request of requests)
        expect((await app.inject({ ...request, headers })).statusCode).toBe(
          403
        );
      expect(mocks.embedding).not.toHaveBeenCalled();
      expect(mocks.deleteFile).not.toHaveBeenCalled();
      expect(mocks.saveFile).not.toHaveBeenCalled();
      const [kb] = await db
        .select()
        .from(knowledgeBase)
        .where(eq(knowledgeBase.id, kbId));
      expect(kb).toMatchObject({ title: "Class material", deletedAt: null });
    }
  );

  it("allows responsible teachers to create/update material and scoped manual entries", async () => {
    const headers = { cookie: cookies.lead };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/knowledge-bases/",
          headers,
          payload: { classroomId: cls.id, title: "New KB" },
        })
      ).statusCode
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/knowledge-bases/${kbId}`,
          headers,
          payload: { title: "Updated KB" },
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/knowledge-bases/${kbId}/entries/${entryId}`,
          headers,
          payload: { content: "Updated entry" },
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/knowledge-bases/${kbId}/entries/`,
          headers,
          payload: { content: "New entry" },
        })
      ).statusCode
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/v1/knowledge-bases/${kbId}/entries/${entryId}`,
          headers,
        })
      ).statusCode
    ).toBe(204);
  });

  it("allows target organization admins and global admins while preserving classroom boundaries", async () => {
    await addMember(foreignAdmin.id, org.id, "admin");
    const headers = { cookie: cookies.foreignAdmin };
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/knowledge-bases/${kbId}`,
          headers,
          payload: { title: "Org admin edit" },
        })
      ).statusCode
    ).toBe(200);
    const platformAdmin = await createUser({ isPlatformAdmin: true });
    const cookie = await loginAs({
      email: platformAdmin.email,
      password: TEST_PASSWORD,
    });
    expect(
      (
        await app.inject({
          url: `/v1/knowledge-bases/${kbId}`,
          headers: { cookie },
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/knowledge-bases/",
          headers: { cookie },
          payload: { classroomId: cls.id, title: "Platform KB" },
        })
      ).statusCode
    ).toBe(201);
    await db
      .update(classroom)
      .set({ deletedAt: new Date() })
      .where(eq(classroom.id, cls.id));
    expect(
      (
        await app.inject({
          url: `/v1/knowledge-bases/${kbId}`,
          headers: { cookie },
        })
      ).statusCode
    ).toBe(404);
  });

  it("keeps creator access when classroom responsibility changes to another teacher", async () => {
    await db
      .update(classroom)
      .set({ teacherUserId: unrelatedTeacher.id })
      .where(eq(classroom.id, cls.id));
    const headers = { cookie: cookies.lead };
    expect(
      (
        await app.inject({
          url: `/v1/knowledge-bases/?classroomId=${cls.id}`,
          headers,
        })
      ).json<ListResponse>().pagination.total
    ).toBe(1);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/knowledge-bases/${kbId}`,
          headers,
          payload: { title: "Creator edit" },
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/knowledge-bases/${kbId}`,
          headers: { cookie: cookies.unrelatedTeacher },
          payload: { title: "Responsible teacher edit" },
        })
      ).statusCode
    ).toBe(200);
    await db
      .delete(member)
      .where(
        and(eq(member.userId, lead.id), eq(member.organizationId, org.id))
      );
    expect(
      (await app.inject({ url: `/v1/knowledge-bases/${kbId}`, headers }))
        .statusCode
    ).toBe(403);
  });
});
