# App Icons benötigt!

Du brauchst folgende Icon-Dateien für die iOS App:

## Erforderliche Icons:

1. **icon-192.png** (192x192 Pixel)
   - Für PWA und kleine Displays
   
2. **icon-512.png** (512x512 Pixel)
   - Für PWA und große Displays

## Icon-Design Tipps:

- ✅ Einfaches, erkennbares Design
- ✅ Keine Transparenz (iOS App Icons)
- ✅ Quadratisch (iOS rundet automatisch ab)
- ✅ Heller Hintergrund funktioniert besser
- ✅ Kontrastreiche Farben

## Vorschlag für dein Band Planning Icon:

- 🎵 Musiknote Symbol
- 📅 Kalender Symbol
- 🎸 Gitarre Symbol
- Kombination aus beidem

## Tools zum Erstellen:

### Online (kostenlos):
1. **Canva** (https://canva.com)
   - Template: "App Icon"
   - Größe: 1024x1024, dann skalieren

2. **Figma** (https://figma.com)
   - Kostenlos für persönliche Projekte

3. **Icon Kitchen** (https://icon.kitchen)
   - Automatisch alle Größen generieren

### Desktop:
- Adobe Photoshop
- Sketch
- Affinity Designer

## Schnelle Lösung:

Erstelle ein 1024x1024 Bild mit:
- Hintergrundfarbe: #6366f1 (dein Primary Color)
- Weißes Symbol in der Mitte (🎵 oder 📅)
- Exportiere als PNG

Dann mit Icon Kitchen alle Größen generieren lassen.

## Installation:

Sobald du die Icons hast:
```bash
# Icons in images/ Ordner kopieren
cp dein-icon.png images/icon-192.png
cp dein-icon.png images/icon-512.png

# iOS App neu synchen
npx cap sync
```

---

## Temporäre Lösung für Tests:

Du kannst auch erstmal mit Platzhaltern arbeiten.
Die App funktioniert auch ohne schöne Icons zum Testen!
