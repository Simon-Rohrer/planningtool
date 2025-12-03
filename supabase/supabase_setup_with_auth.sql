-- Supabase Schema Setup mit echter Auth-Integration
-- ACHTUNG: Dieses Script löscht alle bestehenden Tabellen und erstellt sie neu!
-- Alle Daten gehen verloren!

-- Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS songs CASCADE;
DROP TABLE IF EXISTS news CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS rehearsals CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS "bandMembers" CASCADE;
DROP TABLE IF EXISTS bands CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (Profile table - linked to auth.users)
-- Die ID kommt jetzt von Supabase Auth (UUID)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  "isAdmin" BOOLEAN DEFAULT FALSE,
  "bandIds" JSONB DEFAULT '[]'::JSONB,
  instrument TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Bands table
CREATE TABLE bands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  "joinCode" TEXT UNIQUE NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Band Members table
CREATE TABLE "bandMembers" (
  id TEXT PRIMARY KEY,
  "bandId" TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("bandId", "userId")
);

-- Events table
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  "bandId" TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TIMESTAMPTZ,
  location TEXT,
  info TEXT,
  "techInfo" TEXT,
  "soundcheckDate" TIMESTAMPTZ,
  "soundcheckLocation" TEXT,
  members JSONB DEFAULT '[]'::JSONB,
  guests JSONB DEFAULT '[]'::JSONB,
  "songIds" JSONB DEFAULT '[]'::JSONB,
  "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Rehearsals table
CREATE TABLE rehearsals (
  id TEXT PRIMARY KEY,
  "bandId" TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  "proposedBy" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "locationId" TEXT,
  "eventId" TEXT,
  "proposedDates" JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  "confirmedDate" TIMESTAMPTZ,
  "confirmedLocation" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  "rehearsalId" TEXT NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "dateIndex" INTEGER NOT NULL,
  availability TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("rehearsalId", "userId", "dateIndex")
);

-- Locations table
CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  type TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Absences table
CREATE TABLE absences (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  reason TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- News table
CREATE TABLE news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]'::JSONB,
  "createdBy" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "readBy" JSONB DEFAULT '[]'::JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Songs table
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  bpm INTEGER,
  key TEXT,
  ccli TEXT,
  "leadVocal" TEXT,
  "eventId" TEXT REFERENCES events(id) ON DELETE CASCADE,
  "bandId" TEXT REFERENCES bands(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,
  "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_bandmembers_bandid ON "bandMembers"("bandId");
CREATE INDEX idx_bandmembers_userid ON "bandMembers"("userId");
CREATE INDEX idx_events_bandid ON events("bandId");
CREATE INDEX idx_rehearsals_bandid ON rehearsals("bandId");
CREATE INDEX idx_votes_rehearsalid ON votes("rehearsalId");
CREATE INDEX idx_votes_userid ON votes("userId");
CREATE INDEX idx_absences_userid ON absences("userId");
CREATE INDEX idx_songs_eventid ON songs("eventId");
CREATE INDEX idx_songs_bandid ON songs("bandId");
CREATE INDEX idx_news_createdby ON news("createdBy");

-- Function: Automatisch User-Profil erstellen wenn neuer Auth-User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, name, email, "createdAt")
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Bei neuem Auth-User automatisch Profil erstellen
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bandMembers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users table
-- Jeder kann alle User sehen (für Band-Member Listen etc.)
CREATE POLICY "Users can read all users"
ON users FOR SELECT
USING (true);

-- User kann nur eigenes Profil updaten
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- RLS Policies: Bands table
-- Alle authentifizierten User können Bands lesen und verwalten
-- (Später kannst du das auf Band-Members beschränken)
CREATE POLICY "Authenticated users can read bands"
ON bands FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage bands"
ON bands FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bands"
ON bands FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bands"
ON bands FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies: BandMembers table
-- Alle authentifizierten User können BandMembers lesen und verwalten
-- Das verhindert die Recursion
CREATE POLICY "Authenticated users can read band members"
ON "bandMembers" FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage band members"
ON "bandMembers" FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update band members"
ON "bandMembers" FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete band members"
ON "bandMembers" FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies: Events table
-- Alle authentifizierten User können Events lesen und verwalten
CREATE POLICY "Authenticated users can read events"
ON events FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage events"
ON events FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update events"
ON events FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete events"
ON events FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies: Rehearsals table
CREATE POLICY "Authenticated users can read rehearsals"
ON rehearsals FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage rehearsals"
ON rehearsals FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update rehearsals"
ON rehearsals FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete rehearsals"
ON rehearsals FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies: Votes table
CREATE POLICY "Authenticated users can read votes"
ON votes FOR SELECT
USING (auth.uid() IS NOT NULL);

-- User kann eigene Votes erstellen/updaten/löschen
CREATE POLICY "Users can manage own votes"
ON votes FOR INSERT
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update own votes"
ON votes FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can delete own votes"
ON votes FOR DELETE
USING (auth.uid() = "userId");

-- RLS Policies: Locations table
-- Alle authentifizierten User können Locations sehen und verwalten
CREATE POLICY "Authenticated users can manage locations"
ON locations FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies: Absences table
-- User kann eigene Abwesenheiten sehen und verwalten
CREATE POLICY "Users can read own absences"
ON absences FOR SELECT
USING (auth.uid() = "userId");

CREATE POLICY "Users can manage own absences"
ON absences FOR INSERT
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update own absences"
ON absences FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can delete own absences"
ON absences FOR DELETE
USING (auth.uid() = "userId");

-- Alle authentifizierten User können Abwesenheiten sehen (für Band-Kalender)
CREATE POLICY "Authenticated users can see all absences"
ON absences FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies: News table
-- Alle authentifizierten User können News lesen
CREATE POLICY "Authenticated users can read news"
ON news FOR SELECT
USING (auth.uid() IS NOT NULL);

-- User kann News erstellen
CREATE POLICY "Users can create news"
ON news FOR INSERT
WITH CHECK (auth.uid() = "createdBy");

-- User kann eigene News updaten/löschen
CREATE POLICY "Users can update own news"
ON news FOR UPDATE
USING (auth.uid() = "createdBy")
WITH CHECK (auth.uid() = "createdBy");

CREATE POLICY "Users can delete own news"
ON news FOR DELETE
USING (auth.uid() = "createdBy");

-- RLS Policies: Songs table
-- Alle authentifizierten User können Songs lesen und verwalten
CREATE POLICY "Authenticated users can read songs"
ON songs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage songs"
ON songs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update songs"
ON songs FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete songs"
ON songs FOR DELETE
USING (auth.uid() IS NOT NULL);
