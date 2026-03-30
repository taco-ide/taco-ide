/**
 * Seed de desenvolvimento: organizacao, turmas, usuarios (RBAC), desafios e TA.
 * Senha padrao para todas as contas de teste: Teste123!@
 *
 * Rode: cd packages/infra && npm run db:seed:dev
 */
if (process.env.NODE_ENV === "production") {
  throw new Error("dev seed cannot run in production");
}

import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  user,
  account,
  organization,
  member,
  classroom,
  userClassroom,
  challenge,
  challengeTeachingAssistant,
} from "../schema";
import { hashPassword } from "better-auth/crypto";
import { seedBase, safeInsert, SEED_TA_ID } from "./base";

// --- IDs fixos (reprodutiveis) ---
const SEED_ORG_ID = "11111111-1111-1111-1111-111111111111";
const SEED_CLASSROOM_ALG = "22222222-2222-2222-2222-222222222201";
const SEED_CLASSROOM_ED = "22222222-2222-2222-2222-222222222202";

const SEED_USER_TEACHER = "33333333-3333-3333-3333-333333330001";
const SEED_USER_STUDENT = "33333333-3333-3333-3333-333333330002";
const SEED_USER_COORD = "33333333-3333-3333-3333-333333330003";

const SEED_ACCOUNT_TEACHER = "44444444-4444-4444-4444-444444440001";
const SEED_ACCOUNT_STUDENT = "44444444-4444-4444-4444-444444440002";
const SEED_ACCOUNT_COORD = "44444444-4444-4444-4444-444444440003";

const SEED_MEMBER_TEACHER = "55555555-5555-5555-5555-555555550001";
const SEED_MEMBER_STUDENT = "55555555-5555-5555-5555-555555550002";
const SEED_MEMBER_COORD = "55555555-5555-5555-5555-555555550003";

/** Publicos (sem turma) -- aparecem em scope=public */
const SEED_CHALLENGE_PUBLIC = [
  "00000000-0000-0000-0000-000000000011",
  "00000000-0000-0000-0000-000000000012",
];
/** Turma Algoritmos I */
const SEED_CHALLENGE_CLASS_A = [
  "00000000-0000-0000-0000-000000000013",
  "00000000-0000-0000-0000-000000000014",
  "00000000-0000-0000-0000-000000000015",
];
/** Turma Estruturas de Dados */
const SEED_CHALLENGE_CLASS_B = [
  "00000000-0000-0000-0000-000000000016",
  "66666666-6666-6666-6666-666666660001",
  "66666666-6666-6666-6666-666666660002",
];

const DEV_PASSWORD = "Teste123!@";

async function seed() {
  console.log("Seeding database (org, RBAC users, classrooms, challenges)...\n");

  // --- Base: model + TA ---
  await seedBase({ organizationId: SEED_ORG_ID });

  // Better Auth usa scrypt (formato salt:hex), nao bcrypt
  const passwordHash = await hashPassword(DEV_PASSWORD);

  // --- Organizacao ---
  await safeInsert("organization", () =>
    db.insert(organization).values({
      id: SEED_ORG_ID,
      name: "TACO Demo",
      slug: "taco-demo",
      metadata: JSON.stringify({ seeded: true }),
    })
  );

  // --- Usuarios (email verificado em dev para login direto) ---
  await safeInsert("user teacher", () =>
    db.insert(user).values({
      id: SEED_USER_TEACHER,
      name: "Prof. Demo",
      email: "professor@taco-demo.local",
      emailVerified: true,
      isActive: true,
    })
  );

  await safeInsert("user student", () =>
    db.insert(user).values({
      id: SEED_USER_STUDENT,
      name: "Aluno Demo",
      email: "aluno@taco-demo.local",
      emailVerified: true,
      isActive: true,
    })
  );

  await safeInsert("user coordinator", () =>
    db.insert(user).values({
      id: SEED_USER_COORD,
      name: "Coord. Demo",
      email: "coordenador@taco-demo.local",
      emailVerified: true,
      isActive: true,
    })
  );

  // --- Contas email/senha (Better Auth: provider credential, accountId = email) ---
  const credential = "credential";
  await safeInsert("account teacher", () =>
    db.insert(account).values({
      id: SEED_ACCOUNT_TEACHER,
      accountId: "professor@taco-demo.local",
      providerId: credential,
      userId: SEED_USER_TEACHER,
      password: passwordHash,
    })
  );

  await safeInsert("account student", () =>
    db.insert(account).values({
      id: SEED_ACCOUNT_STUDENT,
      accountId: "aluno@taco-demo.local",
      providerId: credential,
      userId: SEED_USER_STUDENT,
      password: passwordHash,
    })
  );

  await safeInsert("account coordinator", () =>
    db.insert(account).values({
      id: SEED_ACCOUNT_COORD,
      accountId: "coordenador@taco-demo.local",
      providerId: credential,
      userId: SEED_USER_COORD,
      password: passwordHash,
    })
  );

  // Corrige hash antigo (ex.: bcrypt do seed anterior) ao re-rodar o seed
  for (const uid of [SEED_USER_TEACHER, SEED_USER_STUDENT, SEED_USER_COORD]) {
    try {
      await db
        .update(account)
        .set({ password: passwordHash })
        .where(eq(account.userId, uid));
    } catch (e) {
      console.warn(`  [skip] update password for ${uid}:`, e);
    }
  }

  // --- Membros na org (RBAC: teacher / student / coordinator) ---
  await safeInsert("member teacher", () =>
    db.insert(member).values({
      id: SEED_MEMBER_TEACHER,
      userId: SEED_USER_TEACHER,
      organizationId: SEED_ORG_ID,
      role: "teacher",
    })
  );

  await safeInsert("member student", () =>
    db.insert(member).values({
      id: SEED_MEMBER_STUDENT,
      userId: SEED_USER_STUDENT,
      organizationId: SEED_ORG_ID,
      role: "student",
    })
  );

  await safeInsert("member coordinator", () =>
    db.insert(member).values({
      id: SEED_MEMBER_COORD,
      userId: SEED_USER_COORD,
      organizationId: SEED_ORG_ID,
      role: "coordinator",
    })
  );

  // --- Turmas ---
  await safeInsert("classroom Algoritmos I", () =>
    db.insert(classroom).values({
      id: SEED_CLASSROOM_ALG,
      organizationId: SEED_ORG_ID,
      title: "Algoritmos I",
      description: "Turma seed -- ordenacao, busca e nocoes de complexidade.",
    })
  );

  await safeInsert("classroom Estruturas de Dados", () =>
    db.insert(classroom).values({
      id: SEED_CLASSROOM_ED,
      organizationId: SEED_ORG_ID,
      title: "Estruturas de Dados",
      description: "Turma seed -- listas, pilhas, filas e grafos.",
    })
  );

  // --- Matricula do aluno nas duas turmas ---
  await safeInsert("userClassroom aluno -> Algoritmos", () =>
    db.insert(userClassroom).values({
      userId: SEED_USER_STUDENT,
      classroomId: SEED_CLASSROOM_ALG,
    })
  );

  await safeInsert("userClassroom aluno -> ED", () =>
    db.insert(userClassroom).values({
      userId: SEED_USER_STUDENT,
      classroomId: SEED_CLASSROOM_ED,
    })
  );

  type ChDef = {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    tags: string[];
    classroomId: string | null;
  };

  const challenges: ChDef[] = [
    {
      id: SEED_CHALLENGE_PUBLIC[0]!,
      title: "Ordenacao simples",
      description: "Ordene uma lista de inteiros com o algoritmo que preferir.",
      difficulty: "easy",
      tags: ["Sorting", "Algorithms"],
      classroomId: null,
    },
    {
      id: SEED_CHALLENGE_PUBLIC[1]!,
      title: "Soma de vetor",
      description: "Calcule a soma dos elementos de um array.",
      difficulty: "easy",
      tags: ["Arrays", "Basics"],
      classroomId: null,
    },
    {
      id: SEED_CHALLENGE_CLASS_A[0]!,
      title: "Binary Search",
      description: "Implemente busca binaria em array ordenado.",
      difficulty: "medium",
      tags: ["Search", "Algorithms"],
      classroomId: SEED_CLASSROOM_ALG,
    },
    {
      id: SEED_CHALLENGE_CLASS_A[1]!,
      title: "Counting Sort",
      description: "Implemente counting sort.",
      difficulty: "easy",
      tags: ["Sorting", "Algorithms"],
      classroomId: SEED_CLASSROOM_ALG,
    },
    {
      id: SEED_CHALLENGE_CLASS_A[2]!,
      title: "Traveling Salesman (intro)",
      description: "Modelagem introdutoria do TSP.",
      difficulty: "hard",
      tags: ["Graphs", "Optimization"],
      classroomId: SEED_CLASSROOM_ALG,
    },
    {
      id: SEED_CHALLENGE_CLASS_B[0]!,
      title: "BFS em grafo",
      description: "Implemente busca em largura.",
      difficulty: "medium",
      tags: ["Graphs", "Search"],
      classroomId: SEED_CLASSROOM_ED,
    },
    {
      id: SEED_CHALLENGE_CLASS_B[1]!,
      title: "Pilha com array",
      description: "Implemente uma pilha usando lista em Python.",
      difficulty: "easy",
      tags: ["Stack", "Structures"],
      classroomId: SEED_CLASSROOM_ED,
    },
    {
      id: SEED_CHALLENGE_CLASS_B[2]!,
      title: "Knapsack 0/1",
      description: "Problema da mochila com programacao dinamica.",
      difficulty: "hard",
      tags: ["Dynamic Programming", "Optimization"],
      classroomId: SEED_CLASSROOM_ED,
    },
  ];

  for (const c of challenges) {
    await safeInsert(`challenge ${c.title}`, async () => {
      await db.insert(challenge).values({
        id: c.id,
        classroomId: c.classroomId,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty,
        tags: c.tags,
        createdByUserId: SEED_USER_TEACHER,
      });
      await db.insert(challengeTeachingAssistant).values({
        challengeId: c.id,
        teachingAssistantId: SEED_TA_ID,
        isDefault: true,
      });
    });
  }

  console.log("\n--- Contas de teste (senha: " + DEV_PASSWORD + ") ---");
  console.log("  Professor (teacher):   professor@taco-demo.local");
  console.log("  Aluno (student):       aluno@taco-demo.local");
  console.log("  Coordenador:           coordenador@taco-demo.local");
  console.log("\nOrganizacao: TACO Demo (slug: taco-demo)");
  console.log(
    "Apos login, defina a org ativa no client Better Auth (organization.switch) se necessario.\n"
  );
  console.log("Seed concluido.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
