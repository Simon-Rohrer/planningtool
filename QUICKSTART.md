# 🚀 Quick Start - iOS App Setup

## In 5 Schritten zur testbaren iOS App:

### 1️⃣ Terminal öffnen
```bash
cd /Users/simonrohrer/Webseiten/planingtool
```

### 2️⃣ Abhängigkeiten installieren
```bash
npm install
```

### 3️⃣ iOS Plattform hinzufügen
```bash
npx cap add ios
```

### 4️⃣ Xcode öffnen
```bash
npx cap open ios
```

### 5️⃣ In Xcode testen
- Wähle einen Simulator (z.B. iPhone 15 Pro)
- Drücke ▶️ Play
- Fertig! 🎉

---

## ⚠️ Wichtig VORHER:

**App Icons erstellen!**
Du brauchst mindestens:
- `images/icon-192.png` (192x192px)
- `images/icon-512.png` (512x512px)

Siehe `images/ICONS_NEEDED.md` für Details.

**Oder:** Erstelle Platzhalter-Icons zum Testen:
```bash
# Einfache 192x192 PNG mit Hintergrundfarbe erstellen
# Tool: Preview, Photoshop, oder online mit Canva
```

---

## 🔄 Nach Code-Änderungen:

```bash
npx cap sync
```

Dann in Xcode neu builden (▶️).

---

## 📖 Ausführliche Anleitung:

Siehe `IOS_SETUP.md` für:
- Detaillierte Schritte
- Troubleshooting
- App Store Vorbereitung
- Tipps & Tricks

---

## ✅ Was ist jetzt eingerichtet:

- ✅ PWA (Progressive Web App) - funktioniert im Browser
- ✅ Service Worker - Offline-Funktionalität
- ✅ iOS App Wrapper - Capacitor konfiguriert
- ✅ Ready für Xcode Testing
- ✅ Ready für App Store (nach Icon-Erstellung)

Viel Erfolg! 🎸📱
