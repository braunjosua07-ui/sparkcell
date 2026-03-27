# SparkCell Website Design Spec

**Datum:** 2026-03-27
**Projekt:** SparkCell AI-Agent-Framework
**Status:** MVP Design Genehmigt

---

## 1. Konzept

Eine Website, die drei Funktionen vereint:
1. **Dokumentation & API-Referenz** – für Entwickler
2. **Project Showcase** – Use Cases und Beispiele
3. **Landingpage mit CLI-Download** – "OpenClaw"-Art Installation

**Tonfall:** Einsteiger-freundlich mit rebellisch-hackerem Vibe
**Farbschema:** Weinrot (`#722F37`) + Dark Mode + Weiß

---

## 2. Tech-Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS + Custom CSS Variables |
| Typography | Space Grotesk (Display) + Fira Code (Code) |
| Deployment | Vercel (oder GitHub Pages) |
| Hosting | GitHub Repository (sparkcell website branch) |

---

## 3. Page-Struktur (MVP)

### `/` - Landingpage
- **Hero:** Full-Height mit SparkCell Logo, Tagline, "Install in Terminal" Command
- **Quick Install:** Copy-Paste Terminal-Block mit Copy-Button
- **Feature Grid:** 3 Core Features mit Icons
- **Credibility:** "Trusted by" Logos ( Platzhalter für Community)
- **Footer:** Links zu Docs, GitHub, License

### `/docs` - Dokumentation
- Sidebar-Navigation (Mobile: Drawer)
- Pages: Quickstart, Architecture, Tools, MCP, TUI, API Reference
- Inline-Code-Beispiele mit Copy-Button

### `/showcase` - Use Cases
- Grid von Use Cases (Agent-Kooperation, Web-Scraping, etc.)
- Jeder Case: Thumbnail, Titel, Kurzbeschreibung, "View Example" Button

### `/examples` - Code-Beispiele
- Git-basierte Beispiele (Clone-to-Run)
- Jedes Beispiel: Preview, Installation, Run-Command, Expected Output

---

## 4. Design-System

### Color Palette (CSS Variables)
```css
:root {
  --color-bg: #0a0a0a;
  --color-bg-secondary: #1a1a1a;
  --color-bg-terminal: #0d0d0d;

  --color-primary: #722F37; /* Weinrot */
  --color-primary-light: #9A4A56;
  --color-primary-dark: #5A222A;

  --color-text: #e0e0e0;
  --color-text-muted: #a0a0a0;
  --color-accent: #00ff9d; /* Terminal Green */

  --color-code-bg: #1a1a1a;
  --color-code-text: #d4d4d4;
}
```

### Typography
```css
/* Display Font: Space Grotesk */
font-family: 'Space Grotesk', sans-serif;
font-weight: 700;
letter-spacing: -0.02em;

/* Code Font: Fira Code */
font-family: 'Fira Code', monospace;
font-size: 0.9rem;
line-height: 1.6;
```

### Grid-System
- Desktop: 12-column grid, 24px gutters
- Tablet: 6-column grid
- Mobile: Single column

---

## 5. Interaktions-Details

### Hero-Command (OpenClaw Style)
```bash
npm install -g @sparkcell/cli
sparkcell init my-agent
cd my-agent && sparkcell start
```
- Copy-Button mit Animation
- Terminal-Fenster mit simuliertem Output

### Navigation (Mobile)
- Hamburger Drawer mit slide-in Animation
- Overlay mit Halbtransparent-Hintergrund
- Touch-Optimized (min 44px Hitbox)

### Code Blocks
- Syntax Highlighting (Shiki or Prism)
- Copy-Button in oberer rechten Ecke
- Hover-Effekt: subtle border glow in Weinrot

---

## 6. MVP-Checkliste

| Feature | Status |
|---------|--------|
| Hero Section | ✅ |
| Quick Install Command | ✅ |
| Feature Grid | ✅ |
| Docs Navigation | ✅ |
| Code Examples | ✅ |
| Responsive Mobile | ✅ |
| Copy Buttons | ✅ |
| Git Integration | ✅ |

---

## 7. Nächste Schritte

1. **Branch erstellen:** `feature/website-mvp`
2. **Next.js Projekt setup** in `/website` oder `/docs/website`
3. **Design System implementieren** (Colors, Typography, Grid)
4. **Pages implementieren** (Landing, Docs, Showcase, Examples)
5. **Testing & Deployment**

---

## 8. Visual Reference

**Inspiration:**
- Rau Studio (Layout-Struktur, Grid)
- Docusaurus (Docs Navigation)
- Vercel (Minimalistischer Vibe)
- GitHub (Code-Präsentation)

**Nicht kopieren, sondern inspirieren lassen!**
