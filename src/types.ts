// Task status enum
export type TaskStatus = "queued" | "running" | "completed" | "error";

// Agent types
export type AgentType = "claude" | "codex";

export interface Task {
  id: string;
  folderPath: string;
  agent: AgentType;
  prompt: string;
  originalPrompt?: string; // Before enhancement
  status: TaskStatus;
  terminalOutput: string[];
  exitCode?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface Agent {
  name: AgentType;
  command: string;
  installed: boolean;
  version: string | null;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface DetectionResult {
  agents: Agent[];
  ollama: {
    available: boolean;
    version: string | null;
    models: OllamaModel[];
  };
}

// WebSocket message types (server to client)
export type WSMessage =
  | { type: "detection_result"; data: DetectionResult }
  | { type: "task_added"; task: Task }
  | { type: "task_updated"; task: Task }
  | { type: "task_output"; taskId: string; output: string }
  | { type: "task_completed"; taskId: string; exitCode: number }
  | { type: "task_removed"; taskId: string }
  | { type: "queue_reordered"; taskIds: string[] }
  | { type: "prompt_enhanced"; original: string; enhanced: string }
  | { type: "error"; message: string };

// WebSocket message types (client to server)
export type WSClientMessage =
  | { type: "request_detection" }
  | { type: "create_task"; folderPath: string; agent: AgentType; prompt: string }
  | { type: "enhance_prompt"; prompt: string; model: string; agent: AgentType }
  | { type: "reorder_task"; taskId: string; direction: "up" | "down" }
  | { type: "remove_task"; taskId: string }
  | { type: "stop_task"; taskId: string };
