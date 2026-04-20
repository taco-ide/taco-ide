import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { runCode, getChallengeInfo, searchKnowledgeBase } from "./tools";

/**
 * Build a Teaching Assistant agent with a provided LLM instance.
 * The LLM instance may have custom parameters applied (temperature, max_tokens, etc.).
 *
 * @param llmInstance - The language model instance to use for this agent
 * @returns A compiled LangGraph agent ready for invocation
 */
export function buildTeachingAssistantAgent(llmInstance: BaseChatModel) {
  const checkpointer = new MemorySaver();
  return createReactAgent({
    llm: llmInstance,
    tools: [runCode, getChallengeInfo, searchKnowledgeBase],
    checkpointSaver: checkpointer,
  });
}
