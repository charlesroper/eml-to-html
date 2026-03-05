#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(SCRIPT_FILE), "..");
const FIXTURES_DIR = path.join(ROOT_DIR, "fixtures");
const SERVER_PORT = process.env.SERVER_PORT || "8000";
const BASE_URL = `http://localhost:${SERVER_PORT}`;
const SERVER_LOG =
  process.env.SERVER_LOG || path.join(os.tmpdir(), "eml-to-html-serve.log");
const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";
const UVX_BIN = process.platform === "win32" ? "uvx.exe" : "uvx";

let serverProcess = null;

function log(message) {
  process.stdout.write(`[rodney-smoke] ${message}\n`);
}

function toPosixRelativePath(filePath, baseDir) {
  const rel = path.relative(baseDir, filePath);
  return rel.split(path.sep).join("/");
}

function toFetchPath(filePath) {
  const rel = toPosixRelativePath(filePath, ROOT_DIR);
  return `/${rel
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function runCommand(command, args, options = {}) {
  const { cwd = ROOT_DIR, allowFailure = false } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0 || allowFailure) {
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }

      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      reject(
        new Error(`Command failed (${command} ${args.join(" ")}): ${output}`),
      );
    });
  });
}

async function runBrowserJs(expression) {
  const result = await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "js",
    expression,
  ]);
  return result.stdout;
}

async function installDownloadInterceptor() {
  const hookScript = `(async () => {
    window.__rodneySmokeDownloads = window.__rodneySmokeDownloads || [];
    if (window.__rodneySmokeDownloadHookInstalled) {
      return "already-installed";
    }

    if (typeof window.triggerBlobDownload !== "function") {
      throw new Error("triggerBlobDownload is not available");
    }

    const original = window.triggerBlobDownload;
    window.triggerBlobDownload = async function patchedTriggerBlobDownload(blob, filename) {
      let signature = "";
      try {
        const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        signature = Array.from(bytes)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        signature = "";
      }

      window.__rodneySmokeDownloads.push({
        filename: filename || "",
        size: Number(blob?.size || 0),
        type: String(blob?.type || ""),
        signature,
      });

      return original.call(this, blob, filename);
    };

    window.__rodneySmokeDownloadHookInstalled = true;
    return "installed";
  })()`;

  await runBrowserJs(hookScript);
}

async function getDownloadCount() {
  const countRaw = await runBrowserJs(
    "window.__rodneySmokeDownloads?.length ?? 0",
  );
  return Number.parseInt(countRaw, 10) || 0;
}

async function waitForDownloadCount(expectedCount) {
  const attempts = 25;
  for (let idx = 0; idx < attempts; idx += 1) {
    const count = await getDownloadCount();
    if (count >= expectedCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Expected at least ${expectedCount} captured download(s)`);
}

async function getLastDownloadMeta() {
  const raw = await runBrowserJs(
    "JSON.stringify((window.__rodneySmokeDownloads || []).at(-1) || null)",
  );
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function listFixtureFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFixtureFiles(fullPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && /\.eml$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

async function discoverFixtures() {
  try {
    const stat = await fs.stat(FIXTURES_DIR);
    if (!stat.isDirectory()) {
      throw new Error(`${FIXTURES_DIR} is not a directory`);
    }
  } catch {
    throw new Error(
      "Missing fixtures directory. Create `fixtures/` and add one or more .eml files (kept untracked).",
    );
  }

  const fixtures = await listFixtureFiles(FIXTURES_DIR);
  if (fixtures.length === 0) {
    throw new Error(
      "No .eml fixtures found in `fixtures/`. Add one or more local .eml files there and re-run.",
    );
  }

  return fixtures;
}

async function startServer() {
  log(`Starting static server on port ${SERVER_PORT}`);
  const logStream = createWriteStream(SERVER_LOG, { flags: "a" });
  serverProcess = spawn(NPX_BIN, ["serve", ".", "-p", SERVER_PORT], {
    cwd: ROOT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout.pipe(logStream);
  serverProcess.stderr.pipe(logStream);

  await new Promise((resolve) => setTimeout(resolve, 800));
}

async function stopServer() {
  if (!serverProcess) {
    return;
  }

  const proc = serverProcess;
  serverProcess = null;

  if (proc.killed) {
    return;
  }

  proc.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (!proc.killed) {
    proc.kill("SIGKILL");
  }
}

async function cleanup() {
  await runCommand(UVX_BIN, ["rodney", "--local", "stop"], {
    allowFailure: true,
  });
  await stopServer();
}

async function waitForApp() {
  const attempts = 25;
  for (let i = 0; i < attempts; i += 1) {
    const openResult = await runCommand(
      UVX_BIN,
      ["rodney", "--local", "open", BASE_URL],
      { allowFailure: true },
    );
    if (openResult.code === 0) {
      await runCommand(UVX_BIN, ["rodney", "--local", "waitload"]);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Unable to open ${BASE_URL} after 25 attempts`);
}

async function assertLoadedState() {
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    '!document.getElementById("email-content").classList.contains("hidden")',
  ]);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.getElementById("error-msg").classList.contains("hidden")',
  ]);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.querySelector("#email-body iframe, #email-body pre") !== null',
  ]);
}

async function resetAndAssertHidden() {
  await runCommand(UVX_BIN, ["rodney", "--local", "click", "#reset-btn"]);
  await runCommand(UVX_BIN, ["rodney", "--local", "waitstable"]);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.getElementById("email-content").classList.contains("hidden")',
  ]);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.getElementById("error-msg").classList.contains("hidden")',
  ]);
}

async function simulateDropUpload(fixturePath) {
  const fetchPath = toFetchPath(fixturePath);
  const fixtureName = path.basename(fixturePath);
  const dropScript = `(async () => {
    const response = await fetch(${JSON.stringify(fetchPath)});
    const blob = await response.blob();
    const file = new File([blob], ${JSON.stringify(fixtureName)}, { type: "message/rfc822" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const event = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
    document.getElementById("drop-zone").dispatchEvent(event);
    return "drop-dispatched";
  })()`;

  await runCommand(UVX_BIN, ["rodney", "--local", "js", dropScript]);
  await runCommand(UVX_BIN, ["rodney", "--local", "waitstable"]);
  await assertLoadedState();
}

async function run() {
  const fixtures = await discoverFixtures();
  log(`Found ${fixtures.length} fixture(s) in fixtures/`);

  await startServer();

  log("Starting Rodney local browser session");
  await runCommand(UVX_BIN, ["rodney", "start", "--local"]);

  log(`Opening ${BASE_URL}`);
  await waitForApp();
  await installDownloadInterceptor();

  for (const fixturePath of fixtures) {
    const label = toPosixRelativePath(fixturePath, ROOT_DIR);
    log(`Uploading fixture via #file-input: ${label}`);
    await runCommand(UVX_BIN, [
      "rodney",
      "--local",
      "file",
      "#file-input",
      fixturePath,
    ]);
    await runCommand(UVX_BIN, ["rodney", "--local", "waitstable"]);
    await assertLoadedState();
    await resetAndAssertHidden();
  }

  log("Running synthetic drag-and-drop upload check");
  await simulateDropUpload(fixtures[0]);

  log("Validating Download HTML flow");
  const htmlDownloadsBefore = await getDownloadCount();
  await runCommand(UVX_BIN, ["rodney", "--local", "click", "#download-btn"]);
  await runCommand(UVX_BIN, ["rodney", "--local", "waitstable"]);
  await waitForDownloadCount(htmlDownloadsBefore + 1);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.getElementById("processing-indicator").classList.contains("hidden")',
  ]);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.getElementById("error-msg").classList.contains("hidden")',
  ]);
  const htmlDownload = await getLastDownloadMeta();
  if (!htmlDownload || !htmlDownload.filename.toLowerCase().endsWith(".html")) {
    throw new Error("HTML download was not captured with a .html filename");
  }
  if (htmlDownload.type !== "text/html") {
    throw new Error(
      `HTML download type mismatch: expected text/html, got ${htmlDownload.type}`,
    );
  }
  if (htmlDownload.size < 200) {
    throw new Error(
      `HTML download is unexpectedly small (${htmlDownload.size} bytes)`,
    );
  }

  log("Validating Download PNG flow");
  const pngDownloadsBefore = await getDownloadCount();
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "click",
    "#download-png-btn",
  ]);
  await runCommand(UVX_BIN, ["rodney", "--local", "waitstable"]);
  await runCommand(UVX_BIN, ["rodney", "--local", "sleep", "3"]);
  await waitForDownloadCount(pngDownloadsBefore + 1);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.getElementById("processing-indicator").classList.contains("hidden")',
  ]);
  await runCommand(UVX_BIN, [
    "rodney",
    "--local",
    "assert",
    'document.getElementById("error-msg").classList.contains("hidden")',
  ]);
  const pngDownload = await getLastDownloadMeta();
  if (!pngDownload || !pngDownload.filename.toLowerCase().endsWith(".png")) {
    throw new Error("PNG download was not captured with a .png filename");
  }
  if (pngDownload.type !== "image/png") {
    throw new Error(
      `PNG download type mismatch: expected image/png, got ${pngDownload.type}`,
    );
  }
  if (pngDownload.signature !== "89504e470d0a1a0a") {
    throw new Error(
      `PNG signature mismatch: got ${pngDownload.signature || "<empty>"}`,
    );
  }
  if (pngDownload.size < 1024) {
    throw new Error(
      `PNG download is unexpectedly small (${pngDownload.size} bytes)`,
    );
  }

  log("Smoke test completed successfully");
}

try {
  await run();
} catch (error) {
  process.stderr.write(`[rodney-smoke] ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
