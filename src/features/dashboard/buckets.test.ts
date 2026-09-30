import { describe, expect, it } from "vitest"
import { bucketLabel } from "./buckets"

describe("bucketLabel", () => {
  it("labels days, weeks (within and across months) and months", () => {
    expect(bucketLabel("2026-09-28", "2026-09-28", "day")).toBe("28 Sep")
    expect(bucketLabel("2026-09-01", "2026-09-06", "week")).toBe("01–06 Sep")
    expect(bucketLabel("2026-09-28", "2026-10-04", "week")).toBe("28 Sep–04 Oct")
    expect(bucketLabel("2026-09-28", "2026-09-28", "week")).toBe("28 Sep")
    expect(bucketLabel("2026-04-15", "2026-04-30", "month")).toBe("Apr 2026")
  })
})
