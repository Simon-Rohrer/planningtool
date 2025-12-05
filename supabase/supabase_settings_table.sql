-- Settings Tabelle für App-Konfigurationen wie Spenden-Link
-- Diese Tabelle speichert Key-Value Paare für globale Einstellungen

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- Index für schnellere Suche nach Key
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- RLS aktivieren
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder kann lesen
CREATE POLICY "Jeder kann Settings lesen"
    ON settings FOR SELECT
    USING (true);

-- Policy: Authentifizierte Benutzer können Settings ändern
-- (später kannst du dies auf Admins einschränken)
CREATE POLICY "Authentifizierte Benutzer können Settings ändern"
    ON settings FOR ALL
    USING (auth.uid() IS NOT NULL);

-- Funktion zum automatischen Aktualisieren des Timestamps
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für automatisches Update
DROP TRIGGER IF EXISTS settings_updated_at_trigger ON settings;
CREATE TRIGGER settings_updated_at_trigger
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_settings_updated_at();

-- Initialer Spenden-Link Eintrag (optional, falls schon ein Wert existieren soll)
INSERT INTO settings (id, key, value, updated_at)
VALUES ('donate-link', 'donateLink', '', NOW())
ON CONFLICT (key) DO NOTHING;
