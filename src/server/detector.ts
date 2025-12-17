import type { Agent, DetectionResult, OllamaModel } from "../types";

export async function detectAgents(): Promise<DetectionResult> {
  const [claude, codex, ollama] = await Promise.all([
    detectClaude(),
    detectCodex(),
    detectOllama(),
  ]);

  return {
    agents: [claude, codex],
    ollama,
  };
}

async function detectClaude(): Promise<Agent> {
  try {
    const proc = Bun.spawn(["claude", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return { name: "claude", command: "claude", installed: false, version: null };
    }

    // Parse: "2.0.71 (Claude Code)" or similar
    const match = output.match(/^([\d.]+)/);
    return {
      name: "claude",
      command: "claude",
      installed: true,
      version: match ? match[1] : output.trim().split("\n")[0],
    };
  } catch {
    return { name: "claude", command: "claude", installed: false, version: null };
  }
}

async function detectCodex(): Promise<Agent> {
  try {
    const proc = Bun.spawn(["codex", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return { name: "codex", command: "codex", installed: false, version: null };
    }

    // Parse: "codex-cli 0.73.0" or similar
    const match = output.match(/codex(?:-cli)?\s*([\d.]+)/i);
    return {
      name: "codex",
      command: "codex",
      installed: true,
      version: match ? match[1] : output.trim().split("\n")[0],
    };
  } catch {
    return { name: "codex", command: "codex", installed: false, version: null };
  }
}

async function detectOllama(): Promise<DetectionResult["ollama"]> {
  try {
    // Check version via CLI
    const proc = Bun.spawn(["ollama", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const versionOutput = await new Response(proc.stdout).text();
    await proc.exited;

    // Parse: "ollama version is 0.13.3" or similar
    const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);

    // Fetch models from API
    let models: OllamaModel[] = [];
    try {
      const response = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const data = (await response.json()) as { models?: OllamaModel[] };
        models = data.models || [];
      }
    } catch {
      // API not responding, but CLI might still be installed
    }

    return {
      available: true,
      version: versionMatch ? versionMatch[1] : null,
      models,
    };
  } catch {
    return { available: false, version: null, models: [] };
  }
}
