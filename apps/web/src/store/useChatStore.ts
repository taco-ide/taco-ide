import { create } from "zustand";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  workSessionId: string | null;
  error: string | null;

  setWorkSessionId: (id: string) => void;
  sendMessage: (
    message: string,
    currentCode?: string,
    stdout?: string,
  ) => Promise<void>;
  loadHistory: (workSessionId: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  workSessionId: null,
  error: null,

  setWorkSessionId: (id: string) => {
    set({ workSessionId: id });
  },

  sendMessage: async (
    message: string,
    currentCode?: string,
    stdout?: string,
  ) => {
    const { workSessionId } = get();
    if (!workSessionId) {
      set({ error: "No active work session" });
      return;
    }

    // Add user message immediately
    set((state) => ({
      messages: [...state.messages, { role: "user" as const, content: message }],
      isStreaming: true,
      error: null,
    }));

    // Add empty assistant message for streaming
    set((state) => ({
      messages: [...state.messages, { role: "assistant" as const, content: "" }],
    }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/chat/student/message`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workSessionId,
            message,
            currentCode,
            stdout,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "text" && data.content) {
              // Append text to the last assistant message
              set((state) => {
                const messages = [...state.messages];
                const lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  messages[messages.length - 1] = {
                    ...lastMsg,
                    content: lastMsg.content + data.content,
                  };
                }
                return { messages };
              });
            } else if (data.type === "error") {
              // Handle SSE-level error
              streamError = true;
              set({ error: data.content || "Stream error" });
              // Continue draining the stream in case more events follow
            } else if (data.type === "done") {
              // Optional: use full_response to replace/verify streamed content
              // For now, just treat it as an explicit completion signal
            }
          } catch {
            // Ignore partial JSON chunks
          }
        }
      }

      // Clean up empty assistant message if stream error occurred
      if (streamError) {
        set((state) => {
          const messages = [...state.messages];
          const lastMsg = messages[messages.length - 1];
          // Remove the empty assistant message or one with only whitespace
          if (
            lastMsg &&
            lastMsg.role === "assistant" &&
            (!lastMsg.content || !lastMsg.content.trim())
          ) {
            messages.pop();
          }
          return { messages };
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      set({ error: errorMessage });

      // Remove the empty assistant message on error
      set((state) => {
        const messages = [...state.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content) {
          messages.pop();
        }
        return { messages };
      });
    } finally {
      set({ isStreaming: false });
    }
  },

  loadHistory: async (workSessionId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/chat/student/history/${workSessionId}`,
        { credentials: "include" },
      );

      if (!response.ok) return;

      const result = await response.json();

      if (result.success && result.data) {
        const messages: ChatMessage[] = [];
        for (const interaction of result.data) {
          messages.push({ role: "user", content: interaction.userPrompt });
          messages.push({
            role: "assistant",
            content: interaction.modelResponse,
          });
        }
        set({ messages, workSessionId });
      }
    } catch {
      // Silently fail - history is non-critical
    }
  },

  clearChat: () => {
    set({ messages: [], error: null });
  },
}));
