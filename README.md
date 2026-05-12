# toolharness

Runtime repair layer for Anthropic tool-calling failures.

LLM tool-call failures are overwhelmingly a harness problem, not a model capability problem. This library sits between the model's raw output and your tool implementation: it validates input with Zod, attempts a small set of well-known shape repairs, and returns a model-readable error string when repair is not possible.

## Install

```sh
npm install toolharness
# peer dependencies
npm install zod @anthropic-ai/sdk
```

## Usage

```typescript
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { wrap, pathString } from "toolharness"

const readFile = wrap({
  name: "read_file",
  description: "Read the contents of a file",
  schema: z.object({
    path: pathString(),           // unwraps markdown auto-links
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  execute: async ({ path, limit, offset }) => {
    // your implementation
  },
  relationalDefaults: [
    { ifPresent: "limit", thenDefault: { offset: 0 } },
  ],
  logger: console,
})

// Pass definition to Anthropic
const response = await client.messages.create({
  model: "claude-opus-4-7",
  tools: [readFile.definition],
  messages: [...],
})

// Handle tool_use blocks
for (const block of response.content) {
  if (block.type === "tool_use" && block.name === "read_file") {
    const result = await readFile.execute(block.input)
    // result is your tool's return value, or a model-readable error string
  }
}
```

## What it repairs

Four shape errors cover ~90% of tool-call failures across open models:

| # | Failure | Example | Repair |
|---|---------|---------|--------|
| 2 | JSON array emitted as string | `"[\"a\",\"b\"]"` | parse stringified JSON |
| 4 | Bare string where array expected | `"foo"` | wrap to `["foo"]` |
| 1 | `null` for optional field | `{ limit: null }` | drop the key |
| 3 | Single object where array expected | `{ id: 1 }` | wrap to `[{ id: 1 }]` |

Repairs run in the order shown (#2 before #4 so stringified arrays are parsed, not re-wrapped). Valid inputs are never touched.

## API

### `wrap(options)`

```typescript
wrap({
  name: string
  description: string
  schema: ZodObject           // Zod schema; input_schema is derived from this
  execute: (input) => Promise<unknown>
  relationalDefaults?: Array<{ ifPresent: string; thenDefault: Record<string, unknown> }>
  logger?: { info(...): void; warn(...): void }  // optional; pino, winston, console, etc.
}): {
  definition: Anthropic.Tool  // pass to client.messages.create tools array
  execute: (rawInput: unknown) => Promise<unknown>
}
```

On unrecoverable failure, `execute` returns a model-readable string (no `Error:` prefix) so the model can self-correct and retry.

### `pathString()`

A Zod type that unwraps markdown auto-links before validation:

```
"[notes.md](http://notes.md)"  →  "notes.md"
```

Use it for any field that accepts a file path.

## Logging

Pass any logger with `.info()` and `.warn()` methods. Two events are emitted:

| Event | Level | When |
|-------|-------|------|
| `tool_input_repaired` | info | repair succeeded; includes `{ tool, repairs }` |
| `tool_input_invalid` | warn | unrecoverable; includes `{ tool, issues }` |
| `tool_relational_defaults_applied` | info | defaults were injected; includes `{ tool, defaults }` |
