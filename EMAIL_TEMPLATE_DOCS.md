# Email Template System - Dokumentation

## Übersicht

Das Email-System wurde umgebaut, um flexibel für verschiedene Zwecke verwendet werden zu können. 

## Dateien

### 1. `email-template.html`

Dies ist dein HTML Email-Template. Du kannst es einfach bearbeiten, um das Design anzupassen.

**Template-Variablen:**
- `{{to_name}}` - Name des Empfängers
- `{{subject}}` - E-Mail Betreff
- `{{message}}` - Hauptnachricht (kann Zeilenumbrüche enthalten)
- `{{details_title}}` - Titel für den Details-Bereich (optional)
- `{{detail_X_label}}` und `{{detail_X_value}}` - Details-Einträge (optional)
- `{{button_text}}` und `{{button_link}}` - Button (optional)

### 2. `js/email-service.js`

Der aktualisierte EmailService mit flexiblen Funktionen.

## EmailJS Template einrichten

Du musst **ein neues EmailJS Template** erstellen mit folgenden Variablen:

```
to_email: {{to_email}}
to_name: {{to_name}}
subject: {{subject}}
message: {{message}}
from_name: {{from_name}}
reply_to: {{reply_to}}

Optional:
has_details: {{has_details}}
details_title: {{details_title}}
details_count: {{details_count}}
detail_0_label: {{detail_0_label}}
detail_0_value: {{detail_0_value}}
detail_1_label: {{detail_1_label}}
detail_1_value: {{detail_1_value}}
... bis detail_9

button_text: {{button_text}}
button_link: {{button_link}}
```

## Verwendung

### Universal-Funktion

```javascript
// Einfache E-Mail
await EmailService.sendEmail(
    'user@example.com',
    'Max Mustermann',
    'Betreff der E-Mail',
    'Deine Nachricht hier...'
);

// Mit Details
await EmailService.sendEmail(
    'user@example.com',
    'Max Mustermann',
    'Probe bestätigt',
    'Deine Probe wurde bestätigt!',
    {
        details: [
            { label: '📅 Datum', value: '25.12.2025' },
            { label: '🕐 Uhrzeit', value: '19:00' },
            { label: '📍 Ort', value: 'Proberaum A' }
        ],
        detailsTitle: 'Proben-Details'
    }
);

// Mit Button
await EmailService.sendEmail(
    'user@example.com',
    'Max Mustermann',
    'Passwort zurücksetzen',
    'Klicke auf den Button, um dein Passwort zurückzusetzen.',
    {
        buttonText: 'Passwort zurücksetzen',
        buttonLink: 'https://example.com/reset/token123'
    }
);
```

### Vorgefertigte Funktionen

#### Passwort zurücksetzen
```javascript
await EmailService.sendPasswordReset(
    'user@example.com',
    'Max Mustermann',
    'https://deine-app.com/reset/token123'
);
```

#### Probenbestätigung
```javascript
await EmailService.sendRehearsalConfirmation(
    rehearsal,      // Rehearsal-Objekt
    selectedDate,   // Bestätigtes Datum
    selectedMembers // Array von Band-Mitgliedern
);
```

#### Auftritt-Benachrichtigung
```javascript
await EmailService.sendEventNotification(
    'user@example.com',
    'Max Mustermann',
    event,  // Event-Objekt
    band    // Band-Objekt
);
```

## Eigene E-Mail-Typen hinzufügen

Du kannst einfach neue Funktionen zum EmailService hinzufügen:

```javascript
async sendCustomEmail(toEmail, toName, customData) {
    const subject = 'Dein Betreff';
    const message = `Deine Nachricht mit ${customData}`;
    
    return await this.sendEmail(toEmail, toName, subject, message, {
        details: [
            { label: 'Info', value: customData }
        ]
    });
}
```

## Vorteile

✅ **Ein Template für alles** - Einheitliches Design  
✅ **Einfach erweiterbar** - Neue E-Mail-Typen in wenigen Zeilen  
✅ **Flexibel** - Subject und Message sind dynamisch  
✅ **Wartbar** - Template ist in eigener Datei  
✅ **Wiederverwendbar** - Für alle zukünftigen Features nutzbar
