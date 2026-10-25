# Hopper — AI Coding Agent Orchestrator

A standalone macOS application built with Bun that provides a visual interface for managing and orchestrating multiple AI coding agents (Claude Code, OpenAI Codex) with intelligent prompt enhancement via local Ollama models.

## Overview

This application serves as a **visual control center** for AI-assisted development workflows, allowing developers to:

- **Queue and manage multiple coding tasks** across different projects
- **Enhance prompts** using local LLMs before sending to coding agents
- **Execute tasks in parallel** (when in different folders) or sequentially (same folder)
- **Monitor real-time terminal output** for each task in collapsible cards
- **Detect and version-check** installed coding agents automatically

## Core Architecture

### Technology Stack
- **Runtime:** Bun (with `--compile` for standalone executable)
- **Backend:** Bun.serve() with WebSocket support for real-time updates
- **Frontend:** Vanilla HTML/CSS/JavaScript (embedded in executable)
- **LLM Integration:** Ollama local API (http://localhost:11434)
- **Process Management:** Bun.spawn() for background terminal execution

### Key Components

1. **Agent Detector**
   - Scans system for `claude` and `codex` CLI tools
   - Reports installed versions
   - Validates Ollama availability and lists models

2. **Task Queue Manager**
   - Maintains ordered queue of pending tasks
   - Enforces folder-level locking (same folder = sequential)
   - Enables parallel execution across different folders
   - Handles task reordering (up/down buttons)

3. **Ollama Prompt Enhancer**
   - Accepts minimal user input
   - Uses selected Ollama model to expand into detailed prompt
   - Provides undo capability to revert enhancements
   - Understands context of different coding agents' prompt styles

4. **Task Execution Engine**
   - Spawns agent processes in specified folders
   - Captures stdout/stderr in real-time
   - Streams output to UI via WebSocket
   - Handles process lifecycle (start/stop/complete)

5. **UI Task Cards**
   - Display task metadata (folder, agent, prompt)
   - Show execution status (queued/running/complete/error)
   - Collapsible terminal output viewer
   - Controls for reordering and management

## User Workflow

### Minimal End-to-End Vector (MVP)

1. **Launch Application**
   - App detects installed agents: Claude Code, OpenAI Codex
   - Connects to Ollama and populates model dropdown
   - Displays version information for all detected tools

2. **Create Task**
   - Click "Add Task" button
   - Fill form:
     - **Folder:** Enter the project directory the agent should work in
     - **Agent:** Choose from detected agents (claude/codex)
     - **Prompt:** Enter minimal description
   - Click "Enhance" to use Ollama for prompt expansion
   - Review enhanced prompt (use "Undo" if needed)
   - Submit to add task to queue

3. **Manage Queue**
   - View all queued tasks as cards
   - Reorder with up/down buttons
   - Tasks in different folders execute in parallel
   - Tasks in same folder execute sequentially

4. **Monitor Execution**
   - Watch real-time status updates
   - Expand terminal output within each card
   - See completion status and any errors

## Technical Requirements

### Detected Agent Commands

**Claude Code:**
```bash
claude --version
claude -p "<prompt>"  # non-interactive; run with the task's folder as the working directory
```

**OpenAI Codex:**
```bash
codex --version
codex exec -C "<path>" "<prompt>"
```

**Ollama:**
```bash
ollama --version
curl http://localhost:11434/api/tags  # List models
curl http://localhost:11434/api/generate  # Generate text
```

### Folder Selection

The user provides a folder path for each task when creating it. There is no
OS permission prompt and no stored list of approved paths: the folder is used
directly as the agent's working directory (Claude Code runs with the folder
as its cwd; Codex receives it via `-C`). Only point tasks at folders you trust
the selected agent to work in.

### Folder-Based Execution Rules

**Parallel Execution:**
```
Task A: /Users/ben/project-one (running)
Task B: /Users/ben/project-two (running)  ← Parallel OK
```

**Sequential Execution:**
```
Task A: /Users/ben/project-one (running)
Task B: /Users/ben/project-one (queued)   ← Must wait for Task A
```

### Prompt Enhancement Flow

**Input (minimal):**
```
fix the login bug
```

**Ollama Enhancement (using llama3.2):**
```
Analyze the authentication flow in this project and identify the root cause 
of login failures. The bug likely involves session management, token validation, 
or password hashing. Please:

1. Review authentication-related files (auth.js, login.tsx, middleware)
2. Check for common issues: expired tokens, CORS problems, bcrypt mismatches
3. Examine error logs for relevant stack traces
4. Propose a fix with updated code
5. Add unit tests to prevent regression

Provide a detailed explanation of the issue and the solution.
```

**Undo:** Reverts to original "fix the login bug"

## Build & Distribution

### Development
```bash
bun install
bun run dev  # Starts local server with hot reload
```

### Production Build
```bash
bun run build  # Creates standalone executable
# Output: dist/ai-orchestrator
```

### Running Standalone
```bash
./dist/ai-orchestrator
# Opens browser to http://localhost:3000
# App runs in background with system tray icon (future enhancement)
```

## File Structure

```
hopper/
├── src/
│   ├── main.ts                 # Entry point, starts server
│   ├── server/
│   │   ├── detector.ts         # Agent & Ollama detection
│   │   ├── queue.ts            # Task queue management
│   │   ├── executor.ts         # Process spawning & monitoring
│   │   ├── ollama.ts           # Ollama API client
│   │   └── websocket.ts        # Real-time communication
│   ├── frontend/
│   │   ├── index.html          # Main UI
│   │   ├── app.js              # Frontend logic
│   │   └── styles.css          # Styling
│   └── types.ts                # Shared TypeScript interfaces
├── docs/
│   └── planning-prompt.md      # Original design & planning prompt
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

## Data Models

### Task
```typescript
interface Task {
  id: string;
  folderPath: string;
  agent: 'claude' | 'codex';
  prompt: string;
  originalPrompt?: string;  // Before enhancement
  status: 'queued' | 'running' | 'completed' | 'error';
  terminalOutput: string[];
  exitCode?: number;
  createdAt: number;        // Unix epoch milliseconds
  startedAt?: number;
  completedAt?: number;
}
```

### Agent
```typescript
interface Agent {
  name: 'claude' | 'codex';
  command: string;
  installed: boolean;
  version: string | null;
}
```

### OllamaModel
```typescript
interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}
```

## Security Considerations

Hopper is a local, single-user tool, and its security model follows from that:

1. **Localhost only:** The server binds to `localhost` (port 3000) and is not
   exposed to the network. There is no authentication, because the app is
   meant to be reachable only from the machine it runs on.
2. **No shell:** Tasks are spawned with `Bun.spawn()` using argv arrays (no
   shell), so prompts are passed to the agent as arguments rather than being
   interpreted as shell commands.
3. **User-chosen folders:** Each task runs in the folder you specify for it:
   Claude Code runs with that folder as its working directory, and Codex
   receives it via `-C`. The app does not validate paths or restrict agents
   to pre-approved directories, so only point tasks at folders you trust the
   agent to modify.
4. **API Keys:** The agent CLIs manage their own credentials via environment
   variables; Hopper does not store API keys.

## Future Enhancements (Post-MVP)

- [ ] Persistent task history (SQLite)
- [ ] Task templates/presets
- [ ] Multi-agent collaboration (sequential handoffs)
- [ ] Cost tracking for API usage
- [ ] Git integration (auto-commit on task completion)
- [ ] Export task results as markdown reports
- [ ] System tray mode for background operation
- [ ] Linux and Windows support

## Development Principles

- **Progressive Enhancement:** Build working vertical slice first
- **Real-world Testing:** Use app to build itself (dogfooding)
- **Minimal Dependencies:** Leverage Bun's built-in capabilities
- **Type Safety:** Comprehensive TypeScript throughout
- **Error Resilience:** Graceful degradation when agents unavailable

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- [Claude Code](https://claude.ai/code) and/or the [OpenAI Codex](https://github.com/openai/codex) CLI installed and on your `PATH` (Hopper detects whichever agents are available)
- Optional: [Ollama](https://ollama.com) running locally, for prompt enhancement

### Run

```bash
git clone https://github.com/benmcnulty/hopper
cd hopper
bun install
bun run dev
```

Then open http://localhost:3000 in your browser (on macOS the app opens it
for you). Create a task by choosing a project folder, an agent, and a prompt;
Hopper queues it and streams the agent's output live.

### Build a standalone executable

```bash
bun run build   # outputs dist/ai-orchestrator
./dist/ai-orchestrator
```

### Background

Hopper was designed and built with AI coding agents; the original design
document and planning prompt are preserved in
[docs/planning-prompt.md](docs/planning-prompt.md).

## License

MIT — see [LICENSE](LICENSE).

---

**Status:** Working v1 — local orchestration for Claude Code + Codex with Ollama prompt enhancement  
**Platform:** macOS (arm64 & x64)  
**Build System:** Bun 1.0+
