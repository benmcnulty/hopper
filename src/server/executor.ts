import type { Task } from "../types";
import * as queue from "./queue";

type OutputCallback = (taskId: string, output: string) => void;
type CompletionCallback = (taskId: string, exitCode: number) => void;

// Track running processes for cancellation
const runningProcesses: Map<
  string,
  { proc: ReturnType<typeof Bun.spawn>; kill: () => void }
> = new Map();

export function buildCommand(task: Task): { cmd: string[]; cwd: string } {
  switch (task.agent) {
    case "claude":
      // Claude: use -p for non-interactive, run from target directory
      return {
        cmd: ["claude", "-p", task.prompt],
        cwd: task.folderPath,
      };

    case "codex":
      // Codex: use exec -C for directory specification
      return {
        cmd: ["codex", "exec", "-C", task.folderPath, task.prompt],
        cwd: process.cwd(),
      };

    default:
      throw new Error(`Unknown agent: ${task.agent}`);
  }
}

export async function executeTask(
  task: Task,
  onOutput: OutputCallback,
  onComplete: CompletionCallback
): Promise<void> {
  // Acquire folder lock
  if (!queue.acquireFolderLock(task)) {
    throw new Error(`Folder ${task.folderPath} is locked by another task`);
  }

  // Update task status
  queue.updateTask(task.id, {
    status: "running",
    startedAt: Date.now(),
  });

  const { cmd, cwd } = buildCommand(task);

  try {
    const proc = Bun.spawn(cmd, {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        // Ensure non-interactive mode
        CI: "true",
      },
    });

    // Store for potential cancellation
    runningProcesses.set(task.id, {
      proc,
      kill: () => proc.kill(),
    });

    // Stream stdout and stderr
    const decoder = new TextDecoder();

    const readStream = async (
      stream: ReadableStream<Uint8Array>,
      prefix = ""
    ) => {
      const reader = stream.getReader();
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const output = prefix ? `${prefix}${line}` : line;
            task.terminalOutput.push(output);
            onOutput(task.id, output);
          }
        }
        // Flush remaining buffer
        if (buffer) {
          const output = prefix ? `${prefix}${buffer}` : buffer;
          task.terminalOutput.push(output);
          onOutput(task.id, output);
        }
      } catch {
        // Stream closed
      } finally {
        reader.releaseLock();
      }
    };

    // Read both streams concurrently
    await Promise.all([
      readStream(proc.stdout, ""),
      readStream(proc.stderr, "[stderr] "),
    ]);

    // Wait for process to exit
    const exitCode = await proc.exited;

    // Cleanup
    runningProcesses.delete(task.id);
    queue.releaseFolderLock(task);

    // Update task status
    const status = exitCode === 0 ? "completed" : "error";
    queue.updateTask(task.id, {
      status,
      exitCode,
      completedAt: Date.now(),
    });

    onComplete(task.id, exitCode);
  } catch (error) {
    runningProcesses.delete(task.id);
    queue.releaseFolderLock(task);

    const errorMessage = error instanceof Error ? error.message : String(error);
    task.terminalOutput.push(`[error] ${errorMessage}`);
    onOutput(task.id, `[error] ${errorMessage}`);

    queue.updateTask(task.id, {
      status: "error",
      exitCode: -1,
      completedAt: Date.now(),
    });

    onComplete(task.id, -1);
  }
}

export function stopTask(taskId: string): boolean {
  const running = runningProcesses.get(taskId);
  if (!running) return false;

  running.kill();
  runningProcesses.delete(taskId);

  const task = queue.getTask(taskId);
  if (task) {
    queue.releaseFolderLock(task);
    queue.updateTask(taskId, {
      status: "error",
      exitCode: -9, // SIGKILL
      completedAt: Date.now(),
    });
    task.terminalOutput.push("[system] Task stopped by user");
  }

  return true;
}

export function isTaskRunning(taskId: string): boolean {
  return runningProcesses.has(taskId);
}
