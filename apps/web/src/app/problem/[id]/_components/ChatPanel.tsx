"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import {
  ChatBubble,
  ChatBubbleAction,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { Button } from "@/components/ui/button";
import { CopyIcon, CornerDownLeft, Mic, Paperclip } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useCodeEditorStore } from "@/store/useCodeEditorStore";

const ChatAiIcons = [
  {
    icon: CopyIcon,
    label: "Copy",
  },
];

interface ChatPanelProps {
  workSessionId?: string;
}

function ChatPanel({ workSessionId }: ChatPanelProps) {
  const messages = useChatStore((state) => state.messages);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setWorkSessionId = useChatStore((state) => state.setWorkSessionId);
  const loadHistory = useChatStore((state) => state.loadHistory);

  const getCode = useCodeEditorStore((state) => state.getCode);
  const output = useCodeEditorStore((state) => state.output);

  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (workSessionId) {
      setWorkSessionId(workSessionId);
      loadHistory(workSessionId);
    }
  }, [workSessionId, setWorkSessionId, loadHistory]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const currentCode = getCode();
    const currentInput = input;
    setInput("");

    await sendMessage(currentInput, currentCode, output);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming || !input) return;
      onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleActionClick = async (action: string, messageIndex: number) => {
    if (action === "Copy") {
      const message = messages[messageIndex];
      if (message && message.role === "assistant") {
        navigator.clipboard.writeText(message.content);
      }
    }
  };

  return (
    <Card className="bg-[#1a1f2e] text-white flex flex-col h-full">
      <CardHeader className="flex-none">
        <CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#1e1e2e] ring-1 ring-gray-800/50">
              <MessageSquare className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-gray-300">Chat</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 h-full">
        <div className="h-full w-full flex flex-col">
          <div className="flex-1 overflow-y-auto" ref={messagesRef}>
            <ChatMessageList>
              {messages.length === 0 && (
                <div className="w-full bg-[#1e1e2e] shadow-sm border border-[#313244] rounded-lg p-8 flex flex-col gap-2">
                  <h1 className="font-bold text-gray-300">Bem-vindo ao Chat!</h1>
                  <p className="text-gray-400 text-sm">
                    Use o chat para fazer perguntas sobre o problema ou código.
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
                    fallback={message.role === "user" ? "👨🏽" : "🤖"}
                  />
                  <ChatBubbleMessage>
                    {message.content
                      .split("```")
                      .map((part: string, index: number) => {
                        if (index % 2 === 0) {
                          return (
                            part
                          );
                        } else {
                          return (
                            <pre className="whitespace-pre-wrap pt-2" key={index}>
                              part
                            </pre>
                          );
                        }
                      })}

                    {message.role === "assistant" &&
                      messages.length - 1 === index && (
                        <div className="flex items-center mt-1.5 gap-1">
                          {!isStreaming && (
                            <>
                              {ChatAiIcons.map((icon, iconIndex) => {
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
                            </>
                          )}
                        </div>
                      )}
                  </ChatBubbleMessage>
                </ChatBubble>
              ))}

              {isStreaming &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <ChatBubble variant="received">
                    <ChatBubbleAvatar src="" fallback="🤖" />
                    <ChatBubbleMessage isLoading />
                  </ChatBubble>
                )}
            </ChatMessageList>
          </div>

          <div className="p-4 border-t border-[#313244]">
            <form
              ref={formRef}
              onSubmit={onSubmit}
              className="relative rounded-lg border border-[#313244] bg-[#1e1e2e] focus-within:ring-1 focus-within:ring-blue-500"
            >
              <ChatInput
                value={input}
                onKeyDown={onKeyDown}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem aqui..."
                className="rounded-lg bg-transparent border-0 shadow-none focus-visible:ring-0 text-gray-300"
              />
              <div className="flex items-center p-3 pt-0">
                <Button variant="ghost" size="icon">
                  <Paperclip className="size-4" />
                  <span className="sr-only">Anexar arquivo</span>
                </Button>

                <Button variant="ghost" size="icon">
                  <Mic className="size-4" />
                  <span className="sr-only">Usar microfone</span>
                </Button>

                <Button
                  disabled={!input || isStreaming}
                  type="submit"
                  size="sm"
                  className="ml-auto gap-1.5"
                >
                  Enviar
                  <CornerDownLeft className="size-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ChatPanel;
