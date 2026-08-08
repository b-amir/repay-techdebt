import { openIdentity } from "./identity.js";
export function requireAccess(level: string) {
  return openIdentity(level);
}
