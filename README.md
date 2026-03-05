# eml-to-html

Open an `.eml` file in your browser to get a rendered preview, a downloadable HTML file, or a PNG screenshot — no install, no sign-in, completely client-side.

## Features

- **Drag and Drop** (or click to select) any `.eml` file.
- **Detailed Headers**: Displays From, To, Cc, Subject, and Date.
- **Robust Rendering**: Uses a sandboxed iframe to safely display the email body.
- **Asset Inlining**: Automatically fetches and inlines external images and CSS into the exported HTML.
- **CORS Proxy Fallback**: If an image server blocks direct access (common with Substack or ConvertKit), the app automatically falls back to the [wsrv.nl](https://wsrv.nl) image proxy.
- **Dual Export**: Save as a standalone **HTML file** (with all assets embedded) or a **PNG image**.
- **Diagnostic Report**: View a summary of processed assets, including counts for inlined vs failed resources.
- **Session Reset**: Use the "Load Another" button to quickly process multiple emails without reloading the page.

## How it works

1. **Parsing**: The app parses the raw `.eml` structure in JavaScript, handling multipart/alternative and base64/quoted-printable encodings.
2. **Inlining**: Before export, it scans the HTML for external resources. It uses a concurrency-limited fetch queue (6 simultaneous requests) with automatic timeouts to prevent hanging.
3. **PNG Export**: Uses [html2canvas](https://html2canvas.hertzen.com/) to render the email. It automatically strips dark-mode media queries during export so the resulting image is always high-contrast and readable.

## How to run it

Since the app uses `fetch` and iframes, it must be served from an origin (not opened as a local `file://` path). Start a local static server from the repo root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Known limitation: WSL drag-and-drop

If you run your browser inside WSL2 and drag a file from Windows Explorer, the browser receives only a file path — not the file bytes. This is a browser security boundary.

**Workaround:** Click the drop zone to open the native file picker instead.

## Project structure

```
index.html    — entire app: markup, styles, and logic
biome.json    — Biome formatter/linter config
README.md     — you are here
```

## Tech

- **Vanilla JavaScript** — no build step, no frameworks.
- **Pico CSS** — for a lightweight, modern UI.
- **html2canvas** — loaded on demand for PNG generation.
