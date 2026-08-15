import { createHash } from "node:crypto";

export function stableOperationId(callId: string): string {
  return createHash("sha256").update(callId).digest("hex");
}
