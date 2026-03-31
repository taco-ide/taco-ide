interface Chunk {
  content: string;
  index: number;
  metadata: {
    titleHierarchy: string[];
    documentFilename?: string;
  };
}

function getHierarchyAt(text: string, position: number): string[] {
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const active: (string | null)[] = [null, null, null, null, null, null];
  let match: RegExpExecArray | null;

  while ((match = headerRegex.exec(text)) !== null) {
    if (match.index > position) break;
    const level = match[1]!.length - 1;
    active[level] = match[2]!.trim();
    for (let i = level + 1; i < 6; i++) active[i] = null;
  }

  return active.filter((x): x is string => x !== null);
}

export function chunkText(
  text: string,
  chunkSize = 3200,
  overlap = 800,
  filename?: string,
): Chunk[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Document has no readable content");
  }
  if (trimmed.length <= chunkSize) return [{ content: trimmed, index: 0, metadata: { titleHierarchy: getHierarchyAt(trimmed, 0), documentFilename: filename } }];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < trimmed.length) {
    let end = Math.min(start + chunkSize, trimmed.length);

    // Try to break at a natural boundary (paragraph, line, sentence)
    if (end < trimmed.length) {
      const slice = trimmed.slice(start, end);

      const lastParagraph = slice.lastIndexOf("\n\n");
      if (lastParagraph > chunkSize * 0.5) {
        end = start + lastParagraph + 2;
      } else {
        const lastLine = slice.lastIndexOf("\n");
        if (lastLine > chunkSize * 0.3) {
          end = start + lastLine + 1;
        } else {
          const lastSentence = slice.lastIndexOf(". ");
          if (lastSentence > chunkSize * 0.3) {
            end = start + lastSentence + 2;
          }
        }
      }
    }

    const content = trimmed.slice(start, end).trim();
    if (content) {
      chunks.push({ content, index, metadata: { titleHierarchy: getHierarchyAt(trimmed, start), documentFilename: filename } });
      index++;
    }

    // Next chunk starts with overlap, but only if we're not at the end
    const nextStart = end < trimmed.length ? end - overlap : end;
    // Guard: if overlap would not advance, skip it entirely
    start = nextStart <= start ? end : nextStart;
  }

  return chunks;
}
