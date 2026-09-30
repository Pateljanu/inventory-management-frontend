import { config } from "./config"
import type { ApiErrorBody, PageMeta } from "@/types/api"

/*
 * Thin fetch wrapper for the Metal Scrap API:
 *  - unwraps the { success, data, meta } envelope,
 *  - turns every failure into an ApiError with the server's stable `code` and `details`,
 *  - attaches the Bearer access token and, on an expired token, refreshes once and retries.
 * Token storage and refresh live in auth/session.ts, which registers itself here.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: ApiErrorBody["details"]
  readonly requestId?: string

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = "ApiError"
    this.status = status
    this.code = body.code
    this.details = body.details
    this.requestId = body.requestId
  }

  /** Field problems from a 422 VALIDATION_ERROR, keyed by path ("body.quantityTons"). */
  get issues() {
    return this.details?.issues ?? []
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

type Query = Record<string, string | number | boolean | null | undefined | readonly string[]>

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  query?: Query
  body?: unknown
  signal?: AbortSignal
  /** false for login/refresh/logout, which must not send or refresh the access token. */
  auth?: boolean
}

export type ApiResult<T> = { data: T; meta?: PageMeta }

type AuthBridge = {
  getAccessToken: () => string | null
  /** Refreshes the session; resolves true when a new access token is available. */
  refresh: () => Promise<boolean>
  onUnauthenticated: () => void
}

let auth: AuthBridge | null = null
export function registerAuthBridge(bridge: AuthBridge) {
  auth = bridge
}

/** Builds "?a=1&b=x", skipping empty values; arrays become comma-separated lists. */
export function toQueryString(query?: Query): string {
  if (!query) return ""
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","))
    } else {
      params.set(key, String(value))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ""
}

const EXPIRED_CODES = new Set(["TOKEN_EXPIRED", "UNAUTHENTICATED"])

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(`${config.apiBaseUrl}${path}${toQueryString(opts.query)}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      message: "Could not reach the server. Check the internet connection and try again.",
    })
  }
}

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  let json: unknown = null
  const text = await response.text()
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  const body = json as { success?: boolean; data?: T; meta?: PageMeta; error?: ApiErrorBody } | null

  if (response.ok && body?.success) return { data: body.data as T, meta: body.meta }

  if (body?.error?.code) throw new ApiError(response.status, body.error)
  throw new ApiError(response.status, {
    code:
      response.status === 429
        ? "TOO_MANY_REQUESTS"
        : response.status >= 500
          ? "INTERNAL_ERROR"
          : "UNEXPECTED_RESPONSE",
    message:
      response.status >= 500
        ? "The server had a problem. Try again."
        : `Unexpected response (${response.status})`,
    requestId: response.headers.get("x-request-id") ?? undefined,
  })
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  const useAuth = opts.auth !== false
  const token = useAuth ? (auth?.getAccessToken() ?? null) : null
  let response = await send(path, opts, token)

  if (response.status === 401 && useAuth && auth) {
    const body = await response
      .clone()
      .json()
      .catch(() => null)
    if (EXPIRED_CODES.has(body?.error?.code)) {
      if (await auth.refresh()) {
        response = await send(path, opts, auth.getAccessToken())
      }
      if (response.status === 401) auth.onUnauthenticated()
    }
  }
  return parse<T>(response)
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
}
