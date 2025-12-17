import type { Task, TaskStatus, AgentType } from "../types";

// In-memory task storage
const tasks: Map<string, Task> = new Map();
const taskOrder: string[] = [];

// Folder locks: maps folder path to running task ID
const folderLocks: Map<string, string> = new Map();

function normalizePath(p: string): string {
  // Normalize path to handle trailing slashes consistently
  return p.replace(/\/+$/, "");
}

export function createTask(
  folderPath: string,
  agent: AgentType,
  prompt: string,
  originalPrompt?: string
): Task {
  const task: Task = {
    id: crypto.randomUUID(),
    folderPath: normalizePath(folderPath),
    agent,
    prompt,
    originalPrompt,
    status: "queued",
    terminalOutput: [],
    createdAt: Date.now(),
  };

  tasks.set(task.id, task);
  taskOrder.push(task.id);

  return task;
}

export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId);
}

export function getAllTasks(): Task[] {
  return taskOrder.map((id) => tasks.get(id)!).filter(Boolean);
}

export function updateTask(
  taskId: string,
  updates: Partial<Task>
): Task | undefined {
  const task = tasks.get(taskId);
  if (!task) return undefined;

  Object.assign(task, updates);
  return task;
}

export function removeTask(taskId: string): boolean {
  const task = tasks.get(taskId);
  if (!task) return false;

  // Release folder lock if this task held it
  if (folderLocks.get(task.folderPath) === taskId) {
    folderLocks.delete(task.folderPath);
  }

  tasks.delete(taskId);
  const index = taskOrder.indexOf(taskId);
  if (index > -1) taskOrder.splice(index, 1);

  return true;
}

export function reorderTask(taskId: string, direction: "up" | "down"): boolean {
  const index = taskOrder.indexOf(taskId);
  if (index === -1) return false;

  const newIndex = direction === "up" ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= taskOrder.length) return false;

  // Swap positions
  [taskOrder[index], taskOrder[newIndex]] = [taskOrder[newIndex], taskOrder[index]];
  return true;
}

export function getTaskOrder(): string[] {
  return [...taskOrder];
}

// Folder locking mechanism
export function canStartTask(task: Task): boolean {
  // Check if folder is locked by another running task
  const lockHolder = folderLocks.get(task.folderPath);
  return !lockHolder || lockHolder === task.id;
}

export function acquireFolderLock(task: Task): boolean {
  if (!canStartTask(task)) return false;
  folderLocks.set(task.folderPath, task.id);
  return true;
}

export function releaseFolderLock(task: Task): void {
  if (folderLocks.get(task.folderPath) === task.id) {
    folderLocks.delete(task.folderPath);
  }
}

export function getNextRunnableTask(): Task | undefined {
  for (const taskId of taskOrder) {
    const task = tasks.get(taskId);
    if (task && task.status === "queued" && canStartTask(task)) {
      return task;
    }
  }
  return undefined;
}

// Get all tasks that can run in parallel (different folders)
export function getNextRunnableTasks(): Task[] {
  const runnable: Task[] = [];
  const foldersToStart = new Set<string>();

  for (const taskId of taskOrder) {
    const task = tasks.get(taskId);
    if (!task || task.status !== "queued") continue;

    // Skip if folder is already locked or we're already starting a task in this folder
    if (!canStartTask(task) || foldersToStart.has(task.folderPath)) continue;

    runnable.push(task);
    foldersToStart.add(task.folderPath);
  }

  return runnable;
}
