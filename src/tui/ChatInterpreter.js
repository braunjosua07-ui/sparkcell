export class ChatInterpreter {
  #sparkCell;
  #llm;

  constructor(sparkCell) {
    this.#sparkCell = sparkCell;
    this.#llm = sparkCell?.llm || null;
  }

  setLLM(llm) {
    this.#llm = llm;
  }

  async interpret(message) {
    // Try keyword matching first (fast, no LLM needed)
    const keywordResult = this.#keywordMatch(message);
    if (keywordResult) return keywordResult;

    // If LLM available, try structured interpretation
    if (this.#llm) {
      try {
        return await this.#llmInterpret(message);
      } catch { /* fall through to default */ }
    }

    return `I understood: "${message}". Use keywords like: status, pause, resume, help, agents, tasks.`;
  }

  #keywordMatch(message) {
    const lower = message.toLowerCase().trim();

    // status / query_status
    if (/^(status|how|what's happening)/.test(lower)) {
      const status = this.#sparkCell?.getStatus?.();
      if (!status) return 'No simulation running.';
      const agents = status.agents?.map(a => `  ${a.name}: ${a.state} (${a.energy}%)`).join('\n') || 'None';
      return `Startup: ${status.startup}\nRunning: ${status.running}\nPaused: ${status.paused}\nAgents:\n${agents}`;
    }

    // pause_all
    if (/^(pause|stop|halt)/.test(lower)) {
      this.#sparkCell?.togglePause?.();
      return 'Simulation paused.';
    }

    // resume_all
    if (/^(resume|continue|go|start)/.test(lower)) {
      if (this.#sparkCell?.isPaused) {
        this.#sparkCell?.togglePause?.();
        return 'Simulation resumed.';
      }
      return 'Simulation is already running.';
    }

    // help
    if (/^(help|commands|\?)/.test(lower)) {
      return [
        'Available commands:',
        '  status  — Show simulation status',
        '  pause   — Pause all agents',
        '  resume  — Resume simulation',
        '  agents  — List all agents',
        '  tasks   — Show task board',
        '  help    — Show this help',
      ].join('\n');
    }

    // agents
    if (/^agents?/.test(lower)) {
      const agents = this.#sparkCell?.agents || [];
      if (agents.length === 0) return 'No agents loaded.';
      return agents.map(a => {
        const s = a.getStatus();
        return `${s.name} (${s.role}): ${s.state} — Energy ${s.energy}%`;
      }).join('\n');
    }

    // tasks
    if (/^tasks?/.test(lower)) {
      const agents = this.#sparkCell?.agents || [];
      return agents.map(a => {
        const s = a.getStatus();
        const task = s.currentTask ? s.currentTask.title : 'Idle';
        return `${s.name}: ${task} (queue: ${s.queueLength})`;
      }).join('\n') || 'No agents.';
    }

    return null; // No keyword match
  }

  async #llmInterpret(message) {
    const prompt = `You are a command interpreter for a startup simulation. Parse this user message into an action.

Message: "${message}"

Respond in JSON: { "action": "one of: direction, add_agent, remove_agent, assign_task, pause_all, resume_all, query_status, change_config, export, save_quit", "params": {}, "response": "user-friendly response" }`;

    const result = await this.#llm.query(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 512 },
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      return result.content || 'Done.';
    }

    // Execute action
    switch (parsed.action) {
      case 'pause_all': this.#sparkCell?.togglePause?.(); break;
      case 'resume_all': if (this.#sparkCell?.isPaused) this.#sparkCell?.togglePause?.(); break;
      case 'save_quit': await this.#sparkCell?.shutdown?.(); break;
    }

    return parsed.response || 'Done.';
  }
}
