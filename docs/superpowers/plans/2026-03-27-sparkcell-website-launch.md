# SparkCell Website Launch Plan

**Datum:** 2026-03-27
**Status:** MVP Website komplett - Deploy vorbereiten
**Ziel:** Launch der statischen Website auf Vercel/GitHub Pages

---

## Aktueller Stand

### Erledigt
- ✅ Landingpage (`/`) - Hero mit Terminal-Emulator, Features Grid, Install-Command
- ✅ Dokumentation (`/docs/`) - Sidebar Navigation, Code-Blöcke, CLI Reference
- ✅ Showcase (`/showcase.html`) - 6 Use Cases mit Tags und Hover-Effekte
- ✅ Examples (`/examples.html`) - 6 Clone-and-Run Beispiele mit Befehlsblöcken
- ✅ Design System - Dark-Only Terminal Theme mit CRT-Scanline-Effekt
- ✅ Responsive Mobile (Hamburger-Menü)

### Projektstruktur
```
docs/website/
├── index.html          (Landingpage)
├── docs/index.html     (Dokumentation)
├── showcase.html       (Use Cases)
├── examples.html       (Beispiele)
├── vercel.json         (Deployment Config)
├── package.json        (npm project)
└── vite.config.js      (Build Konfiguration)
```

---

## Nächste Schritte

### Phase 1: Deploy Vorbereitung (15 min)

1. **Branch erstellen**
   ```bash
   cd /Users/josuabraun/Desktop/sparkcell
   git checkout -b feature/website-mvp
   git add docs/website/
   git commit -m "feat: static SparkCell website MVP"
   git push -u origin feature/website-mvp
   ```

2. **Vercel Deployment**
   ```bash
   cd docs/website
   vercel
   # oder via Vercel Dashboard: Import GitHub Repo
   ```

3. **Domain Konfiguration**
   - Vercel bietet automatisch `sparkcell.vercel.app`
   - Custom Domain: `sparkcell.ai` oder `sparkcell.dev`

### Phase 2: SEO & Analytics (30 min)

1. **Meta Tags ergänzen**
   - Website-wide Open Graph Tags
   - Twitter Card Metadata
   - robots.txt

2. **Analytics Setup**
   - Plausible (privacy-first) oder Google Analytics
   - Fathom Analytics (optional)

3. **Sitemap Generierung**
   - automated via GitHub Action oder manuell

### Phase 3: Testing (20 min)

1. **Cross-Browser Testing**
   - Chrome, Firefox, Safari, Edge

2. **Mobile Testing**
   - iOS Safari, Android Chrome
   - Responsive Breakpoints prüfen

3. **Performance Check**
   - Lighthouse Audit (Target: >90)
   - Core Web Vitals überwachen

### Phase 4: Post-Launch (45 min)

1. **README.md aktualisieren**
   - Link zur Website hinzufügen
   - Deployment Status dokumentieren

2. **Changelog aktualisieren**
   - Website MVP Release notieren
   - Contributors vermerken

3. **Tweet/Vita发布**
   - Twitter/X Post
   - Hacker News (optional)
   - Reddit (r/reactjs, r/webdev)

---

## Deploy Checkliste

- [ ] Branch `feature/website-mvp` erstellt und gepusht
- [ ] Vercel Projekt importiert/verbunden
- [ ] Custom Domain konfiguriert (oder Vercel Subdomain genutzt)
- [ ] HTTPS aktiviert
- [ ] Analytics eingebunden
- [ ] robots.txt ausgerollt
- [ ] Lighthouse Audit > 90 Punkte
- [ ] Mobile Responsive getestet
- [ ] README.md mit Website Link aktualisiert
- [ ] Changelog aktualisiert
- [ ] Launch Announcement geplant

---

## Troubleshooting

### Probleme mit Vercel Build
- Prüfe `package.json` scripts
- Stelle sicher, alle HTML Files im Root liegen
- `vercel.json` muss korrekt konfiguriert sein

### Domain nicht erreichbar
- DNS Einträge prüfen (A Record, CNAME)
- TTL Werte abwarten (bis zu 24h, normalerweise < 5min)

### SSL Zertifikat nicht verfügbar
- Vercel auto-letsencrypt (dauert ~5 min)
- Manuelles Zertifikat importieren falls nötig

---

## Links

- **Design Spec:** `docs/superpowers/specs/2026-03-27-sparkcell-website-design.md`
- **Project Status:** `docs/superpowers/plans/2026-03-26-sprint-4-completion-plan.md` (archiviert)
- **Framework README:** `/Users/josuabraun/Desktop/sparkcell/README.md`

---

## Nächster Plan nach Website Launch

1. **Test-Coverage erhöhen** (50 Source-Files ohne Tests)
2. **Performance/Load-Tests** implementieren
3. **Agent-zu-Agent Kommunikation** verbessern
4. **Protection Storage** in JSON-Datei umziehen

---

**Status:** Bereit zum Deploy 🚀
