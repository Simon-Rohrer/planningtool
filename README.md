# Band Planning Tool 🎵

Ein umfassendes web-basiertes Tool zur Organisation von Bands, Probenterminen und Auftritten.

## Features

### Benutzerverwaltung
- **Registrierung** mit Zugangscode (`c2j5Dps!`)
- **Login/Logout** System
- **Admin-Rolle** mit erweiterten Berechtigungen
- **E-Mail-Integration** für Benachrichtigungen

### Band-Management
- **Mehrere Bands** pro Benutzer möglich
- **Rollensystem**:
  - 🟣 **Leiter** (Leader): Volle Verwaltungsrechte
  - 🔵 **Co-Leiter** (Co-Leader): Kann Proben/Auftritte verwalten
  - 🟡 **Mitglied** (Member): Kann abstimmen und teilnehmen
- **Beitrittscode-System** für einfaches Hinzufügen neuer Mitglieder
- **Bandnamen bearbeiten** (Leiter & Co-Leiter)

### Probentermine
- **Terminvorschläge** mit mehreren Datumsoptionen
- **Abstimmungssystem**: ✅ Kann / ❓ Vielleicht / ❌ Kann nicht
- **Accordion-Ansicht** zum Auf-/Zuklappen von Details
- **Standort-Auswahl** aus vorkonfigurierten Orten
- **Auftritts-Verknüpfung**: Proben können einem Auftritt zugeordnet werden
- **Bestätigungsprozess**:
  - Leiter/Co-Leiter sehen Abstimmungsübersicht
  - Beste Termine werden automatisch berechnet
  - Auswahl der zu benachrichtigenden Mitglieder
  - Automatischer E-Mail-Versand bei Bestätigung

### Auftritte
- **Event-Verwaltung** mit Datum, Ort und Details
- **Teilnehmerverwaltung**:
  - Bandmitglieder (vorausgewählt)
  - Gäste
- **Technik-Informationen** separat erfassbar
- **Accordion-Ansicht** mit allen Details

### Standorte
- **Zentrale Verwaltung** durch Admins
- **Name und Adresse** für jeden Standort
- **Wiederverwendbar** bei Proben

### Statistiken
- **Verfügbarkeitsvisualisierung** pro Termin
- **Beste Termine** automatisch berechnet
- **Mitglieder-Heatmap** für Übersicht

### Admin-Bereich (Settings)
- **Standort-Verwaltung**: Orte anlegen und löschen
- **Band-Management**: 
  - Alle Bands als aufklappbare Karten
  - Mitglieder und Beitrittscodes einsehen
  - Bands erstellen und löschen

## Technologie

### Frontend
- **HTML5** + **CSS3** (Vanilla, kein Framework)
- **JavaScript** (ES6+, modular)
- **LocalStorage** für Datenpersistenz

### E-Mail-Integration
- **EmailJS** für Benachrichtigungen
- Konfiguration in `js/email-service.js`:
  ```javascript
  serviceId: 'service_cadjeiq'
  templateId: 'template_l9a8mdf'
  publicKey: '5upXiXp5loj1iOMv7'
  ```

### Dateistruktur
```
planingtool/
├── index.html              # Haupt-HTML
├── css/
│   └── style.css          # Komplettes Styling
├── js/
│   ├── app.js             # Haupt-Controller
│   ├── auth.js            # Authentifizierung & Berechtigungen
│   ├── storage.js         # Datenpersistenz (LocalStorage)
│   ├── bands.js           # Band-Verwaltung
│   ├── events.js          # Auftrittsverwaltung
│   ├── rehearsals.js      # Probentermin-Verwaltung
│   ├── statistics.js      # Statistik-Berechnungen
│   ├── email-service.js   # EmailJS-Integration
│   └── ui.js              # UI-Utilities
├── EMAIL_TEMPLATE.md       # EmailJS Template-Anleitung
└── REGISTRIERUNGSCODES.md  # Zugangscode-Info
```

## Installation & Start

### Lokaler Webserver
```bash
cd planingtool
python3 -m http.server 8000
```

Dann öffne: `http://localhost:8000`

### Erste Schritte

1. **Registrierung**:
   - Code: `c2j5Dps!`
   - Name, E-Mail, Benutzername, Passwort eingeben

2. **Admin-Login**:
   - Benutzername: `admin`
   - Passwort: `bandprobe`
   - E-Mail: `Simon.rohrer04@web.de`

3. **Band erstellen** (nur Admin):
   - Settings → Bandmanagement → "Neue Band erstellen"
   - Admin ist **nicht** automatisch Mitglied der Band
   - Band erscheint nur im Bandmanagement mit Beitrittscode

4. **Mitglieder einladen**:
   - Beitrittscode im Bandmanagement kopieren
   - Mitglieder geben Code unter "Band beitreten" ein
   - Erster Beitretender wird automatisch zum Leiter

5. **Probentermin vorschlagen**:
   - Probentermine → "Neuer Probetermin"
   - Band, Titel, Ort, Termine auswählen
   - Mitglieder stimmen ab

6. **Termin bestätigen**:
   - Probe öffnen → "Öffnen & Bestätigen"
   - Besten Termin auswählen
   - Ort festlegen
   - Zu benachrichtigende Mitglieder auswählen
   - E-Mails werden automatisch versendet

## Berechtigungen

| Aktion | Admin | Leiter | Co-Leiter | Mitglied |
|--------|-------|--------|-----------|----------|
| Band erstellen | ✅ | ❌ | ❌ | ❌ |
| Band löschen | ✅ | ✅ | ❌ | ❌ |
| Bandnamen ändern | ✅ | ✅ | ✅ | ❌ |
| Rollen ändern | ✅ | ✅ | ❌ | ❌ |
| Mitglieder hinzufügen | ✅ | ✅ | ❌ | ❌ |
| Probe erstellen | ✅ | ✅ | ✅ | ❌ |
| Probe bestätigen | ✅ | ✅ | ✅ | ❌ |
| Auftritt erstellen | ✅ | ✅ | ✅ | ❌ |
| Abstimmen | ✅ | ✅ | ✅ | ✅ |
| Standorte verwalten | ✅ | ❌ | ❌ | ❌ |

## E-Mail-Template

Die E-Mail-Vorlage in EmailJS muss folgende Variablen unterstützen:
- `{{to_name}}` - Empfängername
- `{{to_email}}` - Empfänger-E-Mail
- `{{band_name}}` - Bandname
- `{{rehearsal_title}}` - Probentitel
- `{{rehearsal_description}}` - Beschreibung
- `{{rehearsal_date}}` - Datum & Uhrzeit
- `{{rehearsal_location}}` - Ort (Name + Adresse)

Siehe `EMAIL_TEMPLATE.md` für Details.

## Sicherheitshinweise

⚠️ **Nur für Demo/Entwicklung!**

- Passwörter werden im Klartext in LocalStorage gespeichert
- Keine serverseitige Validierung
- Keine Verschlüsselung

**Für Produktion erforderlich:**
- Backend-Server (Node.js, PHP, etc.)
- Datenbank (PostgreSQL, MySQL, MongoDB)
- Passwort-Hashing (bcrypt)
- HTTPS
- JWT-Tokens
- Input-Sanitization

## Browser-Kompatibilität

Getestet in:
- ✅ Chrome (neueste Version)
- ✅ Firefox (neueste Version)
- ✅ Safari (neueste Version)
- ✅ Edge (neueste Version)

## Responsive Design

- 📱 **Mobile** (375px+): Touch-optimiert, kompakte Ansicht
- 📱 **Tablet** (768px+): Angepasste Layouts
- 💻 **Desktop** (1024px+): Volle Feature-Ansicht

## Lizenz

Dieses Projekt ist für den privaten Gebrauch bestimmt.

## Support

Bei Fragen oder Problemen wende dich an: `Simon.rohrer04@web.de`
