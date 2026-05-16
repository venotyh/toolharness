import type { BaseDefinition, ToolAdapter } from "./types"

export interface AnthropicToolDefinition {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties?: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }
}

export interface OpenAIToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const anthropicAdapter: ToolAdapter<AnthropicToolDefinition> = (base: BaseDefinition) => ({
  name: base.name,
  description: base.description,
  input_schema: base.inputSchema as AnthropicToolDefinition["input_schema"],
})

export const openaiAdapter: ToolAdapter<OpenAIToolDefinition> = (base: BaseDefinition) => ({
  type: "function",
  function: {
    name: base.name,
    description: base.description,
    parameters: base.inputSchema,
  },
})
