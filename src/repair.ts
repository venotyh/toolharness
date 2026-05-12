import { ZodError, ZodObject, ZodRawShape } from "zod"

export type RepairType = "stringify_parse" | "string_to_array" | "null_drop" | "object_to_array"

function getAtPath(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string | number, unknown>)[key]
  }
  return cur
}

function setAtPath(obj: unknown, path: (string | number)[], value: unknown): void {
  let cur: unknown = obj
  for (const key of path.slice(0, -1)) {
    if (cur == null || typeof cur !== "object") return
    cur = (cur as Record<string | number, unknown>)[key]
  }
  const last = path[path.length - 1]
  if (cur != null && typeof cur === "object") {
    ;(cur as Record<string | number, unknown>)[last] = value
  }
}

function deleteAtPath(obj: unknown, path: (string | number)[]): void {
  let cur: unknown = obj
  for (const key of path.slice(0, -1)) {
    if (cur == null || typeof cur !== "object") return
    cur = (cur as Record<string | number, unknown>)[key]
  }
  const last = path[path.length - 1]
  if (cur != null && typeof cur === "object") {
    delete (cur as Record<string | number, unknown>)[last]
  }
}

function isOptionalField(schema: ZodObject<ZodRawShape>, path: (string | number)[]): boolean {
  if (path.length !== 1 || typeof path[0] !== "string") return false
  return schema.shape[path[0]]?.isOptional() ?? false
}

export function repair(
  args: Record<string, unknown>,
  error: ZodError,
  schema: ZodObject<ZodRawShape>,
): { repaired: Record<string, unknown>; repairs: RepairType[] } {
  const repaired = structuredClone(args) as Record<string, unknown>
  const repairs: RepairType[] = []

  for (const issue of error.issues) {
    if (issue.path.length === 0) continue

    const value = getAtPath(repaired, issue.path)

    // #2: stringified JSON array — must run before #4
    if (issue.code === "invalid_type" && issue.expected === "array" && typeof value === "string") {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          setAtPath(repaired, issue.path, parsed)
          repairs.push("stringify_parse")
          continue
        }
      } catch {
        // not valid JSON, fall through to #4
      }
    }

    // #4: bare string where array expected
    if (issue.code === "invalid_type" && issue.expected === "array" && typeof value === "string") {
      setAtPath(repaired, issue.path, [value])
      repairs.push("string_to_array")
      continue
    }

    // #1: null for optional field only — dropping null from a required field just
    // changes the error from "wrong type" to "missing required", no net benefit
    if (value === null && isOptionalField(schema, issue.path)) {
      deleteAtPath(repaired, issue.path)
      repairs.push("null_drop")
      continue
    }

    // #3: single object where array expected
    if (
      issue.code === "invalid_type" &&
      issue.expected === "array" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      setAtPath(repaired, issue.path, [value])
      repairs.push("object_to_array")
      continue
    }
  }

  return { repaired, repairs }
}
