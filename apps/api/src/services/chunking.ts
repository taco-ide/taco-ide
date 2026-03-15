interface Chunk {
  content: string;
  index: number;
}

export function chunkText(
  text: string,
  chunkSize = 3200,
  overlap = 800
): Chunk[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Document has no readable content");
  }
  if (trimmed.length <= chunkSize) return [{ content: trimmed, index: 0 }];

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
      chunks.push({ content, index });
      index++;
    }

    // Next chunk starts with overlap
    const nextStart = end - overlap;
    // Guard: always advance at least 1 character to prevent infinite loop
    start = nextStart <= start ? start + 1 : nextStart;
  }

  return chunks;
}
