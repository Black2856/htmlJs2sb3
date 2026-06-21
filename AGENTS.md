# Repository Guidelines

## Project Structure & Module Organization

This repository implements a staged Scratch-compatible DSL foundation. Phases
0–5 are complete; Phase 6 (DSL → project.json, ZIP packaging, and re-import
into the official VM) is next.

- `src/`: TypeScript implementation.
  - `blocks/`: opcode metadata (P0 plus the Phase 5 P1 clone/procedure/pen/monitor opcodes).
  - `cast/`: Scratch-compatible value conversion.
  - `model/`: stable IDs, the Project/Target domain model, and the clone target.
  - `validation/`: project and block-graph validators.
  - `runtime/`: DOM-free scheduler, threads, block runner, primitives, and the clone/procedure/pen/monitor managers.
  - `render/`: renderer port (including the optional pen layer), Canvas 2D renderer, skins, and coordinates.
  - `input/`: input port, DOM input manager, and key normalization.
  - `assets/`: asset manager, md5, and asset reference validation.
  - `audio/`: audio ports, sound manager/bank/player, and the Web Audio adapter.
- `schemas/`: JSON Schema definitions, currently `project.schema.json`.
- `tests/fixtures/`: valid and intentionally invalid DSL projects.
- `tests/{validation,model,runtime,render,input}/`: DOM-free Node test suites.
- `tests/e2e/`: Playwright browser integration tests and their local harness.
- `docs/`: architecture, runtime, block, asset, SB3, and roadmap specifications.
- `scratch-editor/` and `scratch-audio/`: pinned upstream reference checkouts. Treat these as read-only research sources unless a task explicitly targets them.

Follow `docs/IMPLEMENTATION_ROADMAP.md`. Do not implement later phases unless
requested; one requested phase should remain one scoped change.

## Build, Test, and Development Commands

Node.js 22+ runs TypeScript through type stripping (no build step for the source itself). A root `package.json` was added in Phase 3 with Playwright/esbuild as the only devDependencies (`node_modules` is gitignored; run `npm install` first).

Unit tests (node:test, DOM-free):

```powershell
npm test
```

If PowerShell execution policy blocks `npm.ps1`, use `npm.cmd test`.

Run a syntax check over a file with:

```powershell
node --experimental-strip-types --check src/validation/projectValidator.ts
```

Browser integration tests (Playwright + esbuild bundle, Canvas/DOM only):

```powershell
npm run test:e2e
```

Use `npm.cmd run test:e2e` under the same PowerShell restriction. Relative ES
module imports must include the `.ts` extension.

Validate the JSON Schema and hand-written validator together when changing DSL
structure; they are dual-maintained and the schema is not loaded by the runtime
validator. The validation layer and Project model must remain independent of
DOM, Canvas, Web Audio, and ZIP libraries. Runtime may depend only on the
`RendererPort` (including its optional pen methods), `InputPort`, and
`RuntimeAudioPort` interfaces, never their Canvas/DOM/Web Audio
implementations.

## Coding Style & Naming Conventions

Use TypeScript, ES modules, four-space indentation, semicolons, and single quotes. Prefer explicit exported interfaces and pure functions. Use:

- `camelCase` for functions and variables.
- `PascalCase` for classes and interfaces.
- `UPPER_SNAKE_CASE` for immutable registries and constants.
- Diagnostic codes in dotted lowercase form, such as `block.reference-dangling`.

Every validation diagnostic must provide `path`, `entityId`, and `opcode`, using `null` when unavailable.

## Testing Guidelines

Use the built-in `node:test` framework and `node:assert/strict`. Add focused
tests for every validation rule and DOM-free behavior. Fixtures should be
constructed from `createMinimalProject()` and mutate only the property under
test. Required rejection coverage includes dangling references, duplicate IDs,
scope violations, graph cycles, malformed schema data, and unsupported
versions. Keep coordinate conversion and key normalization in Node tests; use
Playwright only for behavior requiring a real browser, Canvas, or DOM events.

## Commit & Pull Request Guidelines

History follows Conventional Commits, for example `feat: ...` and `refactor: ...`. Keep commits scoped and imperative.

Pull requests should include a concise summary, affected phase, test command and result, linked issue when applicable, and screenshots only for future visual changes. Call out schema or diagnostic compatibility changes explicitly.
