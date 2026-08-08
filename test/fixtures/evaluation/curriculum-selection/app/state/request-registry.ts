import { adaptRequest } from "../server/request-adapter.server.js";
const pending = new Map<string, AbortController>();
export async function send(scopeId: string) {
  const controller = new AbortController();
  pending.set(scopeId, controller);
  try {
    return await adaptRequest("allowed", controller.signal);
  } finally {
    pending.delete(scopeId);
  }
}
