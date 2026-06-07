"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  Check,
  ChevronDown,
  File,
  FileText,
  MessageCircle,
  Play,
  Terminal,
} from "lucide-react";
import { Reveal } from "./Reveal";

const NBSP = " ";

export function IdeDemo() {
  const t = useTranslations("home.demo");

  return (
    <section id="demo" className="pb-24 pt-2">
      <Reveal>
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mx-auto max-w-[1060px] overflow-hidden rounded-[14px] border border-[rgba(63,63,70,0.6)] bg-[#0C0D10] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
            {/* Window bar */}
            <div className="flex items-center gap-3.5 border-b border-[rgba(63,63,70,0.6)] bg-[rgba(24,24,27,0.6)] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-[11px] w-[11px] rounded-full bg-[#FF5F57]" />
                <span className="h-[11px] w-[11px] rounded-full bg-[#FEBC2E]" />
                <span className="h-[11px] w-[11px] rounded-full bg-[#28C840]" />
              </div>
              <div className="flex flex-1 justify-center">
                <span className="rounded-full border border-[rgba(63,63,70,0.6)] bg-white/[0.03] px-3.5 py-1 font-mono text-[11px] text-[#71717A]">
                  {t("address")}
                </span>
              </div>
              <div className="w-[52px]" />
            </div>

            {/* IDE body */}
            <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[42%_58%]">
              {/* Left panel */}
              <div className="hidden flex-col border-r border-[rgba(63,63,70,0.6)] md:flex">
                <div className="flex gap-0.5 border-b border-[rgba(63,63,70,0.6)] bg-[rgba(24,24,27,0.35)] px-2 pt-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-t-lg border-b-2 border-[#FFB800] bg-[rgba(39,39,42,0.55)] px-3.5 py-2 text-xs text-[#FFB800]">
                    <FileText className="h-3.5 w-3.5" />
                    {t("problemTab")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-xs text-[#A1A1AA]">
                    <Terminal className="h-3.5 w-3.5" />
                    {t("ioTab")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-xs text-[#A1A1AA]">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t("chatTab")}
                  </span>
                </div>

                <div className="px-[22px] py-5 text-[13px] leading-[1.62] text-[#D4D4D8]">
                  <h3 className="mb-2 text-[19px] font-bold text-white">
                    {t("problemTitle")}
                  </h3>
                  <div className="mb-4 flex gap-1.5">
                    <span className="rounded-md border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.1)] px-2.5 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                      {t("badgeEasy")}
                    </span>
                    <span className="rounded-md bg-[#334155] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      {t("badgeTag")}
                    </span>
                  </div>
                  <p className="mb-3">
                    {t.rich("problemDescription", {
                      code: (chunks: ReactNode) => (
                        <code className="rounded bg-[rgba(63,63,70,0.5)] px-1.5 py-0.5 font-mono text-xs text-[#FFB800]">
                          {chunks}
                        </code>
                      ),
                    })}
                  </p>
                  <div className="mb-1.5 mt-4 text-[11px] uppercase tracking-wider text-[#71717A]">
                    {t("exampleLabel")}
                  </div>
                  <div className="rounded-lg border border-[rgba(63,63,70,0.6)] bg-[rgba(24,24,27,0.5)] px-3 py-2.5 font-mono text-xs text-[#D4D4D8]">
                    <span className="text-[#71717A]">{t("inLabel")}</span>
                    {NBSP} [1, 2, 3, 4]
                    <br />
                    <span className="text-[#71717A]">{t("outLabel")}</span> 6
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div className="flex flex-col">
                {/* Toolbar */}
                <div className="flex items-center justify-between border-b border-[rgba(63,63,70,0.6)] bg-[rgba(24,24,27,0.3)] px-3.5 py-[7px]">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#D4D4D8]">
                    <File className="h-3 w-3 text-[#FFB800]" />
                    {t("fileName")}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(63,63,70,0.6)] bg-[#1E1E2E] px-2.5 py-1 text-xs text-white"
                    >
                      <Image
                        src="/python.png"
                        alt="Python"
                        width={15}
                        height={15}
                      />
                      Python
                      <ChevronDown className="h-[11px] w-[11px] text-[#A1A1AA]" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#4CAF50] to-[#45A049] px-3.5 py-[7px] text-xs font-semibold text-white"
                    >
                      <Play className="h-[11px] w-[11px]" />
                      {t("runCode")}
                    </button>
                  </div>
                </div>

                {/* Editor */}
                <div className="flex-1 bg-[rgba(12,13,16,0.5)] py-3.5 font-mono text-[13px] leading-[1.62]">
                  <CodeLine n={1}>
                    <span className="italic text-[#71717A]">
                      # Return the sum of even numbers
                    </span>
                  </CodeLine>
                  <CodeLine n={2}>
                    <span className="text-[#FFB800]">def</span>{" "}
                    <span className="text-[#C084FC]">sum_evens</span>
                    <span className="text-[#D4D4D8]">(nums):</span>
                  </CodeLine>
                  <CodeLine n={3}>
                    <span className="text-[#D4D4D8]">
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}total ={" "}
                    </span>
                    <span className="text-[#5EEAD4]">0</span>
                  </CodeLine>
                  <CodeLine n={4}>
                    <span className="text-[#D4D4D8]">
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                    </span>
                    <span className="text-[#FFB800]">for</span>
                    <span className="text-[#D4D4D8]"> n </span>
                    <span className="text-[#FFB800]">in</span>
                    <span className="text-[#D4D4D8]"> nums:</span>
                  </CodeLine>
                  <CodeLine n={5}>
                    <span className="text-[#D4D4D8]">
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                    </span>
                    <span className="text-[#FFB800]">if</span>
                    <span className="text-[#D4D4D8]"> n % </span>
                    <span className="text-[#5EEAD4]">2</span>
                    <span className="text-[#D4D4D8]"> == </span>
                    <span className="text-[#5EEAD4]">0</span>
                    <span className="text-[#D4D4D8]">:</span>
                  </CodeLine>
                  <CodeLine n={6}>
                    <span className="text-[#D4D4D8]">
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}total += n
                    </span>
                  </CodeLine>
                  <CodeLine n={7}>
                    <span className="text-[#D4D4D8]">
                      {NBSP}
                      {NBSP}
                      {NBSP}
                      {NBSP}
                    </span>
                    <span className="text-[#FFB800]">return</span>
                    <span className="text-[#D4D4D8]"> total</span>
                  </CodeLine>
                </div>

                {/* Output */}
                <div className="border-t border-[rgba(63,63,70,0.6)] bg-[rgba(24,24,27,0.4)]">
                  <div className="flex gap-0.5 border-b border-[rgba(63,63,70,0.6)] px-2 pt-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-t-lg border-b-2 border-[#FFB800] bg-[rgba(39,39,42,0.55)] px-3.5 py-2 text-xs text-[#FFB800]">
                      <Terminal className="h-3.5 w-3.5" />
                      {t("outputTab")}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-xs text-[#A1A1AA]">
                      <Check className="h-3.5 w-3.5" />
                      {t("testsTab")}
                    </span>
                  </div>
                  <div className="px-4 py-3 font-mono text-xs leading-[1.7] text-[#D4D4D8]">
                    <div className="text-[11px] text-[#71717A]">
                      {t("runMeta")}
                    </div>
                    <div className="text-[#4CAF50]">6</div>
                    <div className="mt-2 text-[11px] text-[#71717A]">
                      {t("allTestsPassed")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

interface CodeLineProps {
  n: number;
  children: ReactNode;
}

function CodeLine({ n, children }: CodeLineProps) {
  return (
    <div className="grid grid-cols-[44px_1fr]">
      <span className="select-none pr-4 text-right text-[#52525B]">{n}</span>
      <span>{children}</span>
    </div>
  );
}

export default IdeDemo;
