import { describe, it, expect } from "vitest"
import { z } from "zod"
import { pathString } from "../src/types"

describe("pathString", () => {
  it("passes a plain string through unchanged", () => {
    const schema = z.object({ p: pathString() })
    const result = schema.parse({ p: "notes.md" })
    expect(result.p).toBe("notes.md")
  })

  it("strips markdown auto-link format", () => {
    const schema = z.object({ p: pathString() })
    const result = schema.parse({ p: "[notes.md](http://notes.md)" })
    expect(result.p).toBe("http://notes.md")
  })

  it("passes an empty string through unchanged", () => {
    const schema = z.object({ p: pathString() })
    const result = schema.parse({ p: "" })
    expect(result.p).toBe("")
  })

  it("does not transform a partial bracket pattern", () => {
    const schema = z.object({ p: pathString() })
    const result = schema.parse({ p: "[notes.md]" })
    expect(result.p).toBe("[notes.md]")
  })

  it("does not transform when only the paren half is present", () => {
    const schema = z.object({ p: pathString() })
    const result = schema.parse({ p: "(http://notes.md)" })
    expect(result.p).toBe("(http://notes.md)")
  })
})
