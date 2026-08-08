import { requireAccess } from "../security/access-gate.js";
export async function adaptRequest(level: string, signal: AbortSignal) {
  requireAccess(level);
  const response = await Promise.resolve({ ok: !signal.aborted });
  if (signal.aborted) throw new Error("aborted");
  return response;
}
