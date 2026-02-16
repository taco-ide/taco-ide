import { db } from "./index";
import {
  model,
  teachingAssistant,
  challenge,
  challengeTeachingAssistant,
} from "./schema";

const SEED_MODEL_ID = "00000000-0000-0000-0000-000000000001";
const SEED_TA_ID = "00000000-0000-0000-0000-000000000002";
const SEED_CHALLENGE_IDS = [
  "00000000-0000-0000-0000-000000000011",
  "00000000-0000-0000-0000-000000000012",
  "00000000-0000-0000-0000-000000000013",
  "00000000-0000-0000-0000-000000000014",
  "00000000-0000-0000-0000-000000000015",
  "00000000-0000-0000-0000-000000000016",
];

async function seed() {
  console.log("Seeding database...");

  try {
    await db.insert(model).values({
      id: SEED_MODEL_ID,
      version: "1.0",
      name: "gpt-4o-mini",
      description: "OpenAI GPT-4o Mini for coding assistance",
    });
  } catch {
    // Model may already exist
  }

  try {
    await db.insert(teachingAssistant).values({
      id: SEED_TA_ID,
      alias: "TACO Assistant",
      version: 1,
      modelId: SEED_MODEL_ID,
      systemPrompt:
        "You are a helpful programming tutor. Guide students to find solutions without giving away the answer directly. Use the Socratic method.",
      description: "Default teaching assistant for TACO-IDE",
      targetAudience: "beginner",
      isActive: true,
    });
  } catch {
    // TA may already exist
  }

  const challenges: Array<{
    id: string;
    title: string;
    description: string;
    difficulty: string;
    tags: string[];
  }> = [
    {
      id: SEED_CHALLENGE_IDS[0]!,
      title: "Sorting Problem",
      description:
        "Solve the sorting problem using the algorithm of your choice.",
      difficulty: "easy",
      tags: ["Sorting", "Algorithms"],
    },
    {
      id: SEED_CHALLENGE_IDS[1]!,
      title: "Binary Search",
      description: "Implement binary search in a sorted array.",
      difficulty: "medium",
      tags: ["Search", "Algorithms"],
    },
    {
      id: SEED_CHALLENGE_IDS[2]!,
      title: "Traveling Salesman Problem",
      description: "Find the shortest path that visits all cities.",
      difficulty: "hard",
      tags: ["Graphs", "Optimization"],
    },
    {
      id: SEED_CHALLENGE_IDS[3]!,
      title: "Counting Sort",
      description: "Implement the counting sort algorithm.",
      difficulty: "easy",
      tags: ["Sorting", "Algorithms"],
    },
    {
      id: SEED_CHALLENGE_IDS[4]!,
      title: "Breadth-First Search",
      description: "Implement breadth-first search in a graph.",
      difficulty: "medium",
      tags: ["Graphs", "Search"],
    },
    {
      id: SEED_CHALLENGE_IDS[5]!,
      title: "Knapsack Problem",
      description: "Solve the knapsack problem using dynamic programming.",
      difficulty: "hard",
      tags: ["Dynamic Programming", "Optimization"],
    },
  ];

  for (const c of challenges) {
    try {
      await db.insert(challenge).values({
        id: c.id,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty,
        tags: c.tags,
      });
      await db.insert(challengeTeachingAssistant).values({
        challengeId: c.id,
        teachingAssistantId: SEED_TA_ID,
        isDefault: true,
      });
    } catch {
      // Challenge may already exist
    }
  }

  console.log("Seed completed - challenges, model and TA created");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
