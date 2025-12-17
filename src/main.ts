import type { ServerWebSocket } from "bun";
import type { WSClientMessage } from "./types";
import { detectAgents } from "./server/detector";
import { enhancePrompt } from "./server/ollama";
import * as queue from "./server/queue";
import { executeTask, stopTask } from "./server/executor";
import * as ws from "./server/websocket";

// Embed frontend files as text for standalone executable
import indexHtml from "./frontend/index.html" with { type: "text" };
import stylesCss from "./frontend/styles.css" with { type: "text" };
import appJs from "./frontend/app.js" with { type: "text" };

const PORT = 3000;

interface ClientData {
  id: string;
}

// Scheduler: check for tasks to start
let schedulerRunning = false;

async function runScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  try {
    const tasks = queue.getNextRunnableTasks();

    for (const task of tasks) {
      // Don't await - run in parallel
      executeTask(
        task,
        (taskId, output) => ws.broadcastTaskOutput(taskId, output),
        (taskId, exitCode) => {
          ws.broadcastTaskCompleted(taskId, exitCode);
          const updatedTask = queue.getTask(taskId);
          if (updatedTask) ws.broadcastTaskUpdated(updatedTask);
          // Trigger scheduler again to start next queued task
          setTimeout(runScheduler, 100);
        }
      ).catch((err) => {
        console.error(`Task ${task.id} failed:`, err);
      });

      // Broadcast updated status
      const updated = queue.getTask(task.id);
      if (updated) ws.broadcastTaskUpdated(updated);
    }
  } finally {
    schedulerRunning = false;
  }
}

// Handle WebSocket client messages
async function handleClientMessage(
  clientWs: ServerWebSocket<ClientData>,
  message: WSClientMessage
) {
  try {
    switch (message.type) {
      case "request_detection": {
        const result = await detectAgents();
        ws.sendTo(clientWs, { type: "detection_result", data: result });
        break;
      }

      case "create_task": {
        const task = queue.createTask(
          message.folderPath,
          message.agent,
          message.prompt
        );
        ws.broadcastTaskAdded(task);
        runScheduler();
        break;
      }

      case "enhance_prompt": {
        try {
          const enhanced = await enhancePrompt(
            message.model,
            message.prompt,
            message.agent
          );
          ws.sendPromptEnhanced(clientWs, message.prompt, enhanced);
        } catch (err) {
          ws.sendError(
            clientWs,
            `Enhancement failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }

      case "reorder_task": {
        if (queue.reorderTask(message.taskId, message.direction)) {
          ws.broadcastQueueReordered(queue.getTaskOrder());
        }
        break;
      }

      case "remove_task": {
        if (queue.removeTask(message.taskId)) {
          ws.broadcastTaskRemoved(message.taskId);
        }
        break;
      }

      case "stop_task": {
        if (stopTask(message.taskId)) {
          const task = queue.getTask(message.taskId);
          if (task) ws.broadcastTaskUpdated(task);
        }
        break;
      }
    }
  } catch (err) {
    ws.sendError(
      clientWs,
      err instanceof Error ? err.message : String(err)
    );
  }
}

// Start server
const server = Bun.serve<ClientData>({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { id: crypto.randomUUID() },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Serve embedded static files
    switch (url.pathname) {
      case "/":
      case "/index.html":
        return new Response(indexHtml as unknown as BodyInit, {
          headers: { "Content-Type": "text/html" },
        });
      case "/styles.css":
        return new Response(stylesCss as unknown as BodyInit, {
          headers: { "Content-Type": "text/css" },
        });
      case "/app.js":
        return new Response(appJs as unknown as BodyInit, {
          headers: { "Content-Type": "application/javascript" },
        });
      default:
        return new Response("Not found", { status: 404 });
    }
  },

  websocket: {
    open(wsClient: ServerWebSocket<ClientData>) {
      ws.addClient(wsClient);
    },

    close(wsClient: ServerWebSocket<ClientData>) {
      ws.removeClient(wsClient);
    },

    message(wsClient: ServerWebSocket<ClientData>, message) {
      try {
        const parsed = JSON.parse(String(message)) as WSClientMessage;
        handleClientMessage(wsClient, parsed);
      } catch {
        ws.sendError(wsClient, "Invalid message format");
      }
    },
  },
});

console.log(`AI Orchestrator running at http://localhost:${PORT}`);

// Auto-open browser on macOS
if (process.platform === "darwin") {
  Bun.spawn(["open", `http://localhost:${PORT}`], {
    stdout: "ignore",
    stderr: "ignore",
  });
}
