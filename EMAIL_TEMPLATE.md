# EmailJS Template Konfiguration

Um die erweiterten E-Mail-Benachrichtigungen mit Standort-Daten zu nutzen, erstelle bitte ein neues E-Mail-Template in deinem EmailJS Dashboard mit folgendem Inhalt.

## Template Einstellungen

*   **Subject**: `Neue Probe bestätigt: {{rehearsal_title}}`
*   **Content**:

```html
<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #2563eb;">Neue Probe bestätigt! 🎵</h2>
    
    <p>Hallo {{to_name}},</p>
    
    <p>Ein neuer Probetermin für <strong>{{band_name}}</strong> wurde bestätigt.</p>
    
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0;">{{rehearsal_title}}</h3>
        
        <p><strong>📅 Datum:</strong><br>
        {{rehearsal_date}}</p>
        
        <p><strong>📍 Ort:</strong><br>
        {{rehearsal_location}}</p>
        
        <p><strong>📝 Beschreibung:</strong><br>
        {{rehearsal_description}}</p>
    </div>
    
    <p>Bitte trage dir den Termin in deinen Kalender ein.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    
    <p style="font-size: 12px; color: #666;">
        Dies ist eine automatische Benachrichtigung vom Band Planning Tool.<br>
        Gesendet an: {{to_email}}
    </p>
</div>
```

## Verfügbare Variablen

Folgende Variablen werden vom System an EmailJS übergeben und können im Template verwendet werden:

| Variable | Beschreibung |
|----------|--------------|
| `{{to_name}}` | Name des Empfängers |
| `{{to_email}}` | E-Mail-Adresse des Empfängers |
| `{{band_name}}` | Name der Band |
| `{{rehearsal_title}}` | Titel der Probe |
| `{{rehearsal_description}}` | Beschreibung der Probe |
| `{{rehearsal_date}}` | Formatiertes Datum und Uhrzeit |
| `{{rehearsal_location}}` | Name und Adresse des Standorts (oder "Kein Ort angegeben") |

## Einrichtung

1.  Gehe zu [EmailJS](https://www.emailjs.com/)
2.  Erstelle ein neues Template
3.  Kopiere den HTML-Code in den "Content" Bereich (Source Code Modus aktivieren)
4.  Speichere das Template
5.  Kopiere die **Template ID**
6.  Trage die Template ID im Band Planning Tool unter "Admin" -> "E-Mail Einstellungen" ein
