# SparkCell v2.1 — Autonomes Startup Redesign

> Stand: 2026-03-23 | Status: Geplant, nicht begonnen

## Vision

SparkCell ist kein Tool das Dokumente generiert. SparkCell IST das Startup.
Die Agents sind echte Mitarbeiter die autonom arbeiten, miteinander kommunizieren,
aufeinander reagieren und gemeinsam ein Unternehmen aufbauen.

Der User konfiguriert es, startet es, und schaut zu.

---

## Was wir haben (und nicht nutzen)

| Modul | Status | Problem |
|-------|--------|---------|
| WorkerBus | Funktioniert | Agents senden, hören aber nicht zu |
| CommitmentProtocol | Gebaut, ungenutzt | Agents machen keine Zusagen |
| SharedWhiteboard | Gebaut, ungenutzt | Agents teilen keine Blocker/Ziele |
| PauseRoom | Gebaut, minimal | Nur bei globalem Pause |
| ResearchTool | Gebaut, ungenutzt | Agents recherchieren nie |
| ContentGenerator | Gebaut, ungenutzt | Templates werden ignoriert |
| CodeGenerator | Gebaut, ungenutzt | Kann Code generieren, keiner ruft es |
| KnowledgeGraph | Gebaut, ungenutzt | Komplett brachgelegt |
| ProtectionSystem | Gebaut, ungenutzt | Nicht mal instanziiert |
| CostRouter | Gebaut, ungenutzt | Nicht mit LLMManager verbunden |
| LLM Multi-Turn | Ready | Agents machen nur Single-Shot |

**Kernproblem:** Agents arbeiten isoliert. Jeder generiert eigene Tasks,
ruft LLM auf, speichert Output. Keiner liest was die anderen machen.

---

## Inspiration von Multi-Agent Frameworks

| Framework | Kernidee | Für SparkCell |
|-----------|----------|---------------|
| MetaGPT | Pipeline: CEO→PM→Architect→Dev, SOPs | Output A → Input B |
| CrewAI | Hierarchisch: Manager delegiert | CEO delegiert an CTO→Dev |
| AutoGen | Message-passing, Agents als Tools | Bus-Subscriptions |
| CAMEL | Role-Playing, stateful Memory | AgentMemory + Rollen |

---

## Implementierungsplan: 5 Phasen

### Phase 1: Agents hören einander zu (Quick Win)

**Ziel:** Agents reagieren auf Outputs der anderen

**Änderungen:**
- Agent subscribt auf `agent:output` und `agent:task-completed`
- Peer-Output wird in eigene Memory gespeichert (tag: `peer-{agentId}`)
- `#buildPrompt()` enthält die letzten 3 Peer-Outputs als Kontext
- LLM sieht was Teammates gemacht haben → passt eigene Arbeit an

**Dateien:** `src/core/Agent.js`
**Aufwand:** Klein
**Impact:** Hoch — Agents koordinieren sich natürlich

---

### Phase 2: SharedWhiteboard + Blocker-System

**Ziel:** Team-Koordination über geteilten Kontext

**Änderungen:**
- SparkCell übergibt Whiteboard + Protocol an Agents
- SparkCell setzt Mission + Goals beim Start aus startup.json
- Whiteboard wird beim Start geladen (nicht nur beim Shutdown gespeichert)
- Agent liest Whiteboard-State in `#buildPrompt()` (Mission, Goals, Blocker)
- LLM-Prompt enthält Instruktion: "Melde Blocker mit [BLOCKER: ...]"
- Agent parsed Output nach `[BLOCKER: ...]` → `whiteboard.addBlocker()`
- Idle Agents lesen Blocker → generieren Help-Tasks mit hoher Priorität
- Whiteboard publiziert Änderungen auf den Bus

**Dateien:** `src/core/Agent.js`, `src/index.js`, `src/communication/SharedWhiteboard.js`
**Aufwand:** Mittel
**Impact:** Hoch — Team wird bewusst, hilft bei Problemen

---

### Phase 3: CommitmentProtocol + Task-Pipeline

**Ziel:** Agents machen verbindliche Zusagen, Tasks haben Dependencies

**Änderungen:**
- Agent bekommt CommitmentProtocol injected
- LLM-Prompt enthält: "Erstelle Zusagen mit [COMMITMENT: to=X, action=Y, deadline=Z]"
- Agent parsed Commitments aus Output → `protocol.create()`
- Agent checkt eigene pending Commitments in jedem Cycle
- Überfällige Commitments → Blocker auf Whiteboard
- TaskGenerator bekommt `teamState` (wer macht was, wer ist idle, wer blocked)
- Tasks können `dependsOn: taskId` haben
- Wenn CEO "Define Vision" abschließt → CTO bekommt "Design Architecture basierend auf Vision"

**Dateien:** `src/core/Agent.js`, `src/core/TaskGenerator.js`, `src/index.js`
**Aufwand:** Mittel-Groß
**Impact:** Sehr hoch — echte Arbeitsketten statt isolierte Tasks

---

### Phase 4: Peer-Consultation + Team-Meetings

**Ziel:** Agents fragen Kollegen bevor sie entscheiden

**Änderungen:**
- Neuer State: CONSULTING in StateMachine
- LLM kann `[CONSULT: target=cto, question=...]` ausgeben
- Agent postet Frage auf Bus → Ziel-Agent antwortet im nächsten Cycle
- Timeout: nach 2 Cycles ohne Antwort → Solo-Entscheidung
- "Team-Meeting" Event: CEO kann `[MEETING: agenda=...]` triggern
  → Alle Agents pausieren, jeder gibt Input zum Thema
  → CEO sammelt Inputs, trifft Entscheidung, postet auf Whiteboard
- PauseRoom wird zur Meeting-Location

**Dateien:** `src/core/StateMachine.js`, `src/core/Agent.js`, `src/communication/PauseRoom.js`
**Aufwand:** Groß
**Impact:** Hoch — echte Team-Dynamik

---

### Phase 5: Autonomes Startup mit echtem Output

**Ziel:** Agents produzieren echte Artefakte, Startup hat Phasen

**Änderungen:**
- Agents nutzen ContentGenerator für strukturierte Dokumente
- Agents nutzen CodeGenerator für Code-Artefakte
- Agents nutzen ResearchTool für Markt-/Wettbewerbs-Recherche
- KnowledgeGraph trackt Entitäten (Wettbewerber, Technologien, Märkte)
- ProtectionSystem wird aktiviert (Loop-Guard, Isolation-Guard, Deadlock-Guard)
- CostRouter wird mit LLMManager verbunden (Budget-Tracking)
- Startup hat organische Phasen basierend auf completed Documents:
  - Ideation: Vision, Problem Statement → unlock Validation
  - Validation: Market Analysis, Competitor Research → unlock Planning
  - Planning: Business Plan, Tech Spec, Financial Model → unlock Build
  - Build: Code, Wireframes, Marketing Content → unlock Launch
  - Launch: Pitch Deck, Go-to-Market, Launch Plan → "Startup Ready"
- TUI zeigt Phase-Progress, Document-Status, Team-Activity

**Dateien:** Viele — Agent, TaskGenerator, SparkCell, TUI Views
**Aufwand:** Sehr groß
**Impact:** Sehr hoch — das vollständige Produkt

---

## TUI Redesign für Autonomes Startup

### Neue/Überarbeitete Tabs:

1. **Dashboard** — Startup-Phase, Progress-Bar, Key Metrics
2. **Feed** — Live Events (bereits gebaut, funktioniert)
3. **Agents** — Status, Energy, aktuelle Task (bereits gebaut)
4. **Documents** — Alle generierten Docs mit Status (neu/in-review/fertig)
5. **Whiteboard** — Mission, Goals, Blocker, Decisions (live vom SharedWhiteboard)
6. **Budget** — LLM-Kosten, Token-Usage (von CostRouter)

---

## Reihenfolge

Phase 1 → 2 → 3 bauen eine solide Basis.
Phase 4 → 5 machen das Produkt einzigartig.

Phase 1 allein macht schon einen riesigen Unterschied —
Agents die aufeinander reagieren fühlen sich sofort lebendiger an.
