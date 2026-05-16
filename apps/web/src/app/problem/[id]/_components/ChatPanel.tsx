"use client";

import { CopyIcon, CornerDownLeft } from "lucide-react";
import { useState } from "react";
import { useRemarkSync } from "react-remark";
import { useProblem } from "@/contexts/ProblemContext";
import { useCodeEditorStore } from "@/store/useCodeEditorStore";
import { Button } from "@/components/ui/button";
import {
  ChatBubble,
  ChatBubbleAction,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";

const ChatAiIcons = [{ icon: CopyIcon, label: "Copy" }];

/** Reduz parágrafos vazios repetidos (modelos costumam usar muitas quebras duplas). */
function normalizeAssistantMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AssistantMessageContent({ content }: { content: string }) {
  const trimmed =
    normalizeAssistantMarkdown(content || "") || "(Aguardando resposta...)";
  const md = useRemarkSync(trimmed);
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:text-zinc-300 prose-p:my-0.5 prose-headings:text-zinc-100 prose-headings:my-1.5 prose-li:my-0 prose-li:text-zinc-300 prose-code:text-amber-400 prose-code:bg-zinc-700/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-zinc-900/80 prose-pre:border prose-pre:border-zinc-600/50 prose-pre:text-zinc-300 prose-pre:text-xs prose-pre:my-1.5 prose-ul:my-1 prose-ol:my-1">
      {md}
    </div>
  );
}

function ChatPanel() {
  const { workSession, sendChatMessage, isSessionEnded } = useProblem();
  const { getCode, getInput, output, error } = useCodeEditorStore();
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);

  const messages: Array<{ role: string; content: string }> = [];
  if (workSession?.interactions) {
    for (const i of workSession.interactions) {
      if (i.interactionType === "chat") {
        if (i.userPrompt) messages.push({ role: "user", content: i.userPrompt });
        messages.push({
          role: "assistant",
          content: i.modelResponse || "(Aguardando resposta...)",
        });
      }
    }
  }
  if (optimisticUserMessage) {
    messages.push({ role: "user", content: optimisticUserMessage });
  }

  const submitMessage = async () => {
    if (isSessionEnded || !input.trim() || isGenerating) return;

    setIsGenerating(true);
    setChatError(null);
    const userMessage = input.trim();
    setInput("");
    setOptimisticUserMessage(userMessage);

    try {
      await sendChatMessage({
        message: userMessage,
        code: getCode(),
        stdin: getInput(),
        stdout: error || output || undefined,
      });
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Erro ao enviar mensagem"
      );
    } finally {
      setIsGenerating(false);
      setOptimisticUserMessage(null);
    }
  };

  const onSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const handleActionClick = async (action: string, messageIndex: number) => {
    if (action === "Copy") {
      const message = messages[messageIndex];
      if (message?.role === "assistant") {
        navigator.clipboard.writeText(message.content);
      }
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Área de mensagens com scroll - ChatMessageList gerencia o scroll internamente */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatMessageList className="flex-1 min-h-0 border-0 p-3">
          {isSessionEnded && (
            <div className="rounded-lg border border-zinc-600/50 bg-zinc-800/50 p-3 text-xs text-zinc-400 mb-3">
              Esta sessão foi submetida. O chat está em modo somente leitura.
            </div>
          )}
          {chatError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400/90 mb-3">
              {chatError}
            </div>
          )}
          {messages.length === 0 && (
            <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/40 p-6 flex flex-col gap-2">
              <h3 className="font-medium text-zinc-300 text-sm">
                Bem-vindo ao Chat
              </h3>
              <p className="text-zinc-500 text-xs">
                Faça perguntas sobre o problema ou código. As mensagens são
                salvas no histórico.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <ChatBubble
              key={index}
              variant={message.role === "user" ? "sent" : "received"}
            >
              <ChatBubbleAvatar
                src=""
                fallback={message.role === "user" ? "👤" : "🤖"}
              />
              <ChatBubbleMessage>
                {message.role === "assistant" ? (
                  <AssistantMessageContent content={message.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                )}
                {message.role === "assistant" &&
                  messages.length - 1 === index && (
                    <div className="flex items-center mt-1.5 gap-1">
                      {!isGenerating &&
                        ChatAiIcons.map((icon, iconIndex) => {
                          const Icon = icon.icon;
                          return (
                            <ChatBubbleAction
                              variant="outline"
                              className="size-5"
                              key={iconIndex}
                              icon={<Icon className="size-3" />}
                              onClick={() =>
                                handleActionClick(icon.label, index)
                              }
                            />
                          );
                        })}
                    </div>
                  )}
              </ChatBubbleMessage>
            </ChatBubble>
          ))}

          {isGenerating && (
            <ChatBubble variant="received">
              <ChatBubbleAvatar src="" fallback="🤖" />
              <ChatBubbleMessage isLoading />
            </ChatBubble>
          )}
        </ChatMessageList>
      </div>

      {/* Input fixo no rodapé */}
      <div className="shrink-0 p-3 pt-0 border-t border-zinc-800/60">
        <form
          onSubmit={onSubmit}
          className={`rounded-lg border border-zinc-700/50 bg-zinc-800/40 transition-all ${
            isSessionEnded
              ? "opacity-60 pointer-events-none"
              : "focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500/40"
          }`}
        >
          <ChatInput
            value={input}
            onKeyDown={onKeyDown}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isSessionEnded
                ? "Sessão submetida — chat bloqueado"
                : "Digite sua mensagem..."
            }
            disabled={isSessionEnded}
            className="rounded-lg bg-transparent border-0 shadow-none focus-visible:ring-0 text-zinc-300 placeholder:text-zinc-600 min-h-[44px] py-3 disabled:cursor-not-allowed"
          />
          <div className="flex items-center px-2 pb-2">
            <Button
              disabled={isSessionEnded || !input.trim() || isGenerating}
              type="submit"
              size="sm"
              className="ml-auto gap-1.5 bg-amber-500/90 hover:bg-amber-500 text-zinc-900 text-xs"
            >
              Enviar
              <CornerDownLeft className="size-3.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatPanel;
