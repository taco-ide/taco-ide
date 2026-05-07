"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Keyboard, Terminal } from "lucide-react";

type ReplayIOPanelProps = {
  stdin: string;
  stdout: string;
  animationsEnabled: boolean;
};

export function ReplayIOPanel({
  stdin,
  stdout,
  animationsEnabled,
}: ReplayIOPanelProps) {
  const duration = animationsEnabled ? 0.2 : 0;

  return (
    <Card className="flex h-full min-h-[280px] flex-col overflow-hidden border-slate-700 bg-slate-800/40 text-slate-100 shadow-none lg:min-h-0">
      <CardHeader className="shrink-0 space-y-0 border-b border-slate-700/80 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Keyboard className="h-4 w-4 text-amber-500/90" />
          Input / Output
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-4 min-h-0">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">stdin</span>
          <motion.div
            key={stdin}
            initial={animationsEnabled ? { opacity: 0.65 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration }}
            className="min-h-[100px] flex-1"
          >
            <textarea
              readOnly
              value={stdin}
              placeholder="(vazio)"
              className="h-full min-h-[100px] w-full resize-none rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 font-mono text-sm text-slate-300 placeholder:text-slate-600"
            />
          </motion.div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Terminal className="h-3.5 w-3.5" />
            stdout
          </span>
          <motion.div
            key={stdout}
            initial={animationsEnabled ? { opacity: 0.65 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration }}
            className="min-h-[100px] flex-1"
          >
            <textarea
              readOnly
              value={stdout}
              placeholder="(sem execução ainda)"
              className="h-full min-h-[100px] w-full resize-none rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 font-mono text-sm text-slate-300 placeholder:text-slate-600"
            />
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
