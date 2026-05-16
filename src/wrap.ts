import { z, ZodObject, ZodRawShape } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { repair } from "./repair"
import { applyRelationalDefaults } from "./relational"
import type { RelationalDefault, Logger, BaseDefinition, ToolAdapter } from "./types"
import { anthropicAdapter, type AnthropicToolDefinition } from "./adapters"

export interface WrapOptions<S extends ZodObject<ZodRawShape>> {
  name: string
  description: string
  schema: S
  execute: (input: z.infer<S>) => Promise<unknown>
  relationalDefaults?: RelationalDefault[]
  logger?: Logger
}

export interface WrappedTool<TDef> {
  definition: TDef
  execute: (rawInput: unknown) => Promise<unknown>
}

export function wrap<S extends ZodObject<ZodRawShape>>(
  options: WrapOptions<S> & { adapter?: undefined }
): WrappedTool<AnthropicToolDefinition>

export function wrap<S extends ZodObject<ZodRawShape>, TDef>(
  options: WrapOptions<S> & { adapter: ToolAdapter<TDef> }
): WrappedTool<TDef>

export function wrap<S extends ZodObject<ZodRawShape>, TDef = AnthropicToolDefinition>(
  options: WrapOptions<S> & { adapter?: ToolAdapter<TDef> }
): WrappedTool<TDef> {
  const { name, description, schema, execute, relationalDefaults = [], logger, adapter } = options

  const { $schema: _$schema, ...inputSchema } = zodToJsonSchema(schema) as Record<string, unknown>

  const base: BaseDefinition = { name, description, inputSchema }
  const resolvedAdapter = (adapter ?? anthropicAdapter) as ToolAdapter<TDef>
  const definition = resolvedAdapter(base)

  async function executeWrapped(rawInput: unknown): Promise<unknown> {
    if (rawInput == null || typeof rawInput !== "object" || Array.isArray(rawInput)) {
      return `Input for "${name}" must be an object. Received: ${typeof rawInput}. Retry with a valid JSON object.`
    }

    const args = rawInput as Record<string, unknown>
    const { result: withDefaults, applied } = applyRelationalDefaults(args, relationalDefaults)

    if (applied.length > 0) {
      logger?.info("tool_relational_defaults_applied", {
        tool: name,
        defaults: applied.map((d) => ({ ifPresent: d.ifPresent, thenDefault: d.thenDefault })),
      })
    }

    const first = schema.safeParse(withDefaults)
    if (first.success) {
      return execute(first.data)
    }

    const { repaired, repairs } = repair(withDefaults, first.error, schema)
    const second = schema.safeParse(repaired)

    if (second.success) {
      logger?.info("tool_input_repaired", { tool: name, repairs })
      return execute(second.data)
    }

    logger?.warn("tool_input_invalid", {
      tool: name,
      issues: second.error.issues.map((i) => ({ path: i.path, message: i.message })),
    })

    return formatFailureMessage(name, second.error)
  }

  return { definition, execute: executeWrapped }
}

function formatFailureMessage(tool: string, error: z.ZodError): string {
  const lines = error.issues.map((i) => {
    const path = i.path.length > 0 ? i.path.join(".") : "(root)"
    return `  - ${path}: ${i.message}`
  })
  return [
    `Input for "${tool}" could not be parsed after repair attempts.`,
    `Issues:`,
    ...lines,
    `Retry with corrected input.`,
  ].join("\n")
}
