import { PDFParse } from "pdf-parse";

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;

type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export function isSupportedMimeType(
  mimeType: string
): mimeType is SupportedMimeType {
  return SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pageCount: number }> {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(
      `Unsupported MIME type: ${mimeType}. Supported: ${SUPPORTED_MIME_TYPES.join(", ")}`
    );
  }

  switch (mimeType) {
    case "application/pdf": {
      const pdf = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await pdf.getText();
      const info = await pdf.getInfo();
      await pdf.destroy();
      return {
        text: textResult.text,
        pageCount: info.total,
      };
    }
    case "text/plain":
    case "text/markdown": {
      return { text: buffer.toString("utf-8"), pageCount: 1 };
    }
  }
}
