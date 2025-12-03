// Storage Module - Supabase-only (no localStorage fallback)

const Storage = {
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
        const sb = SupabaseClient.getClient();
        const { data, error } = await sb.from(key).insert(item).select('*').single();
        if (error) { 
            console.error('Supabase save error', key, error); 
            throw new Error(`Fehler beim Speichern in ${key}: ${error.message}`);
        }
        return data || item;
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
        const band = {
            id: this.generateId(),
            ...bandData,
            joinCode: await this.generateUniqueJoinCode(),
            createdAt: new Date().toISOString(),
            color: bandData.color || '#6366f1'
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
            readBy: [createdBy]
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
    }
};

// Initialize storage on load
(async () => {
    await Storage.init();
})();
