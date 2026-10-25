# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Coding Agent Orchestrator - a standalone macOS application built with Bun that provides a visual interface for managing and orchestrating multiple AI coding agents (Claude Code, OpenAI Codex) with intelligent prompt enhancement via local Ollama models.

## Build Commands

```bash
# Install dependencies
bun install

# Development (serves on http://localhost:3000)
bun run dev

# Type check
bun run typecheck

# Production build (creates standalone executable)
bun run build
# Output: dist/ai-orchestrator (57MB, includes Bun runtime)

# Run standalone
./dist/ai-orchestrator
```

## Architecture

**Technology Stack:**
- Runtime: Bun (compiled to standalone executable)
- Backend: Bun.serve() with WebSocket for real-time updates
- Frontend: Vanilla HTML/CSS/JavaScript (embedded in executable)
- LLM Integration: Ollama local API (http://localhost:11434)
- Process Management: Bun.spawn() for background terminal execution

**Key Components:**
1. **Agent Detector** (`src/server/detector.ts`) - Scans for `claude` and `codex` CLI tools, validates Ollama availability
2. **Task Queue Manager** (`src/server/queue.ts`) - Manages task ordering with folder-level locking (same folder = sequential, different folders = parallel)
3. **Ollama Prompt Enhancer** (`src/server/ollama.ts`) - Expands minimal prompts into detailed instructions using local LLM
4. **Task Execution Engine** (`src/server/executor.ts`) - Spawns agent processes, captures real-time output via WebSocket
5. **WebSocket Handler** (`src/server/websocket.ts`) - Real-time communication between server and UI

**Execution Rules:**
- Tasks in different folders can run in parallel
- Tasks in the same folder must run sequentially (folder-level locking)

## External CLI Commands

The app orchestrates these external tools:

```bash
# Claude Code (run from target directory with -p for non-interactive)
claude --version
claude -p "<prompt>"  # Run from target folder with cwd set

# OpenAI Codex (use exec command with -C for directory)
codex --version
codex exec -C "<path>" "<prompt>"

# Ollama
curl http://localhost:11434/api/tags     # List models
curl http://localhost:11434/api/generate # Generate text
```

## Security Model

Hopper is a local, single-user tool:

- The server binds to localhost only (port 3000) and has no authentication; it is not exposed to the network
- Tasks are spawned via `Bun.spawn()` with argv arrays (no shell), so prompts are passed as arguments, not shell input — do not change this to string-based shell commands
- The user chooses the working folder for each task; paths are not validated and there is no approved-directory restriction (Claude Code runs with the folder as cwd; Codex receives it via `-C`)
- API keys are managed by the agent CLIs via environment variables, never stored in the app
