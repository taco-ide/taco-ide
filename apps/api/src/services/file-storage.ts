import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";

const UPLOADS_DIR = join(process.cwd(), "uploads", "documents");

export async function saveFile(
  buffer: Buffer,
  organizationId: string,
  knowledgeBaseId: string,
  documentId: string,
  originalFilename: string
): Promise<string> {
  const ext = extname(originalFilename);
  const dir = join(UPLOADS_DIR, organizationId, knowledgeBaseId);
  await mkdir(dir, { recursive: true });

  const filePath = join(dir, `${documentId}${ext}`);
  await writeFile(filePath, buffer);

  return filePath;
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
