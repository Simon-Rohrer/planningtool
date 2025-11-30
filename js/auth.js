// Authentication Module

const Auth = {
    currentUser: null,

    // Valid registration codes (can be managed via localStorage)
    validRegistrationCodes: [],

    init() {
        // Check for existing session
        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser) {
            this.currentUser = JSON.parse(sessionUser);
        }

        // Set the single valid registration code
        const validCode = 'c2j5Dps!';
        localStorage.setItem('registrationCodes', JSON.stringify([validCode]));
        this.validRegistrationCodes = [validCode];
    },

    register(registrationCode, name, email, username, password) {
        // Validate registration code first
        if (!registrationCode) {
            throw new Error('Registrierungscode ist erforderlich');
        }

        // Check if code is valid (exact match)
        const validCodes = JSON.parse(localStorage.getItem('registrationCodes') || '[]');
        if (!validCodes.includes(registrationCode)) {
            throw new Error('Ungültiger Registrierungscode');
        }

        // Validate inputs
        if (!name || !email || !username || !password) {
            throw new Error('Alle Felder sind erforderlich');
        }

        // Check if username already exists
        const existingUser = Storage.getUserByUsername(username);
        if (existingUser) {
            throw new Error('Benutzername bereits vergeben');
        }

        // Check if email already exists
        const existingEmail = Storage.getUserByEmail(email);
        if (existingEmail) {
            throw new Error('E-Mail bereits registriert');
        }

        // Validate password length
        if (password.length < 6) {
            throw new Error('Passwort muss mindestens 6 Zeichen lang sein');
        }

        // Create user
        const user = Storage.createUser({
            name,
            email,
            username,
            password // In production, this should be hashed!
        });

        return user;
    },

    login(usernameOrEmail, password) {
        // Validate inputs
        if (!usernameOrEmail || !password) {
            throw new Error('Benutzername/E-Mail und Passwort sind erforderlich');
        }

        // Find user by username or email
        const users = Storage.getAll('users');
        const user = users.find(u =>
            u.username.toLowerCase() === usernameOrEmail.toLowerCase() ||
            u.email.toLowerCase() === usernameOrEmail.toLowerCase()
        );

        if (!user) {
            throw new Error('Ungültiger Benutzername/E-Mail oder Passwort');
        }

        // Check password
        if (user.password !== password) {
            throw new Error('Ungültiger Benutzername oder Passwort');
        }

        // Set current user
        this.currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));

        return user;
    },

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('currentUser');
    },

    isAuthenticated() {
        return this.currentUser !== null;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    updateCurrentUser() {
        if (this.currentUser) {
            const updatedUser = Storage.getById('users', this.currentUser.id);
            this.currentUser = updatedUser;
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
    },

    // Check if user is admin
    isAdmin() {
        return this.currentUser && this.currentUser.isAdmin === true;
    },

    // Check if user can create bands (everyone can)
    canCreateBand() {
        return true;
    },

    // Check if user can manage band (admin or leader)
    canManageBand(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader';
    },

    // Check if user can change roles (admin or leader)
    canChangeRoles(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader';
    },

    // Check if user can propose/edit rehearsals (leader or co-leader)
    canProposeRehearsal(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user can confirm rehearsals (leader or co-leader)
    canConfirmRehearsal(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user can edit band details (leader or co-leader)
    canEditBandDetails(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user can manage events (leader or co-leader)
    canManageEvents(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user is member of band
    isMemberOfBand(bandId) {
        if (!this.currentUser) return false;
        const role = Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role !== null;
    },

    // Get role display with hierarchy
    getRoleHierarchy(role) {
        const hierarchy = {
            'admin': 1,
            'leader': 2,
            'co-leader': 3,
            'member': 4
        };
        return hierarchy[role] || 999;
    }
};

// Initialize auth on load
Auth.init();