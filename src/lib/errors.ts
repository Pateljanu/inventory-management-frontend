import { isApiError } from "./api-client"

/*
 * Plain-language copy for the backend's stable error codes. Messages say what happened and
 * what to do, without "invalid", "please", "sorry" or "oops". Screens that can do better
 * (the delivery form uses the numbers in error.details) handle their codes before falling
 * back to this dictionary.
 */
const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "Could not reach the server. Check the internet connection and try again.",
  INVALID_CREDENTIALS: "The email or password is not right. Check both and try again.",
  TOO_MANY_REQUESTS: "Too many attempts in a short time. Wait a minute and try again.",
  TOKEN_EXPIRED: "Your session has ended. Log in again to continue.",
  UNAUTHENTICATED: "Your session has ended. Log in again to continue.",
  INVALID_REFRESH_TOKEN: "Your session has ended. Log in again to continue.",
  FORBIDDEN: "Your account can view records but cannot change them. Ask the owner to make this change.",
  VALIDATION_ERROR: "Some details need fixing. Check the highlighted fields.",
  DUPLICATE_VALUE: "A record with the same name or number already exists.",
  INTERNAL_ERROR: "The server had a problem and nothing was saved. Try again in a moment.",
  NOT_FOUND: "This record no longer exists. It may have been removed.",
  COMPANY_NOT_FOUND: "This company no longer exists.",
  MATERIAL_NOT_FOUND: "This material no longer exists.",
  PURCHASE_NOT_FOUND: "This purchase no longer exists.",
  PO_NOT_FOUND: "This sales order no longer exists.",
  SALE_NOT_FOUND: "This delivery no longer exists.",
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (isApiError(error)) return MESSAGES[error.code] ?? error.message ?? fallback
  if (error instanceof Error && error.name === "AbortError") return fallback
  return fallback
}

/** A copyable reference is shown only for server faults, where support needs it. */
export function errorReference(error: unknown): string | undefined {
  if (isApiError(error) && (error.status >= 500 || error.status === 0)) return error.requestId
  return undefined
}
