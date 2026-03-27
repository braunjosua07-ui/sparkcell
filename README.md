# SparkCell 🚀

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node->=18.0.0-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-420%20passing-brightgreen.svg)](https://github.com/sparkcell/sparkcell)

> **SparkCell ist kein Simulation - es ist ein ECHTES TOOL!** 🎯
>
> Ein Multi-Agent Startup Framework, das echte AI-Agenten (OpenAI, Anthropic, Ollama) mit echten Tools ausführt - Dateien schreiben, Browser steuern, Social Media Posts publishen und mehr.

---

## ✨ Features

| Feature | Beschreibung |
|---------|-------------|
| 🤖 **Multi-Agent System** | 5 Role-Templates (CEO, Tech Lead, Product, Designer, Marketing) |
| 🧠 **Big Five Persönlichkeit** | Wissenschaftlich fundiertes Persönlichkeitsmodell |
| ⚡ **Skill System** | 12 Skill-Kategorien mit XP-based Leveling |
| ❤️ **Soul Evolution** | Persönlichkeit ändert sich basierend auf Qualität |
| 🔧 **26 Core Tools** | Dateien, Browser, Social, Comms (Slack, Discord, Email) |
| 📦 **MCP Integration** | 6400+ Tools via Model Context Protocol |
| 🔐 **Security Hardened** | AES-256 Verschlüsselung, API-Key Redaction |
| 📊 **TUI** | Terminal User Interface mit Echtzeit-Feedback |
| 🎮 **Agentic Loop** | Tool-use mit max 25 Iterationen pro Task |

---

## 🚀 Quick Start

```bash
# Install global
npm install -g sparkcell

# Setup LLM provider
sparkcell setup

# Neues Startup erstellen
sparkcell new

# Startup starten
sparkcell start

# Alle Startups auflisten
sparkcell list
```

### CLI Commands

| Command | Beschreibung |
|---------|-------------|
| `sparkcell start [name]` | Startup starten |
| `sparkcell new` | Neues Startup erstellen |
| `sparkcell list` | Alle Startups auflisten |
| `sparkcell config [show\|set\|path]` | Konfiguration verwalten |
| `sparkcell tool list` | Tools auflisten |
| `sparkcell tool install <url>` | Tool installieren |
| `sparkcell tool remove <name>` | Tool entfernen |
| `sparkcell tool enable <name>` | Tool aktivieren |
| `sparkcell tool disable <name>` | Tool deaktivieren |
| `sparkcell setup` | Setup-Wizard |
| `sparkcell doctor` | System-Check |

---

## 📖 Agent Rollen

### CEO (Strategic Lead)
- **Openness:** 80 | **Conscientiousness:** 75 | **Extraversion:** 85
- **Agreeableness:** 60 | **Neuroticism:** 30
- **Persönlichkeit:** kreativ, gewissenhaft, gesellig, mitfühlend, stabil
- **Stil:** prägnant, direkt
- **Ansatz:** decision-driven
- **Werte:** wachstum, impact, exzellenz
- Skills: strategy, vision, planning, leadership

### Tech Lead
- **Openness:** 70 | **Conscientiousness:** 85 | **Extraversion:** 40
- **Agreeableness:** 70 | **Neuroticism:** 40
- **Persönlichkeit:** ausgewogen, gewissenhaft, zurückhaltend, harmonie, ausgewogen
- **Stil:** technisch, genau
- **Ansatz:** solution-oriented
- **Werte:**qualität, effizienz, innovation
- Skills: coding, architecture, debugging, api-design

### Product Manager
- **Openness:** 75 | **Conscientiousness:** 70 | **Extraversion:** 75
- **Agreeableness:** 80 | **Neuroticism:** 35
- **Persönlichkeit:** kreativ, strukturiert, sozial, mitfühlend, stabil
- **Stil:** nutzerzentriert
- **Ansatz:** data-driven
- **Werte:** nutzen, wachstum, einfachheit
- Skills: product, research, analysis, user-stories

### Designer
- **Openness:** 90 | **Conscientiousness:** 60 | **Extraversion:** 60
- **Agreeableness:** 75 | **Neuroticism:** 45
- **Persönlichkeit:** sehr kreativ, flexibel, sozial, harmonie, emotional
- **Stil:** ästhetisch, emotional
- **Ansatz:** experimentell
- **Werte:** schönheit, user-experience, ästhetik
- Skills: design, ux, branding, prototyping

### Marketing
- **Openness:** 65 | **Conscientiousness:** 60 | **Extraversion:** 90
- **Agreeableness:** 70 | **Neuroticism:** 40
- **Persönlichkeit:** kreativ, strukturiert, sehr gesellig, kooperativ, ausgeglichen
- **Stil:** persuasiv, emotional
- **Ansatz:** test-and-learn
- **Werte:** wachstum, brand, community
- Skills: marketing, content, social-media, seo

---

## 🧠 Persönlichkeits-System (Big Five)

### Die 5 Kerndimensionen

1. **Openness (Offenheit)** - Kreativität, Neugier, Abenteuerlust
   - Niedrig: konservativ, strukturiert, risikoscheu
   - Hoch: kreativ, neugierig, experimentierfreudig

2. **Conscientiousness (Gewissenhaftigkeit)** - Organisierung, Zuverlässigkeit
   - Niedrig: spontan, unordentlich, flexibel
   - Hoch: geordnet, zuverlässig, diszipliniert

3. **Extraversion (Geselligkeit)** - Energie, Sozialität
   - Niedrig: introvertiert, zurückhaltend, ruhig
   - Hoch: extrovertiert, gesellig, energisch

4. **Agreeableness (Vereinbarkeit)** - Kooperativität, Mitgefühl
   - Niedrig: wettbewerbsorientiert, kritisch, selbstbewusst
   - Hoch: kooperativ, mitfühlend, hilfsbereit

5. **Neuroticism (Neurotizismus)** - Emotionale Stabilität
   - Niedrig: emotional stabil, ruhig, zuversichtlich
   - Hoch: emotional labil, ängstlich, empfindlich

### Soul Score (0-100)

Der Soul Score berechnet sich aus den Big Five Traits:

```javascript
soulScore = (
  openness * 0.15 +
  conscientiousness * 0.20 +
  extraversion * 0.15 +
  agreeableness * 0.20 +
  (100 - neuroticism) * 0.30
)
```

**Milestones:**
- ☓ **Soul entstanden** (< 10)
- ♥ **Soul gestärkt** (10-69)
- ❤️ **SOUL-CHARGE** (>= 70)

---

## 🛠️ Tech Stack

| Kategorie | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Module System | ESM (`"type": "module"`) |
| UI Framework | React 18 + Ink v5 |
| Testing | `node:test` |
| File Locking | `proper-lockfile` |
| LLM Support | OpenAI, Anthropic, Ollama, LM Studio, Mistral, Groq, Together AI, Perplexity, OpenRouter, Custom |

---

## 🔐 Sicherheit

### Verschlüsselung
- **AES-256-CBC** für Credentials
- **macOS Keychain** oder **pbkdf2** Fallback (100k Iterationen)
- **File Permissions**: 0o600 für sensible Dateien

### API Key Protection
- Automatische **Redaction** in Logs (`sk-***REDACTED***`)
- Keine hardcoded Secrets im Code
- Environment-based configuration

### Protection System (7 Guards)
1. **Loop Detection** - Endlose Zyklen erkennen
2. **Skill Inflation** - Verhindert Skill-Bloat
3. **Commitment Overload** - Max 10 pending Tasks
4. **Isolation** - Verhindert Agenten-Inseln
5. **Energy Exploit** - Verhindert Energie-Maximierung
6. **Memory Overflow** - Max 500 Memory Einträge
7. **Deadlock Detection** - Blockaden erkennen

---

## 📊 TUI Features

Die Terminal UI zeigt in Echtzeit:
- 🟢 **Agent States**: IDLE, WORKING, BLOCKED, PAUSED, COMPLETE, RESTED, HELP
- ❤️ **Soul Score**: 0-100 mit Farbcodierung (red/magenta/gray hearts)
- ⚡ **Skill Levels**: 12 Kategorien pro Agent
- 🔋 **Energy**: 100% decay/recovery tracking
- 📝 **Active Tasks**: Current task + queue length
- 📚 **Memory Tiers**: HOT / WARM / COLD
- 🧬 **Persönlichkeit**: Big Five Beschreibung pro Agent

---

## 📁 Projekt-Struktur

```
sparkcell/
├── bin/
│   └── sparkcell.js          # CLI Entry Point
├── src/
│   ├── core/                 # Core Engine
│   │   ├── Agent.js          # Agent Klasse
│   │   ├── Personality.js    # Big Five Persönlichkeit
│   │   ├── SkillManager.js   # Skill System
│   │   ├── EnergyManager.js  # Energie-Tracking
│   │   ├── AgentMemory.js    # Memory Tiering
│   │   ├── Metrics.js        # Performance Tracking
│   │   └── ...
│   ├── tools/                # Tool System
│   │   ├── ToolRunner.js     # Tool Execution
│   │   ├── ToolPermissions.js
│   │   └── core/             # 26 Core Tools
│   ├── communication/        # Agent Kommunikation
│   │   ├── WorkerBus.js      # Event Bus
│   │   ├── CommitmentProtocol.js
│   │   └── AgentMessageBus.js
│   ├── tui/                  # Terminal UI
│   │   ├── App.js
│   │   ├── components/       # Ink Components
│   │   └── hooks/
│   ├── llm/                  # LLM Integration
│   │   ├── LLMManager.js
│   │   ├── OpenAIProvider.js
│   │   └── AnthropicProvider.js
│   └── ...
├── docs/                     # Dokumentation
├── test/                     # Tests (420 Tests)
└── README.md                 # This file
```

---

## 🧪 Testing

```bash
# Alle Tests
npm test

# Unit Tests
npm run test:unit

# Integration Tests
npm run test:integration

# Wizard Tests
npm run test:wizard

# TUI Tests
npm run test:tui

# Mit Coverage
npm run test:coverage
```

**Test Status:** 420 Tests, alle grün ✅

---

## 📚 Dokumentation

- [Tool Manifest Format](docs/TOOL-MANIFEST-FORMAT.md)
- [Full Documentation](docs/superpowers/specs/2026-03-27-sparkcell-full-documentation.md)
- [Website Design](docs/superpowers/specs/2026-03-27-sparkcell-website-design.md)

---

## 🤝 Contributing

1. Fork das Repository
2. Erstelle einen Branch (`git checkout -b feature/amazing-feature`)
3. Commit deine Changes (`git commit -m 'feat: add amazing feature'`)
4. Push zum Branch (`git push origin feature/amazing-feature`)
5. Öffne einen Pull Request

---

## 📄 License

MIT License - siehe [LICENSE](LICENSE) für Details.

---

## 🙏 Acknowledgments

- **Model Context Protocol (MCP)** - 6400+ Tools
- **OpenAI API** - GPT-4o Support
- **Anthropic API** - Claude 3.5 Sonnet Support
- **Ollama** - Lokale LLM Support

---

## 📞 Kontakt

- GitHub: [@sparkcell](https://github.com/sparkcell)
- License: MIT

---

**Built with ❤️ using React, Ink, and Node.js**
