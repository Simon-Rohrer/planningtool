# TODO Liste - Band Planning Tool

## Priorität: Hoch

## Priorität: Mittel

### Email-System einrichten
- [ ] SMTP-Anbieter wählen (Empfehlung: SendGrid Free Tier - 100 Emails/Tag)
- [ ] SMTP-Zugangsdaten erstellen
- [ ] In Supabase SMTP konfigurieren:
  - Dashboard → Project Settings → Auth → SMTP Settings
  - SMTP Host, Port, Username, Password eintragen
  - Sender Email und Name festlegen
- [ ] Email-Bestätigung aktivieren:
  - Dashboard → Authentication → Providers → Email
  - "Confirm email" aktivieren
- [ ] Email Templates anpassen:
  - Dashboard → Authentication → Email Templates
  - Confirm Signup Template personalisieren
  - Password Reset Template anpassen
- [ ] Test-Registrierung durchführen und Email prüfen

## Priorität: Niedrig

## Erledigt ✅
- ✅ Supabase Auth Integration
- ✅ RLS Policies ohne Recursion
- ✅ Vote-System async Funktionen
- ✅ Song-Management mit Auto-Save
- ✅ Rollback-System für Event-Songs
