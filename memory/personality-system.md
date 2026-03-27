---
name: personality-system
description: SparkCell Big Five Personality System - Agent Soul & Character
type: project
---

## Big Five Personality Model Implementation

SparkCell nutzt das Big Five Persönlichkeitsmodell für seine Agents:

### Die 5 Kerntrait dimensionen:
1. **Openness** (Offenheit) - Kreativität, Neugier, Abenteuerlust
2. **Conscientiousness** (Gewissenhaftigkeit) - Organisierung, Zuverlässigkeit
3. **Extraversion** (Extraversion) - Geselligkeit, Energie
4. **Agreeableness** (Vereinbarkeit) - Kooperativität, Mitgefühl
5. **Neuroticism** (Neurotizismus) - Emotionale Stabilität

### Persönlichkeits-Templates:
- **ceo**: openness:80, conscientiousness:75, extraversion:85, agreeableness:60, neuroticism:30
- **tech**: openness:70, conscientiousness:85, extraversion:40, agreeableness:70, neuroticism:40
- **product**: openness:75, conscientiousness:70, extraversion:75, agreeableness:80, neuroticism:35
- **design**: openness:90, conscientiousness:60, extraversion:60, agreeableness:75, neuroticism:45
- **marketing**: openness:65, conscientiousness:60, extraversion:90, agreeableness:70, neuroticism:40

### Soul Score Berechnung:
```javascript
// Neuroticism ist invertiert (niedrig = besser)
const soulScore = (
  openness * 0.15 +
  conscientiousness * 0.20 +
  extraversion * 0.15 +
  agreeableness * 0.20 +
  (100 - neuroticism) * 0.30
);
```

### Soul Evolution Events:
- `agent:soul-evolution` wird publiziert wenn Persönlichkeit sich ändert
- Events enthalten: `oldSoulScore`, `newSoulScore`, `changes` (Trait-Änderungen)
- Visualisiert in TUI mit Heart-Icons: ❤️ SOUL, ♥ soul, ☓ soul

### Character Attributes (neben Big Five):
- `humor`: sarkastisch, witzig, trocken, kreativ, neutral
- `style`: prägnant, direkt, technisch, genau, Nutzerzentriert, ästhetisch, emotional
- `approach`: decision-driven, solution-oriented, data-driven, experimentell, adaptiv
- `values`: Array von Werten (z.B. ['wachstum', 'impact', 'exzellenz'])

### Dateien:
- `/Users/josuabraun/Desktop/sparkcell/src/core/Personality.js` - Kern-Implementierung
- `/Users/josuabraun/Desktop/sparkcell/src/core/Agent.js` - Integration in Agent
- `/Users/josuabraun/Desktop/sparkcell/src/tui/components/AgentsView.js` - TUI Anzeige
- `/Users/josuabraun/Desktop/sparkcell/src/tui/components/FeedView.js` - Event Feed
- `/Users/josuabraun/Desktop/sparkcell/src/tui/components/StatusBar.js` - Status Bar

### Test Status:
Alle 420 Tests grün ✅
