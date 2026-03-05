# eml-to-html

Open an `.eml` file in your browser to get a rendered preview, a downloadable HTML file, or a PNG screenshot — no install, no sign-in, runs entirely in your browser.

## Features

- **Drag and Drop** (or click to select) any `.eml` file.
- **Detailed Headers**: Displays From, To, Cc, Subject, and Date.
- **Robust Rendering**: Uses an isolated preview frame to safely display the email body.
- **Asset Inlining**: Automatically fetches and inlines external images and CSS into the exported HTML.
- **CORS Proxy Fallback**: If an image server blocks direct access (common with Substack or ConvertKit), the app automatically falls back to the [wsrv.nl](https://wsrv.nl) image proxy.
- **Dual Export**: Save as a standalone **HTML file** (with all assets embedded) or a **PNG image**.
- **Diagnostic Report**: View a summary of processed assets, including counts for inlined vs failed resources.
- **Session Reset**: Use the "Load Another" button to quickly process multiple emails without reloading the page.

## How it works

1. **Parsing**: The app parses the raw `.eml` structure in JavaScript, handling common email MIME structures and encodings.
2. **Inlining**: Before export, it scans the HTML for external resources. It limits simultaneous downloads to keep exports reliable.
3. **PNG Export**: Uses [html2canvas](https://html2canvas.hertzen.com/) to render the email. It automatically strips dark-mode media queries during export so the resulting image is always high-contrast and readable.

## How to run it

You cannot open the HTML file directly in your browser (the `file://` scheme blocks some features). Instead, serve it locally and open via `http://localhost:8000`. Start a local server from the project folder:

```bash
npx serve . -p 8000
```

Then open `http://localhost:8000` in your browser.

## Smoke testing (agents / CLI)

Run the smoke test:

```bash
node scripts/rodney-smoke.mjs
```

The test automatically discovers `.eml` files in `fixtures/`. These files are not tracked by Git, so fixtures stay local.

Optional shell script (Linux/macOS):

```bash
./scripts/rodney-smoke.sh
```

## Known limitation: WSL drag-and-drop

If you run your browser inside Windows Subsystem for Linux (WSL2) and drag a file from Windows Explorer, the browser receives only a file path — not the file bytes. This is a browser security limitation.

**Workaround:** Click the drop zone to open the native file picker instead.

## Project structure

```
index.html      — entire app: markup, styles, and logic
fixtures/       — local .eml test files (git-ignored)
scripts/        — automation and smoke test runners
biome.json      — Biome formatter/linter config
AGENTS.md       — guidance for AI coding agents
README.md       — you are here
```

- **fixtures/** — place `.eml` files here to test locally.
- **scripts/** — contains the Rodney smoke test runner.

## Tech

- **Vanilla JavaScript** — no build step, no frameworks.
- **Pico CSS** — for a lightweight, modern UI.
- **html2canvas** — loaded on demand for PNG generation.
- **Rodney** — used for automated browser smoke testing and UI verification.
- **Biome** — provides high-performance formatting and linting.
- **Node.js** — used for local serving and test orchestration.
