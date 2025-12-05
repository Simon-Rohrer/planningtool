# Band Planning Tool - iOS App Setup

## 📱 Setup für iPhone App (Xcode Testing)

### Voraussetzungen
- ✅ macOS mit Xcode installiert (aus dem App Store)
- ✅ Node.js installiert (https://nodejs.org)
- ✅ Dein Mac ist bereit 😊

---

## 🚀 Schritt-für-Schritt Anleitung

### 1. Terminal öffnen und ins Projektverzeichnis wechseln
```bash
cd /Users/simonrohrer/Webseiten/planingtool
```

### 2. Capacitor installieren
```bash
npm install
```

### 3. iOS Plattform hinzufügen
```bash
npx cap add ios
```

### 4. Icons erstellen (wichtig!)
Du brauchst App-Icons. Erstelle diese Dateien:
- `images/icon-192.png` (192x192 Pixel)
- `images/icon-512.png` (512x512 Pixel)

**Tipp:** Nutze ein Online-Tool wie https://icon.kitchen oder erstelle sie in Photoshop/Figma

### 5. Projekt zu iOS kopieren
```bash
npx cap sync
```

### 6. Xcode öffnen
```bash
npx cap open ios
```

oder manuell öffnen:
```bash
open ios/App/App.xcworkspace
```

---

## 🧪 In Xcode testen

### Im Simulator testen:
1. Xcode öffnet sich automatisch
2. Oben links: Wähle ein iPhone Simulator (z.B. "iPhone 15 Pro")
3. Klicke auf ▶️ Play Button
4. Die App startet im Simulator!

### Auf echtem iPhone testen:
1. iPhone mit USB verbinden
2. iPhone entsperren
3. In Xcode: Wähle dein iPhone aus der Liste (oben links)
4. Klicke auf ▶️ Play Button
5. Beim ersten Mal:
   - Auf dem iPhone: Settings → General → VPN & Device Management
   - Deinem Developer-Profil vertrauen
6. App startet auf deinem iPhone!

---

## 🔄 Nach Code-Änderungen

Wenn du etwas im Web-Code änderst:

```bash
# 1. Änderungen zu iOS kopieren
npx cap sync

# 2. In Xcode neu builden (▶️ Play drücken)
```

Oder nutze das npm Script:
```bash
npm run build-ios
```

---

## 📦 App Store Vorbereitung

### Benötigt:
1. **Apple Developer Account** ($99/Jahr)
   - https://developer.apple.com

2. **App Icons in allen Größen**
   - Xcode zeigt dir welche Größen fehlen
   - Asset Catalog: `ios/App/App/Assets.xcassets/AppIcon.appiconset`

3. **Launch Screen / Splash Screen**
   - `ios/App/App/Assets.xcassets/Splash.imageset`

4. **App Store Screenshots**
   - Verschiedene iPhone-Größen
   - Mache Screenshots im Simulator

5. **In Xcode konfigurieren:**
   - Bundle Identifier: `com.bandplanning.app` (muss eindeutig sein)
   - Version & Build Number
   - Team auswählen (dein Apple Developer Account)

### Build für App Store:
1. In Xcode: Product → Archive
2. Organizer öffnet sich
3. "Distribute App" klicken
4. "App Store Connect" wählen
5. Upload zu Apple
6. In App Store Connect fertig konfigurieren

---

## 🛠️ Nützliche Befehle

```bash
# Entwicklung: Live Reload (Web)
npm start

# iOS App öffnen
npm run open-ios

# Sync + Xcode öffnen
npm run build-ios

# Nur sync (Änderungen kopieren)
npx cap sync

# iOS komplett neu hinzufügen (falls Probleme)
npx cap sync --force
```

---

## ⚠️ Troubleshooting

### "capacitor.js not found"
Normal! Capacitor erstellt diese Datei automatisch beim iOS-Build.

### "Module not found" Fehler
```bash
rm -rf node_modules package-lock.json
npm install
```

### Icons werden nicht angezeigt
1. Stelle sicher, dass `images/icon-192.png` und `images/icon-512.png` existieren
2. `npx cap sync` erneut ausführen
3. In Xcode: Clean Build Folder (Cmd + Shift + K)

### App startet nicht im Simulator
1. Simulator komplett schließen
2. Xcode neu starten
3. Erneut versuchen

---

## 📱 Was funktioniert jetzt?

### ✅ Im Web Browser:
- Progressive Web App (PWA)
- Offline-Funktionalität (Service Worker)
- Installierbar auf Android/iOS (Add to Home Screen)

### ✅ In Xcode/iPhone:
- Native iOS App
- Kann im Simulator getestet werden
- Kann auf echtem iPhone installiert werden
- Bereit für App Store Upload
- Zugriff auf native iOS-Features möglich

---

## 🎯 Nächste Schritte

1. **Icons erstellen** (wichtig!)
2. `npx cap add ios` ausführen
3. In Xcode öffnen und testen
4. Apple Developer Account holen (wenn du in den App Store willst)
5. App Store Metadaten vorbereiten (Beschreibung, Screenshots, etc.)

---

## 💡 Tipps

- **Debugging:** Nutze Safari Developer Tools für iOS Simulator
  - Safari → Develop → Simulator → [Deine App]
  
- **Schnelles Testen:** Änderungen am Web-Code werden sofort sichtbar nach `npx cap sync`

- **Native Features:** Capacitor-Plugins für Kamera, Push-Notifications, etc. können später hinzugefügt werden

---

Viel Erfolg! 🚀🎸
