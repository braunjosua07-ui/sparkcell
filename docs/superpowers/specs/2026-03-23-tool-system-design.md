# SparkCell Tool-System: Agents bekommen Haende

> Status: Design-Spec (reviewed and updated)
> Datum: 2026-03-23
> Ziel: Agents von Text-Simulation zu vollstaendig handlungsfaehigen Akteuren machen

## Vision

SparkCell-Agents sollen alles koennen was ein Mensch in einem Startup kann: Dateien schreiben, Code ausfuehren, im Web recherchieren, Social-Media-Accounts betreiben, sich selbst verbessern. Dafuer bekommen sie ein Tool-System nach dem Vorbild von Claude Code.

## Kern-Prinzip: Agents sind frei

- Agents handeln autonom — der User wird nur bei wenigen, kritischen Aktionen gefragt
- Die meisten Tools laufen ohne Bestaetigung
- Nur destruktive oder externe Aktionen (Social-Media-Posts, E-Mails) brauchen einmalige Zustimmung
- Agents koennen sich selbst neue Tools bauen wenn keins existiert

---

## Architektur

### Agentic Loop (Kern-Aenderung an Agent.js)

Aktuell: Agent ruft LLM einmal auf, speichert Text.
Neu: Agent laeuft in einem Tool-Use-Loop:

```
while (task nicht erledigt) {
  1. Sende Kontext + Tool-Definitionen ans LLM
  2. LLM antwortet mit:
     a) Text -> Task erledigt, Ergebnis speichern
     b) Tool-Call -> ToolRunner fuehrt aus -> Ergebnis zurueck in Kontext
  3. Max 25 Iterationen pro Task (Schutz vor Endlos-Loops)
  4. Token-Budget pruefen — wenn Kontext > 80% Limit, zusammenfassen
}
```

### Kontext-Management

Der Agentic Loop sammelt Tool-Ergebnisse in der messages-Liste. Ohne Begrenzung laeuft das Kontext-Fenster ueber. Loesung:

```javascript
class ContextManager {
  #maxTokens;          // Kontext-Limit des Models (z.B. 128k)
  #budgetRatio = 0.8;  // Bei 80% zusammenfassen

  estimateTokens(messages)      // Grobe Schaetzung (chars / 4)
  shouldSummarize(messages)     // true wenn > budgetRatio
  summarize(messages, llm)      // Alte Tool-Ergebnisse zusammenfassen
  truncateToolResult(result, maxChars = 4000)  // Einzelne Ergebnisse kuerzen
}
```

- readFile-Ergebnisse werden auf 4000 Zeichen gekuerzt
- bash-Output wird auf 2000 Zeichen gekuerzt
- Wenn Kontext-Budget 80% erreicht: aeltere Tool-Ergebnisse werden zu einer Zusammenfassung komprimiert
- Aktueller Tool-Call + letzte 3 Ergebnisse bleiben immer vollstaendig

### Fehlerbehandlung im Loop

```javascript
for (const call of result.toolCalls) {
  try {
    const toolResult = await this.#toolRunner.execute(this.id, call.name, call.args);
    messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(toolResult) });
  } catch (err) {
    // Fehler als Tool-Ergebnis zurueck ans LLM — es kann entscheiden wie weiter
    messages.push({
      role: 'tool', toolCallId: call.id,
      content: JSON.stringify({ error: true, message: err.message }),
    });
    failCount++;
    if (failCount >= 3) break; // Nach 3 Fehlern Loop abbrechen
  }
}
```

Das LLM bekommt den Fehler als Kontext und kann entscheiden: nochmal versuchen, alternativen Ansatz waehlen, oder aufgeben.

### Komponenten

```
src/tools/
  ToolRunner.js          — Registry, Ausfuehrung, Logging
  ToolPermissions.js     — Permission-Checks (auto/ask/deny) + Persistenz
  ToolValidator.js       — Parameter-Validierung + Sandbox-Check
  ContextManager.js      — Token-Budget, Zusammenfassung, Truncation
  core/                  — Built-in Tools
    ReadFileTool.js
    WriteFileTool.js
    EditFileTool.js
    GlobTool.js
    GrepTool.js
    BashTool.js
    WebFetchTool.js
    BrowserTool.js
    SocialMediaTool.js
    SendEmailTool.js
  custom/                — Von Agents erstellte Tools (Laufzeit)
  meta/
    CreateToolTool.js    — Agents bauen eigene Tools
    ListToolsTool.js     — Verfuegbare Tools auflisten
    UpdateConfigTool.js  — Agent kann eigene Config aendern
```

---

## Fundament: ToolRunner

### ToolRunner.js

```javascript
class ToolRunner {
  #tools = new Map();        // name -> Tool-Instanz
  #permissions;              // ToolPermissions-Instanz
  #logger;
  #bus;                      // WorkerBus fuer Events

  registerTool(tool)         // Tool registrieren
  registerDirectory(dir)     // Alle .js-Dateien aus Ordner laden
  getToolDefinitions()       // JSON-Schema fuer LLM-Prompt (OpenAI + Anthropic Format)
  async execute(agentId, toolName, args)  // Tool ausfuehren
}
```

execute() Ablauf:
1. Tool-Lookup (existiert das Tool?)
2. Permission-Check via ToolPermissions
3. Wenn needs-approval -> Event auf Bus, 60s Timeout — danach Fehler an LLM
4. Argument-Validierung gegen Schema
5. tool.execute(args, context) aufrufen mit Timeout (30s default)
6. Ergebnis auf Bus publizieren: tool:executed
7. Standardisiertes Ergebnis zurueck: { success: boolean, output: any, error?: string }

### ToolPermissions.js

Drei Stufen, standardmaessig sehr offen:

| Permission | Wann | Beispiele |
|------------|------|-----------|
| auto | Kein Nachfragen, Agent ist frei | readFile, writeFile, editFile, glob, grep, bash, webFetch, listTools, createTool, updateConfig, browserOpen, browserClick, browserType, browserScreenshot |
| ask | User wird einmal gefragt, dann persistent gespeichert | Erster Social-Media-Post, E-Mail senden |
| deny | Gesperrt | Systemdateien ausserhalb Projekt |

Persistenz: Genehmigte Aktionen werden in permissions-state.json im Startup-Verzeichnis gespeichert. Beim Neustart geladen — User muss nicht nochmal bestaetigen.

Permission-Timeout: Wenn User nicht innerhalb 60s antwortet, wird der Tool-Call als fehlgeschlagen zurueckgegeben. LLM kann alternativ vorgehen.

```javascript
class ToolPermissions {
  #rules = new Map();          // toolName -> 'auto' | 'ask' | 'deny'
  #approvedActions = new Set(); // Bereits genehmigte ask-Aktionen

  check(agentId, toolName, args)  // -> 'allowed' | 'needs-approval' | 'denied'
  approve(actionKey)               // User hat genehmigt
  setRule(toolName, level)         // Permission-Level setzen
  async load(configPath)           // Regeln + Approvals laden
  async save(configPath)           // Approvals persistieren
}
```

### Tool-Interface

Jedes Tool implementiert:

```javascript
{
  name: string,
  description: string,
  parameters: {
    paramName: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array',
      required: boolean,
      description: string,
      default: any,  // optional
    }
  },
  permissionLevel: 'auto' | 'ask' | 'deny',
  async execute(args, context): { success: boolean, output: any, error?: string }
}
```

Standardisiertes Ergebnis-Format: Jedes Tool gibt { success, output, error? } zurueck. Das LLM kann so zuverlaessig pruefen ob ein Tool geklappt hat.

Context-Objekt das jedes Tool bekommt:

```javascript
{
  agentId: string,
  agentName: string,
  workDir: string,        // = paths.startup(startupName) — Startup-Verzeichnis
  outputDir: string,      // = paths.output(startupName)
  bus: WorkerBus,
  logger: Logger,
  toolRunner: ToolRunner, // Falls Tool andere Tools aufrufen muss (composed tools)
}
```

workDir = Startup-Verzeichnis (~/.sparkcell/startups/<name>/). Dateisystem-Tools sind auf workDir + outputDir beschraenkt.

---

## Core Tools

### Dateisystem

| Tool | Permission | Beschreibung |
|------|-----------|--------------|
| readFile | auto | Datei lesen. Args: path, optional offset, limit. Output auf 4000 Zeichen gekuerzt |
| writeFile | auto | Datei schreiben/erstellen. Args: path, content |
| editFile | auto | Gezielte Ersetzung in Datei. Args: path, oldString, newString |
| glob | auto | Dateien suchen nach Pattern. Args: pattern, path |
| grep | auto | In Dateien suchen. Args: query, path, include |

### Shell

| Tool | Permission | Beschreibung |
|------|-----------|--------------|
| bash | auto | Shell-Befehl ausfuehren. Args: command, timeout (max 120s) |

Bash-Sicherheit: Statt Blacklist (unsicher) wird der Befehl in einer eingeschraenkten Umgebung ausgefuehrt:
- Arbeitsverzeichnis auf workDir gesetzt
- Umgebungsvariablen gefiltert: Credentials/Secrets werden entfernt
- Output auf 2000 Zeichen gekuerzt
- Timeout: max 120s, default 30s
- Alle Befehle werden geloggt fuer Audit-Trail

### Web/HTTP

| Tool | Permission | Beschreibung |
|------|-----------|--------------|
| webFetch | auto | URL abrufen + Inhalt extrahieren. Args: url, selector (optional CSS-Selector), method, headers, body. Returns: bereinigter Text oder JSON |

---

## Meta-Tools: Selbst-Verbesserung

| Tool | Permission | Beschreibung |
|------|-----------|--------------|
| createTool | auto | Neues Tool erstellen. Args: name, description, parameters, code |
| listTools | auto | Alle verfuegbaren Tools mit Beschreibung auflisten |
| updateConfig | auto | Eigene Agent-Config aendern. Args: key, value. Erlaubt: skills, energy-thresholds, task-generation-params. Gesperrt: id, permissions |

### Ablauf createTool

1. Agent schreibt Tool-Code als String
2. ToolValidator prueft:
   - Syntaktisch valide (try-parse)
   - Hat name, description, parameters, execute
   - Strukturell korrekt (execute gibt {success, output} zurueck)
3. Code wird nach src/tools/custom/{name}Tool.js geschrieben
4. ToolRunner laedt es dynamisch via import()
5. Erstes Custom-Tool laeuft in Sandbox-Modus: Output wird geloggt, bei 3 Fehlern deaktiviert
6. Event auf Bus: tool:created — alle Agents koennen es nutzen
7. SkillManager: Tool-Erstellung gibt XP fuer passenden Skill

### Custom-Tool Sicherheit

Statt fragiler Blacklist ein Sandbox-Ansatz:
- Custom-Tools laufen in einem vm.createContext() mit eingeschraenktem Scope
- Nur erlaubte Node.js-Module verfuegbar: fs (read-only), path, fetch, crypto
- Kein Zugriff auf process, require, globalThis
- Timeout: 10s pro Custom-Tool-Execution
- Wenn ein Custom-Tool 3x fehlschlaegt -> automatisch deaktiviert

### Custom-Tool Namenskonflikte

- Tool-Namen muessen einzigartig sein. Wenn Name existiert -> Fehler
- Agent kann explizit updateTool aufrufen um ein Custom-Tool zu ueberschreiben
- Core-Tools koennen nie ueberschrieben werden

---

## Web-Browser

Dependency: Playwright als optionalDependency. Browser-Tools nur verfuegbar wenn installiert. Graceful Degradation: listTools zeigt Browser-Tools als "nicht verfuegbar" wenn Playwright fehlt.

| Tool | Permission | Beschreibung |
|------|-----------|--------------|
| browserOpen | auto | Browser starten, URL oeffnen. Args: url. Returns: pageId |
| browserClick | auto | Element klicken. Args: pageId, selector |
| browserType | auto | Text eingeben. Args: pageId, selector, text |
| browserScreenshot | auto | Screenshot. Args: pageId. Returns: Dateipfad |
| browserNavigate | auto | Zu URL navigieren. Args: pageId, url |
| browserGetText | auto | Text extrahieren. Args: pageId, selector |
| browserClose | auto | Tab schliessen. Args: pageId |

Session-Management:
- Max 3 Tabs pro Agent
- Auto-Close nach 5 Min Inaktivitaet
- Cleanup bei Shutdown: Alle Browser-Sessions werden geschlossen in SparkCell.shutdown()
- Cleanup bei Agent-Pause: Offene Tabs werden gespeichert, bei Resume wiederhergestellt
- Browser-Instanzen werden in BrowserManager zentral verwaltet

---

## Social Media

Baut auf Browser-Tools auf. Social-Media-Tools sind Composed Tools — sie nutzen intern context.toolRunner um Browser-Tools aufzurufen. Interne Sub-Calls ueberspringen den Permission-Check (erben die Permission des aeusseren Tools).

| Tool | Permission | Beschreibung |
|------|-----------|--------------|
| socialPost | ask (einmal, persistent) | Inhalt posten. Args: platform, content, media |
| socialLogin | ask (einmal, persistent) | In Account einloggen. Args: platform. Credentials aus SecureKeyManager |
| socialAnalytics | auto | Statistiken abrufen. Args: platform |
| socialSchedule | auto | Post planen. Args: platform, content, scheduledTime |

### Credential-Verwaltung

- Eingabe: Ueber separaten Credential-Wizard (maskierte Eingabe, kein Klartext im Chat)
- Chat-Befehl /account add <platform> oeffnet maskierten Input-Modus
- /accounts zeigt gespeicherte Plattformen (nie Passwoerter)
- /account revoke <platform> loescht Zugangsdaten

SecureKeyManager-Upgrade: Verschluesselung ueber macOS Keychain via security CLI-Tool statt deterministischem Key. Fallback: User-Passwort-basierter Key via crypto.pbkdf2 bei Ersteinrichtung.

---

## Kommunikation

| Tool | Permission | Beschreibung |
|------|-----------|--------------|
| sendEmail | ask (einmal, persistent) | E-Mail senden. Args: to, subject, body |
| sendSlack | ask (einmal, persistent) | Slack-Nachricht. Args: channel, message |
| sendDiscord | ask (einmal, persistent) | Discord-Nachricht. Args: channel, message |
| notify | auto | User im TUI benachrichtigen. Args: message, priority |

---

## TUI-Integration

### Neuer Tab: Tools (Tab 7)

```
Tools (23 verfuegbar, 3 custom)

  Letzte Aktionen:
  23:15:02  dev-agent       writeFile    src/api/auth.js           ok
  23:15:04  dev-agent       bash         npm test                  ok (12 passed)
  23:15:08  marketing-agent browserOpen  tiktok.com                ok
  23:15:12  marketing-agent browserType  #caption "Neues Video..." ok
  23:15:15  marketing-agent socialPost   tiktok                    WARTET

  Warte auf Bestaetigung:
  > marketing-agent will auf TikTok posten: "Neues Video..."
  > [j]a / [n]ein / [i]mmer erlauben
```

### Neue Dateien

- src/tui/components/ToolsView.js — Tab 7 Komponente
- src/tui/hooks/useToolStatus.js — Hook fuer Tool-Events

### Feed-Events (neue Typen)

| Event | Icon | Farbe |
|-------|------|-------|
| tool:executed | Hammer | blue |
| tool:created | Stern | green |
| tool:permission-requested | Schloss | yellow |
| tool:permission-granted | Schluessel | green |
| tool:failed | X | red |

### Chat-Befehle (neu)

| Befehl | Beschreibung |
|--------|-------------|
| /tools | Alle Tools auflisten |
| /tools custom | Nur Agent-erstellte Tools |
| /allow <tool> | Tool auf auto setzen |
| /deny <tool> | Tool sperren |
| /account add <platform> | Credential-Wizard (maskiert) |
| /accounts | Gespeicherte Plattformen |
| /account revoke <platform> | Zugang loeschen |

### Permission-Anfragen im Chat

Erscheinen als spezielle Nachrichten mit Inline-Antwort:

```
  marketing-agent: Darf ich auf TikTok posten?
    Inhalt: "5 Tipps fuer Gruender..."
  > [j]a / [n]ein / [i]mmer erlauben     (Timeout: 60s)
```

j = einmal erlaubt, i = immer erlaubt (persistent gespeichert), n = abgelehnt.

---

## Aenderungen an bestehenden Dateien

### Agent.js — Agentic Loop

doLLMWork() wird komplett umgebaut. Agent bekommt toolRunner als neue Dependency.

```javascript
constructor(id, options = {}) {
  // ... bestehender Code ...
  this.#toolRunner = options.toolRunner || null;
}
```

Rueckwaertskompatibel: Wenn kein toolRunner uebergeben wird, verhaelt sich der Agent wie bisher (ein LLM-Call, Text-Output).

### LLMManager.js + Provider — Tool-Use Support

Beide Provider muessen erweitert werden:

OpenAICompatibleProvider:
- _buildRequestBody() bekommt tools Parameter
- Response-Parsing: message.tool_calls Array extrahieren
- supportsToolUse Flag — nicht alle lokalen Modelle koennen Tool-Use

AnthropicProvider:
- Request: tools Array im Body
- Response: Content-Blocks mit type tool_use parsen
- Tool-Ergebnisse als type tool_result Content-Blocks senden

Fallback fuer Modelle ohne Tool-Use:
Wenn supportsToolUse === false, werden Tools als Text-Instruktionen in den System-Prompt injiziert. Agent-Code parst dann [TOOL: name({args})] aus der Text-Antwort.

### SparkCell (index.js) — ToolRunner-Integration

- ToolRunner wird im Constructor erstellt
- Core-Tools und Custom-Tools werden registriert
- Agents bekommen toolRunner als Option
- Shutdown: Browser-Sessions schliessen + Permission-State speichern

### App.js — Neuer Tab

Tab-Array: ['Feed', 'Chat', 'Agents', 'Tasks', 'Skills', 'Pause', 'Tools']

---

## Bau-Reihenfolge (Implementation Phases)

### Phase 1: Fundament — ToolRunner + Core Tools
- ToolRunner.js, ToolPermissions.js, ToolValidator.js, ContextManager.js
- Core-Tools: readFile, writeFile, editFile, glob, grep, bash
- Agent.js: Agentic Loop umbau (rueckwaertskompatibel)
- LLMManager: Tool-Use Support fuer OpenAI + Anthropic Provider
- Fallback: Text-basiertes Tool-Calling fuer Modelle ohne native Unterstuetzung
- SparkCell: ToolRunner-Integration + Shutdown-Cleanup
- Tests fuer alle Komponenten

### Phase 2: Meta-Tools + TUI
- createTool, listTools, updateConfig
- Custom-Tool Sandbox via vm.createContext()
- ToolsView TUI-Komponente (Tab 7)
- useToolStatus-Hook
- Feed-Events + Chat-Befehle (/tools, /allow, /deny)
- Permission-Anfragen im Chat mit Timeout
- Tests

### Phase 3: Web-Browser
- Playwright als optionale Dependency
- BrowserManager (zentrale Session-Verwaltung)
- Browser-Tools: open, click, type, screenshot, navigate, getText, close
- Auto-Cleanup bei Shutdown + Pause
- webFetch-Tool (HTTP + Content-Extraction)
- Tests

### Phase 4: Social Media + Credentials
- SecureKeyManager-Upgrade (macOS Keychain / pbkdf2 Fallback)
- Credential-Wizard (maskierte Eingabe)
- Social-Media composed Tools: socialPost, socialLogin, socialAnalytics
- /account Chat-Befehle
- Tests

### Phase 5: Kommunikation
- sendEmail (SMTP), sendSlack (Webhook), sendDiscord (Webhook), notify
- Config fuer SMTP/Webhooks in startup.json
- Tests

---

## Sicherheit

- Bash: Eingeschraenkte Umgebung (workDir, gefilterte ENV-Vars, Timeout). Keine Blacklist — stattdessen Audit-Logging aller Befehle
- Browser: Max 3 Tabs pro Agent, Auto-Close 5min, Cleanup bei Shutdown
- Custom-Tools: vm.createContext() Sandbox, eingeschraenkte Module, 10s Timeout, 3-Strikes Deaktivierung
- Dateisystem: Beschraenkt auf Startup-Verzeichnis + Output-Dir. Pfad-Traversal-Check
- Credentials: macOS Keychain oder pbkdf2-verschluesselt. Nie in Chat-History, Logs oder Feed
- Rate-Limiting: 60 Tool-Calls/Minute pro Agent, 200/Minute global (konfigurierbar)
- Permissions: Genehmigte Aktionen persistent gespeichert. 60s Timeout bei Anfragen
- Audit-Trail: Jeder Tool-Call wird mit Timestamp, Agent, Args und Ergebnis geloggt
- Tool-Fehler: 3 aufeinanderfolgende Fehler -> Agent meldet Blocker + pausiert Tool

## Migration bestehender Module

- src/content/ResearchTool.js -> wird als webFetch-Core-Tool migriert
- src/content/CodeGenerator.js -> Agents nutzen writeFile + LLM direkt, CodeGenerator wird deprecated
- src/content/DocumentManager.js -> bleibt als High-Level-Wrapper, nutzt intern writeFile-Tool
