import { describe, expect, it } from "vitest"
import { pageWindow } from "./pagination"

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it("keeps first, last and neighbours with gaps", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20])
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, "gap", 20])
    expect(pageWindow(20, 20)).toEqual([1, "gap", 17, 18, 19, 20])
  })
})
