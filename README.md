# AI Coding Agent Orchestrator

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
     - **Folder:** Select project directory (triggers permission request)
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
claude --message "<prompt>" --folder "<path>"
```

**OpenAI Codex:**
```bash
codex --version
codex run --message "<prompt>" --cwd "<path>"
```
*(Note: Actual Codex CLI syntax may vary, will be verified during implementation)*

**Ollama:**
```bash
ollama --version
curl http://localhost:11434/api/tags  # List models
curl http://localhost:11434/api/generate  # Generate text
```

### Folder Permissions

When user selects a folder, the app must:
- Request macOS file system access for that specific path
- Validate read/write permissions
- Store approved paths for subsequent task executions

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
# Output: dist/ai-orchestrator-macos
```

### Running Standalone
```bash
./dist/ai-orchestrator-macos
# Opens browser to http://localhost:3000
# App runs in background with system tray icon (future enhancement)
```

## File Structure

```
ai-orchestrator/
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
│   │   ├── app.ts              # Frontend logic
│   │   └── styles.css          # Styling
│   └── types.ts                # Shared TypeScript interfaces
├── package.json
├── bunfig.toml
├── tsconfig.json
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
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
```

### Agent
```typescript
interface Agent {
  name: 'claude' | 'codex';
  command: string;
  installed: boolean;
  version: string;
}
```

### OllamaModel
```typescript
interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}
```

## Security Considerations

1. **Path Validation:** Prevent directory traversal attacks
2. **Command Injection:** Sanitize all prompt inputs before passing to shell
3. **Folder Access:** Only operate within user-approved directories
4. **API Keys:** Agents' API keys managed via environment variables (not stored in app)

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

This project is designed to be initialized with Claude Code in Planning Mode:

1. Place this README.md in an empty repository
2. Run: `claude init` to generate `claude.md` configuration
3. Use the planning prompt (see PLANNING_PROMPT.md) to kick off development
4. Let AI agents build the foundation while you refine requirements

## License

MIT - Open source for the AI development community

---

**Status:** Planning Phase  
**Target MVP:** Core functionality with Claude Code + Codex + Ollama integration  
**Platform:** macOS (arm64 & x64)  
**Build System:** Bun 1.0+
