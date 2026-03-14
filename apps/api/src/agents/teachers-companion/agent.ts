import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { llm } from "../llm";
import {
  createChallengeDraft,
  listSubmissions,
  evaluateSubmission,
  suggestTestCases,
  getClassroomInfo,
} from "./tools";

const checkpointer = new MemorySaver();

export const teachersCompanionAgent = createReactAgent({
  llm,
  tools: [
    createChallengeDraft,
    listSubmissions,
    evaluateSubmission,
    suggestTestCases,
    getClassroomInfo,
  ],
  checkpointSaver: checkpointer,
});
