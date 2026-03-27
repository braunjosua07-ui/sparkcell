# Tool Manifest Format

SparkCell Tools sind JSON-basierte Dateien die definiert sind wie ein Tool arbeitet und was es tut.

## Struktur

```json
{
  "name": "tool-name",
  "description": "Beschreibung was das Tool macht",
  "parameters": {
    "param1": {
      "type": "string",
      "description": "Parameter 1 Beschreibung",
      "required": true
    },
    "param2": {
      "type": "number",
      "description": "Parameter 2 Beschreibung",
      "default": 0
    }
  },
  "code": "console.log('Hello ' + args.name);",
  "enabled": true
}
```

## Felder

| Feld | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `name` | string | yes | Eindeutiger Name des Tools (keine Sonderzeichen) |
| `description` | string | yes | Beschreibung was das Tool tut |
| `parameters` | object | yes | Definition der Parameter (Name → Schema) |
| `code` | string | yes | JavaScript-Code der ausgeführt wird |
| `enabled` | boolean | no | Ob das Tool aktiv ist (default: true) |

## Parameter Schemas

Jeder Parameter hat folgende Attribute:

```javascript
{
  type: "string" | "number" | "boolean" | "object" | "array",
  description: "Beschreibung",
  required: true | false,
  default: "Standardwert"
}
```

## Beispiele

### Echo Tool
```json
{
  "name": "echo",
  "description": "Gibt einen Text aus",
  "parameters": {
    "message": {
      "type": "string",
      "description": "Der auszugebende Text",
      "required": true
    }
  },
  "code": "console.log(args.message);"
}
```

### Add Tool
```json
{
  "name": "add",
  "description": "Addiert zwei Zahlen",
  "parameters": {
    "a": {
      "type": "number",
      "description": "Erste Zahl",
      "required": true
    },
    "b": {
      "type": "number",
      "description": "Zweite Zahl",
      "default": 0
    }
  },
  "code": "console.log(args.a + args.b);"
}
```

## Installation

Tools werden automatisch von `~/.config/sparkcell/tools/` geladen.

## CLI Befehle

```bash
sparkcell tool list        # Alle Tools auflisten
sparkcell tool install <url|file>  # Tool installieren
sparkcell tool remove <name>       # Tool entfernen
sparkcell tool enable <name>       # Tool aktivieren
sparkcell tool disable <name>      # Tool deaktivieren
```
