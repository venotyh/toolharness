import type { RelationalDefault } from "./types"

export function applyRelationalDefaults(
  args: Record<string, unknown>,
  defaults: RelationalDefault[],
): { result: Record<string, unknown>; applied: RelationalDefault[] } {
  const result = { ...args }
  const applied: RelationalDefault[] = []

  for (const def of defaults) {
    if (result[def.ifPresent] !== undefined) {
      let anyApplied = false
      for (const [key, value] of Object.entries(def.thenDefault)) {
        if (result[key] === undefined) {
          result[key] = value
          anyApplied = true
        }
      }
      if (anyApplied) applied.push(def)
    }
  }

  return { result, applied }
}
