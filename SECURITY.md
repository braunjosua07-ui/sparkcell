# 🔒 Sicherheitshinweise für SparkCell

## Warnung: Öffentliches Repository

Wenn dieses Repository öffentlich ist, kann jeder:

1. **API Keys extrahieren** - Die `.env` Datei enthält sensible Keys
2. **Code kopieren** - Die gesamte Software ist kopierbar
3. **Forks manipulieren** - Bösartige Erweiterungen sind möglich

## Was du tun solltest:

### 1. API Key rotieren (SOFORT)
```bash
# Den Tavily Key bei https://app.tavily.com/home neu generieren
```

### 2. `.env` aus dem Repo entfernen
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all
```

### 3. `.gitignore` hinzufügen
```gitignore
.env
.env.*
*.key
config*.json
```

### 4. Repo auf privat stellen (empfohlen)

Gehe zu GitHub → Settings → Danger Zone → "Change repository visibility" → "Private"

---

## Was dieses Projekt NICH T kann:

- Kein automatischer Code-Execution auf deinem System
- Kein Zugriff auf GitHub Credentials durch Repo allein
- Kein Skript-Ausführung ohne deine explizite Genehmigung

---

## Autorisierung

Dieses Projekt wurde erstellt von:
- **Josua Braun**

---

*Letzte Aktualisierung: 2026-03-27*
