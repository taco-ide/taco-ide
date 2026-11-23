import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

export interface ScriptedTurn {
  content: string;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  responseMetadata?: Record<string, unknown>;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
}

/**
 * A chat model that answers each call with the next scripted turn, so a real
 * LangGraph agent can run tool calls end to end in tests. Supports both
 * `invoke` (via `_generate`) and streaming (via `_streamResponseChunks`).
 * The public fields mirror the ChatOpenAI ones the turn capture reads.
 */
export class ScriptedChatModel extends BaseChatModel {
  model = "gpt-test";
  temperature = 0.2;
  topP = 0.9;
  maxTokens = 512;
  clientConfig = { baseURL: "https://llm.example.test/openai/v1/" };
  private readonly script: ScriptedTurn[];

  constructor(script: ScriptedTurn[], params: BaseChatModelParams = {}) {
    super(params);
    this.script = [...script];
  }

  _llmType() {
    return "scripted";
  }

  bindTools() {
    return this;
  }

  private next(): ScriptedTurn {
    return this.script.shift() ?? { content: "" };
  }

  async _generate(): Promise<ChatResult> {
    const turn = this.next();
    const message = new AIMessage({
      content: turn.content,
      tool_calls: (turn.toolCalls ?? []).map((tc) => ({ ...tc, type: "tool_call" as const })),
      response_metadata: turn.responseMetadata ?? {},
      usage_metadata: turn.usage,
    });
    return { generations: [{ text: turn.content, message }] };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const turn = this.next();
    const chunk = new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: turn.content,
        tool_call_chunks: (turn.toolCalls ?? []).map((tc, index) => ({
          id: tc.id,
          name: tc.name,
          args: JSON.stringify(tc.args),
          index,
          type: "tool_call_chunk" as const,
        })),
        usage_metadata: turn.usage,
      }),
      text: turn.content,
      // Like ChatOpenAI when streaming: model name, fingerprint and finish
      // reason arrive only in the generation info, not in response_metadata.
      generationInfo: turn.responseMetadata,
    });
    yield chunk;
    await runManager?.handleLLMNewToken(turn.content, undefined, undefined, undefined, undefined, {
      chunk,
    });
  }
}
