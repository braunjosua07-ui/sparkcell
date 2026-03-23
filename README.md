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
