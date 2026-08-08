import { canAccess } from "./policy.js";
export function openIdentity(level: string) {
  if (!canAccess(level)) throw new Error("forbidden");
  return { level, active: true };
}
