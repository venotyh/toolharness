import { describe, it, expect, vi } from "vitest"
import { z } from "zod"
import { wrap } from "../src/wrap"
import { openaiAdapter } from "../src/adapters"

const schema = z.object({
  path: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  tags: z.array(z.string()).optional(),
})

describe("wrap", () => {
  it("produces an Anthropic-compatible tool definition", () => {
    const tool = wrap({ name: "readFile", description: "reads a file", schema, execute: async () => "ok" })
    expect(tool.definition.name).toBe("readFile")
    expect(tool.definition.description).toBe("reads a file")
    expect(tool.definition.input_schema.type).toBe("object")
  })

  it("calls execute with valid input unchanged", async () => {
    const execute = vi.fn().mockResolvedValue("ok")
    const tool = wrap({ name: "readFile", description: "", schema, execute })
    await tool.execute({ path: "foo.txt", limit: 10 })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ path: "foo.txt", limit: 10 }))
  })

  it("repairs a stringified array and calls execute", async () => {
    const execute = vi.fn().mockResolvedValue("ok")
    const tool = wrap({ name: "readFile", description: "", schema, execute })
    await tool.execute({ path: "foo.txt", tags: '["a","b"]' })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ tags: ["a", "b"] }))
  })

  it("drops null on an optional field and calls execute", async () => {
    const execute = vi.fn().mockResolvedValue("ok")
    const tool = wrap({ name: "readFile", description: "", schema, execute })
    await tool.execute({ path: "foo.txt", limit: null })
    const call = execute.mock.calls[0][0] as Record<string, unknown>
    expect(call.path).toBe("foo.txt")
    expect(call).not.toHaveProperty("limit")
  })

  it("applies relational defaults before validation", async () => {
    const execute = vi.fn().mockResolvedValue("ok")
    const tool = wrap({
      name: "readFile",
      description: "",
      schema,
      execute,
      relationalDefaults: [{ ifPresent: "limit", thenDefault: { offset: 0 } }],
    })
    await tool.execute({ path: "foo.txt", limit: 50 })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }))
  })

  it("returns a model-readable string on unrecoverable failure", async () => {
    const execute = vi.fn()
    const tool = wrap({ name: "readFile", description: "", schema, execute })
    const result = await tool.execute({ limit: 10 }) // path required, missing
    expect(typeof result).toBe("string")
    expect(result as string).toContain("readFile")
    expect(result as string).toContain("Retry")
    expect(execute).not.toHaveBeenCalled()
  })

  it("returns a model-readable string when rawInput is not an object", async () => {
    const execute = vi.fn()
    const tool = wrap({ name: "readFile", description: "", schema, execute })
    const result = await tool.execute("bad input")
    expect(typeof result).toBe("string")
    expect(execute).not.toHaveBeenCalled()
  })

  it("logs tool_input_repaired when a repair succeeds", async () => {
    const logger = { info: vi.fn(), warn: vi.fn() }
    const tool = wrap({ name: "readFile", description: "", schema, execute: async () => "ok", logger })
    await tool.execute({ path: "foo.txt", tags: '["a"]' })
    expect(logger.info).toHaveBeenCalledWith(
      "tool_input_repaired",
      expect.objectContaining({ tool: "readFile" }),
    )
  })

  it("logs tool_input_invalid on unrecoverable failure", async () => {
    const logger = { info: vi.fn(), warn: vi.fn() }
    const tool = wrap({ name: "readFile", description: "", schema, execute: async () => "ok", logger })
    await tool.execute({ limit: 10 })
    expect(logger.warn).toHaveBeenCalledWith(
      "tool_input_invalid",
      expect.objectContaining({ tool: "readFile" }),
    )
  })

  it("logs tool_relational_defaults_applied when a default is injected", async () => {
    const logger = { info: vi.fn(), warn: vi.fn() }
    const tool = wrap({
      name: "readFile",
      description: "",
      schema,
      execute: async () => "ok",
      logger,
      relationalDefaults: [{ ifPresent: "limit", thenDefault: { offset: 0 } }],
    })
    await tool.execute({ path: "foo.txt", limit: 50 })
    expect(logger.info).toHaveBeenCalledWith(
      "tool_relational_defaults_applied",
      expect.objectContaining({ tool: "readFile" }),
    )
  })

  it("returns a model-readable string when rawInput is an array", async () => {
    const execute = vi.fn()
    const tool = wrap({ name: "readFile", description: "", schema, execute })
    const result = await tool.execute(["foo.txt"])
    expect(typeof result).toBe("string")
    expect(execute).not.toHaveBeenCalled()
  })

  it("does not log on a clean valid call", async () => {
    const logger = { info: vi.fn(), warn: vi.fn() }
    const tool = wrap({ name: "readFile", description: "", schema, execute: async () => "ok", logger })
    await tool.execute({ path: "foo.txt" })
    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })
})

describe("wrap with openaiAdapter", () => {
  it("produces an OpenAI-compatible tool definition", () => {
    const tool = wrap({ name: "readFile", description: "reads a file", schema, execute: async () => "ok", adapter: openaiAdapter })
    expect(tool.definition.type).toBe("function")
    expect(tool.definition.function.name).toBe("readFile")
    expect(tool.definition.function.description).toBe("reads a file")
    expect(tool.definition.function.parameters.type).toBe("object")
  })

  it("still repairs input and calls execute correctly", async () => {
    const execute = vi.fn().mockResolvedValue("ok")
    const tool = wrap({ name: "readFile", description: "", schema, execute, adapter: openaiAdapter })
    await tool.execute({ path: "foo.txt", tags: '["a","b"]' })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ tags: ["a", "b"] }))
  })

  it("returns model-readable error on failure", async () => {
    const execute = vi.fn()
    const tool = wrap({ name: "readFile", description: "", schema, execute, adapter: openaiAdapter })
    const result = await tool.execute({ limit: 10 })
    expect(typeof result).toBe("string")
    expect(result as string).toContain("readFile")
    expect(execute).not.toHaveBeenCalled()
  })
})
