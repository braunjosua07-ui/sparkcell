// src/core/SelfImprover.js — Self-Diagnosis, Strategy Adaptation & Meta-Learning
//
// Three layers:
//   1. ErrorTracker    — tracks tool/LLM failures per agent, detects patterns
//   2. StrategyAdapter — adapts agent behavior based on error patterns
//   3. MetaLearner     — learns what works/fails across all agents, evolves system

const MAX_ERROR_HISTORY = 100;
const PATTERN_THRESHOLD = 3;     // same error 3x → trigger adaptation
const STRATEGY_COOLDOWN = 60000; // don't re-adapt within 60s
const REFLECTION_INTERVAL = 10;  // reflect every N completed tasks

/**
 * ErrorTracker — per-agent error pattern detection
 */
class ErrorTracker {
  #errors = new Map(); // agentId → [{ tool, error, timestamp, context }]

  record(agentId, { tool, error, args, context }) {
    if (!this.#errors.has(agentId)) this.#errors.set(agentId, []);
    const history = this.#errors.get(agentId);
    history.push({
      tool,
      error: typeof error === 'string' ? error : error?.message || 'unknown',
      args: typeof args === 'string' ? args.slice(0, 200) : JSON.stringify(args || {}).slice(0, 200),
      context: context || '',
      timestamp: Date.now(),
    });
    if (history.length > MAX_ERROR_HISTORY) history.shift();
  }

  recordSuccess(agentId, { tool, duration }) {
    if (!this.#errors.has(agentId)) this.#errors.set(agentId, []);
    const history = this.#errors.get(agentId);
    history.push({
      tool,
      success: true,
      duration,
      timestamp: Date.now(),
    });
    if (history.length > MAX_ERROR_HISTORY) history.shift();
  }

  /**
   * Detect recurring error patterns for an agent.
   * Returns array of { pattern, count, tool, suggestion }
   */
  detectPatterns(agentId) {
    const history = this.#errors.get(agentId) || [];
    const recent = history.filter(e => !e.success && Date.now() - e.timestamp < 300000); // last 5 min

    // Group errors by tool
    const byTool = new Map();
    for (const err of recent) {
      const key = err.tool;
      if (!byTool.has(key)) byTool.set(key, []);
      byTool.get(key).push(err);
    }

    const patterns = [];
    for (const [tool, errors] of byTool) {
      if (errors.length >= PATTERN_THRESHOLD) {
        patterns.push({
          pattern: 'repeated-tool-failure',
          tool,
          count: errors.length,
          lastError: errors[errors.length - 1].error,
          suggestion: this.#suggestAlternative(tool, errors),
        });
      }
    }

    // Detect "stuck in same task" pattern
    const workErrors = recent.filter(e => e.context?.includes('same-task'));
    if (workErrors.length >= 5) {
      patterns.push({
        pattern: 'stuck-on-task',
        count: workErrors.length,
        suggestion: 'skip-task',
      });
    }

    return patterns;
  }

  #suggestAlternative(tool, errors) {
    const ALTERNATIVES = {
      'webFetch':  { use: 'bash', hint: 'Nutze bash mit curl statt webFetch: bash({command: "curl -s URL"})' },
      'webSearch': { use: 'bash', hint: 'Nutze bash mit curl für Websuchen' },
      'writeFile': { use: 'bash', hint: 'Nutze bash mit echo/cat: bash({command: "echo content > file.txt"})' },
      'readFile':  { use: 'bash', hint: 'Nutze bash: bash({command: "cat datei.txt"})' },
      'glob':      { use: 'bash', hint: 'Nutze bash: bash({command: "find . -name pattern"})' },
      'bash':      { use: 'writeFile', hint: 'Bash fehlgeschlagen — erstelle die Datei direkt mit writeFile' },
    };
    return ALTERNATIVES[tool] || { use: null, hint: `Tool "${tool}" funktioniert nicht. Versuche einen anderen Ansatz.` };
  }

  getStats(agentId) {
    const history = this.#errors.get(agentId) || [];
    const errors = history.filter(e => !e.success);
    const successes = history.filter(e => e.success);
    const toolStats = new Map();
    for (const entry of history) {
      const key = entry.tool;
      if (!toolStats.has(key)) toolStats.set(key, { ok: 0, fail: 0 });
      const stat = toolStats.get(key);
      if (entry.success) stat.ok++; else stat.fail++;
    }
    return { totalErrors: errors.length, totalSuccesses: successes.length, toolStats: Object.fromEntries(toolStats) };
  }

  getAllStats() {
    const stats = {};
    for (const [agentId] of this.#errors) {
      stats[agentId] = this.getStats(agentId);
    }
    return stats;
  }
}

/**
 * StrategyAdapter — modifies agent behavior based on detected patterns
 */
class StrategyAdapter {
  #adaptations = new Map();  // agentId → [{ timestamp, pattern, action }]
  #disabledTools = new Map(); // agentId → Set<toolName>
  #toolHints = new Map();     // agentId → Map<toolName, hintString>

  adapt(agentId, patterns) {
    const now = Date.now();
    const recent = (this.#adaptations.get(agentId) || [])
      .filter(a => now - a.timestamp < STRATEGY_COOLDOWN);

    if (recent.length > 0) return []; // cooldown active

    const actions = [];
    for (const pattern of patterns) {
      switch (pattern.pattern) {
        case 'repeated-tool-failure': {
          // Disable the failing tool and suggest alternative
          if (!this.#disabledTools.has(agentId)) this.#disabledTools.set(agentId, new Set());
          this.#disabledTools.get(agentId).add(pattern.tool);

          if (!this.#toolHints.has(agentId)) this.#toolHints.set(agentId, new Map());
          this.#toolHints.get(agentId).set(pattern.tool, pattern.suggestion.hint);

          actions.push({
            type: 'tool-disabled',
            tool: pattern.tool,
            alternative: pattern.suggestion.use,
            hint: pattern.suggestion.hint,
          });
          break;
        }
        case 'stuck-on-task': {
          actions.push({
            type: 'skip-task',
            reason: 'Agent is stuck — skipping to next task',
          });
          break;
        }
      }
    }

    if (actions.length > 0) {
      if (!this.#adaptations.has(agentId)) this.#adaptations.set(agentId, []);
      for (const action of actions) {
        this.#adaptations.get(agentId).push({ timestamp: now, ...action });
      }
    }

    return actions;
  }

  /**
   * Generate prompt injection based on current adaptations.
   * This tells the agent what NOT to do and what to do instead.
   */
  getPromptInjection(agentId) {
    const hints = this.#toolHints.get(agentId);
    if (!hints || hints.size === 0) return '';

    const lines = ['', '## GELERNTE LEKTIONEN (aus vorherigen Fehlern)'];
    for (const [tool, hint] of hints) {
      lines.push(`- NICHT ${tool} verwenden — ${hint}`);
    }
    lines.push('- Wenn ein Ansatz nicht funktioniert, probiere sofort etwas anderes.');
    return lines.join('\n');
  }

  getDisabledTools(agentId) {
    return this.#disabledTools.get(agentId) || new Set();
  }

  getAdaptationHistory(agentId) {
    return this.#adaptations.get(agentId) || [];
  }
}

/**
 * MetaLearner — cross-agent learning and system-level insights
 */
class MetaLearner {
  #taskResults = []; // { agentId, task, quality, toolsUsed, duration, success }
  #insights = [];    // discovered patterns across all agents
  #completedTasks = 0;

  recordTaskResult({ agentId, agentName, task, quality, toolsUsed, duration, filesCreated, success }) {
    this.#taskResults.push({
      agentId, agentName, task, quality, toolsUsed: toolsUsed || [],
      duration, filesCreated: filesCreated || 0, success: success !== false,
      timestamp: Date.now(),
    });
    // Keep bounded — only last 200 results needed for pattern detection
    if (this.#taskResults.length > 200) this.#taskResults.shift();
    this.#completedTasks++;

    // Keep bounded
    if (this.#taskResults.length > 500) this.#taskResults.shift();

    // Periodic reflection
    if (this.#completedTasks % REFLECTION_INTERVAL === 0) {
      this.#reflect();
    }
  }

  #reflect() {
    const recent = this.#taskResults.slice(-50);
    const insights = [];

    // Which tools lead to successful tasks?
    const toolSuccess = new Map();
    for (const result of recent) {
      for (const tool of result.toolsUsed) {
        if (!toolSuccess.has(tool)) toolSuccess.set(tool, { ok: 0, fail: 0 });
        const s = toolSuccess.get(tool);
        if (result.success) s.ok++; else s.fail++;
      }
    }

    for (const [tool, stats] of toolSuccess) {
      const failRate = stats.fail / (stats.ok + stats.fail);
      if (failRate > 0.7 && stats.fail >= 3) {
        insights.push({
          type: 'unreliable-tool',
          tool,
          failRate: Math.round(failRate * 100),
          message: `Tool "${tool}" scheitert in ${Math.round(failRate * 100)}% der Fälle — sollte vermieden werden`,
        });
      }
    }

    // Which agents are most productive?
    const agentFiles = new Map();
    for (const result of recent) {
      if (!agentFiles.has(result.agentId)) agentFiles.set(result.agentId, 0);
      agentFiles.set(result.agentId, agentFiles.get(result.agentId) + (result.filesCreated || 0));
    }

    // Tasks that take too long
    const slowTasks = recent.filter(r => r.duration > 120000);
    if (slowTasks.length > recent.length * 0.5) {
      insights.push({
        type: 'slow-system',
        message: `Mehr als 50% der Tasks dauern über 2 Minuten — System könnte überlastet sein`,
      });
    }

    // Tasks with 0 files created
    const noOutput = recent.filter(r => r.filesCreated === 0 && r.success);
    if (noOutput.length > recent.length * 0.6) {
      insights.push({
        type: 'no-output',
        message: `${Math.round(noOutput.length / recent.length * 100)}% der Tasks produzieren keine Dateien`,
      });
    }

    if (insights.length > 0) {
      this.#insights.push(...insights);
      // Keep bounded
      if (this.#insights.length > 100) this.#insights = this.#insights.slice(-50);
    }
  }

  /**
   * Get system-wide prompt hints based on meta-learning insights
   */
  getSystemHints() {
    if (this.#insights.length === 0) return '';

    const recent = this.#insights.slice(-5);
    const lines = ['', '## SYSTEM-ERKENNTNISSE'];
    for (const insight of recent) {
      lines.push(`- ${insight.message}`);
    }
    return lines.join('\n');
  }

  getInsights() {
    return [...this.#insights];
  }

  getProductivityStats() {
    const recent = this.#taskResults.slice(-50);
    const total = recent.length;
    if (total === 0) return { total: 0, successRate: 0, avgFilesPerTask: 0, avgDuration: 0 };

    const successful = recent.filter(r => r.success).length;
    const totalFiles = recent.reduce((sum, r) => sum + (r.filesCreated || 0), 0);
    const avgDuration = recent.reduce((sum, r) => sum + (r.duration || 0), 0) / total;

    return {
      total,
      successRate: Math.round(successful / total * 100),
      avgFilesPerTask: Math.round(totalFiles / total * 10) / 10,
      avgDuration: Math.round(avgDuration / 1000),
    };
  }
}

/**
 * SelfImprover — main facade combining all three layers
 */
export class SelfImprover {
  #errorTracker;
  #strategyAdapter;
  #metaLearner;
  #bus;

  constructor(bus) {
    this.#errorTracker = new ErrorTracker();
    this.#strategyAdapter = new StrategyAdapter();
    this.#metaLearner = new MetaLearner();
    this.#bus = bus;

    // Auto-subscribe to relevant events
    if (bus) {
      bus.subscribe('tool:failed', (data) => {
        this.#errorTracker.record(data.agentId, {
          tool: data.toolName,
          error: data.error,
        });
      });

      bus.subscribe('tool:executed', (data) => {
        if (data.success) {
          this.#errorTracker.recordSuccess(data.agentId, { tool: data.toolName });
        } else {
          this.#errorTracker.record(data.agentId, {
            tool: data.toolName,
            error: 'execution-failed',
            args: data.args,
          });
        }
      });
    }
  }

  /**
   * Called after each agent work cycle. Detects patterns and adapts.
   * Returns adaptations applied (if any).
   */
  onCycleComplete(agentId) {
    const patterns = this.#errorTracker.detectPatterns(agentId);
    if (patterns.length === 0) return [];

    const actions = this.#strategyAdapter.adapt(agentId, patterns);

    // Publish adaptations
    if (actions.length > 0 && this.#bus) {
      this.#bus.publish('agent:self-improvement', {
        agentId,
        actions,
        patterns: patterns.map(p => ({ pattern: p.pattern, tool: p.tool, count: p.count })),
      });
    }

    return actions;
  }

  /**
   * Called when a task is completed. Feeds meta-learner.
   */
  onTaskComplete(data) {
    this.#metaLearner.recordTaskResult(data);
  }

  /**
   * Get prompt additions based on learned adaptations for an agent.
   */
  getPromptInjection(agentId) {
    const agentHints = this.#strategyAdapter.getPromptInjection(agentId);
    const systemHints = this.#metaLearner.getSystemHints();
    return [agentHints, systemHints].filter(Boolean).join('\n');
  }

  /**
   * Check if a tool should be avoided by this agent.
   */
  isToolDisabled(agentId, toolName) {
    return this.#strategyAdapter.getDisabledTools(agentId).has(toolName);
  }

  /**
   * Get full diagnostic report for an agent.
   */
  getDiagnostics(agentId) {
    return {
      errorStats: this.#errorTracker.getStats(agentId),
      patterns: this.#errorTracker.detectPatterns(agentId),
      adaptations: this.#strategyAdapter.getAdaptationHistory(agentId),
      disabledTools: [...(this.#strategyAdapter.getDisabledTools(agentId) || [])],
    };
  }

  /**
   * Get system-wide report.
   */
  getSystemReport() {
    return {
      allAgentErrors: this.#errorTracker.getAllStats(),
      insights: this.#metaLearner.getInsights(),
      productivity: this.#metaLearner.getProductivityStats(),
    };
  }
}
