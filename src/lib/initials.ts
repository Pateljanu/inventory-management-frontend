/** "Rajesh Patel" -> "RP"; falls back to the email ("meena.shah@x.in" -> "MS"). */
export function initials(user: { name?: string; email: string }): string {
  const source = user.name?.trim() || user.email
  const words = source.split(/[\s@._-]+/).filter(Boolean)
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?"
}
