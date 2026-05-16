import { z } from "zod"

export interface RelationalDefault {
  ifPresent: string
  thenDefault: Record<string, unknown>
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
}

export interface BaseDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type ToolAdapter<TDef> = (base: BaseDefinition) => TDef

// Unwraps markdown auto-links that bleed through from chat prior:
//   "[notes.md](http://notes.md)" → "notes.md"
export const pathString = () =>
  z.string().transform((val) => {
    const match = val.match(/^\[.*?\]\((.*?)\)$/)
    return match ? match[1] : val
  })
