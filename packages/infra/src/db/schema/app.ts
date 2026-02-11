import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  varchar,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user, organization } from "./auth";

// ==================== CLASSROOMS ====================

export const classroom = pgTable("classroom", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// ==================== USER CLASSROOMS (Enrollment) ====================

export const userClassroom = pgTable(
  "user_classroom",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    classroomId: text("classroom_id")
      .notNull()
      .references(() => classroom.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.classroomId] }),
  ]
);

// ==================== MODELS (LLM Configurations) ====================

export const model = pgTable(
  "model",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    modelParameters: jsonb("model_parameters"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("model_name_version_idx").on(table.name, table.version),
  ]
);

// ==================== TEACHING ASSISTANTS (Versioned TA Configs) ====================

export const teachingAssistant = pgTable(
  "teaching_assistant",
  {
    id: text("id").primaryKey(),
    alias: varchar("alias", { length: 50 }).notNull(),
    version: integer("version").notNull(),
    modelId: text("model_id").references(() => model.id),
    systemPrompt: text("system_prompt").notNull(),
    description: text("description"),
    targetAudience: varchar("target_audience", { length: 50 }),
    guardrailConfig: jsonb("guardrail_config"),
    isActive: boolean("is_active").notNull().default(false),
    createdByOrganizationId: text("created_by_organization_id").references(
      () => organization.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("teaching_assistant_alias_version_idx").on(
      table.alias,
      table.version
    ),
  ]
);

// ==================== CHALLENGES ====================

export const challenge = pgTable("challenge", {
  id: text("id").primaryKey(),
  classroomId: text("classroom_id").references(() => classroom.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  supportMaterials: jsonb("support_materials"),
  possibleSolutions: jsonb("possible_solutions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// ==================== CHALLENGE <-> TEACHING ASSISTANT (M2M) ====================

export const challengeTeachingAssistant = pgTable(
  "challenge_teaching_assistant",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenge.id, { onDelete: "cascade" }),
    teachingAssistantId: text("teaching_assistant_id")
      .notNull()
      .references(() => teachingAssistant.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.challengeId, table.teachingAssistantId],
    }),
  ]
);

// ==================== WORK SESSIONS ====================

export const workSession = pgTable("work_session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenge.id),
  classroomId: text("classroom_id").references(() => classroom.id),
  teachingAssistantId: text("teaching_assistant_id")
    .notNull()
    .references(() => teachingAssistant.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at"),
  endedAt: timestamp("ended_at"),
});

// ==================== USER INTERACTIONS ON CHALLENGES ====================

export const userInteractionOnChallenge = pgTable(
  "user_interaction_on_challenge",
  {
    id: text("id").primaryKey(),
    workSessionId: text("work_session_id")
      .notNull()
      .references(() => workSession.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenge.id),
    userPrompt: text("user_prompt").notNull(),
    modelResponse: text("model_response").notNull(),
    code: text("code"),
    stdin: text("stdin"),
    stdout: text("stdout"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

// ==================== CHALLENGE SOLUTIONS (Current State) ====================

export const challengeSolution = pgTable(
  "challenge_solution",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenge.id),
    chatHistory: jsonb("chat_history"),
    code: text("code"),
    stdin: text("stdin"),
    stdout: text("stdout"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("challenge_solution_user_challenge_idx").on(
      table.userId,
      table.challengeId
    ),
  ]
);

// ==================== KNOWLEDGE BASE (RAG Context) ====================

export const knowledgeBase = pgTable("knowledge_base", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organization.id),
  classroomId: text("classroom_id").references(() => classroom.id),
  challengeId: text("challenge_id").references(() => challenge.id),
  content: text("content").notNull(),
  // embedding column omitted - requires pgvector extension
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== CONVERSATION REPLAYS (TA A/B Testing) ====================

export const conversationReplay = pgTable(
  "conversation_replay",
  {
    id: text("id").primaryKey(),
    originalWorkSessionId: text("original_work_session_id")
      .notNull()
      .references(() => workSession.id, { onDelete: "cascade" }),
    replayTeachingAssistantId: text("replay_teaching_assistant_id")
      .notNull()
      .references(() => teachingAssistant.id, { onDelete: "restrict" }),
    replayedAt: timestamp("replayed_at").defaultNow(),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("conversation_replay_session_ta_idx").on(
      table.originalWorkSessionId,
      table.replayTeachingAssistantId
    ),
  ]
);

// ==================== REPLAY INTERACTIONS ====================

export const replayInteraction = pgTable("replay_interaction", {
  id: text("id").primaryKey(),
  replayId: text("replay_id")
    .notNull()
    .references(() => conversationReplay.id, { onDelete: "cascade" }),
  originalInteractionId: text("original_interaction_id")
    .notNull()
    .references(() => userInteractionOnChallenge.id),
  userPrompt: text("user_prompt").notNull(),
  modelResponse: text("model_response").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==================== EXPORT TYPES ====================

export type Classroom = typeof classroom.$inferSelect;
export type NewClassroom = typeof classroom.$inferInsert;
export type UserClassroom = typeof userClassroom.$inferSelect;
export type Model = typeof model.$inferSelect;
export type NewModel = typeof model.$inferInsert;
export type TeachingAssistant = typeof teachingAssistant.$inferSelect;
export type NewTeachingAssistant = typeof teachingAssistant.$inferInsert;
export type Challenge = typeof challenge.$inferSelect;
export type NewChallenge = typeof challenge.$inferInsert;
export type ChallengeTeachingAssistant =
  typeof challengeTeachingAssistant.$inferSelect;
export type WorkSession = typeof workSession.$inferSelect;
export type NewWorkSession = typeof workSession.$inferInsert;
export type UserInteractionOnChallenge =
  typeof userInteractionOnChallenge.$inferSelect;
export type ChallengeSolution = typeof challengeSolution.$inferSelect;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type ConversationReplay = typeof conversationReplay.$inferSelect;
export type ReplayInteraction = typeof replayInteraction.$inferSelect;
