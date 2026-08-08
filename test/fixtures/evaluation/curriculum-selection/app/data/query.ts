import { requireAccess } from "../security/access-gate.js";
export function dataQuery(level: string) {
  requireAccess(level);
  return [];
}
