import { describe, expect, it, vi } from "vitest"
import { ApiError } from "./api-client"
import { applyServerErrors, collectErrors, fieldId } from "./form-errors"

type Form = { name: string; email: string; gstNumber: string }
const KNOWN = ["name", "email", "gstNumber"] as const

describe("applyServerErrors", () => {
  it("puts 422 issues under their fields and returns the rest as a form message", () => {
    const setError = vi.fn()
    const error = new ApiError(422, {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: {
        issues: [
          { path: "body.contact.email", message: "Invalid email" },
          { path: "body.name", message: "Too short" },
          { path: "body.unknown", message: "Something else" },
        ],
      },
    })
    const result = applyServerErrors<Form>(error, setError, KNOWN, { fieldMap: { "contact.email": "email" } })
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "Invalid email" })
    expect(setError).toHaveBeenCalledWith("name", { type: "server", message: "Too short" })
    expect(result.formMessage).toBe("Something else")
  })

  it("maps unique-index duplicates to the right field with custom copy", () => {
    const setError = vi.fn()
    const error = new ApiError(409, {
      code: "DUPLICATE_VALUE",
      message: "dup",
      details: { fields: ["normalizedName"] },
    })
    const result = applyServerErrors<Form>(error, setError, KNOWN, {
      fieldMap: { normalizedName: "name" },
      duplicateMessages: { name: "A company with this name already exists." },
    })
    expect(setError).toHaveBeenCalledWith("name", {
      type: "server",
      message: "A company with this name already exists.",
    })
    expect(result.formMessage).toBeNull()
  })

  it("puts a compound-key duplicate only on the field with custom copy", () => {
    const setError = vi.fn()
    const error = new ApiError(409, {
      code: "DUPLICATE_VALUE",
      message: "dup",
      details: { fields: ["companyId", "normalizedGst"] },
    })
    const result = applyServerErrors<Form>(error, setError, KNOWN, {
      fieldMap: { companyId: "name", normalizedGst: "gstNumber" },
      duplicateMessages: { gstNumber: "This GST number is already used." },
    })
    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith("gstNumber", {
      type: "server",
      message: "This GST number is already used.",
    })
    expect(result.formMessage).toBeNull()
  })

  it("falls back to plain-language copy for other failures", () => {
    const error = new ApiError(0, { code: "NETWORK_ERROR", message: "x" })
    expect(applyServerErrors<Form>(error, vi.fn(), KNOWN).formMessage).toMatch(/Could not reach the server/)
  })
})

describe("collectErrors", () => {
  it("lists errors in form order with linkable field ids", () => {
    const rows = collectErrors<Form>(
      { gstNumber: { type: "x", message: "Bad GST" }, name: { type: "x", message: "Enter a name" } },
      KNOWN
    )
    expect(rows).toEqual([
      { field: fieldId("name"), message: "Enter a name" },
      { field: fieldId("gstNumber"), message: "Bad GST" },
    ])
    expect(fieldId("contact.email")).toBe("field-contact-email")
  })
})
