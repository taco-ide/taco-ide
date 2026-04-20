import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  createChallengeDraft,
  listSubmissions,
  evaluateSubmission,
  suggestTestCases,
  getClassroomInfo,
} from "./tools";

const checkpointer = new MemorySaver();

/**
 * Build a Teachers Companion agent with a provided LLM instance.
 * The LLM instance may have custom parameters applied (temperature, max_tokens, etc.).
 *
 * @param llmInstance - The language model instance to use for this agent
 * @returns A compiled LangGraph agent ready for invocation
 */
export function buildTeachersCompanionAgent(llmInstance: BaseChatModel) {
  return createReactAgent({
    llm: llmInstance,
    tools: [
      createChallengeDraft,
      listSubmissions,
      evaluateSubmission,
      suggestTestCases,
      getClassroomInfo,
    ],
    checkpointSaver: checkpointer,
  });
}
