import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { llm } from "../llm";
import { runCode, getChallengeInfo, searchKnowledgeBase } from "./tools";

const checkpointer = new MemorySaver();

export const teachingAssistantAgent = createReactAgent({
  llm,
  tools: [runCode, getChallengeInfo, searchKnowledgeBase],
  checkpointSaver: checkpointer,
});
