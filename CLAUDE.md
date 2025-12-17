# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Coding Agent Orchestrator - a standalone macOS application built with Bun that provides a visual interface for managing and orchestrating multiple AI coding agents (Claude Code, OpenAI Codex) with intelligent prompt enhancement via local Ollama models.

## Build Commands

```bash
# Install dependencies
bun install

# Development with hot reload
bun run dev

# Production build (creates standalone executable)
bun run build
# Output: dist/ai-orchestrator-macos
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
# Claude Code
claude --version
claude --message "<prompt>" --folder "<path>"

# OpenAI Codex
codex --version
codex run --message "<prompt>" --cwd "<path>"

# Ollama
curl http://localhost:11434/api/tags    # List models
curl http://localhost:11434/api/generate # Generate text
```

## Security Requirements

- Validate all folder paths to prevent directory traversal
- Sanitize prompt inputs before passing to shell commands
- Only operate within user-approved directories
- API keys are managed via environment variables, never stored in app
