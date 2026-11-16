#!/usr/bin/env node
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  parseSession,
  validateSession,
  formatSession,
  logPathForSession,
  resolveDay,
} from "./core/model.js";
import { createGitStore } from "./stores/git.js";
import { createService } from "./core/service.js";

/**
 * Validates a session file path.
 *
 * @param {string} filePath File path to check.
 * @returns {Promise<boolean>} True if valid.
 */
async function validateSessionFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const session = parseSession(text);
    const { ok, errors } = validateSession(session);
    if (!ok) {
      console.error(`Validation error in ${filePath}:`, errors.join(", "));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return false;
  }
}

/**
 * Installs git hooks into .git/hooks.
 *
 * @param {string} rootDir Repository root.
 */
async function installHooks(rootDir) {
  const hooksDir = path.join(rootDir, ".git", "hooks");
  await fs.mkdir(hooksDir, { recursive: true });

  const preCommitPath = path.join(hooksDir, "pre-commit");
  const preCommitScript = `#!/bin/sh\nnode src/cli.js hook-pre-commit\n`;
  await fs.writeFile(preCommitPath, preCommitScript, { mode: 0o755 });

  const prePushPath = path.join(hooksDir, "pre-push");
  const prePushScript = `#!/bin/sh\nnode src/cli.js hook-pre-push "$@"\n`;
  await fs.writeFile(prePushPath, prePushScript, { mode: 0o755 });

  console.log("Git hooks installed in .git/hooks/");
}

/**
 * Pre-commit hook handler.
 *
 * @param {string} rootDir Repository root.
 */
async function hookPreCommit(rootDir) {
  const sessionPath = path.join(rootDir, "data", "session.txt");
  try {
    await fs.access(sessionPath);
    const ok = await validateSessionFile(sessionPath);
    if (!ok) process.exit(1);
  } catch {
    // No active session file, continue
  }
}

/**
 * Pre-push hook handler guarding against pushing private data to public remotes.
 *
 * @param {string[]} args Hook CLI arguments.
 */
async function hookPrePush(args) {
  const remote = args[0] || "";
  const remoteUrl = args[1] || "";

  const isPublicGitHub =
    remote.includes("github") ||
    remoteUrl.includes("github.com") ||
    remoteUrl.includes("github-lilfeelz");

  if (isPublicGitHub) {
    // Check if data/ or .clasp.json is tracked in commits being pushed
    try {
      const gitDiff = execFileSync("git", ["diff", "--name-only", "HEAD~1"], {
        encoding: "utf8",
      });
      if (gitDiff.includes("data/") || gitDiff.includes(".clasp.json")) {
        console.error(
          "BLOCKED: Attempting to push private data/ or .clasp.json directly to GitHub!",
        );
        console.error(
          "Use `bash scripts/mirror.sh` to filter private data before pushing to public remotes.",
        );
        process.exit(1);
      }
    } catch {
      // Git diff failed, continue safely
    }
  }
}

/**
 * Starts a local HTTP server for the web interface.
 *
 * @param {number} port HTTP port.
 * @param {string} rootDir Repository root.
 */
async function serve(port = 3000, rootDir = process.cwd()) {
  const dataDir = path.join(rootDir, "data");
  const store = createGitStore({ fs, dir: dataDir });
  const service = createService({ store });

  const uiDir = path.join(rootDir, "src", "ui");

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // API Routes
    if (
      url.pathname === "/api/load" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      if (req.method === "HEAD") {
        res.writeHead(200);
        res.end();
        return;
      }
      const day = url.searchParams.get("day") || undefined;
      const data = await service.load(day);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }

    if (url.pathname === "/api/start" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { day } = JSON.parse(body || "{}");
          const session = await service.start(day);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(session));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/stop" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { session } = JSON.parse(body || "{}");
          const stopped = await service.stop(session);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(stopped));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/save" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { session } = JSON.parse(body || "{}");
          // Rehydrate dates
          session.startAt = new Date(session.startAt);
          if (session.endAt) session.endAt = new Date(session.endAt);
          const result = await service.save(session);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Static Files
    let filePath = path.join(
      uiDir,
      url.pathname === "/" ? "index.html" : url.pathname,
    );
    // Fallback to sample or root for module imports
    if (
      url.pathname.startsWith("/stores/") ||
      url.pathname.startsWith("/core/")
    ) {
      filePath = path.join(rootDir, "src", url.pathname);
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const ext = path.extname(filePath);
        const types = {
          ".html": "text/html",
          ".css": "text/css",
          ".js": "application/javascript",
          ".json": "application/json",
          ".svg": "image/svg+xml",
        };
        const content = await fs.readFile(filePath);
        res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
        res.end(content);
        return;
      }
    } catch {
      // Not found
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(port, () => {
    console.log(`Swole server running at http://localhost:${port}`);
  });
}

/**
 * Main CLI entry point.
 */
async function main() {
  const [, , cmd, ...rest] = process.argv;
  const rootDir = process.cwd();

  switch (cmd) {
    case "install-hooks":
      await installHooks(rootDir);
      break;

    case "hook-pre-commit":
      await hookPreCommit(rootDir);
      break;

    case "hook-pre-push":
      await hookPrePush(rest);
      break;

    case "start": {
      const day = resolveDay(rest[0] || "");
      const sessionPath = path.join(rootDir, "data", "session.txt");
      const session = {
        day,
        startAt: new Date(),
        entries: [],
      };
      await fs.writeFile(sessionPath, formatSession(session), "utf8");
      console.log(
        `Started session for ${day} at ${session.startAt.toISOString()}`,
      );
      break;
    }

    case "stop": {
      const sessionPath = path.join(rootDir, "data", "session.txt");
      const text = await fs.readFile(sessionPath, "utf8");
      const session = parseSession(text);
      session.endAt = new Date();
      await fs.writeFile(sessionPath, formatSession(session), "utf8");
      console.log(
        `Stopped session for ${session.day} at ${session.endAt.toISOString()}`,
      );
      break;
    }

    case "save": {
      const sessionPath = path.join(rootDir, "data", "session.txt");
      const text = await fs.readFile(sessionPath, "utf8");
      const session = parseSession(text);
      session.endAt = session.endAt || new Date();
      const { ok, errors } = validateSession(session);
      if (!ok) {
        console.error("Session validation failed:", errors.join(", "));
        process.exit(1);
      }
      const logDir = path.join(rootDir, "data", "log");
      const targetPath = logPathForSession(session, logDir);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, formatSession(session), "utf8");
      await fs.unlink(sessionPath);
      console.log(`Saved session to ${targetPath}`);
      break;
    }

    case "serve": {
      const port = Number(rest[0]) || 3000;
      await serve(port, rootDir);
      break;
    }

    default:
      console.log(`Usage: swole <command>
Commands:
  serve [port]       Run local workout server (default: 3000)
  start [day]        Start a workout session
  stop               Record stop timestamp
  save               Archive active session to data/log/
  install-hooks      Install pre-commit and pre-push git hooks
`);
      break;
  }
}

if (process.argv[1] && process.argv[1].endsWith("cli.js")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
