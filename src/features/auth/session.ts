import { useSyncExternalStore } from "react"
import { isApiError, registerAuthBridge, request } from "@/lib/api-client"
import type { LoginResponse, RefreshResponse, User } from "@/types/api"

/*
 * Session model
 *  - Access token (15 min JWT): memory only, never persisted.
 *  - Refresh token (opaque, rotating, 7 days): localStorage, so a reload or a new tab stays
 *    signed in. The backend returns it in the JSON body (no cookie), so script-readable
 *    storage is the only option; a strict CSP and no third-party scripts keep XSS risk low.
 *  - Refresh is single-flight per tab and serialised across tabs with the Web Locks API; inside
 *    the lock the latest stored token is re-read, so a rotation by another tab is never reused.
 */

/**
 * "expired": the session ended while the app was open. The user and the screen stay as they
 * are (so typed work survives) and a dialog asks for the password again.
 */
export type SessionStatus = "loading" | "authenticated" | "expired" | "anonymous" | "unreachable"
export type EndReason = "expired" | "logout" | null

export type SessionState = {
  status: SessionStatus
  user: User | null
  endReason: EndReason
}

const RT_KEY = "metalix.rt"
const LOCK_NAME = "metalix-refresh"
/** Set just before a deliberate logout, so other tabs can tell it apart from an expiry. */
const LOGOUT_KEY = "metalix.logout-at"

let accessToken: string | null = null
let state: SessionState = { status: "loading", user: null, endReason: null }
const listeners = new Set<() => void>()

function setState(next: Partial<SessionState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(RT_KEY)
  } catch {
    return null
  }
}

function writeRefreshToken(value: string | null) {
  try {
    if (value) localStorage.setItem(RT_KEY, value)
    else localStorage.removeItem(RT_KEY)
  } catch {
    // Private mode or blocked storage: the session simply won't survive a reload.
  }
}

async function refreshUnderLock(): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    const token = readRefreshToken()
    if (!token) return false
    try {
      const { data } = await request<RefreshResponse>("/auth/refresh", {
        method: "POST",
        body: { refreshToken: token },
        auth: false,
      })
      accessToken = data.accessToken
      writeRefreshToken(data.refreshToken)
      return true
    } catch (error) {
      // Only a definite rejection ends the session; network trouble is rethrown so the caller
      // sees "offline" instead of being logged out.
      if (isApiError(error) && error.status === 401) {
        if (readRefreshToken() === token) writeRefreshToken(null)
        accessToken = null
        return false
      }
      throw error
    }
  }
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, run)
  }
  return run()
}

let refreshing: Promise<boolean> | null = null
export function refreshSession(): Promise<boolean> {
  refreshing ??= refreshUnderLock().finally(() => {
    refreshing = null
  })
  return refreshing
}

function endSession(reason: EndReason) {
  accessToken = null
  writeRefreshToken(null)
  initPromise = Promise.resolve()
  setState({ status: "anonymous", user: null, endReason: reason })
}

/** Keeps the user and the page; the re-login dialog takes over. */
function expireSession() {
  accessToken = null
  setState({ status: "expired", endReason: "expired" })
}

registerAuthBridge({
  getAccessToken: () => accessToken,
  refresh: refreshSession,
  onUnauthenticated: () => {
    if (state.status === "authenticated") expireSession()
  },
})

let initPromise: Promise<void> | null = null

/** Restores the session on app start (idempotent). */
export function initSession(): Promise<void> {
  initPromise ??= (async () => {
    if (!readRefreshToken()) {
      setState({ status: "anonymous", user: null })
      return
    }
    try {
      if (!(await refreshSession())) {
        setState({ status: "anonymous", user: null })
        return
      }
      const { data: user } = await request<User>("/auth/me")
      setState({ status: "authenticated", user, endReason: null })
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        endSession(null)
      } else {
        // Server unreachable: keep the stored token and let the user retry.
        initPromise = null
        setState({ status: "unreachable", user: null })
      }
    }
  })()
  return initPromise
}

export function retryInitSession() {
  initPromise = null
  setState({ status: "loading" })
  return initSession()
}

export async function login(email: string, password: string): Promise<User> {
  const { data } = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email: email.trim(), password },
    auth: false,
  })
  accessToken = data.accessToken
  writeRefreshToken(data.refreshToken)
  initPromise = Promise.resolve()
  setState({ status: "authenticated", user: data.user, endReason: null })
  return data.user
}

export async function logout(): Promise<void> {
  const token = readRefreshToken()
  try {
    localStorage.setItem(LOGOUT_KEY, String(Date.now()))
  } catch {
    // Other tabs will treat it as an expiry and ask for the password instead.
  }
  endSession("logout")
  if (token) {
    // Best effort: revoke the server-side session; the local session is already gone.
    await request("/auth/logout", { method: "POST", body: { refreshToken: token }, auth: false }).catch(
      () => undefined
    )
  }
}

export function getSession(): SessionState {
  return state
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

function loggedOutJustNow(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(LOGOUT_KEY) ?? 0) < 10_000
  } catch {
    return false
  }
}

// Across tabs: logging out in one tab logs out every tab; an expiry in one tab asks every tab
// for the password; logging back in from any tab resumes the others.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== RT_KEY) return
    if (event.newValue === null && (state.status === "authenticated" || state.status === "expired")) {
      if (loggedOutJustNow()) {
        accessToken = null
        initPromise = Promise.resolve()
        setState({ status: "anonymous", user: null, endReason: "logout" })
      } else if (state.status === "authenticated") {
        expireSession()
      }
    } else if (event.newValue && state.status === "expired") {
      void refreshSession()
        .then((ok) => {
          if (ok && state.status === "expired") setState({ status: "authenticated", endReason: null })
        })
        .catch(() => undefined)
    }
  })
}
