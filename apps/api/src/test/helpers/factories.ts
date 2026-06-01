/**
 * Factories for inserting test data directly via Drizzle. Each function
 * accepts an optional overrides bag so a test can pin specific fields.
 *
 * IDs are random UUIDs by default; pass `id` to make them stable.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import {
  user,
  account,
  session,
  organization,
  member,
  classroom,
  challenge,
  workSession,
  submission,
  model,
  teachingAssistant,
  challengeTeachingAssistant,
  userClassroom,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";

export const TEST_PASSWORD = "Teste123!@";

export async function createOrg(overrides: Partial<typeof organization.$inferInsert> = {}) {
  const id = overrides.id ?? randomUUID();
  const slug = overrides.slug ?? `org-${id.slice(0, 8)}`;
  const [row] = await db
    .insert(organization)
    .values({
      id,
      name: overrides.name ?? `Org ${slug}`,
      slug,
      isActive: overrides.isActive ?? true,
      ...overrides,
    })
    .returning();
  return row!;
}

export async function createUser(
  overrides: Partial<typeof user.$inferInsert> & { password?: string } = {}
) {
  const id = overrides.id ?? randomUUID();
  const email = overrides.email ?? `user-${id.slice(0, 8)}@test.local`;
  const password = overrides.password ?? TEST_PASSWORD;
  const passwordHash = await hashPassword(password);

  const [u] = await db
    .insert(user)
    .values({
      id,
      name: overrides.name ?? `User ${id.slice(0, 8)}`,
      email,
      emailVerified: overrides.emailVerified ?? true,
      isActive: overrides.isActive ?? true,
      isPlatformAdmin: overrides.isPlatformAdmin ?? false,
    })
    .returning();

  await db.insert(account).values({
    id: randomUUID(),
    accountId: email,
    providerId: "credential",
    userId: id,
    password: passwordHash,
  });

  return { ...u!, plainPassword: password };
}

export async function addMember(
  userId: string,
  organizationId: string,
  role: "student" | "teacher" | "coordinator" | "admin" = "teacher"
) {
  const [row] = await db
    .insert(member)
    .values({
      id: randomUUID(),
      userId,
      organizationId,
      role,
    })
    .returning();
  return row!;
}

export async function createClassroom(
  overrides: Partial<typeof classroom.$inferInsert> & { organizationId: string }
) {
  const id = overrides.id ?? randomUUID();
  const [row] = await db
    .insert(classroom)
    .values({
      id,
      organizationId: overrides.organizationId,
      teacherUserId: overrides.teacherUserId ?? null,
      title: overrides.title ?? `Classroom ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
    })
    .returning();
  return row!;
}

export async function enrollStudent(userId: string, classroomId: string) {
  await db.insert(userClassroom).values({ userId, classroomId });
}

export async function createChallenge(
  overrides: Partial<typeof challenge.$inferInsert> & { createdByUserId: string }
) {
  const id = overrides.id ?? randomUUID();
  const [row] = await db
    .insert(challenge)
    .values({
      id,
      classroomId: overrides.classroomId ?? null,
      title: overrides.title ?? `Challenge ${id.slice(0, 8)}`,
      description: overrides.description ?? "Test challenge",
      difficulty: overrides.difficulty ?? "easy",
      tags: (overrides.tags as string[] | undefined) ?? ["test"],
      createdByUserId: overrides.createdByUserId,
    })
    .returning();
  return row!;
}

/** Creates a model + teaching assistant pair. Required FK for work sessions. */
export async function createTeachingAssistant(overrides: {
  organizationId: string;
  id?: string;
}) {
  const modelId = randomUUID();
  await db.insert(model).values({
    id: modelId,
    name: "test-model",
    version: `v-${modelId.slice(0, 8)}`,
    description: "Test LLM model",
  });

  const id = overrides.id ?? randomUUID();
  const [ta] = await db
    .insert(teachingAssistant)
    .values({
      id,
      alias: `ta-${id.slice(0, 8)}`,
      version: 1,
      modelId,
      systemPrompt: "You are a test TA",
      isActive: true,
      createdByOrganizationId: overrides.organizationId,
    })
    .returning();
  return ta!;
}

export async function linkChallengeToTa(challengeId: string, teachingAssistantId: string) {
  await db.insert(challengeTeachingAssistant).values({
    challengeId,
    teachingAssistantId,
    isDefault: true,
  });
}

export async function createWorkSession(overrides: {
  userId: string;
  challengeId: string;
  classroomId?: string | null;
  teachingAssistantId: string;
  endedAt?: Date | null;
  id?: string;
}) {
  const id = overrides.id ?? randomUUID();
  const [row] = await db
    .insert(workSession)
    .values({
      id,
      userId: overrides.userId,
      challengeId: overrides.challengeId,
      classroomId: overrides.classroomId ?? null,
      teachingAssistantId: overrides.teachingAssistantId,
      endedAt: overrides.endedAt ?? null,
    })
    .returning();
  return row!;
}

export async function createSubmission(overrides: {
  workSessionId: string;
  challengeId: string;
  studentUserId: string | null;
  code?: string | null;
  id?: string;
}) {
  const id = overrides.id ?? randomUUID();
  const [row] = await db
    .insert(submission)
    .values({
      id,
      workSessionId: overrides.workSessionId,
      challengeId: overrides.challengeId,
      studentUserId: overrides.studentUserId,
      code: overrides.code ?? "print('hi')",
    })
    .returning();
  return row!;
}

export async function addInteraction(overrides: {
  workSessionId: string;
  challengeId: string;
  interactionType?: "chat" | "code_run";
  userPrompt?: string;
  modelResponse?: string;
  code?: string | null;
}) {
  const id = randomUUID();
  const [row] = await db
    .insert(userInteractionOnChallenge)
    .values({
      id,
      workSessionId: overrides.workSessionId,
      challengeId: overrides.challengeId,
      interactionType: overrides.interactionType ?? "chat",
      userPrompt: overrides.userPrompt ?? "what next?",
      modelResponse: overrides.modelResponse ?? "try X",
      code: overrides.code ?? null,
    })
    .returning();
  return row!;
}

/**
 * Insert a Better Auth session row directly. Returns the session token.
 * Callers pass this token as a Bearer header or build the signed cookie
 * via `signSessionCookie` if needed. For tests we use the helper in
 * ./auth.ts which knows how to build the cookie shape Better Auth expects.
 */
export async function createSession(opts: {
  userId: string;
  activeOrganizationId?: string | null;
  expiresInMs?: number;
}) {
  const id = randomUUID();
  const token = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + (opts.expiresInMs ?? 7 * 24 * 60 * 60 * 1000));
  await db.insert(session).values({
    id,
    token,
    userId: opts.userId,
    activeOrganizationId: opts.activeOrganizationId ?? null,
    expiresAt,
  });
  return { id, token, expiresAt };
}
