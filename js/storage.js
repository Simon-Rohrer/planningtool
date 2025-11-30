// Storage Module - LocalStorage wrapper for data persistence

const Storage = {
    // Initialize storage with default data
    init() {
        if (!localStorage.getItem('users')) {
            localStorage.setItem('users', JSON.stringify([]));
        }
        if (!localStorage.getItem('bands')) {
            localStorage.setItem('bands', JSON.stringify([]));
        }
        if (!localStorage.getItem('bandMembers')) {
            localStorage.setItem('bandMembers', JSON.stringify([]));
        }
        if (!localStorage.getItem('rehearsals')) {
            localStorage.setItem('rehearsals', JSON.stringify([]));
        }
        if (!localStorage.getItem('votes')) {
            localStorage.setItem('votes', JSON.stringify([]));
        }
        if (!localStorage.getItem('events')) {
            localStorage.setItem('events', JSON.stringify([]));
        }
        if (!localStorage.getItem('locations')) {
            localStorage.setItem('locations', JSON.stringify([]));
        }

        // Create admin user if not exists
        this.ensureAdminUser();
    },

    // Ensure admin user exists
    ensureAdminUser() {
        const users = this.getAll('users');
        const adminIndex = users.findIndex(u => u.username === 'admin');
        const adminEmail = 'Simon.rohrer04@web.de';

        if (adminIndex === -1) {
            // Create new admin
            const adminUser = {
                id: 'admin-' + Date.now(),
                username: 'admin',
                password: 'bandprobe',
                name: 'Administrator',
                email: adminEmail,
                isAdmin: true,
                bandIds: [],
                createdAt: new Date().toISOString()
            };
            users.push(adminUser);
            localStorage.setItem('users', JSON.stringify(users));
        } else {
            // Update existing admin email if different
            if (users[adminIndex].email !== adminEmail) {
                users[adminIndex].email = adminEmail;
                localStorage.setItem('users', JSON.stringify(users));
            }
        }
    },

    // Generic CRUD operations
    getAll(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    getById(key, id) {
        const items = this.getAll(key);
        return items.find(item => item.id === id);
    },

    save(key, item) {
        const items = this.getAll(key);
        items.push(item);
        localStorage.setItem(key, JSON.stringify(items));
        return item;
    },

    update(key, id, updatedItem) {
        const items = this.getAll(key);
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...updatedItem };
            localStorage.setItem(key, JSON.stringify(items));
            return items[index];
        }
        return null;
    },

    delete(key, id) {
        const items = this.getAll(key);
        const filtered = items.filter(item => item.id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));
        return filtered.length < items.length;
    },

    // User operations
    createUser(userData) {
        const user = {
            id: this.generateId(),
            ...userData,
            bandIds: [],
            createdAt: new Date().toISOString()
        };
        return this.save('users', user);
    },

    getUserByUsername(username) {
        const users = this.getAll('users');
        return users.find(user => user.username === username);
    },

    getUserByEmail(email) {
        const users = this.getAll('users');
        return users.find(user => user.email === email);
    },

    updateUser(userId, updates) {
        return this.update('users', userId, updates);
    },

    // Band operations
    createBand(bandData) {
        const band = {
            id: this.generateId(),
            ...bandData,
            joinCode: this.generateJoinCode(),
            createdAt: new Date().toISOString()
        };
        return this.save('bands', band);
    },

    // Generate 8-character join code for bands
    generateJoinCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // Find band by join code
    getBandByJoinCode(joinCode) {
        const bands = this.getAll('bands');
        return bands.find(b => b.joinCode === joinCode.toUpperCase());
    },

    getBand(bandId) {
        return this.getById('bands', bandId);
    },

    getAllBands() {
        return this.getAll('bands');
    },

    getAllBands() {
        return this.getAll('bands');
    },

    updateBand(bandId, updates) {
        return this.update('bands', bandId, updates);
    },

    deleteBand(bandId) {
        // Delete band
        this.delete('bands', bandId);

        // Delete all band members
        const members = this.getAll('bandMembers');
        const filteredMembers = members.filter(m => m.bandId !== bandId);
        localStorage.setItem('bandMembers', JSON.stringify(filteredMembers));

        // Delete all rehearsals
        const rehearsals = this.getAll('rehearsals');
        const filteredRehearsals = rehearsals.filter(r => r.bandId !== bandId);
        localStorage.setItem('rehearsals', JSON.stringify(filteredRehearsals));

        // Delete all events
        const events = this.getAll('events');
        const filteredEvents = events.filter(e => e.bandId !== bandId);
        localStorage.setItem('events', JSON.stringify(filteredEvents));

        // Update users' bandIds
        const users = this.getAll('users');
        users.forEach(user => {
            if (user.bandIds && user.bandIds.includes(bandId)) {
                user.bandIds = user.bandIds.filter(id => id !== bandId);
            }
        });
        localStorage.setItem('users', JSON.stringify(users));

        return true;
    },

    // Band Member operations
    addBandMember(bandId, userId, role) {
        const member = {
            id: this.generateId(),
            bandId,
            userId,
            role,
            joinedAt: new Date().toISOString()
        };

        // Add member
        this.save('bandMembers', member);

        // Update user's bandIds
        const user = this.getById('users', userId);
        if (user) {
            if (!user.bandIds) user.bandIds = [];
            if (!user.bandIds.includes(bandId)) {
                user.bandIds.push(bandId);
                this.updateUser(userId, { bandIds: user.bandIds });
            }
        }

        return member;
    },

    getBandMembers(bandId) {
        const members = this.getAll('bandMembers');
        return members.filter(m => m.bandId === bandId);
    },

    getUserBands(userId) {
        const members = this.getAll('bandMembers');
        const userMemberships = members.filter(m => m.userId === userId);
        return userMemberships.map(m => ({
            ...this.getBand(m.bandId),
            role: m.role
        }));
    },

    getUserRoleInBand(userId, bandId) {
        const members = this.getAll('bandMembers');
        const membership = members.find(m => m.userId === userId && m.bandId === bandId);
        return membership ? membership.role : null;
    },

    updateBandMemberRole(bandId, userId, newRole) {
        const members = this.getAll('bandMembers');
        const member = members.find(m => m.bandId === bandId && m.userId === userId);
        if (member) {
            return this.update('bandMembers', member.id, { role: newRole });
        }
        return null;
    },

    removeBandMember(bandId, userId) {
        const members = this.getAll('bandMembers');
        const member = members.find(m => m.bandId === bandId && m.userId === userId);
        if (member) {
            this.delete('bandMembers', member.id);

            // Update user's bandIds
            const user = this.getById('users', userId);
            if (user && user.bandIds) {
                user.bandIds = user.bandIds.filter(id => id !== bandId);
                this.updateUser(userId, { bandIds: user.bandIds });
            }

            return true;
        }
        return false;
    },

    // Rehearsal operations
    createRehearsal(rehearsalData) {
        const rehearsal = {
            id: this.generateId(),
            ...rehearsalData,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        return this.save('rehearsals', rehearsal);
    },

    getRehearsal(rehearsalId) {
        return this.getById('rehearsals', rehearsalId);
    },

    getBandRehearsals(bandId) {
        const rehearsals = this.getAll('rehearsals');
        return rehearsals.filter(r => r.bandId === bandId);
    },

    getUserRehearsals(userId) {
        const userBands = this.getUserBands(userId);
        const bandIds = userBands.map(b => b.id);
        const rehearsals = this.getAll('rehearsals');
        return rehearsals.filter(r => bandIds.includes(r.bandId));
    },

    updateRehearsal(rehearsalId, updates) {
        return this.update('rehearsals', rehearsalId, updates);
    },

    deleteRehearsal(rehearsalId) {
        // Delete rehearsal
        this.delete('rehearsals', rehearsalId);

        // Delete all votes for this rehearsal
        const votes = this.getAll('votes');
        const filteredVotes = votes.filter(v => v.rehearsalId !== rehearsalId);
        localStorage.setItem('votes', JSON.stringify(filteredVotes));

        return true;
    },

    // Vote operations
    createVote(voteData) {
        const vote = {
            id: this.generateId(),
            ...voteData,
            createdAt: new Date().toISOString()
        };

        // Check if vote already exists
        const votes = this.getAll('votes');
        const existingVote = votes.find(v =>
            v.rehearsalId === vote.rehearsalId &&
            v.userId === vote.userId &&
            v.dateIndex === vote.dateIndex
        );

        if (existingVote) {
            // Update existing vote
            return this.update('votes', existingVote.id, { availability: vote.availability });
        } else {
            // Create new vote
            return this.save('votes', vote);
        }
    },

    getRehearsalVotes(rehearsalId) {
        const votes = this.getAll('votes');
        return votes.filter(v => v.rehearsalId === rehearsalId);
    },

    getUserVoteForDate(userId, rehearsalId, dateIndex) {
        const votes = this.getAll('votes');
        return votes.find(v =>
            v.userId === userId &&
            v.rehearsalId === rehearsalId &&
            v.dateIndex === dateIndex
        );
    },

    // Event operations
    createEvent(eventData) {
        const event = {
            id: this.generateId(),
            ...eventData,
            createdAt: new Date().toISOString()
        };
        return this.save('events', event);
    },

    getEvent(eventId) {
        return this.getById('events', eventId);
    },

    getBandEvents(bandId) {
        const events = this.getAll('events');
        return events.filter(e => e.bandId === bandId);
    },

    getUserEvents(userId) {
        const userBands = this.getUserBands(userId);
        const bandIds = userBands.map(b => b.id);
        const events = this.getAll('events');
        return events.filter(e => bandIds.includes(e.bandId));
    },

    updateEvent(eventId, updates) {
        return this.update('events', eventId, updates);
    },

    deleteEvent(eventId) {
        return this.delete('events', eventId);
    },

    // Location operations
    createLocation(name, address) {
        const location = {
            id: this.generateId(),
            name,
            address,
            createdAt: new Date().toISOString()
        };
        return this.save('locations', location);
    },

    getLocations() {
        return this.getAll('locations');
    },

    getLocation(id) {
        return this.getById('locations', id);
    },

    deleteLocation(id) {
        this.delete('locations', id);
    },

    // Utility functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    clear() {
        localStorage.clear();
        this.init();
    }
};

// Initialize storage on load
Storage.init();