import { requireAccess } from "../../security/access-gate.js";
export function listRecords(level: string) {
  requireAccess(level);
  return [];
}
