# AGENTS.md

Guidance for coding agents working in this repository.

## 1) Repository Overview

- Project type: static single-page web app.
- Runtime model: client-side only (no backend).
- Current entrypoint: `index.html`.
- Primary purpose: open `.eml`, parse it in browser, preview rendered email, and export HTML.
- Dependency model: no package manager setup currently; Pico CSS is loaded from CDN.

## 2) Source of Truth / Rules

- Checked for Cursor rules: `.cursor/rules/` and `.cursorrules`.
- Checked for Copilot rules: `.github/copilot-instructions.md`.
- Result: no Cursor/Copilot rule files are present right now.
- Therefore, this AGENTS.md is the operative local guidance.

## 3) Build, Lint, Test, and Run Commands

This repo currently has no `package.json`, no build system, and no test runner configured.

### Run locally

- Start static server from repo root:
  - `python3 -m http.server 8000`
- Open app:
  - `http://localhost:8000`

### Build

- Build step: none (static HTML file).
- Distribution artifact: `index.html` itself.

### Lint

- [Biome](https://biomejs.dev) is the configured formatter and linter for the project (`biome.json`).
- If a temporary lint check is needed, use the Biome format/check loop below.

### Agent-required format/check loop

- On every code change, agents must run this loop before finishing work:
  1. `npx --yes @biomejs/biome format index.html --write`
  2. `npx --yes @biomejs/biome check index.html`
  3. If check reports issues, fix them and repeat steps 1-2 until clean.
- Keep this loop scoped to changed files when possible; for the current repo that is typically `index.html`.

### Test

- No automated tests are currently configured.
- Primary validation is manual browser verification.

### Single-test equivalent (manual targeted check)

Use one focused verification at a time:

1. Launch server: `python3 -m http.server 8000`
2. Open app in browser.
3. Drag a known `.eml` fixture.
4. Confirm headers render.
5. Confirm preview shows rendered HTML in iframe (not raw tags).
6. Click **Download HTML** and open saved file.
7. Click **Download PNG** and confirm a valid image is generated.
8. Confirm downloaded files preserve body and tight header spacing.
9. Click **Load Another** and confirm the UI resets to original state.

### Optional ad-hoc checks

- Syntax sanity in browser devtools console.
- Confirm no uncaught exceptions during load/parse/download flows.
- Re-test with:
  - `text/plain` message
  - `text/html` message
  - multipart alternative message
  - upper-case extension (`.EML`)

## 4) Architecture and Editing Expectations

- Keep app single-file unless user asks for multi-file refactor.
- Preserve vanilla JS approach (no frameworks by default).
- Preserve Pico CSS usage via CDN unless user asks to vendor assets.
- Prefer minimal, targeted edits over broad rewrites.
- Avoid introducing bundlers/transpilers without explicit request.

## 5) JavaScript Style Guidelines

### Language level

- Use modern browser-safe JavaScript (ES2019+ style is fine).
- Prefer `const` by default; use `let` only when reassignment is required.
- Avoid `var`.

### Functions and structure

- Keep functions small and single-purpose.
- Prefer pure helpers for parsing/transforming content.
- Keep DOM wiring near top; helper utilities below.
- Avoid deeply nested conditionals; return early when possible.

### Naming conventions

- Variables/functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` only for true constants.
- DOM refs: descriptive nouns (`dropZone`, `fileInput`, `emailBody`).
- Booleans: `is/has/can/should` prefixes (`isHtml`, `hasBoundary`).

### Imports / dependencies

- Current project has no JS module imports.
- If adding modules later, keep imports grouped and deterministic.
- Do not add dependencies for trivial utilities.

### Types and data shapes

- No TypeScript currently.
- Use consistent object shapes for parser returns.
- Example preferred shape: `{ content: string, isHtml: boolean }`.
- Validate assumptions when reading MIME segments.

### Error handling

- Fail gracefully for invalid files or unsupported content.
- Surface user-facing errors in UI (`showError`) instead of alerts.
- Keep console errors for developer diagnostics (`console.error`).
- Avoid throwing uncaught errors from user actions.

### Security and safety

- Treat email HTML as untrusted input.
- Prefer iframe preview with sandbox for rendering HTML bodies.
- Escape text content before inserting with `innerHTML`.
- Do not enable script execution in previews unless explicitly requested.

### DOM and rendering

- Minimize `innerHTML` usage; escape when rendering plain text.
- For HTML preview, write to iframe `srcdoc`.
- Keep preview styles constrained and responsive.

### Formatting

- Use 2-space indentation in HTML/CSS/JS.
- Keep semicolon usage consistent (current code uses semicolons).
- Wrap long lines when readability drops.
- Preserve existing quote style unless changing nearby code requires consistency.

## 6) HTML/CSS Style Guidelines

- Keep markup semantic and lightweight.
- Reuse Pico primitives; avoid custom heavy component systems.
- Keep CSS scoped and simple.
- Favor CSS variables from Pico when available.
- Ensure mobile-friendly behavior (`meta viewport`, fluid widths).
- Keep preview container visually distinct (border/radius/min-height).

## 7) Feature-Specific Guidance (EML Parsing)

- Handle both file select and drag/drop paths consistently.
- File extension checks should be case-insensitive.
- Parse headers with folded-line support.
- For multipart, split headers/body at first blank line per part.
- Prefer HTML body over plain text when both exist.
- Keep plain-text fallback readable (`<pre>` with wrapping).
- Preserve downloaded HTML as standalone file.

## 8) Change Management for Agents

- Before major edits, read the full `index.html`.
- After edits, manually verify main user flows in browser.
- Do not remove existing behavior unless requested.
- Keep backwards-compatible UX text and controls where reasonable.
- If behavior changes, mention what changed and why.

## 9) When Adding Tooling (Only if Asked)

- Add `package.json` only on explicit request.
- Prefer lightweight defaults:
  - formatter: Prettier
  - linter: ESLint
  - test runner: Playwright (for UI flow) or Vitest (logic helpers)
- Include scripts for full and single-test execution if tooling is added.

## 10) Definition of Done (Current Repo)

- `.eml` can be opened by drag/drop and file picker.
- Parsed headers display correctly.
- HTML emails render as visual preview (iframe), not raw tags.
- Text emails render legibly.
- Downloaded HTML opens standalone and matches preview intent.
- PNG export works and correctly handles external assets via proxy fallback.
- "Load Another" button resets the view for subsequent processing.
- No new console errors introduced in normal flows.
