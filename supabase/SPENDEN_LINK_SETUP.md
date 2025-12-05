# Spenden-Link Setup mit Supabase

## 📝 Was wurde geändert?

Der Spenden-Link wird jetzt in der Supabase-Datenbank gespeichert statt in localStorage. Dadurch ist er für alle Benutzer sichtbar und zentral verwaltbar.

## 🗄️ Datenbank Setup

**Schritt 1:** Führe das SQL-Script in Supabase aus:
```bash
supabase/supabase_settings_table.sql
```

**In Supabase Dashboard:**
1. Gehe zu deinem Projekt
2. Klicke auf "SQL Editor"
3. Öffne `supabase_settings_table.sql`
4. Kopiere den gesamten Inhalt
5. Füge ihn im SQL Editor ein
6. Klicke "Run"

## ✨ Was macht das Script?

- ✅ Erstellt eine `settings` Tabelle für globale Einstellungen
- ✅ Jeder kann Settings lesen
- ✅ Nur Admins können Settings ändern (RLS Policy)
- ✅ Automatische Timestamps bei Updates
- ✅ Initialer Eintrag für `donateLink` wird erstellt

## 🎯 Nutzung

**Als Admin:**
1. Gehe zu "Einstellungen"
2. Scrolle zu "Spenden-Link"
3. Trage deinen PayPal-Link ein (z.B. `https://paypal.me/deinname`)
4. Klicke "Spenden-Link speichern"

**Für alle Benutzer:**
- Der "💖 Spenden" Button erscheint in "News & Updates"
- Klick öffnet den konfigurierten PayPal-Link in neuem Tab
- Wenn kein Link konfiguriert ist, führt der Button zu den Einstellungen

## 🔧 Technische Details

### Neue Storage Funktionen:
```javascript
// Link laden
const link = await Storage.getSetting('donateLink');

// Link speichern
await Storage.setSetting('donateLink', 'https://paypal.me/example');
```

### Datenbank Schema:
```sql
settings (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE,
  value TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT (user id)
)
```

## ✅ Migration von localStorage

Wenn du bereits einen Spenden-Link in localStorage hattest:
1. Der alte Link wird **nicht** automatisch übertragen
2. Gehe zu Einstellungen und trage den Link erneut ein
3. Er wird dann in Supabase gespeichert

## 🔒 Sicherheit

- RLS (Row Level Security) ist aktiviert
- Nur Admins können den Link ändern
- Alle Benutzer können den Link lesen
- Änderungen werden mit User-ID und Timestamp protokolliert
