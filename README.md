# SparkCell

**Multi-Agent Startup Simulation Platform**

SparkCell runs autonomous AI teams that simulate a startup from day one. Multiple agents with distinct roles collaborate through a shared communication bus, generate documents and code, manage budgets, and evolve their skills over time — all inside a terminal UI powered by Ink v5.

---

## Features

- **Multi-agent AI teams** — Agents with dedicated roles (CEO, CTO, designer, etc.) operate concurrently via cooperative scheduling on a single event loop
- **Universal LLM support** — 10 providers out of the box: Ollama, LM Studio, OpenAI, Anthropic, Mistral, Groq, Together AI, Perplexity, OpenRouter, and custom endpoints
- **Terminal UI** — Full React/Ink v5 TUI with tab views for agents, logs, whiteboard, and budget
- **Energy, skill, and memory systems** — Each agent tracks energy levels, accumulates skills, and maintains a personal memory store
- **Knowledge graph** — Shared structured knowledge that agents read from and write to
- **Communication bus** — Async message passing between agents with a commitment protocol and pause room for coordination
- **Auto-task generation** — Agents generate and assign tasks to each other based on simulation state
- **Budget tracking** — Per-simulation cost tracking with circuit breakers to stay within spend limits
- **7 Protection Guards** — Loop detection, skill inflation, commitment overload, isolation, energy exploit, memory overflow, deadlock detection
- **Agent-to-Agent Messaging** — Direct communication with help requests and responses
- **Protection Storage** — JSON-file persistence for action history with automatic rotation
- **Performance Metrics** — Real-time tracking of cycles/sec, latency, memory, and event rates

---

## Quick Start

```bash
npm install -g sparkcell
sparkcell config       # point to your LLM provider
sparkcell new          # create a new startup
sparkcell start        # launch the simulation
```

---

## Installation

**Requirements:** Node.js 18 or later

```bash
git clone https://github.com/your-org/sparkcell.git
cd sparkcell
npm install
npm link               # makes `sparkcell` available globally
```

SparkCell is ESM-only (`"type": "module"`) and uses Node's built-in `fetch` — no external HTTP client required.

---

## Usage

```
sparkcell start [name]     Start a startup simulation (prompts to pick one if name is omitted)
sparkcell new              Create a new startup
sparkcell list             List all existing startups
sparkcell config           Show and edit global settings
sparkcell export [name]    Export generated documents for a startup
```

### Examples

```bash
sparkcell start my-saas        # start a specific simulation by name
sparkcell list                 # see all simulations and their agent counts
sparkcell export my-saas       # list exported docs for my-saas
```

---

## Configuration

Global settings are stored at `~/.sparkcell/config.json` by default.

To use a different location, set the `SPARKCELL_HOME` environment variable:

```bash
export SPARKCELL_HOME=/path/to/custom/dir
```

Run `sparkcell config` to print the current config path and its contents. Edit the JSON file directly to set your LLM provider, API key, default template, and budget limits.

**Example config:**

```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "budgetUsd": 5.00
}
```

---

## Architecture

SparkCell is a single-process application. All agents run on one event loop using cooperative scheduling — no worker threads or child processes.

**Stack:**
- ESM modules throughout (`"type": "module"`)
- React 18 + Ink v5 for the terminal UI
- Node.js built-in `node:test` for the test suite
- `proper-lockfile` for safe concurrent file access to simulation state

### Key Subsystems

**Core**
| Module | Responsibility |
|---|---|
| `Agent` | Agent lifecycle, role definition, decision loop |
| `StateMachine` | Per-agent state transitions (idle → thinking → acting → resting) |
| `EnergyManager` | Tracks and replenishes agent energy |
| `AgentMemory` | Per-agent short- and long-term memory store |
| `KnowledgeGraph` | Shared structured knowledge base across all agents |
| `SkillManager` | Skill acquisition and proficiency tracking |
| `ProtectionSystem` | 7 safety guards: loop, skill inflation, commitment, isolation, energy, memory, deadlock |
| `AgentMessageBus` | Agent-to-agent messaging with help requests/responses |
| `Metrics` | Performance tracking: cycles, timing, memory, event rates |
| `ProtectionStorage` | JSON-file persistence for protection action history with rotation |

**Communication**
| Module | Responsibility |
|---|---|
| `WorkerBus` | Async message routing between agents |
| `CommitmentProtocol` | Ensures agents honor assigned tasks |
| `PauseRoom` | Coordinates agent pauses and synchronisation points |
| `SharedWhiteboard` | Global scratchpad visible to all agents |

**LLM**
| Module | Responsibility |
|---|---|
| `ProviderRegistry` | Registers and resolves the 10 supported LLM providers |
| `LLMManager` | Request dispatch with circuit breaker and retry logic |
| `CostRouter` | Routes requests to cheapest capable provider within budget |

**Content**
| Module | Responsibility |
|---|---|
| `DocumentManager` | Creates, versions, and persists markdown documents |
| `ContentGenerator` | Prose generation for briefs, reports, and pitches |
| `CodeGenerator` | Source code generation and file scaffolding |
| `ResearchTool` | Synthesises research queries into knowledge graph entries |

**Tools**
| Module | Responsibility |
|---|---|
| `ToolRunner` | Tool registration, validation, execution with permission levels |
| `ToolPermissions` | Permission levels: open, restricted, approval workflow |
| `GlobTool`, `GrepTool` | File system search tools |
| `ReadFileTool`, `WriteFileTool` | File I/O with path validation |
| `EditFileTool` | In-place file editing with context awareness |

**TUI**
- Built with React 18 and Ink v5
- Tab views: Agents, Activity Log, Shared Whiteboard, Budget
- Live updates streamed from agent events via React state

---

## Templates

When creating a new startup, pick a team template:

| Template | Agents | Best for |
|---|---|---|
| `lean-3` | 3 | Solo founders, fast experiments |
| `growth-5` | 5 | Early-stage teams with specialisation |
| `enterprise-8` | 8 | Full cross-functional simulations |

---

## License

MIT

---

## API Reference

### Agent

```javascript
import { Agent } from '@sparkcell/core';

const agent = new Agent('my-agent', {
  name: 'MyAgent',
  role: 'developer',
  bus: eventBus,
  llm: llmClient,
  toolRunner: toolRunner,
});

// Messaging
const msgId = agent.sendTo('other-agent', 'Hello!');
const helpId = agent.requestHelp('senior-agent', 'Need guidance on...');

// Status
const status = agent.getStatus();
// { id, name, role, state, energy, currentTask, queueLength, cycleCount }
```

### ProtectionSystem

```javascript
import { ProtectionSystem } from '@sparkcell/core';

const protection = new ProtectionSystem();

// Actions are recorded automatically by Agent
// Manual check for custom scenarios:
const violations = protection.check(agentId, {
  skillLevels: currentSkills,
  prevSkillLevels: previousSkills,
  commitments: pendingTasks,
  boostCount: energyBoosts,
  memorySize: memoryCount,
  agentState: currentState,
  blockedActions: consecutiveBlocked,
  helpRequested: isAskingForHelp,
});
```

### ToolRunner

```javascript
import { ToolRunner } from '@sparkcell/tools';
import { ToolPermissions } from '@sparkcell/tools';

const permissions = new ToolPermissions();
const toolRunner = new ToolRunner({ permissions });

// Register a custom tool
toolRunner.registerTool({
  name: 'myTool',
  description: 'Does something useful',
  parameters: { arg1: { type: 'string', description: 'Argument 1' } },
  execute: async (args, context) => ({
    success: true,
    output: `Result: ${args.arg1}`,
  }),
  permissionLevel: 'open', // or 'restricted' or 'approval'
});

// Execute with context
const result = await toolRunner.execute('agent-id', 'myTool', { arg1: 'value' }, {
  workDir: '/path/to/workdir',
  outputDir: '/path/to/output',
});
```

---

### Metrics

```javascript
import { metrics } from '@sparkcell/core';

// Record timing
metrics.recordTiming('tool:execution', durationMs);
metrics.recordEvent('agent:cycle');
metrics.recordGauge('memory:heap', memUsage);

// Get stats
const stats = metrics.getStats('tool:execution');
// { name, count, avg, min, max, last, total }

// Get full system metrics
const system = metrics.getSystemMetrics();
// { uptime, memory, cpuUsage }
```

---

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Wizard tests
npm run test:wizard

# TUI tests
npm run test:tui
```
