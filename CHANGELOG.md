# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Tests for `pathString()` — plain passthrough, markdown auto-link stripping, empty string, and partial bracket patterns
- Test for `tool_relational_defaults_applied` log event in `wrap()`
- Test for array `rawInput` rejection in `wrap()`
- Test that a clean valid call emits no log events
- Test for `repair()` when a valid-JSON-but-non-array string falls through from `stringify_parse` to `string_to_array`
- Test for `repair()` repairing multiple fields in a single call
- Test documenting that `null_drop` does not apply to nested paths (`isOptionalField` is shallow-only)

## [0.1.0] — 2026-05-16

### Added
- `wrap()` — main entry point producing an `Anthropic.Tool` definition and a hardened `execute` function
- Four shape repairs: `null_drop`, `stringify_parse`, `object_to_array`, `string_to_array`
- `applyRelationalDefaults()` — inject co-dependent field defaults before validation
- `pathString()` — Zod helper that strips markdown auto-links from path fields
- Structured logging via optional `Logger` interface (`tool_input_repaired`, `tool_input_invalid`, `tool_relational_defaults_applied`)
- CJS + ESM dual build via tsup
