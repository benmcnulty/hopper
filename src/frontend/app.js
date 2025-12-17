// State
let ws;
const tasks = new Map();
let taskOrder = [];
let agents = [];
let ollamaModels = [];
let ollamaAvailable = false;
let originalPrompt = null;

// Connect WebSocket
function connect() {
  ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onopen = () => {
    console.log("Connected to server");
    ws.send(JSON.stringify({ type: "request_detection" }));
  };

  ws.onclose = () => {
    console.log("Disconnected, reconnecting in 1s...");
    setTimeout(connect, 1000);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleMessage(message);
    } catch (err) {
      console.error("Failed to parse message:", err);
    }
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case "detection_result":
      updateDetectionUI(msg.data);
      break;

    case "task_added":
      tasks.set(msg.task.id, msg.task);
      taskOrder.push(msg.task.id);
      renderTasks();
      break;

    case "task_updated":
      tasks.set(msg.task.id, msg.task);
      renderTasks();
      break;

    case "task_output": {
      const task = tasks.get(msg.taskId);
      if (task) {
        task.terminalOutput.push(msg.output);
        updateTaskOutput(msg.taskId);
      }
      break;
    }

    case "task_completed":
      // Task updated message will follow
      break;

    case "task_removed":
      tasks.delete(msg.taskId);
      taskOrder = taskOrder.filter((id) => id !== msg.taskId);
      renderTasks();
      break;

    case "queue_reordered":
      taskOrder = msg.taskIds;
      renderTasks();
      break;

    case "prompt_enhanced":
      document.getElementById("task-prompt").value = msg.enhanced;
      originalPrompt = msg.original;
      document.getElementById("undo-enhance-btn").disabled = false;
      document.getElementById("enhance-status").textContent = "Enhanced!";
      setTimeout(() => {
        document.getElementById("enhance-status").textContent = "";
      }, 2000);
      break;

    case "error":
      alert(msg.message);
      document.getElementById("enhance-status").textContent = "";
      break;
  }
}

function updateDetectionUI(data) {
  agents = data.agents;
  ollamaAvailable = data.ollama.available;
  ollamaModels = (data.ollama.models || []).map((m) => m.name);

  // Update status bar
  const statusBar = document.getElementById("status-bar");
  statusBar.innerHTML =
    agents
      .map(
        (a) =>
          `<span class="${a.installed ? "installed" : "not-installed"}">
          ${a.installed ? "✓" : "✗"} ${a.name} ${a.version || "(Not Installed)"}
        </span>`
      )
      .join("") +
    `<span class="${data.ollama.available ? "installed" : "not-installed"}">
      ${data.ollama.available ? "✓" : "✗"} Ollama ${data.ollama.version || "(Not Available)"}
    </span>`;

  // Update agent select
  const agentSelect = document.getElementById("task-agent");
  const installedAgents = agents.filter((a) => a.installed);
  agentSelect.innerHTML =
    '<option value="">Select agent...</option>' +
    installedAgents.map((a) => `<option value="${a.name}">${a.name}</option>`).join("");

  // Disable agent select if no agents installed
  if (installedAgents.length === 0) {
    agentSelect.innerHTML = '<option value="">No agents installed</option>';
    agentSelect.disabled = true;
  } else {
    agentSelect.disabled = false;
  }

  // Update model select
  const modelSelect = document.getElementById("ollama-model");
  if (ollamaAvailable && ollamaModels.length > 0) {
    modelSelect.innerHTML =
      '<option value="">Select Ollama Model</option>' +
      ollamaModels.map((m) => `<option value="${m}">${m}</option>`).join("");
    modelSelect.disabled = false;
  } else {
    modelSelect.innerHTML = '<option value="">Ollama not available</option>';
    modelSelect.disabled = true;
  }

  // Update enhance button state
  document.getElementById("enhance-btn").disabled = !ollamaAvailable;
}

function renderTasks() {
  const container = document.getElementById("task-list");

  if (taskOrder.length === 0) {
    container.innerHTML =
      '<p class="empty-state">No tasks in queue. Click "+ Add Task" to get started.</p>';
    return;
  }

  container.innerHTML = taskOrder
    .map((id, index) => {
      const task = tasks.get(id);
      if (!task) return "";

      const outputCount = task.terminalOutput?.length || 0;
      const promptPreview =
        task.prompt.length > 200 ? task.prompt.substring(0, 200) + "..." : task.prompt;

      return `
      <div class="task-card ${task.status}" data-id="${task.id}">
        <div class="task-header">
          <span class="task-title">Task #${index + 1}</span>
          <div class="task-controls">
            <button onclick="reorderTask('${task.id}', 'up')" ${index === 0 ? "disabled" : ""} title="Move up">↑</button>
            <button onclick="reorderTask('${task.id}', 'down')" ${index === taskOrder.length - 1 ? "disabled" : ""} title="Move down">↓</button>
            ${
              task.status === "running"
                ? `<button class="danger" onclick="stopTask('${task.id}')" title="Stop task">Stop</button>`
                : `<button class="danger" onclick="removeTask('${task.id}')" title="Remove task">×</button>`
            }
          </div>
        </div>
        <div class="task-meta">
          <span>Agent: ${task.agent}</span>
          <span>Folder: ${task.folderPath}</span>
          <span class="status-badge ${task.status}">${task.status}</span>
          ${task.exitCode !== undefined ? `<span>Exit: ${task.exitCode}</span>` : ""}
        </div>
        <div class="task-prompt">${escapeHtml(promptPreview)}</div>
        <details class="terminal-output" ${task.status === "running" ? "open" : ""}>
          <summary>Terminal Output (${outputCount} lines)</summary>
          <pre id="output-${task.id}">${(task.terminalOutput || []).map(escapeHtml).join("\n")}</pre>
        </details>
      </div>
    `;
    })
    .join("");
}

function updateTaskOutput(taskId) {
  const pre = document.getElementById(`output-${taskId}`);
  const task = tasks.get(taskId);
  if (pre && task) {
    pre.textContent = (task.terminalOutput || []).join("\n");
    pre.scrollTop = pre.scrollHeight;

    // Update line count in summary
    const details = pre.closest("details");
    if (details) {
      const summary = details.querySelector("summary");
      if (summary) {
        summary.textContent = `Terminal Output (${task.terminalOutput.length} lines)`;
      }
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Global functions for onclick handlers
window.reorderTask = (taskId, direction) => {
  ws.send(JSON.stringify({ type: "reorder_task", taskId, direction }));
};

window.removeTask = (taskId) => {
  if (confirm("Remove this task from the queue?")) {
    ws.send(JSON.stringify({ type: "remove_task", taskId }));
  }
};

window.stopTask = (taskId) => {
  if (confirm("Stop this running task?")) {
    ws.send(JSON.stringify({ type: "stop_task", taskId }));
  }
};

// Modal handling
const modal = document.getElementById("add-task-modal");

document.getElementById("add-task-btn").onclick = () => {
  // Reset form state
  document.getElementById("task-form").reset();
  originalPrompt = null;
  document.getElementById("undo-enhance-btn").disabled = true;
  document.getElementById("enhance-status").textContent = "";
  modal.showModal();
};

document.getElementById("cancel-btn").onclick = () => {
  modal.close();
};

// Close modal on backdrop click
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.close();
  }
});

// Enhance prompt
document.getElementById("enhance-btn").onclick = () => {
  const prompt = document.getElementById("task-prompt").value.trim();
  const model = document.getElementById("ollama-model").value;
  const agent = document.getElementById("task-agent").value;

  if (!prompt) {
    alert("Please enter a prompt first");
    return;
  }
  if (!model) {
    alert("Please select an Ollama model first");
    return;
  }
  if (!agent) {
    alert("Please select an agent first");
    return;
  }

  originalPrompt = prompt;
  document.getElementById("enhance-status").textContent = "Enhancing...";
  ws.send(JSON.stringify({ type: "enhance_prompt", prompt, model, agent }));
};

// Undo enhancement
document.getElementById("undo-enhance-btn").onclick = () => {
  if (originalPrompt) {
    document.getElementById("task-prompt").value = originalPrompt;
    originalPrompt = null;
    document.getElementById("undo-enhance-btn").disabled = true;
  }
};

// Form submission
document.getElementById("task-form").onsubmit = (e) => {
  e.preventDefault();

  const folder = document.getElementById("task-folder").value.trim();
  const agent = document.getElementById("task-agent").value;
  const prompt = document.getElementById("task-prompt").value.trim();

  if (!folder || !agent || !prompt) {
    alert("Please fill in all fields");
    return;
  }

  ws.send(
    JSON.stringify({
      type: "create_task",
      folderPath: folder,
      agent,
      prompt,
    })
  );

  modal.close();
  document.getElementById("task-form").reset();
  originalPrompt = null;
};

// Initialize
connect();
