# AI Coding Agent Orchestrator - Comprehensive Implementation Prompt

You are tasked with building a production-ready, standalone macOS application using Bun that serves as a visual orchestration platform for AI coding agents. This is a complete end-to-end implementation from scratch to working MVP.

## Project Context

This application will be used by developers to manage multiple AI coding tasks across different projects simultaneously. It provides a GUI for queuing tasks, enhancing prompts with local LLMs, and monitoring real-time execution of coding agents like Claude Code and OpenAI Codex.

**Critical Success Factors:**
1. Must compile to a standalone macOS executable using `bun build --compile`
2. Must handle parallel execution intelligently (different folders) and sequential execution (same folder)
3. Must provide real-time terminal output streaming to the UI
4. Must integrate seamlessly with Ollama for prompt enhancement
5. Must detect and report versions of installed coding agents

## Implementation Requirements

### Phase 1: Foundation & Detection (Priority: Critical)

**1.1 Project Setup**
- Initialize Bun project with TypeScript
- Configure `tsconfig.json` for strict type checking
- Set up build script for standalone executable: `bun build src/main.ts --compile --outfile dist/ai-orchestrator`
- Create folder structure as specified in README.md
- Install minimal dependencies (if any needed beyond Bun built-ins)

**1.2 Agent Detection System**
Create `src/server/detector.ts` that:
- Detects Claude Code CLI: Run `claude --version` and parse output
- Detects OpenAI Codex CLI: Run `codex --version` (or equivalent command)
- Validates Ollama: Check if `http://localhost:11434` responds
- Fetches Ollama models: `GET http://localhost:11434/api/tags`
- Returns structured data with installation status and versions
- Handles gracefully when tools are not installed (show "Not Installed" in UI)
- Implements proper error handling for spawn failures

**Expected Detection Output:**
```typescript
{
  agents: [
    { name: 'claude', command: 'claude', installed: true, version: '1.2.3' },
    { name: 'codex', command: 'codex', installed: false, version: null }
  ],
  ollama: {
    installed: true,
    version: '0.1.20',
    models: ['llama3.2', 'codellama', 'mistral']
  }
}
```

### Phase 2: Ollama Integration (Priority: Critical)

**2.1 Ollama Client**
Create `src/server/ollama.ts` with:
- `listModels()`: Fetch available models from API
- `enhancePrompt(model: string, userPrompt: string, agentType: string)`: Takes minimal prompt and returns enhanced version
- Use streaming API: `POST http://localhost:11434/api/generate` with `stream: true`
- Include agent-specific context in enhancement prompt (Claude Code vs Codex have different optimal prompt styles)

**Enhancement System Prompt Template:**
```
You are a prompt engineering assistant specializing in AI coding agents. 
The user has provided a brief task description that needs to be enhanced 
into a detailed, actionable prompt for {AGENT_NAME}.

User's brief: {USER_INPUT}

Transform this into a comprehensive prompt that:
1. Clearly states the objective
2. Provides context about what to look for
3. Specifies expected outputs (code, explanations, tests)
4. Includes relevant best practices
5. Uses {AGENT_NAME}'s optimal prompt structure

Enhanced prompt:
```

**2.2 Prompt Enhancement Flow**
- User types minimal text in prompt field
- Clicks "Enhance" button
- Show loading indicator while Ollama generates
- Stream enhanced text into prompt field (replace original)
- Store original in hidden state for "Undo" functionality
- "Undo" button restores original text

### Phase 3: Task Queue System (Priority: Critical)

**3.1 Queue Manager**
Create `src/server/queue.ts` with:
- Task data structure (as defined in README.md)
- Queue operations: add, remove, reorder (moveUp, moveDown)
- Folder-based execution logic:
  ```typescript
  // Parallel execution allowed if folders differ
  canRunInParallel(task: Task, runningTasks: Task[]): boolean {
    return !runningTasks.some(t => t.folderPath === task.folderPath);
  }
  ```
- Automatic task progression: When task completes, check queue for next task in that folder
- Persistent queue state (in-memory is fine for MVP, but structure for future persistence)

**3.2 Execution Rules**
Implement these specific behaviors:
- **Multiple folders, multiple tasks:** Run all in parallel
- **Same folder, multiple tasks:** Run first, queue others, auto-start next when previous completes
- **Task status transitions:** queued → running → completed/error
- **Cancellation:** Allow stopping running tasks (kill process)

### Phase 4: Task Execution Engine (Priority: Critical)

**4.1 Process Spawner**
Create `src/server/executor.ts` with:
- `executeTask(task: Task)`: Spawns appropriate agent command
- Agent-specific command builders:
  ```typescript
  // Claude Code
  ['claude', '--message', task.prompt, '--folder', task.folderPath]
  
  // Codex (adjust based on actual CLI)
  ['codex', 'run', '--message', task.prompt, '--cwd', task.folderPath]
  ```
- Use `Bun.spawn()` with:
  - `cwd: task.folderPath`
  - `stdout: 'pipe'`
  - `stderr: 'pipe'`
- Stream output line-by-line to WebSocket
- Capture exit code and update task status
- Handle process errors and timeouts

**4.2 Output Streaming**
- Read from stdout/stderr using TextDecoder
- Send chunks to frontend via WebSocket with task ID
- Append to task's terminalOutput array
- Format ANSI codes if present (or strip them for simplicity)

### Phase 5: WebSocket Communication (Priority: Critical)

**5.1 Real-time Server**
Create `src/server/websocket.ts`:
- Set up WebSocket server on separate port (e.g., 3001)
- Handle client connections
- Broadcast task updates to all connected clients:
  ```typescript
  type WSMessage = 
    | { type: 'task_added', task: Task }
    | { type: 'task_updated', task: Task }
    | { type: 'task_output', taskId: string, output: string }
    | { type: 'task_completed', taskId: string, exitCode: number }
    | { type: 'detection_result', data: DetectionResult };
  ```
- Handle client requests (start task, stop task, reorder, etc.)

### Phase 6: Backend Server (Priority: Critical)

**6.1 HTTP + WebSocket Server**
Create `src/main.ts`:
- Start HTTP server on port 3000 using `Bun.serve()`
- Serve static frontend files (HTML, CSS, JS)
- REST API endpoints:
  - `GET /api/detect` - Run detection, return results
  - `POST /api/tasks` - Create new task
  - `POST /api/tasks/:id/enhance` - Enhance prompt via Ollama
  - `PUT /api/tasks/:id/reorder` - Move task up/down
  - `DELETE /api/tasks/:id` - Remove task
  - `POST /api/tasks/:id/start` - Manually trigger task
  - `POST /api/tasks/:id/stop` - Kill running task
- Initialize WebSocket server
- Auto-open browser to `http://localhost:3000` on startup (macOS: `open http://...`)

### Phase 7: Frontend UI (Priority: High)

**7.1 Main Interface Layout**
Create `src/frontend/index.html` with structure:
```
┌─────────────────────────────────────────┐
│  AI Coding Agent Orchestrator           │
├─────────────────────────────────────────┤
│  Status Bar:                            │
│  ✓ Claude Code v1.2.3                   │
│  ✗ Codex (Not Installed)                │
│  ✓ Ollama v0.1.20                       │
│  [Model: llama3.2 ▼]                    │
├─────────────────────────────────────────┤
│  [+ Add Task]                           │
├─────────────────────────────────────────┤
│  Task Queue:                            │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Task #1               [↑] [↓] [×] │ │
│  │ Agent: Claude Code                │ │
│  │ Folder: /Users/ben/project-one    │ │
│  │ Status: ⏸ Queued                  │ │
│  │ ────────────────────────────────  │ │
│  │ Prompt: [Enhanced text here...]   │ │
│  │ [▼ Show Terminal Output]          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Task #2               [↑] [↓] [×] │ │
│  │ Agent: Claude Code                │ │
│  │ Folder: /Users/ben/project-two    │ │
│  │ Status: ▶ Running                 │ │
│  │ ────────────────────────────────  │ │
│  │ Prompt: [Text...]                 │ │
│  │ ▼ Terminal Output:                │ │
│  │   [Live streaming text...]        │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**7.2 Add Task Modal/Form**
When "+ Add Task" clicked, show form:
```
┌─────────────────────────────────┐
│  Create New Task                │
├─────────────────────────────────┤
│  Agent: [Claude Code ▼]         │
│                                 │
│  Folder: [/path/to/folder 📁]   │
│                                 │
│  Prompt:                        │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │ [Text input area]       │   │
│  │                         │   │
│  └─────────────────────────┘   │
│  [Enhance with Ollama]          │
│  [Undo Enhancement]             │
│                                 │
│  [Cancel]  [Add to Queue]       │
└─────────────────────────────────┘
```

**7.3 Frontend JavaScript**
Create `src/frontend/app.ts`:
- WebSocket connection to backend
- Task list state management
- Handle real-time updates (new tasks, status changes, output)
- Folder picker (use native file input with `webkitdirectory` or manual text entry)
- Collapsible terminal output sections
- Drag-free reordering (use up/down buttons)
- Form validation

**7.4 Styling**
Create `src/frontend/styles.css`:
- Clean, modern interface
- Status indicators (colored badges: queued=gray, running=blue, completed=green, error=red)
- Monospace font for terminal output
- Responsive layout (but primarily designed for desktop)
- Smooth transitions for collapsing/expanding sections
- Loading states for async operations

### Phase 8: Error Handling & Edge Cases (Priority: High)

**8.1 Robust Error Handling**
- Agent not installed → Show clear message in UI, disable that agent option
- Ollama not running → Show warning, disable enhancement feature
- Folder permissions denied → Catch error, show alert to user
- Task execution fails → Update task status to 'error', show exit code
- WebSocket disconnection → Show reconnection UI, attempt to reconnect
- Invalid folder path → Validate before adding task
- Process spawn errors → Log clearly, update task status

**8.2 Validation**
- Folder path must exist and be readable
- Prompt cannot be empty
- Agent must be installed before task creation
- Model must be selected for enhancement

### Phase 9: Build & Distribution (Priority: Medium)

**9.1 Build Configuration**
- Update `package.json` with build script
- Ensure all frontend assets are bundled correctly
- Test standalone executable:
  ```bash
  bun run build
  ./dist/ai-orchestrator
  ```
- Verify browser opens automatically
- Confirm all features work in compiled mode

**9.2 Development Scripts**
```json
{
  "scripts": {
    "dev": "bun run src/main.ts",
    "build": "bun build src/main.ts --compile --outfile dist/ai-orchestrator",
    "start": "./dist/ai-orchestrator"
  }
}
```

## Implementation Strategy

### Suggested Development Order:
1. **Setup project structure** (5 min)
2. **Build detection system** - Get agent versions showing (30 min)
3. **Create basic HTTP server** - Serve static HTML (15 min)
4. **Build minimal UI** - Show detection results (30 min)
5. **Implement Ollama client** - Test prompt enhancement (45 min)
6. **Add task form UI** - Create and display tasks (30 min)
7. **Build task queue logic** - Folder-based execution rules (45 min)
8. **Implement executor** - Spawn processes, capture output (60 min)
9. **Add WebSocket** - Stream output to UI (45 min)
10. **Wire up all interactions** - Complete flow from form to execution (30 min)
11. **Polish UI** - Status indicators, collapsible sections (30 min)
12. **Test edge cases** - Missing agents, errors, parallel execution (30 min)
13. **Build standalone executable** - Test final artifact (15 min)

**Total Estimated Time:** ~6 hours of focused development

### Testing Checkpoints:
- [ ] Detection shows installed agents and Ollama models
- [ ] Can select folder and agent in form
- [ ] Enhancement button calls Ollama and updates prompt
- [ ] Undo button restores original prompt
- [ ] Adding task shows it in queue
- [ ] Reorder buttons move tasks up/down correctly
- [ ] Starting task spawns process in correct folder
- [ ] Terminal output streams to UI in real-time
- [ ] Tasks in different folders run in parallel
- [ ] Tasks in same folder run sequentially
- [ ] Completed tasks show final status
- [ ] Can remove tasks from queue
- [ ] Standalone executable runs and opens browser

## Code Quality Requirements

- **Type Safety:** Use TypeScript interfaces for all data structures
- **Error Handling:** Try-catch blocks around all async operations
- **Logging:** Console.log important events (task start/stop, errors)
- **Comments:** Document complex logic (especially folder-locking rules)
- **Separation of Concerns:** Keep backend/frontend clearly separated
- **No External UI Frameworks:** Use vanilla JS for frontend (React adds complexity)

## Constraints & Preferences

- **Bun-first:** Use Bun's native APIs (`Bun.spawn`, `Bun.serve`, `Bun.file`) over Node equivalents
- **Minimal dependencies:** Avoid npm packages unless absolutely necessary
- **macOS-specific:** Don't worry about Windows/Linux compatibility yet
- **Development focus:** Prioritize working functionality over visual polish
- **Self-documenting code:** Clear variable names, logical file organization

## Specific Technical Decisions

**Agent Detection Commands:**
```bash
# Claude Code
claude --version
# Expected output: "Claude Code v1.2.3" or similar

# Codex (verify actual command)
codex --version
# Expected output format TBD - handle gracefully if different

# Ollama
curl http://localhost:11434/api/version
# Returns: {"version": "0.1.20"}
```

**Task Execution Commands:**
```bash
# Claude Code (verify with actual CLI docs)
claude --message "Your prompt here" --folder "/path/to/project"

# Codex (verify with actual CLI docs - may need adjustment)
codex run --message "Your prompt here" --cwd "/path/to/project"
```

**Ollama Prompt Enhancement:**
```typescript
const enhancementPrompt = `You are a prompt engineering assistant for AI coding agents.

The user is working with: ${agentType}
Their brief description: ${userPrompt}

Transform this into a detailed, actionable prompt that:
1. States the objective clearly
2. Provides necessary context
3. Specifies expected outputs
4. Follows ${agentType} best practices

Return only the enhanced prompt, no preamble.`;

// Send to: POST http://localhost:11434/api/generate
// Body: { model: selectedModel, prompt: enhancementPrompt, stream: false }
```

## Deliverables

Upon completion, the repository should contain:
1. ✅ Working standalone macOS executable in `dist/`
2. ✅ Complete source code in `src/` matching specified structure
3. ✅ `package.json` with correct build scripts
4. ✅ `tsconfig.json` configured properly
5. ✅ Updated README.md with usage instructions
6. ✅ All features from MVP scope working end-to-end

## Success Criteria

The MVP is complete when:
1. ✅ Executable runs and opens browser automatically
2. ✅ Detection shows real versions of installed tools
3. ✅ Ollama models populate dropdown when available
4. ✅ Can create task with enhanced prompt
5. ✅ Tasks execute in background with real-time output
6. ✅ Folder-locking rules work (parallel vs sequential)
7. ✅ Can reorder and remove tasks
8. ✅ Terminal output is visible and collapsible
9. ✅ No crashes or unhandled errors during normal operation

---

**You have full autonomy to implement this system.** Make reasonable technical decisions where specifications are ambiguous. Focus on getting a working vertical slice rather than perfect code - we can iterate and improve after the foundation is solid.

Begin implementation now. Start with project setup and detection system, then build up from there following the suggested development order. Good luck!
