/** Only same-app paths are allowed after login, so a crafted link can't send users to another site. */
export function safeRedirect(value: string | undefined | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/"
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) return "/"
  return value
}
