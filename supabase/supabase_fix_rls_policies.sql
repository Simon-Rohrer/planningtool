-- Fix RLS Policies - Entfernt Recursion-Probleme
-- Dieses Script löscht KEINE Daten, sondern nur die Policies

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

DROP POLICY IF EXISTS "Authenticated users can read bands" ON bands;
DROP POLICY IF EXISTS "Band members can manage bands" ON bands;
DROP POLICY IF EXISTS "Authenticated users can manage bands" ON bands;
DROP POLICY IF EXISTS "Authenticated users can update bands" ON bands;
DROP POLICY IF EXISTS "Authenticated users can delete bands" ON bands;

DROP POLICY IF EXISTS "Users can read band members of their bands" ON "bandMembers";
DROP POLICY IF EXISTS "Band members can manage memberships" ON "bandMembers";
DROP POLICY IF EXISTS "Authenticated users can read band members" ON "bandMembers";
DROP POLICY IF EXISTS "Authenticated users can manage band members" ON "bandMembers";
DROP POLICY IF EXISTS "Authenticated users can update band members" ON "bandMembers";
DROP POLICY IF EXISTS "Authenticated users can delete band members" ON "bandMembers";

DROP POLICY IF EXISTS "Band members can read events" ON events;
DROP POLICY IF EXISTS "Band members can manage events" ON events;
DROP POLICY IF EXISTS "Authenticated users can read events" ON events;
DROP POLICY IF EXISTS "Authenticated users can manage events" ON events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON events;

DROP POLICY IF EXISTS "Band members can read rehearsals" ON rehearsals;
DROP POLICY IF EXISTS "Band members can manage rehearsals" ON rehearsals;
DROP POLICY IF EXISTS "Authenticated users can read rehearsals" ON rehearsals;
DROP POLICY IF EXISTS "Authenticated users can manage rehearsals" ON rehearsals;
DROP POLICY IF EXISTS "Authenticated users can update rehearsals" ON rehearsals;
DROP POLICY IF EXISTS "Authenticated users can delete rehearsals" ON rehearsals;

DROP POLICY IF EXISTS "Users can read votes of their rehearsals" ON votes;
DROP POLICY IF EXISTS "Users can manage own votes" ON votes;
DROP POLICY IF EXISTS "Authenticated users can read votes" ON votes;
DROP POLICY IF EXISTS "Users can update own votes" ON votes;
DROP POLICY IF EXISTS "Users can delete own votes" ON votes;

DROP POLICY IF EXISTS "Authenticated users can manage locations" ON locations;

DROP POLICY IF EXISTS "Users can read own absences" ON absences;
DROP POLICY IF EXISTS "Users can manage own absences" ON absences;
DROP POLICY IF EXISTS "Band members can see other members absences" ON absences;
DROP POLICY IF EXISTS "Authenticated users can see all absences" ON absences;
DROP POLICY IF EXISTS "Users can update own absences" ON absences;
DROP POLICY IF EXISTS "Users can delete own absences" ON absences;

DROP POLICY IF EXISTS "Authenticated users can read news" ON news;
DROP POLICY IF EXISTS "Users can create news" ON news;
DROP POLICY IF EXISTS "Users can manage own news" ON news;
DROP POLICY IF EXISTS "Users can update own news" ON news;
DROP POLICY IF EXISTS "Users can delete own news" ON news;

DROP POLICY IF EXISTS "Band members can read songs" ON songs;
DROP POLICY IF EXISTS "Band members can manage songs" ON songs;
DROP POLICY IF EXISTS "Authenticated users can read songs" ON songs;
DROP POLICY IF EXISTS "Authenticated users can manage songs" ON songs;
DROP POLICY IF EXISTS "Authenticated users can update songs" ON songs;
DROP POLICY IF EXISTS "Authenticated users can delete songs" ON songs;

-- Create new simplified policies (no recursion)

-- Users table
CREATE POLICY "Users can read all users"
ON users FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Bands table
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

-- BandMembers table
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

-- Events table
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

-- Rehearsals table
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

-- Votes table
CREATE POLICY "Authenticated users can read votes"
ON votes FOR SELECT
USING (auth.uid() IS NOT NULL);

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

-- Locations table
CREATE POLICY "Authenticated users can manage locations"
ON locations FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Absences table
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

CREATE POLICY "Authenticated users can see all absences"
ON absences FOR SELECT
USING (auth.uid() IS NOT NULL);

-- News table
CREATE POLICY "Authenticated users can read news"
ON news FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create news"
ON news FOR INSERT
WITH CHECK (auth.uid() = "createdBy");

CREATE POLICY "Users can update own news"
ON news FOR UPDATE
USING (auth.uid() = "createdBy")
WITH CHECK (auth.uid() = "createdBy");

CREATE POLICY "Users can delete own news"
ON news FOR DELETE
USING (auth.uid() = "createdBy");

-- Songs table
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
