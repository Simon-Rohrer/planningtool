# Supabase Auth Migration Guide

## Übersicht
Diese Anleitung zeigt dir, wie du von der alten "Custom Auth" auf **echte Supabase Authentication** migrierst.

## ⚠️ WICHTIG: Backup erstellen!
Bevor du beginnst, erstelle ein Backup deiner aktuellen Daten in Supabase!

## Schritt 1: Neue Datenbank mit Auth aufsetzen

1. Öffne das Supabase Dashboard: https://app.supabase.com
2. Wähle dein Projekt aus
3. Gehe zu **SQL Editor**
4. Öffne die Datei `supabase_setup_with_auth.sql`
5. Kopiere den gesamten Inhalt
6. Füge ihn in den SQL Editor ein
7. Klicke auf **Run** (oder Ctrl/Cmd + Enter)

**Was passiert:**
- Alle Tabellen werden neu erstellt
- Die `users`-Tabelle nutzt jetzt UUIDs von Supabase Auth
- Ein Trigger erstellt automatisch Profile für neue Auth-User
- RLS ist aktiviert mit sicheren Policies

## Schritt 2: Email-Bestätigung deaktivieren (für Development)

Da du noch keine Email-Konfiguration hast:

1. Gehe zu **Authentication** → **Providers** → **Email**
2. Deaktiviere **"Confirm email"**
3. Speichern

**Wichtig:** In Produktion solltest du Email-Bestätigung aktivieren!

## Schritt 3: Code-Änderungen sind bereits implementiert

Die folgenden Dateien wurden bereits aktualisiert:
- ✅ `js/auth.js` - Nutzt jetzt `signUp`, `signInWithPassword`, `signOut`
- ✅ `js/app.js` - `init()` ruft `Auth.init()` auf
- ✅ `index.html` - Register-Form hat bereits Email-Feld

## Schritt 4: Testen

1. Öffne deine App im Browser
2. Gehe zur Registrierung
3. Registriere einen neuen User:
   - Registrierungscode: `c2j5Dps!`
   - Name, Email, Username, Passwort eingeben
4. Nach erfolgreicher Registrierung solltest du eingeloggt sein

## Schritt 5: Bestehende User migrieren (Optional)

Falls du bestehende User hast, musst du sie manuell in Supabase Auth erstellen:

### Option A: Über Supabase Dashboard
1. Gehe zu **Authentication** → **Users**
2. Klicke auf **Add user**
3. Gib Email und Passwort ein
4. Der User wird automatisch in der `users`-Tabelle angelegt (durch den Trigger)

### Option B: Via SQL (für mehrere User)
```sql
-- Beispiel: User erstellen
-- Dies muss für jeden bestehenden User gemacht werden
-- Ersetze die Werte entsprechend

-- 1. In Supabase Dashboard → Authentication → Users → Add user
--    Email: user@example.com
--    Password: neugesetztesPassword
--    Auto-confirm: ✓ (Haken setzen)

-- 2. Nach dem Erstellen: User-UUID kopieren (z.B. "123e4567-e89b-12d3-a456-426614174000")

-- 3. Profil-Daten updaten
UPDATE users 
SET 
  username = 'alter_username',
  name = 'Alter Name',
  instrument = 'Gitarre'
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
```

## Schritt 6: Admin-User erstellen

1. Registriere einen Admin-User über die App
2. Kopiere die User-UUID aus der Supabase Console (**Authentication** → **Users**)
3. Führe in **SQL Editor** aus:
```sql
UPDATE users 
SET "isAdmin" = true 
WHERE id = 'UUID-DES-ADMINS';
```

## Wie es funktioniert

### Registrierung
1. User registriert sich mit Email/Password
2. Supabase Auth erstellt Entry in `auth.users`
3. Trigger `on_auth_user_created` erstellt automatisch Profil in `users`-Tabelle
4. User ist automatisch eingeloggt

### Login
1. User gibt Username oder Email + Password ein
2. App prüft: Ist es eine Email? Falls nein, suche Email zum Username
3. Supabase Auth macht `signInWithPassword` mit Email
4. Session wird automatisch gespeichert
5. `Auth.setCurrentUser()` lädt das Profil aus `users`-Tabelle

### Logout
1. `Auth.logout()` ruft `supabase.auth.signOut()` auf
2. Session wird gelöscht
3. User wird zur Login-Seite weitergeleitet

### Session Persistence
- `Auth.init()` prüft beim Page-Load, ob eine Session existiert
- Falls ja: User automatisch eingeloggt
- `onAuthStateChange` listener reagiert auf Sign-in/Sign-out Events

## RLS Policies erklärt

### Users-Tabelle
- **Lesen:** Jeder kann alle User-Profile sehen (für Band-Member Listen)
- **Schreiben:** User kann nur eigenes Profil updaten

### Bands-Tabelle
- **Lesen:** Alle authentifizierten User
- **Schreiben:** Nur Band-Members können ihre Band verwalten

### Events, Rehearsals, Songs
- **Lesen/Schreiben:** Nur Band-Members der jeweiligen Band

### Votes
- **Lesen:** Band-Members können Votes ihrer Rehearsals sehen
- **Schreiben:** User kann nur eigene Votes erstellen/ändern

### Absences
- **Lesen:** User sieht eigene Absences + Absences von Band-Kollegen
- **Schreiben:** User kann nur eigene Absences verwalten

## Troubleshooting

### "Email not confirmed"
→ Deaktiviere Email-Bestätigung in **Authentication** → **Providers** → **Email**

### "User already registered"
→ Email ist bereits in Supabase Auth. Nutze andere Email oder lösche User in **Authentication** → **Users**

### "Invalid login credentials"
→ Falsche Email/Password Kombination. Prüfe Groß-/Kleinschreibung

### RLS-Fehler: "row-level security policy"
→ Führe `supabase_setup_with_auth.sql` nochmal aus, um Policies zu erstellen

### User kann keine Bands sehen/erstellen
→ Prüfe, ob User in `bandMembers`-Tabelle eingetragen ist
→ RLS Policy erlaubt nur Band-Members Zugriff

## Vorteile von Supabase Auth

✅ **Sicherheit:** Passwörter werden gehashed, nicht im Klartext gespeichert
✅ **Session Management:** Automatische Token-Verwaltung
✅ **RLS Integration:** `auth.uid()` für sichere Policies
✅ **Multi-Device:** Login bleibt auf allen Geräten synchron
✅ **Password Reset:** Kann später einfach hinzugefügt werden
✅ **OAuth:** Google, GitHub Login später möglich

## Nächste Schritte (Optional)

1. **Email-Bestätigung aktivieren:**
   - SMTP-Server konfigurieren in Supabase
   - "Confirm email" in Authentication aktivieren

2. **Password Reset implementieren:**
   - `supabase.auth.resetPasswordForEmail()`
   - Reset-Link per Email

3. **OAuth-Provider hinzufügen:**
   - Google, GitHub, etc. in Authentication aktivieren
   - `supabase.auth.signInWithOAuth()`

4. **2FA aktivieren:**
   - Multi-Factor Authentication in Supabase Dashboard

## Support

Falls Probleme auftreten:
1. Prüfe Browser Console auf Fehler
2. Prüfe Supabase Dashboard → **Logs** für Backend-Fehler
3. Prüfe, ob alle SQL-Scripts erfolgreich ausgeführt wurden
