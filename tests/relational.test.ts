import { describe, it, expect } from "vitest"
import { applyRelationalDefaults } from "../src/relational"

describe("applyRelationalDefaults", () => {
  it("applies default when trigger field is present", () => {
    const { result } = applyRelationalDefaults(
      { limit: 50 },
      [{ ifPresent: "limit", thenDefault: { offset: 0 } }],
    )
    expect(result.offset).toBe(0)
  })

  it("does not override an existing value", () => {
    const { result } = applyRelationalDefaults(
      { limit: 50, offset: 10 },
      [{ ifPresent: "limit", thenDefault: { offset: 0 } }],
    )
    expect(result.offset).toBe(10)
  })

  it("does not apply when trigger field is absent", () => {
    const { result } = applyRelationalDefaults(
      { path: "foo.txt" },
      [{ ifPresent: "limit", thenDefault: { offset: 0 } }],
    )
    expect(result.offset).toBeUndefined()
  })

  it("tracks which defaults were applied", () => {
    const def = { ifPresent: "limit", thenDefault: { offset: 0 } }
    const { applied } = applyRelationalDefaults({ limit: 50 }, [def])
    expect(applied).toContain(def)
  })

  it("does not track a default if thenDefault fields were all already present", () => {
    const def = { ifPresent: "limit", thenDefault: { offset: 0 } }
    const { applied } = applyRelationalDefaults({ limit: 50, offset: 10 }, [def])
    expect(applied).not.toContain(def)
  })

  it("applies multiple independent defaults", () => {
    const { result } = applyRelationalDefaults(
      { limit: 50 },
      [
        { ifPresent: "limit", thenDefault: { offset: 0 } },
        { ifPresent: "limit", thenDefault: { encoding: "utf-8" } },
      ],
    )
    expect(result.offset).toBe(0)
    expect(result.encoding).toBe("utf-8")
  })
})
