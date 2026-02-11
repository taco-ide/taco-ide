import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditorPanel from "./_components/EditorPanel";
import Header from "./_components/Header";
import OutputPanel from "./_components/OutputPanel";
import ProblemDescription from "./_components/ProblemDescription";
import InputPanel from "./_components/InputPanel";
import ChatPanel from "./_components/ChatPanel";

export default function ProblemPage() {
  // Future: we will get the id from the url
  // const { id } = useParams();
  return (
    <div className="h-screen w-screen p-4 gap-4 bg-slate-900 text-white flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex flex-row gap-4">
        <div className="flex-1 flex flex-col">
          <Tabs defaultValue="problem" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 bg-[--color-tacoyellowdark] text-white">
              <TabsTrigger value="problem">problem</TabsTrigger>
              <TabsTrigger value="output">output</TabsTrigger>
              <TabsTrigger value="input">input</TabsTrigger>
              <TabsTrigger value="chat">chat</TabsTrigger>
            </TabsList>
            <div className="flex-1">
              <TabsContent value="problem" className="h-full">
                <ProblemDescription />
              </TabsContent>
              <TabsContent value="output" className="h-full">
                <OutputPanel />
              </TabsContent>
              <TabsContent value="input" className="h-full">
                <InputPanel />
              </TabsContent>
              <TabsContent value="chat" className="h-full">
                <ChatPanel />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex-1">
          <EditorPanel />
        </div>
      </div>
    </div>
  );
}
