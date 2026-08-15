import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import type { MessageAttachment } from "./types";

const MAX_ATTACHMENTS = 3;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function loadImageAttachments(paths: string[]): Promise<MessageAttachment[]> {
  if (paths.length > MAX_ATTACHMENTS) {
    throw new Error(`MMS supports at most ${MAX_ATTACHMENTS} image attachments`);
  }

  let totalBytes = 0;
  const attachments: MessageAttachment[] = [];
  for (const path of paths) {
    const absolutePath = resolve(path);
    const contentType = contentTypes[extname(absolutePath).toLowerCase()];
    if (!contentType) throw new Error(`Unsupported image type: ${extname(absolutePath) || "none"}`);
    const file = await stat(absolutePath);
    if (!file.isFile()) throw new Error(`Attachment is not a file: ${absolutePath}`);
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("MMS image attachments exceed the 10 MiB total limit");
    }
    attachments.push({
      filename: basename(absolutePath),
      contentType,
      content: await readFile(absolutePath),
    });
  }
  return attachments;
}
