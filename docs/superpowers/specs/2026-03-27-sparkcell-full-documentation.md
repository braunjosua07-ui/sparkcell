# SparkCell - Komplette Dokumentation

**Datum:** 2026-03-27
**Status:** V1.0 - Feature Complete
**Project:** /Users/josuabraun/Desktop/sparkcell

---

## 1. Was ist SparkCell?

**SparkCell ist ein Multi-Agent Startup Simulation Framework - kein Simulation, sondern ein ECHTES TOOL.**

### Die Wahrheit:
- ✅ SparkCell läuft **echte** AI-Agenten (OpenAI, Anthropic, Ollama, etc.)
- ✅ Die Agenten verbinden sich mit echten LLMs
- ✅ Die Agenten führen **echte** Tool-Executions aus (Dateien schreiben, Browser öffnen, etc.)
- ✅ Die Agenten nutzen **echte** MCP-Server (6400+ verfügbare Tools)
- ✅ Die Agenten kommunizieren über **echten** Message Bus
- ✅ Alles läuft in Echtzeit mit echtem Token-Streaming

### Was "Simulation" bedeutet hier:
Das Wort "Simulation" bezieht sich auf das **Konzept** - wir simulieren ein Startup-Team mit mehreren Agenten. Die Agenten selbst sind aber **echte AI-Systeme**, keine Simulatoren.

---

## 2. Installation & Setup

### requirements
- Node.js 18+
- npm oder pnpm
- Einen LLM-Provider (OpenAI, Anthropic, Ollama, etc.)

### Installieren
```bash
npm install -g sparkcell
sparkcell setup        # Erstes Setup
sparkcell config set provider openai
sparkcell config set model gpt-4o
```

### Konfiguration
```json
{
  "llm": {
    "primary": {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "sk-...",
      "baseUrl": "https://api.openai.com/v1"
    }
  },
  "budget": {
    "dailyLimit": 10.00
  },
  "tickRate": 5000
}
```

---

## 3. CLI Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `sparkcell start [name]` | Startup starten |
| `sparkcell new` | Neues Startup erstellen |
| `sparkcell list` | Alle Startups auflisten |
| `sparkcell config [show\|set\|path]` | Einstellungen verwalten |
| `sparkcell export [name]` | Dokumente exportieren |
| `sparkcell setup` | Setup-Wizard |
| `sparkcell doctor` | System-Check |

---

## 4. Core Features

### 4.1 Multi-Agent System
- 5 vorkonfigurierte Rollen: CEO, Tech Lead, Product Manager, Designer, Marketing
- Jeder Agent hat eigenen Status: idle, thinking, acting, resting
- Kooperative Scheduling auf einem Event Loop
- Keine Worker Threads oder Child Processes

### 4.2 Energy-System
- Jeder Agent hat 100% Energie
- Energie sinkt mit jeder Aktion (~15%/Stunde)
- Agent läuft pause, wenn Energie < 20%
- Energie erholt sich automatisch im Pause-Status

### 4.3 Memory Tiering
- **Hot Memory:** Aktuelle Konversation (500 Einträge)
- **Warm Memory:** Zwischenspeicher für Wissen
- **Cold Memory:** Langzeit-Speicher mit Kompression
- Automatisches Eviction basierend auf Nutzung

### 4.4 Protection System (7 Guards)
1. **Loop Detection** - Erkennt endlose Zyklen
2. **Skill Inflation** - Verhindert Skill-Bloat
3. **Commitment Overload** - Max. 10 pending Tasks
4. **Isolation** - Verhindert Agenten-Inseln
5. **Energy Exploit** - Verhindert Energie-Maximierung
6. **Memory Overflow** - Max. 500 Memory Einträge
7. **Deadlock Detection** - Erkennt Blockaden

### 4.5 LLM Support (10 Provider)
- OpenAI (GPT-4o, GPT-4 Turbo, etc.)
- Anthropic (Claude 3.5 Sonnet, Haiku, Opus)
- Ollama (Llama 3, Mistral, etc.)
- LM Studio
- Mistral
- Groq
- Together AI
- Perplexity
- OpenRouter
- Custom Endpoints

### 4.6 MCP Integration (6400+ Tools)
- MCP Server über stdio oder HTTP
- Automatische Tool-Registrierung
- Tool-Limit pro Agent: 50
- Tool-Ausführung mit Permissions

### 4.7 Communication Bus
- Asynchrone Nachrichten zwischen Agenten
- Help-Requests und Responses
- Commitment Protocol für Task-Verfolgung
- Pause Room für Synchronisation

### 4.8 Content Generation
- Dokumenten-Manager mit Versionsverwaltung
- Content Generator für Texte
- Code Generator für Dateien
- Research Tool für Wissens-Graph

### 4.9 Tools (26 Tools)
- **Core:** Glob, Grep, ReadFile, WriteFile, EditFile
- **Meta:** CreateTool, ListTools, UpdateConfig
- **Browser:** Open, Navigate, Type, Click, Screenshot, Text, Close
- **Social:** Post, Analytics, Schedule, Login
- **Comms:** Slack, Discord, Email, Notify

### 4.9 Tool Management
- **26 Core Tools** - Vordefinierte Tools für Dateien, Browser, Social, Comms
- **User Tools** - JSON-basierte Tools von Usern (speicherort: `~/.config/sparkcell/tools/`)
- **Custom Tools** - Vom LLM erstellte Tools (speicherort: `startup/custom-tools/`)

**CLI Commands:**
```
sparkcell tool list        # Liste alle Tools auf
sparkcell tool install <url>  # Installiere Tool von URL
sparkcell tool remove <name>  # Entferne ein Tool
sparkcell tool enable <name>  # Aktiviere ein Tool
sparkcell tool disable <name> # Deaktiviere ein Tool
```

---

## 5. Templates

| Template | Agents | Verwendung |
|----------|--------|------------|
| `lean-3` | 3 | Solo Founders, schnelle Experimente |
| `growth-5` | 5 | Early-Stage Teams |
| `enterprise-8` | 8 | Vollständige Teams |

---

## 6. Architektur

### Stack
- ESM modules (`"type": "module"`)
- React 18 + Ink v5 für TUI
- Node.js `node:test` für Tests
- `proper-lockfile` für sicheren File-Zugriff

### Core Subsysteme
- **Agent** - Agent Lifecycle, Decision Loop
- **StateMachine** - State Transitions
- **EnergyManager** - Energie-Tracking
- **AgentMemory** - Memory Store
- **KnowledgeGraph** - Shared Knowledge
- **SkillManager** - Skill Tracking
- **ProtectionSystem** - 7 Guards
- **AgentMessageBus** - Agent-Kommunikation
- **Metrics** - Performance Tracking
- **ProtectionStorage** - JSON-Persistenz

---

## 7. Status (März 2026)

| Phase | Status |
|-------|--------|
| Core Framework | ✅ Complete |
| Tool-System (5 Phasen) | ✅ Complete |
| MCP Integration | ✅ Complete |
| Security Hardening | ✅ Complete |
| AgentMemory Eviction | ✅ Complete |
| Circuit Breaker | ✅ Complete |
| Token Streaming | ✅ Complete |
| Protection System | ✅ Complete |
| Agent Messaging | ✅ Complete |
| TUI | ✅ Complete |

**Tests:** 359 Tests, alle grün
**Source-Files:** 91 Files
**Tools:** 26 Core Tools + User Tools + Custom Tools + MCP (6400+)

---

## 8. Nächste Schritte (MVP Website)

Die Website ist **nicht fertig** - das ist nur der Anfang:

1. **Dokumentation erweitern** - Jedes Feature genau dokumentieren
2. **CLI-Download-Section** - Einen echten Download anbieten
3. **Use Cases** - Echte Anwendungsfälle zeigen
4. **Examples** - Working Demo-Projects

---

## 9. Kontakt & Community

- **GitHub:** https://github.com/sparkcell/sparkcell
- **MIT License**

---

**Status:** Feature Complete, Dokumentation in Arbeit, Website im Aufbau
