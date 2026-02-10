/**
 * HTTP client for communicating with the AI service.
 */

import { env } from "@repo/infra/env";

interface ExerciseContext {
  title: string;
  description: string | null;
  supportMaterials: unknown;
  possibleSolutions: unknown;
}

interface TeachingAssistantContext {
  systemPrompt: string;
  targetAudience: string | null;
}

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  code: string;
  language: string;
  message: string;
  exercise: ExerciseContext;
  teaching_assistant: TeachingAssistantContext;
  knowledge_base: string[];
  chat_history: ChatMessage[];
}

interface ChatResponse {
  response: string;
  suggestions: string[];
}

class AIServiceClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = env.AI_SERVICE_URL;
    this.headers = {
      "Content-Type": "application/json",
    };
  }

  async sendChatRequest(data: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `AI service request failed: ${response.status} - ${error}`
      );
    }

    const json = await response.json();
    return json as ChatResponse;
  }
}

// Export singleton instance
export const aiClient = new AIServiceClient();
