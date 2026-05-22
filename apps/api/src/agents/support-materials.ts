type SupportMaterialItem =
  | { type?: string; content?: string; url?: string; label?: string }
  | string
  | null
  | undefined;

export function formatSupportMaterials(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return "";
    return raw
      .map((item: SupportMaterialItem, i) => {
        if (item && typeof item === "object") {
          if (typeof item.content === "string" && item.content.trim()) {
            return item.content;
          }
          if (typeof item.url === "string") {
            return `- Link: ${item.url}${item.label ? ` (${item.label})` : ""}`;
          }
          return `- Item ${i + 1}: ${JSON.stringify(item)}`;
        }
        if (typeof item === "string") return item;
        return `- Item ${i + 1}: ${JSON.stringify(item)}`;
      })
      .filter((line) => line.length > 0)
      .join("\n");
  }
  return JSON.stringify(raw);
}
