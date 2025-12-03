# Supabase Migration - Setup-Anleitung

## Was wurde gemacht

Die App nutzt jetzt **Supabase als primäre Datenbank**, wenn konfiguriert. Fallback auf localStorage bleibt erhalten.

### Anpassungen:
- **`index.html`**: Supabase CDN eingebunden, Settings-Tab für URL/Anon Key hinzugefügt
- **`js/supabase.js`**: Initialisiert Supabase-Client mit deinen Keys (bereits vorausgefüllt)
- **`js/storage.js`**: Alle Methoden sind jetzt async und nutzen Supabase, wenn konfiguriert
- **`js/storage-compat.js`**: Compatibility Layer macht alle Storage-Aufrufe automatisch Promise-kompatibel
- **`js/auth.js`**: Login/Register nutzen Supabase (async)
- **`supabase_setup.sql`**: SQL-Schema für alle Tabellen

---

## Setup-Schritte

### 1. Supabase-Tabellen erstellen

1. Öffne dein Supabase-Projekt: https://brkapsnrdewuualhsmcr.supabase.co
2. Gehe zu **SQL Editor** (linke Sidebar)
3. Öffne die Datei `supabase_setup.sql` in diesem Projekt
4. Kopiere den kompletten SQL-Code und füge ihn im SQL Editor ein
5. Klicke auf **Run** (oder Strg+Enter)

Das erstellt alle Tabellen und fügt den Admin-User ein (Username: `admin`, Passwort: `bandprobe`).

### 2. App starten

```zsh
cd /Users/simonrohrer/Webseiten/planingtool
python3 -m http.server 8000
```

Dann öffne: http://localhost:8000

### 3. Prüfen, dass Supabase aktiv ist

1. Öffne die **Browser-Konsole** (F12 → Console)
2. Du solltest sehen: 
   - `Supabase client initialized`
   - `✅ Storage Async Compatibility Layer geladen`
3. Deine Keys sind bereits vorausgefüllt

Optional: Gehe zu Settings → Supabase Konfiguration, um die Keys zu prüfen oder anzupassen.

### 4. Login und Testen

1. **Login** mit: `admin` / `bandprobe`
2. **Erstelle eine Band**, lade Mitglieder ein, erstelle Events/Proben
3. Öffne dein Supabase-Dashboard → **Table Editor** und prüfe, ob die Daten in den Tabellen auftauchen

---

## Wichtige Hinweise

### Async-Migration ✅
- Alle Storage-Methoden sind async
- **`storage-compat.js` macht alle Aufrufe automatisch Promise-kompatibel**
- Existierender Code funktioniert weiter, neue Features können `await` nutzen
- Login/Register sind vollständig auf async umgestellt

### Compatibility Layer
Der `storage-compat.js` Proxy sorgt dafür, dass:
- Alte synchrone `Storage.xyz()` Aufrufe weiterhin funktionieren
- Neue async `await Storage.xyz()` Aufrufe auch funktionieren
- Keine manuelle Migration von hunderten Funktionen nötig ist

---

## Troubleshooting

### "Supabase client initialized" erscheint nicht
- Prüfe, ob die Keys korrekt in localStorage gespeichert sind
- Öffne Console und tippe: `localStorage.getItem('supabase.url')`
- Sollte deine URL zurückgeben

### Daten werden nicht gespeichert
- Prüfe Supabase Table Editor: Sind Tabellen leer?
- Konsole: Gibt es Fehler wie "permission denied"?
- Falls ja: RLS ist aktiv, muss policies erstellen oder RLS pro Tabelle deaktivieren

### Login schlägt fehl
- Stelle sicher, dass du das SQL-Script ausgeführt hast (Admin-User wird dabei erstellt)
- Prüfe in Supabase Table Editor → users, ob der Admin-Eintrag existiert

### "Cannot read property of undefined" Fehler
- Lösche localStorage und lade neu: `localStorage.clear()` in Console
- Stelle sicher, dass SQL-Script erfolgreich ausgeführt wurde

---

## Nächste Schritte (Optional)

### Für Produktion:
1. **RLS aktivieren**: Row Level Security Policies für jede Tabelle erstellen
2. **Auth umstellen**: Statt localStorage-basierter Auth Supabase Auth nutzen
3. **Passwörter hashen**: bcrypt oder ähnliches für sichere Passwortspeicherung
4. **Umgebungsvariablen**: Keys aus `.env` laden statt hardcoded

### Weitere Optimierungen:
- Realtime-Subscriptions für Live-Updates
- Image Upload via Supabase Storage statt Base64
- Caching-Strategie für häufig abgerufene Daten
