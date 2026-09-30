import type { Role, User } from "@/types/api"

/*
 * OWNER can read and write; VIEWER can only read. Write controls are hidden (not disabled)
 * for VIEWERs, and the server still answers 403 if a write slips through.
 */
export type Action = "read" | "write"

const ALLOWED: Record<Role, Action[]> = {
  OWNER: ["read", "write"],
  VIEWER: ["read"],
}

export function can(user: Pick<User, "role"> | null | undefined, action: Action): boolean {
  if (!user) return false
  return ALLOWED[user.role]?.includes(action) ?? false
}

export const ROLE_LABELS: Record<Role, string> = { OWNER: "Owner", VIEWER: "View only" }
