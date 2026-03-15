"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { KbDocuments } from "./kb-documents";
import { KbTextEntries } from "./kb-text-entries";

interface KnowledgeBaseSectionProps {
  challengeId: string;
}

export function KnowledgeBaseSection({
  challengeId,
}: KnowledgeBaseSectionProps) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-yellow-400" />
          Knowledge Base
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-700">
            <TabsTrigger
              value="documents"
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-400"
            >
              Documentos
            </TabsTrigger>
            <TabsTrigger
              value="text"
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-400"
            >
              Notas de Texto
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents">
            <KbDocuments challengeId={challengeId} />
          </TabsContent>
          <TabsContent value="text">
            <KbTextEntries challengeId={challengeId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
