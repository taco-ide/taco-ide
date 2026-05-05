export type SSEEvent =
  | { type: "text"; content: string }
  | { type: "done"; full_response: string }
  | { type: "error"; content: string };

export function formatSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
