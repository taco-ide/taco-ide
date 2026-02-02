/**
 * HTTP client for communicating with the AI service.
 */

import { env } from "@repo/infra/env";

interface ChatRequest {
  exercise_id: number;
  code: string;
  language: string;
  message: string;
  user_id: number;
}

interface ChatResponse {
  response: string;
  suggestions: string[];
}

class AIServiceClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = env.AI_SERVICE_URL;
    this.headers = {
      "Content-Type": "application/json",
      "X-Internal-Secret": env.INTERNAL_API_SECRET,
    };
  }

  /**
   * Send a chat request to the AI service.
   */
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

    return response.json();
  }
}

// Export singleton instance
export const aiClient = new AIServiceClient();
