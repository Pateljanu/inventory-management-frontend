import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, api, registerAuthBridge, toQueryString } from "./api-client"

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

afterEach(() => {
  vi.restoreAllMocks()
})

describe("toQueryString", () => {
  it("skips empty values and joins arrays", () => {
    expect(toQueryString({ a: 1, b: "", c: undefined, d: null, e: ["X", "Y"], f: false })).toBe(
      "?a=1&e=X%2CY&f=false"
    )
    expect(toQueryString({})).toBe("")
  })
})

describe("request", () => {
  it("unwraps the success envelope with page meta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(200, {
        success: true,
        data: [{ _id: "1" }],
        meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
      })
    )
    const result = await api.get<{ _id: string }[]>("/companies", { page: 1 })
    expect(result.data).toEqual([{ _id: "1" }])
    expect(result.meta?.total).toBe(1)
  })

  it("turns error envelopes into ApiError with code and details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(409, {
        success: false,
        error: {
          code: "PO_QUANTITY_EXCEEDED",
          message: "too much",
          details: { remaining: "5.750" },
          requestId: "r1",
        },
      })
    )
    const error = await api.post("/sales", {}).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: "PO_QUANTITY_EXCEEDED",
      details: { remaining: "5.750" },
    })
  })

  it("reports network failures as NETWORK_ERROR", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(api.get("/materials")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" })
  })

  it("refreshes once on an expired token and retries with the new token", async () => {
    let token = "old"
    const refresh = vi.fn(async () => {
      token = "new"
      return true
    })
    const onUnauthenticated = vi.fn()
    registerAuthBridge({ getAccessToken: () => token, refresh, onUnauthenticated })

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        json(401, { success: false, error: { code: "TOKEN_EXPIRED", message: "expired" } })
      )
      .mockResolvedValueOnce(json(200, { success: true, data: { ok: true } }))

    const result = await api.get<{ ok: boolean }>("/auth/me")
    expect(result.data.ok).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)
    const retryHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe("Bearer new")
    expect(onUnauthenticated).not.toHaveBeenCalled()
  })

  it("ends the session when refresh fails", async () => {
    const onUnauthenticated = vi.fn()
    registerAuthBridge({ getAccessToken: () => "old", refresh: async () => false, onUnauthenticated })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(401, { success: false, error: { code: "TOKEN_EXPIRED", message: "expired" } })
    )
    await expect(api.get("/auth/me")).rejects.toMatchObject({ status: 401 })
    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
  })
})
