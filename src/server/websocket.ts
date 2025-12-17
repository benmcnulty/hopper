import type { ServerWebSocket } from "bun";
import type { WSMessage, Task, DetectionResult } from "../types";

interface ClientData {
  id: string;
}

// Track all connected clients
const clients: Set<ServerWebSocket<ClientData>> = new Set();

export function addClient(ws: ServerWebSocket<ClientData>): void {
  clients.add(ws);
  console.log(`Client connected: ${ws.data.id} (${clients.size} total)`);
}

export function removeClient(ws: ServerWebSocket<ClientData>): void {
  clients.delete(ws);
  console.log(`Client disconnected: ${ws.data.id} (${clients.size} total)`);
}

export function broadcast(message: WSMessage): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    client.send(data);
  }
}

export function sendTo(ws: ServerWebSocket<ClientData>, message: WSMessage): void {
  ws.send(JSON.stringify(message));
}

// Convenience broadcast methods
export function broadcastDetectionResult(data: DetectionResult): void {
  broadcast({ type: "detection_result", data });
}

export function broadcastTaskAdded(task: Task): void {
  broadcast({ type: "task_added", task });
}

export function broadcastTaskUpdated(task: Task): void {
  broadcast({ type: "task_updated", task });
}

export function broadcastTaskOutput(taskId: string, output: string): void {
  broadcast({ type: "task_output", taskId, output });
}

export function broadcastTaskCompleted(taskId: string, exitCode: number): void {
  broadcast({ type: "task_completed", taskId, exitCode });
}

export function broadcastTaskRemoved(taskId: string): void {
  broadcast({ type: "task_removed", taskId });
}

export function broadcastQueueReordered(taskIds: string[]): void {
  broadcast({ type: "queue_reordered", taskIds });
}

export function broadcastPromptEnhanced(original: string, enhanced: string): void {
  broadcast({ type: "prompt_enhanced", original, enhanced });
}

export function broadcastError(message: string): void {
  broadcast({ type: "error", message });
}

export function sendPromptEnhanced(
  ws: ServerWebSocket<ClientData>,
  original: string,
  enhanced: string
): void {
  sendTo(ws, { type: "prompt_enhanced", original, enhanced });
}

export function sendError(ws: ServerWebSocket<ClientData>, message: string): void {
  sendTo(ws, { type: "error", message });
}
