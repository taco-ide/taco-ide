import * as React from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/components/ui/chat/hooks/useAutoScroll";
import { cn } from "@/lib/utils";

export interface ChatMessageListProps
  extends React.HTMLAttributes<HTMLDivElement> {
  smooth?: boolean;
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    refs.forEach((r) => {
      if (typeof r === "function") r(node);
      else if (r) (r as React.MutableRefObject<T | null>).current = node;
    });
  };
}

const ChatMessageList = React.forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, children, smooth = false, ...props }, ref) => {
    const { scrollRef, isAtBottom, scrollToBottom } = useAutoScroll({
      smooth,
      content: children,
    });

    return (
      <div className="relative w-full h-full min-h-0">
        <div
          ref={mergeRefs(ref, scrollRef)}
          className={cn(
            "flex flex-col w-full h-full p-4 overflow-y-auto",
            className
          )}
          {...props}
        >
          <div className="flex flex-col gap-6">{children}</div>
        </div>

        {!isAtBottom && (
          <Button
            onClick={() => scrollToBottom()}
            size="icon"
            variant="outline"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-800/80 border-zinc-700/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-300"
            aria-label="Ir para o final"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
);

ChatMessageList.displayName = "ChatMessageList";

export { ChatMessageList };
