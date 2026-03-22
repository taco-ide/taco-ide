import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);

const PANDOC_TIMEOUT = 30_000;

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{ text: string }> {
  const id = randomUUID();
  const tempInput = join(tmpdir(), `pandoc-${id}-${filename}`);
  const tempOutput = join(tmpdir(), `pandoc-${id}-output.txt`);

  try {
    await writeFile(tempInput, buffer);

    await execFileAsync("pandoc", [tempInput, "-t", "plain", "-o", tempOutput], {
      timeout: PANDOC_TIMEOUT,
    });

    const text = await readFile(tempOutput, "utf-8");

    return { text };
  } catch (err) {
    const stderr =
      err instanceof Error && "stderr" in err
        ? (err as { stderr: string }).stderr
        : String(err);

    throw new Error(`Pandoc conversion failed: ${stderr}`);
  } finally {
    await unlink(tempInput).catch(() => {});
    await unlink(tempOutput).catch(() => {});
  }
}
