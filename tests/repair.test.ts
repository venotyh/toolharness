import { describe, it, expect } from "vitest"
import { z } from "zod"
import { repair } from "../src/repair"

const schema = z.object({
  path: z.string(),
  tags: z.array(z.string()).optional(),
  items: z.array(z.object({ id: z.number() })).optional(),
  offset: z.number().optional(),
})

function parseError(input: unknown) {
  const result = schema.safeParse(input)
  if (result.success) throw new Error("expected parse failure")
  return result.error
}

describe("repair", () => {
  it("#2: parses stringified JSON array", () => {
    const error = parseError({ path: "f.txt", tags: '["a","b"]' })
    const { repaired, repairs } = repair({ path: "f.txt", tags: '["a","b"]' }, error, schema)
    expect(repaired.tags).toEqual(["a", "b"])
    expect(repairs).toContain("stringify_parse")
  })

  it("#4: wraps bare string to array", () => {
    const error = parseError({ path: "f.txt", tags: "foo" })
    const { repaired, repairs } = repair({ path: "f.txt", tags: "foo" }, error, schema)
    expect(repaired.tags).toEqual(["foo"])
    expect(repairs).toContain("string_to_array")
  })

  it("#1: drops null on optional field", () => {
    const error = parseError({ path: "f.txt", offset: null })
    const { repaired, repairs } = repair({ path: "f.txt", offset: null }, error, schema)
    expect(repaired).not.toHaveProperty("offset")
    expect(repairs).toContain("null_drop")
  })

  it("#1: does not drop null on required field", () => {
    const error = parseError({ path: null })
    const { repaired, repairs } = repair({ path: null }, error, schema)
    expect(repaired.path).toBeNull()
    expect(repairs).not.toContain("null_drop")
  })

  it("#3: wraps single object to array", () => {
    const error = parseError({ path: "f.txt", items: { id: 1 } })
    const { repaired, repairs } = repair({ path: "f.txt", items: { id: 1 } }, error, schema)
    expect(repaired.items).toEqual([{ id: 1 }])
    expect(repairs).toContain("object_to_array")
  })

  it("ordering: #2 runs before #4 — stringified array is parsed, not wrapped", () => {
    const error = parseError({ path: "f.txt", tags: '["a","b"]' })
    const { repaired, repairs } = repair({ path: "f.txt", tags: '["a","b"]' }, error, schema)
    expect(repaired.tags).toEqual(["a", "b"])
    expect(repairs).toContain("stringify_parse")
    expect(repairs).not.toContain("string_to_array")
  })

  it("does not touch fields that already pass validation", () => {
    const error = parseError({ path: "f.txt", tags: "foo", offset: null })
    const args = { path: "f.txt", tags: "foo", offset: null }
    const { repaired } = repair(args, error, schema)
    expect(repaired.path).toBe("f.txt")
  })
})
