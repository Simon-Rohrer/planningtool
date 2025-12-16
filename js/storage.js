// (removed duplicate top-level async deleteUser)
// Storage Module - Supabase-only (no localStorage fallback)

const Storage = {
    // Löscht einen User aus der eigenen Datenbank
    async deleteUser(userId) {
        const sb = SupabaseClient.getClient();
        if (!sb || !userId) throw new Error('Kein User zum Löschen gefunden!');
        const { error } = await sb.from('users').delete().eq('id', userId);
        if (error) throw new Error('User konnte nicht aus der Datenbank gelöscht werden!');
        return true;
    },
    // Initialize storage
    async init() {
        if (!SupabaseClient.isConfigured()) {
            console.error('⚠️ Supabase nicht konfiguriert! Bitte URL und Anon Key in den Einstellungen eingeben.');
            return;
        }
        console.log('✓ Storage initialized with Supabase');
    },

    generateId() {
        return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    },

    // Generic CRUD operations
    async getAll(key) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from(key).select('*');
        if (error) { console.error('Supabase getAll error', key, error); return []; }
        return data || [];
    },

    async getById(key, id) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from(key).select('*').eq('id', id).limit(1).maybeSingle();
        if (error) { console.error('Supabase getById error', key, error); return null; }
        return data || null;
    },

    async save(key, item) {
        console.log('[Storage.save] Starting save to table:', key, 'Item:', item);
        const sb = SupabaseClient.getClient();
        console.log('[Storage.save] Supabase client obtained:', sb);
        console.log('[Storage.save] Building query for table:', key);

        // Remove .single() - it might be causing the hang
        const query = sb.from(key).insert(item).select('*');
        console.log('[Storage.save] Query built successfully, executing...');

        const { data, error } = await query;
        console.log('[Storage.save] Query execution completed. Data:', data, 'Error:', error);

        if (error) {
            console.error('Supabase save error', key, error);
            throw new Error(`Fehler beim Speichern in ${key}: ${error.message}`);
        }

        // Return first item if array, or the item itself
        const result = Array.isArray(data) ? data[0] : (data || item);
        console.log('[Storage.save] Returning data:', result);
        return result;
    },

    async update(key, id, updatedItem) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from(key).update(updatedItem).eq('id', id).select('*').maybeSingle();
        if (error) { console.error('Supabase update error', key, error); return null; }
        return data || null;
    },

    async delete(key, id) {
        const sb = SupabaseClient.getClient();
        const { error } = await sb.from(key).delete().eq('id', id);
        if (error) { console.error('Supabase delete error', key, error); return false; }
        return true;
    },

    // User operations
    async createUser(userData) {
        const user = {
            id: this.generateId(),
            ...userData,
            bandIds: [],
            createdAt: new Date().toISOString()
        };
        return await this.save('users', user);
    },

    async getUserByUsername(username) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('users').select('*').ilike('username', username).limit(1).maybeSingle();
        if (error) { console.error('Supabase getUserByUsername error', error); return null; }
        return data || null;
    },

    async getUserByEmail(email) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('users').select('*').ilike('email', email).limit(1).maybeSingle();
        if (error) { console.error('Supabase getUserByEmail error', error); return null; }
        return data || null;
    },

    async updateUser(userId, updates) {
        return await this.update('users', userId, updates);
    },

    // Band operations
    async createBand(bandData) {
        // Bunter Farbpool ohne Grautöne
        const vibrantColors = [
            '#6366f1', // Indigo/Blau
            '#ec4899', // Pink
            '#10b981', // Grün
            '#f59e0b', // Orange
            '#ef4444', // Rot
            '#8b5cf6', // Lila
            '#06b6d4', // Cyan
            '#f97316', // Dunkelorange
            '#14b8a6', // Teal
            '#a855f7', // Violett
            '#22c55e', // Hellgrün
            '#eab308', // Gelb
            '#3b82f6', // Blau
            '#e11d48', // Rose/Pink
            '#84cc16', // Lime
            '#0ea5e9'  // Sky
        ];

        // Zufällige Farbe auswählen, wenn keine angegeben
        const randomColor = vibrantColors[Math.floor(Math.random() * vibrantColors.length)];

        const band = {
            id: this.generateId(),
            ...bandData,
            joinCode: await this.generateUniqueJoinCode(),
            createdAt: new Date().toISOString(),
            color: bandData.color || randomColor
        };
        return await this.save('bands', band);
    },

    async getBand(bandId) {
        return await this.getById('bands', bandId);
    },

    async getAllBands() {
        return await this.getAll('bands');
    },

    async updateBand(bandId, updates) {
        return await this.update('bands', bandId, updates);
    },

    async deleteBand(bandId) {
        await this.delete('bands', bandId);
        // Supabase CASCADE handles deletion of related records
        return true;
    },

    async getBandByJoinCode(joinCode) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('bands').select('*').eq('joinCode', joinCode).limit(1).maybeSingle();
        if (error) { console.error('Supabase getBandByJoinCode error', error); return null; }
        return data || null;
    },

    async generateUniqueJoinCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;

        while (!isUnique) {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            const existing = await this.getBandByJoinCode(code);
            if (!existing) isUnique = true;
        }
        return code;
    },

    // Band member operations
    async addBandMember(bandId, userId, role = 'member') {
        const membership = {
            id: this.generateId(),
            bandId,
            userId,
            role,
            joinedAt: new Date().toISOString()
        };
        return await this.save('bandMembers', membership);
    },

    async getBandMembers(bandId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('bandMembers').select('*').eq('bandId', bandId);
        if (error) { console.error('Supabase getBandMembers error', error); return []; }
        return data || [];
    },

    async getUserBands(userId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('bandMembers').select('*').eq('userId', userId);
        if (error) { console.error('Supabase getUserBands error', error); return []; }
        const memberships = data || [];
        const bands = await Promise.all(memberships.map(async m => {
            const band = await this.getBand(m.bandId);
            return band ? { ...band, role: m.role } : null;
        }));
        return bands.filter(b => b !== null);
    },

    async getUserRoleInBand(userId, bandId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('bandMembers').select('*').eq('userId', userId).eq('bandId', bandId).limit(1).maybeSingle();
        if (error) { console.error('Supabase getUserRoleInBand error', error); return null; }
        return data ? data.role : null;
    },

    async updateBandMemberRole(bandId, userId, newRole) {
        const sb = SupabaseClient.getClient();
        const { error } = await sb.from('bandMembers').update({ role: newRole }).eq('bandId', bandId).eq('userId', userId);
        if (error) { console.error('Supabase updateBandMemberRole error', error); return false; }
        return true;
    },

    async removeBandMember(bandId, userId) {
        const sb = SupabaseClient.getClient();
        const { error } = await sb.from('bandMembers').delete().eq('bandId', bandId).eq('userId', userId);
        if (error) { console.error('Supabase removeBandMember error', error); return false; }
        return true;
    },

    // Event operations
    async createEvent(eventData) {
        const event = {
            id: this.generateId(),
            ...eventData,
            createdAt: new Date().toISOString()
        };
        return await this.save('events', event);
    },

    async getEvent(eventId) {
        return await this.getById('events', eventId);
    },

    async getBandEvents(bandId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('events').select('*').eq('bandId', bandId);
        if (error) { console.error('Supabase getBandEvents error', error); return []; }
        return data || [];
    },

    async getUserEvents(userId) {
        const userBands = await this.getUserBands(userId);
        const bandIds = userBands.map(b => b.id);
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('events').select('*').in('bandId', bandIds);
        if (error) { console.error('Supabase getUserEvents error', error); return []; }
        return data || [];
    },

    async updateEvent(eventId, updates) {
        return await this.update('events', eventId, updates);
    },

    async deleteEvent(eventId) {
        return await this.delete('events', eventId);
    },

    // Rehearsal operations
    async createRehearsal(rehearsalData) {
        const rehearsal = {
            id: this.generateId(),
            ...rehearsalData,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        return await this.save('rehearsals', rehearsal);
    },

    async getRehearsal(rehearsalId) {
        return await this.getById('rehearsals', rehearsalId);
    },

    async getBandRehearsals(bandId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('rehearsals').select('*').eq('bandId', bandId);
        if (error) { console.error('Supabase getBandRehearsals error', error); return []; }
        return data || [];
    },

    async getUserRehearsals(userId) {
        const userBands = await this.getUserBands(userId);
        const bandIds = userBands.map(b => b.id);
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('rehearsals').select('*').in('bandId', bandIds);
        if (error) { console.error('Supabase getUserRehearsals error', error); return []; }
        return data || [];
    },

    async updateRehearsal(rehearsalId, updates) {
        return await this.update('rehearsals', rehearsalId, updates);
    },

    async deleteRehearsal(rehearsalId) {
        await this.delete('rehearsals', rehearsalId);
        // Supabase CASCADE handles votes deletion
        return true;
    },

    // Vote operations
    async createVote(voteData) {
        const vote = {
            id: this.generateId(),
            ...voteData,
            createdAt: new Date().toISOString()
        };
        return await this.save('votes', vote);
    },

    async getRehearsalVotes(rehearsalId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('votes').select('*').eq('rehearsalId', rehearsalId);
        if (error) { console.error('Supabase getRehearsalVotes error', error); return []; }
        return data || [];
    },

    async getUserVoteForDate(userId, rehearsalId, dateIndex) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('votes').select('*').eq('userId', userId).eq('rehearsalId', rehearsalId).eq('dateIndex', dateIndex).limit(1).maybeSingle();
        if (error) { console.error('Supabase getUserVoteForDate error', error); return null; }
        return data || null;
    },

    async deleteVote(voteId) {
        return await this.delete('votes', voteId);
    },

    // Time Suggestion operations
    async createTimeSuggestion(suggestionData) {
        const suggestion = {
            id: this.generateId(),
            ...suggestionData,
            createdAt: new Date().toISOString()
        };
        return await this.save('timeSuggestions', suggestion);
    },

    async getTimeSuggestionsForDate(rehearsalId, dateIndex) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('timeSuggestions').select('*').eq('rehearsalId', rehearsalId).eq('dateIndex', dateIndex);
        if (error) { console.error('Supabase getTimeSuggestionsForDate error', error); return []; }
        return data || [];
    },

    async getUserTimeSuggestionForDate(userId, rehearsalId, dateIndex) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('timeSuggestions').select('*').eq('userId', userId).eq('rehearsalId', rehearsalId).eq('dateIndex', dateIndex).limit(1).maybeSingle();
        if (error) { console.error('Supabase getUserTimeSuggestionForDate error', error); return null; }
        return data || null;
    },

    async deleteTimeSuggestion(suggestionId) {
        return await this.delete('timeSuggestions', suggestionId);
    },

    // Location operations
    async createLocation(locationData) {
        const location = {
            id: this.generateId(),
            ...locationData,
            createdAt: new Date().toISOString()
        };
        return await this.save('locations', location);
    },

    async getLocations() {
        return await this.getAll('locations');
    },

    async getLocation(locationId) {
        return await this.getById('locations', locationId);
    },

    async updateLocation(locationId, updates) {
        return await this.update('locations', locationId, updates);
    },

    async deleteLocation(locationId) {
        return await this.delete('locations', locationId);
    },

    // Absence operations
    async createAbsence(userId, startDate, endDate, reason = '') {
        const absence = {
            id: this.generateId(),
            userId,
            startDate,
            endDate,
            reason,
            createdAt: new Date().toISOString()
        };
        return await this.save('absences', absence);
    },

    async getUserAbsences(userId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('absences').select('*').eq('userId', userId);
        if (error) { console.error('Supabase getUserAbsences error', error); return []; }
        return data || [];
    },

    async deleteAbsence(absenceId) {
        return await this.delete('absences', absenceId);
    },

    async isUserAbsentOnDate(userId, date) {
        const absences = await this.getUserAbsences(userId);
        const checkDate = new Date(date);
        return absences.some(a => {
            const start = new Date(a.startDate);
            const end = new Date(a.endDate);
            return checkDate >= start && checkDate <= end;
        });
    },

    async getAbsentUsersDuringRange(userIds, startDate, endDate) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('absences').select('*').in('userId', userIds);
        if (error) { console.error('Supabase getAbsentUsersDuringRange error', error); return []; }

        const absences = data || [];
        const rangeStart = new Date(startDate);
        const rangeEnd = new Date(endDate);

        return absences.filter(a => {
            const absStart = new Date(a.startDate);
            const absEnd = new Date(a.endDate);
            return (absStart <= rangeEnd && absEnd >= rangeStart);
        });
    },

    // News operations
    async createNewsItem(title, content, createdBy, images = []) {
        const newsItem = {
            id: this.generateId(),
            title,
            content,
            images,
            createdBy,
            createdAt: new Date().toISOString(),
            readBy: [] // Empty array so creator also sees "NEU" badge initially
        };
        return await this.save('news', newsItem);
    },

    async getAllNews() {
        const news = await this.getAll('news');
        return news.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async deleteNewsItem(newsId) {
        return await this.delete('news', newsId);
    },

    async updateNewsItem(newsId, updates) {
        return await this.update('news', newsId, updates);
    },

    async markNewsRead(newsId, userId) {
        const news = await this.getById('news', newsId);
        if (!news) return;
        if (!news.readBy) news.readBy = [];
        if (!news.readBy.includes(userId)) {
            news.readBy.push(userId);
            await this.update('news', newsId, { readBy: news.readBy });
        }
    },

    async markAllNewsReadForUser(userId) {
        const allNews = await this.getAllNews();
        for (const news of allNews) {
            if (!news.readBy) news.readBy = [];
            if (!news.readBy.includes(userId)) {
                news.readBy.push(userId);
                await this.update('news', news.id, { readBy: news.readBy });
            }
        }
    },

    async getUnreadNewsCountForUser(userId) {
        const allNews = await this.getAllNews();
        return allNews.filter(n => !n.readBy || !n.readBy.includes(userId)).length;
    },

    // Song operations
    async createSong(songData) {
        const song = {
            id: this.generateId(),
            ...songData,
            createdAt: new Date().toISOString()
        };
        return await this.save('songs', song);
    },

    async getEventSongs(eventId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('songs').select('*').eq('eventId', eventId);
        if (error) { console.error('Supabase getEventSongs error', error); return []; }
        return (data || []).sort((a, b) => a.order - b.order);
    },

    async getBandSongs(bandId) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('songs').select('*').eq('bandId', bandId);
        if (error) { console.error('Supabase getBandSongs error', error); return []; }
        return data || [];
    },

    async updateSong(songId, updates) {
        return await this.update('songs', songId, updates);
    },

    async deleteSong(songId) {
        return await this.delete('songs', songId);
    },

    // Settings operations
    async getSetting(key) {
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from('settings').select('value').eq('key', key).limit(1).maybeSingle();
        if (error) { console.error('Supabase getSetting error', key, error); return null; }
        return data ? data.value : null;
    },

    async setSetting(key, value) {
        const sb = SupabaseClient.getClient();
        const id = `setting-${key}`;

        // Try to update first
        const { data: existing } = await sb.from('settings').select('id').eq('key', key).limit(1).maybeSingle();

        if (existing) {
            // Update existing
            const { error } = await sb.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
            if (error) {
                console.error('Supabase setSetting update error', key, error);
                throw new Error(`Fehler beim Aktualisieren der Einstellung: ${error.message}`);
            }
        } else {
            // Insert new
            const { error } = await sb.from('settings').insert({ id, key, value });
            if (error) {
                console.error('Supabase setSetting insert error', key, error);
                throw new Error(`Fehler beim Speichern der Einstellung: ${error.message}`);
            }
        }
        return true;
    },

    // Cleanup operations
    async cleanupPastItems() {
        try {
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Set to start of today

            // Clean up past events
            const allEvents = await this.getAll('events');
            let deletedEventsCount = 0;

            for (const event of allEvents) {
                if (event.date) {
                    const eventDate = new Date(event.date);
                    eventDate.setHours(0, 0, 0, 0);

                    if (eventDate < now) {
                        await this.deleteEvent(event.id);
                        deletedEventsCount++;
                        console.log(`🗑️ Deleted past event: ${event.title} (${event.date})`);
                    }
                }
            }

            // Clean up past rehearsals
            const allRehearsals = await this.getAll('rehearsals');
            let deletedRehearsalsCount = 0;

            for (const rehearsal of allRehearsals) {
                let shouldDelete = false;

                // Check confirmed rehearsals with finalDate
                if (rehearsal.finalDate) {
                    const rehearsalDate = new Date(rehearsal.finalDate);
                    rehearsalDate.setHours(0, 0, 0, 0);

                    if (rehearsalDate < now) {
                        shouldDelete = true;
                    }
                }
                // Check unconfirmed rehearsals - delete if ALL proposed dates are in the past
                else if (rehearsal.proposedDates && Array.isArray(rehearsal.proposedDates) && rehearsal.proposedDates.length > 0) {
                    const allDatesInPast = rehearsal.proposedDates.every(dateStr => {
                        const proposedDate = new Date(dateStr);
                        proposedDate.setHours(0, 0, 0, 0);
                        return proposedDate < now;
                    });

                    if (allDatesInPast) {
                        shouldDelete = true;
                    }
                }

                if (shouldDelete) {
                    await this.deleteRehearsal(rehearsal.id);
                    deletedRehearsalsCount++;
                    const dateInfo = rehearsal.finalDate || (rehearsal.proposedDates ? rehearsal.proposedDates[0] : 'unknown');
                    console.log(`🗑️ Deleted past rehearsal: ${rehearsal.title} (${dateInfo})`);
                }
            }

            if (deletedEventsCount > 0 || deletedRehearsalsCount > 0) {
                console.log(`✓ Cleanup complete: ${deletedEventsCount} events and ${deletedRehearsalsCount} rehearsals deleted`);
            } else {
                console.log('✓ Cleanup complete: No past items to delete');
            }

            return { deletedEventsCount, deletedRehearsalsCount };
        } catch (error) {
            console.error('Error during cleanup:', error);
            return { deletedEventsCount: 0, deletedRehearsalsCount: 0 };
        }
    },

    // Calendar operations
    async createCalendar(calendarData) {
        console.log('[Storage.createCalendar] Starting...', calendarData);
        const calendar = {
            id: this.generateId(), // Generate ID for new calendars
            ...calendarData,
            created_at: new Date().toISOString()
        };
        console.log('[Storage.createCalendar] Calendar object created:', calendar);

        // Use direct fetch for calendars to avoid Supabase JS hanging issue
        console.log('[Storage.createCalendar] Using direct REST API call...');
        try {
            // Get credentials from SupabaseClient
            const sb = SupabaseClient.getClient();
            const supabaseUrl = sb.supabaseUrl;
            const supabaseKey = sb.supabaseKey;

            console.log('[Storage.createCalendar] Using URL:', supabaseUrl);

            const response = await fetch(`${supabaseUrl}/rest/v1/calendars`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(calendar)
            });

            console.log('[Storage.createCalendar] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Storage.createCalendar] Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('[Storage.createCalendar] Created successfully:', result);

            return Array.isArray(result) ? result[0] : result;
        } catch (error) {
            console.error('[Storage.createCalendar] Fetch error:', error);
            throw error;
        }
    },

    async getAllCalendars() {
        console.log('[Storage.getAllCalendars] Using direct REST API call...');
        try {
            const sb = SupabaseClient.getClient();
            const supabaseUrl = sb.supabaseUrl;
            const supabaseKey = sb.supabaseKey;

            const response = await fetch(`${supabaseUrl}/rest/v1/calendars?select=*`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                },
                cache: 'no-store'  // Prevent caching
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Storage.getAllCalendars] Error:', errorText);
                return [];
            }

            const data = await response.json();
            console.log('[Storage.getAllCalendars] Loaded calendars:', data);
            return data;
        } catch (error) {
            console.error('[Storage.getAllCalendars] Fetch error:', error);
            return [];
        }
    },

    async getCalendar(calendarId) {
        console.log('[Storage.getCalendar] Using direct REST API call for:', calendarId);
        try {
            const sb = SupabaseClient.getClient();
            const response = await fetch(`${sb.supabaseUrl}/rest/v1/calendars?id=eq.${calendarId}&select=*`, {
                headers: {
                    'apikey': sb.supabaseKey,
                    'Authorization': `Bearer ${sb.supabaseKey}`
                }
            });
            const data = await response.json();
            return Array.isArray(data) ? data[0] : data;
        } catch (error) {
            console.error('[Storage.getCalendar] Error:', error);
            return null;
        }
    },

    async updateCalendar(calendarId, updates) {
        console.log('[Storage.updateCalendar] Using direct REST API call for:', calendarId);
        console.log('[Storage.updateCalendar] Updates:', updates);
        try {
            const sb = SupabaseClient.getClient();
            const response = await fetch(`${sb.supabaseUrl}/rest/v1/calendars?id=eq.${calendarId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': sb.supabaseKey,
                    'Authorization': `Bearer ${sb.supabaseKey}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updates)
            });
            console.log('[Storage.updateCalendar] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Storage.updateCalendar] Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('[Storage.updateCalendar] Updated calendar:', data);
            return Array.isArray(data) ? data[0] : data;
        } catch (error) {
            console.error('[Storage.updateCalendar] Error:', error);
            throw error;
        }
    },

    async deleteCalendar(calendarId) {
        console.log('[Storage.deleteCalendar] Using direct REST API call for:', calendarId);
        try {
            const sb = SupabaseClient.getClient();
            const response = await fetch(`${sb.supabaseUrl}/rest/v1/calendars?id=eq.${calendarId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': sb.supabaseKey,
                    'Authorization': `Bearer ${sb.supabaseKey}`
                }
            });
            console.log('[Storage.deleteCalendar] Response status:', response.status, 'OK:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Storage.deleteCalendar] Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            console.log('[Storage.deleteCalendar] Calendar deleted successfully');
            return response.ok;
        } catch (error) {
            console.error('[Storage.deleteCalendar] Error:', error);
            throw error;
        }
    },
};

// Initialize storage on load
(async () => {
    await Storage.init();
})();
