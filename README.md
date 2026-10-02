# Hopper: AI Coding Agent Orchestrator

An experimental Bun application for queuing local coding-agent tasks and
optionally expanding prompts through Ollama. It has an implemented browser UI
and server; the original planning documents are design history, not a claim that
every proposed capability is complete.

## Implemented source

- [`src/main.ts`](src/main.ts) embeds static frontend assets and handles WebSockets.
- [`src/server/detector.ts`](src/server/detector.ts) detects installed agent CLIs
  and local Ollama availability.
- [`src/server/queue.ts`](src/server/queue.ts) holds tasks in memory and applies
  folder-string locks: tasks for distinct folders can run concurrently.
- [`src/server/executor.ts`](src/server/executor.ts) launches Claude/Codex commands
  and streams stdout/stderr to the UI.
- [`src/server/ollama.ts`](src/server/ollama.ts) expands prompts using the local
  server at `http://localhost:11434`.
- [`src/frontend`](src/frontend) contains the plain HTML/CSS/JavaScript interface.

Persistent task history, tray integration, a native folder-permission picker,
approved-root enforcement and verified cross-platform packaging are not supplied
by those modules. Different spellings/symlinks of the same folder are not a
filesystem isolation boundary.

## Original local workflow

Use Bun (candidate tested on1.4.2) and Node.js for the TypeScript checker.
Run from the repository root:

```sh
bun install --frozen-lockfile
bun run dev
```

The app uses port 3000 and opens a browser automatically on macOS. Agent execution
requires the corresponding existing CLI installation/configuration; prompt
enhancement requires an installed Ollama model. No app-specific `.env` variables
configure the port or Ollama URL in the current source. Child processes inherit
the host environment and their installed CLI permissions. Creating a task can
immediately invoke an external coding agent; merely previewing the UI is not a
reason to submit a task. Stop the server with Ctrl+C.

`bun run build` compiles to `dist/ai-orchestrator` on the build host. The original
`bun run start` script uses a POSIX executable path. The 2026-10-02 candidate passed a frozen install, strict TypeScript check,
five transport tests and standalone Windows compilation with Bun 1.4.2. The
Windows output is `dist/ai-orchestrator.exe`; it was not launched. No real
agent/provider or cross-platform release packaging was verified.

## Current trust boundary

The server binds to `127.0.0.1` and accepts only local `localhost`/`127.0.0.1`
Host values on its actual port. Foreign/null origins and cross-site browser
requests are rejected before routing; WebSocket controls require a matching
browser Origin and GET. Reverse proxies, LAN hosting and cross-origin embeds are
not supported by this local-only boundary.

This is not application authentication or an agent sandbox. Trusted local
processes can supply matching headers; the coding agent still inherits its
installed permissions and can act in the folder the user submits. Process
arguments are passed as an array, but no approved-root enforcement or native
permission isolation is implemented. Keep it off untrusted networks and review
all agent tasks before submitting them.

## Verification and contributions

Transport regressions in [`src/main.test.ts`](src/main.test.ts) exercise the real
loopback HTTP listener and WebSocket handshake, hostile Host/Origin rejection
and read-only static methods. Use `bun run check`, `bun test` and `bun run build`;
the candidate CI performs these checks with read-only repository permissions and
has no deployment step. Queue ordering/process lifecycle and full UI/accessibility
flows are not covered by those transport tests. Stub external CLIs and inference
rather than invoking paid/live agents. Read [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md),
keep source maps and tested commands current, and include actual test/build
evidence with code changes. The original [planning prompt](planning-prompt.md)
remains available as historical intent.

The original README declares MIT; a standalone `LICENSE` file has not yet been
committed. Preserve that intent and any upstream provenance.
