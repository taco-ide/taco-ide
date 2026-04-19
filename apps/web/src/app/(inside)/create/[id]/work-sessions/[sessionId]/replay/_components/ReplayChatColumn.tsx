"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useRemarkSync } from "react-remark";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useMemo } from "react";
import {
  deriveReplayState,
  type DerivedReplayState,
  type ReplayChatMessage,
  type ReplayInteraction,
} from "./deriveReplayState";
import { useRevealText } from "./useRevealText";
import type { StepDirection } from "./useWorkSessionReplay";

function normalizeAssistantMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AssistantMarkdownBody({ content }: { content: string }) {
  const trimmed =
    normalizeAssistantMarkdown(content || "") || "(Aguardando resposta...)";
  const md = useRemarkSync(trimmed);
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:text-zinc-300 prose-p:my-0.5 prose-headings:text-zinc-100 prose-headings:my-1.5 prose-li:my-0 prose-li:text-zinc-300 prose-code:text-amber-400 prose-code:bg-zinc-700/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-zinc-900/80 prose-pre:border prose-pre:border-zinc-600/50 prose-pre:text-zinc-300 prose-pre:text-xs prose-pre:my-1.5 prose-ul:my-1 prose-ol:my-1">
      {md}
    </div>
  );
}

function RevealedUserLine({
  fullText,
  runReveal,
  resetKey,
}: {
  fullText: string;
  runReveal: boolean;
  resetKey: string;
}) {
  const text = useRevealText(fullText, runReveal, resetKey);
  return <span className="whitespace-pre-wrap">{text}</span>;
}

function RevealedAssistantLine({
  fullText,
  runReveal,
  resetKey,
}: {
  fullText: string;
  runReveal: boolean;
  resetKey: string;
}) {
  const text = useRevealText(fullText, runReveal, resetKey);
  return <AssistantMarkdownBody content={text} />;
}

type ReplayChatColumnProps = {
  interactions: ReplayInteraction[];
  stepIndex: number;
  stepDirection: StepDirection;
  animationsEnabled: boolean;
  derived: DerivedReplayState;
};

export function ReplayChatColumn({
  interactions,
  stepIndex,
  stepDirection,
  animationsEnabled,
  derived,
}: ReplayChatColumnProps) {
  const prevMessages = useMemo(
    () => deriveReplayState(interactions, Math.max(0, stepIndex - 1)).messages,
    [interactions, stepIndex]
  );

  const prevKeySet = useMemo(
    () => new Set(prevMessages.map((m) => m.key)),
    [prevMessages]
  );

  const newMessageKeys = useMemo(() => {
    if (stepDirection !== "forward") return new Set<string>();
    return new Set(
      derived.messages
        .filter((m) => !prevKeySet.has(m.key))
        .map((m) => m.key)
    );
  }, [derived.messages, prevKeySet, stepDirection]);

  const entryDuration = animationsEnabled ? 0.22 : 0;

  function wrapMessage(message: ReplayChatMessage) {
    const isNew = newMessageKeys.has(message.key);
    const runReveal =
      animationsEnabled && stepDirection === "forward" && isNew;
    const resetKey = `${stepIndex}-${message.key}`;

    const shouldMotionEnter =
      animationsEnabled && stepDirection === "forward" && isNew;

    const bubble = (
      <ChatBubble
        variant={message.role === "user" ? "sent" : "received"}
        className="w-full"
      >
        <ChatBubbleAvatar
          src=""
          fallback={message.role === "user" ? "👤" : "🤖"}
        />
        <ChatBubbleMessage>
          {message.role === "assistant" ? (
            <RevealedAssistantLine
              fullText={message.content}
              runReveal={runReveal}
              resetKey={resetKey}
            />
          ) : (
            <RevealedUserLine
              fullText={message.content}
              runReveal={runReveal}
              resetKey={resetKey}
            />
          )}
        </ChatBubbleMessage>
      </ChatBubble>
    );

    return (
      <motion.div
        key={message.key}
        initial={shouldMotionEnter ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={
          animationsEnabled
            ? { opacity: 0, y: -6 }
            : { opacity: 0, transition: { duration: 0 } }
        }
        transition={{ duration: entryDuration }}
      >
        {bubble}
      </motion.div>
    );
  }

  return (
    <Card className="flex h-full min-h-[320px] flex-col border-slate-700 bg-slate-800/40 text-slate-100 shadow-none lg:min-h-0">
      <CardHeader className="shrink-0 space-y-0 border-b border-slate-700/80 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <MessageSquare className="h-4 w-4 text-amber-500/90" />
          Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <ChatMessageList className="min-h-[240px] flex-1 border-0 p-3 lg:min-h-0">
          {derived.messages.length === 0 ? (
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 text-sm text-slate-500">
              Nenhuma mensagem de chat neste passo.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {derived.messages.map((m) => wrapMessage(m))}
            </AnimatePresence>
          )}
        </ChatMessageList>
      </CardContent>
    </Card>
  );
}
