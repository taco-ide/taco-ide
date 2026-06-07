"use client";

import { useTranslations } from "next-intl";
import type { ComponentType, ReactNode } from "react";
import {
  Bot,
  CornerDownLeft,
  History,
  MessageSquareMore,
  ShieldCheck,
  User,
} from "lucide-react";
import { Reveal } from "./Reveal";

type Feat = { title: string; desc: string };

type ChatMessage = {
  role: "user" | "ai";
  messageKey: "userMsg1" | "aiMsg1" | "userMsg2" | "aiMsg2";
};

const featIcons: ComponentType<{ className?: string }>[] = [
  MessageSquareMore,
  ShieldCheck,
  History,
];

const chatMessages: ChatMessage[] = [
  { role: "user", messageKey: "userMsg1" },
  { role: "ai", messageKey: "aiMsg1" },
  { role: "user", messageKey: "userMsg2" },
  { role: "ai", messageKey: "aiMsg2" },
];

export function AiFeedback() {
  const t = useTranslations("home.ai");
  const feats = t.raw("feats") as Feat[];

  const code = (chunks: ReactNode) => (
    <code className="font-mono text-[#FFB800] bg-[rgba(63,63,70,0.5)] px-1.5 py-0.5 rounded text-xs">
      {chunks}
    </code>
  );

  return (
    <section id="ai" className="relative overflow-hidden py-[88px]">
      {/* decorative green halo bottom-right */}
      <div className="pointer-events-none absolute -bottom-[180px] -right-[60px] h-[380px] w-[380px] rounded-full bg-[#4CAF50] opacity-20 blur-[96px]" />

      <div className="mx-auto max-w-[1180px] px-6">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="mb-3.5 text-xs uppercase tracking-[0.1em] text-[#FFB800]">
              {t("eyebrow")}
            </p>
            <h2 className="mb-[18px] text-[38px] font-extrabold leading-[1.15] tracking-tight text-white">
              {t("title")}{" "}
              <span className="bg-gradient-to-r from-[#FFB800] to-[#FFA000] bg-clip-text text-transparent">
                {t("titleAccent")}
              </span>
              {t("titleAfter")}
            </h2>
            <p className="mb-[26px] text-base leading-[1.7] text-gray-400">
              {t("subtitle")}
            </p>

            <div className="flex flex-col gap-[18px]">
              {feats.map((feat, i) => {
                const Icon = featIcons[i] ?? MessageSquareMore;
                return (
                  <div key={feat.title} className="flex gap-3.5">
                    <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#FFB800]/10 text-[#FFB800]">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <h4 className="mb-1 text-[15px] font-semibold text-white">
                        {feat.title}
                      </h4>
                      <p className="text-[13.5px] leading-snug text-gray-400">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal>
            <div className="rounded-[18px] border border-[rgba(63,63,70,0.6)] bg-[rgba(24,24,27,0.5)] p-[18px] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)] backdrop-blur">
              {/* chat head */}
              <div className="mb-3.5 flex items-center gap-2.5 border-b border-[rgba(63,63,70,0.6)] px-1.5 pb-3.5">
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-r from-[#FFB800] to-[#FFA000]">
                  <Bot className="h-[17px] w-[17px] text-[#1A1F2E]" />
                </div>
                <div className="text-[13px] font-semibold text-white">
                  {t("chat.name")}
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#4CAF50]">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#4CAF50] shadow-[0_0_8px_#4CAF50]" />
                  {t("chat.status")}
                </div>
              </div>

              {/* messages */}
              {chatMessages.map(({ role, messageKey }) => {
                const isUser = role === "user";
                return (
                  <div
                    key={messageKey}
                    className={`mb-3.5 flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isUser
                          ? "bg-[#4CAF50]/20 text-[#4CAF50]"
                          : "bg-gradient-to-r from-[#FFB800] to-[#FFA000]"
                      }`}
                    >
                      {isUser ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-[#1A1F2E]" />
                      )}
                    </div>
                    <div
                      className={`max-w-[84%] rounded-[14px] px-3.5 py-2.5 text-[13px] leading-snug ${
                        isUser
                          ? "rounded-br-[4px] border border-[#4CAF50]/[0.22] bg-[#4CAF50]/[0.14] text-white/85"
                          : "rounded-bl-[4px] border border-[rgba(63,63,70,0.6)] bg-[rgba(39,39,42,0.6)] text-gray-300"
                      }`}
                    >
                      {t.rich(`chat.${messageKey}`, { code })}
                    </div>
                  </div>
                );
              })}

              {/* input */}
              <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-[rgba(63,63,70,0.6)] bg-[rgba(12,13,16,0.4)] px-3 py-2.5">
                <span className="flex-1 text-[13px] text-[#71717A]">
                  {t("chat.inputPlaceholder")}
                </span>
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-gradient-to-r from-[#FFB800] to-[#FFA000] text-[#1A1F2E]">
                  <CornerDownLeft className="h-[15px] w-[15px]" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default AiFeedback;
