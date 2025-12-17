import type { AgentType } from "../types";

const ENHANCEMENT_SYSTEM_PROMPT = `You are a prompt engineering assistant for AI coding agents.
Transform brief task descriptions into detailed, actionable prompts.

Rules:
1. State the objective clearly
2. Provide context about what to look for
3. Specify expected outputs (code, explanations, tests)
4. Include relevant best practices
5. Keep it focused and actionable
6. Return ONLY the enhanced prompt, no preamble or explanation`;

export async function enhancePrompt(
  model: string,
  userPrompt: string,
  agentType: AgentType
): Promise<string> {
  const agentContext =
    agentType === "claude"
      ? "Claude Code (an AI coding assistant that can read files, edit code, and run commands)"
      : "Codex CLI (an AI coding assistant that executes commands in a sandboxed environment)";

  const fullPrompt = `${ENHANCEMENT_SYSTEM_PROMPT}

Target agent: ${agentContext}

User's brief task description:
"${userPrompt}"

Enhanced prompt:`;

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: fullPrompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = (await response.json()) as { response: string };
  return data.response.trim();
}

export async function listModels(): Promise<string[]> {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}
