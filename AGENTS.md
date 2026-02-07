# Editor Group Grid - AI Agent Instructions

## Overview

VSCode extension that controls editor groups with "focus if exists, create if not" behavior.
Each shortcut (Ctrl+1–4) records the `viewColumn` of the group it created, then uses
`workbench.action.focusNthEditorGroup` to directly focus that group by its identifier.

Single source file: `src/extension.ts` → compiled to `out/extension.js`.

## Project Structure

```
editor-group-grid/
├── package.json       # Extension manifest (commands, keybindings, scripts)
├── pnpm-lock.yaml     # pnpm lock file
├── mise.toml          # Toolchain: node@25.6.0, pnpm@10.28.2
├── tsconfig.json      # TypeScript: target ES2020, module commonjs, strict: true
├── src/
│   └── extension.ts   # All extension logic (single file)
├── out/
│   └── extension.js   # Compiled output (main entry point)
└── node_modules/
```

## Build / Dev Commands

```bash
pnpm install           # Install dependencies
pnpm run compile       # Build (tsc -p ./)
pnpm run watch         # Watch mode (tsc -watch -p ./)
```

- No linter, formatter, or test framework is configured.
- No bundler — raw `tsc` output is used directly.
- Always run `pnpm run compile` after code changes to verify.

## Architecture

### Commands & Keybindings

| Command ID                         | Key      | Behavior                               |
| ---------------------------------- | -------- | -------------------------------------- |
| `editorGroupGrid.focusTopLeft`     | `Ctrl+1` | Focus first group (ViewColumn.One)     |
| `editorGroupGrid.focusBottomLeft`  | `Ctrl+2` | Focus/create bottom-left group         |
| `editorGroupGrid.focusTopRight`    | `Ctrl+3` | Focus/create top-right group           |
| `editorGroupGrid.focusBottomRight` | `Ctrl+4` | Focus/create bottom-right group        |

### Identifier-Based Focus

- `slotMap: Map<SlotName, ViewColumn>` records which `viewColumn` each shortcut created.
- On shortcut press: if the recorded group exists → `focusNthEditorGroup` directly.
- If not → create appropriate layout, detect new `viewColumn` via before/after diff, record it.
- `onDidChangeTabGroups` cleans up `slotMap` when groups are closed.

### ViewColumn Remapping

`setEditorLayout` reassigns `viewColumn` values in depth-first order, which can silently
move existing groups to different indices. To handle this:

1. Before layout change: `snapshotSlots()` saves tab-content fingerprints (file URIs) per slot.
2. After layout change: `remapSlotsByFingerprint()` matches fingerprints to find each
   group's new `viewColumn` and updates `slotMap`.
3. New groups (not matched by any fingerprint) are returned by `changeLayout()` for assignment.

### Layout Progression

```
1 group  →  Ctrl+2: vertical 2-split    |  Ctrl+3: horizontal 2-split
2 groups →  Ctrl+2: left-split 3-pane   |  Ctrl+3: top-split 3-pane
3 groups →  Ctrl+4: 2x2 grid
```

### Key APIs

- `vscode.commands.executeCommand('vscode.getEditorLayout')` / `vscode.setEditorLayout`
- `vscode.window.tabGroups.all` — enumerate groups by `viewColumn`
- `workbench.action.focusFirstEditorGroup` through `focusEighthEditorGroup`

## Code Style Guidelines

### TypeScript

- **Strict mode**: `tsconfig.json` has `"strict": true`. All code must pass strict checks.
- **Target**: ES2020. Use ES2020 features (optional chaining, nullish coalescing, etc.).

### Formatting

- **Indentation**: 2 spaces (no tabs).
- **Quotes**: Single quotes for all strings.
- **Semicolons**: Always.
- **Trailing commas**: Always in multi-line constructs (objects, arrays, function args).
- **Braces**: Opening brace on same line (`function foo() {`).
- **Arrow functions**: Always parenthesize parameters (`(x) =>`, not `x =>`).

### Naming Conventions

| Kind                | Convention  | Examples                                        |
| ------------------- | ----------- | ----------------------------------------------- |
| Functions           | camelCase   | `groupExists`, `getEditorLayout`, `tryFocusSlot`|
| Variables/constants | camelCase   | `slotMap`, `focusCommands`, `newCols`            |
| Interfaces          | PascalCase  | `EditorGroupLayout`                             |
| Type aliases        | PascalCase  | `SlotName`                                      |

- Prefix getters with `get` (`get2x2Layout`, `getEditorLayout`).
- Prefix setters with `set` (`setEditorLayout`).
- Prefix boolean-returning functions with verbs (`groupExists`, `tryFocusSlot`).
- Prefix idempotent init functions with `ensure` (`ensureTopLeftRegistered`).
- No `UPPER_SNAKE_CASE` — even module-level constants use camelCase.

### Type Annotations

- **Explicit return types** on all standalone functions (not on inline callbacks).
- Use `interface` for object shapes, `type` for unions.
- Use `Record<K, V>` for typed dictionaries, `Map<K, V>` for stateful storage.
- Use `Set<T>` for membership testing.
- Minimize type assertions (`as`); use `'key' in obj` for type narrowing.

### Error Handling

- **No `throw`** — errors are handled gracefully with fallback values.
- Bare `catch` blocks (no error variable): `catch { return undefined; }`.
- Guard clauses with early returns over nested conditionals.

### Async Patterns

- `async/await` exclusively — no `.then()` chains.
- `Promise<void>` for side-effect-only async functions.
- `new Promise((resolve) => setTimeout(resolve, N))` for timing delays.

### Imports

- Namespace import: `import * as vscode from 'vscode';`.
- Single dependency only (`vscode`). No runtime dependencies.

### Comments

- **Language**: Japanese for all comments and documentation.
- **JSDoc** (`/** ... */`) for function-level documentation (no `@param`/`@returns` tags).
- **Section separators**: `// --- セクション名 ---` to group related code.
- **Inline comments**: Brief Japanese explanations for non-obvious logic.

### Module Organization (top to bottom)

1. Imports
2. File-level JSDoc
3. Type / interface definitions
4. Module-level constants (`slotMap`, `focusCommands`)
5. Utility functions
6. Layout definition functions (with `// --- レイアウト定義 ---`)
7. Layout operation functions (with `// --- レイアウト操作 ---`)
8. `export function activate()` (command registrations)
9. `export function deactivate()`

### Other Patterns

- `const` by default; `let` only for reassigned variables; never `var`.
- `for...of` loops preferred over `.forEach()`.
- Named exports only (`export function`); no default exports.
- Keep `package.json` commands/keybindings in sync with `extension.ts`.
- `deactivate()` is an empty function (no cleanup needed).
- Disposables registered via `context.subscriptions.push(...)` in a single call.

## Dependencies

- **devDependencies**: `@types/vscode` ^1.74.0, `typescript` ^5.0.0
- **engines**: `vscode` ^1.74.0. **No runtime dependencies**.

## Troubleshooting

1. Check symlink: `ls -la ~/.vscode/extensions/editor-group-grid`
2. Check build output: `ls out/extension.js`
3. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
4. Check commands registered: `Ctrl+Shift+P` → type "Grid:"
5. Check dev console: `Ctrl+Shift+P` → "Developer: Toggle Developer Tools"
6. Check keybinding conflicts: `Ctrl+Shift+P` → "Preferences: Open Keyboard Shortcuts"

