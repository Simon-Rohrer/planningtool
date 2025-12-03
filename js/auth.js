// Authentication Module with Supabase Auth

const Auth = {
    currentUser: null,
    supabaseUser: null, // Supabase auth.users record

    // Valid registration codes (can be managed via localStorage)
    validRegistrationCodes: [],

    async init() {
        // Set the single valid registration code
        const validCode = 'c2j5Dps!';
        localStorage.setItem('registrationCodes', JSON.stringify([validCode]));
        this.validRegistrationCodes = [validCode];

        // Check for existing Supabase session
        const sb = SupabaseClient.getClient();
        if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) {
                await this.setCurrentUser(session.user);
            }
        }

        // Listen for auth state changes
        if (sb) {
            sb.auth.onAuthStateChange(async (event, session) => {
                console.log('Auth state changed:', event);
                if (event === 'SIGNED_IN' && session) {
                    await this.setCurrentUser(session.user);
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.supabaseUser = null;
                }
            });
        }
    },

    async setCurrentUser(supabaseAuthUser) {
        this.supabaseUser = supabaseAuthUser;
        // Load profile from users table
        const profile = await Storage.getById('users', supabaseAuthUser.id);
        if (profile) {
            this.currentUser = profile;
        } else {
            // Fallback: use auth user data if profile not yet created
            this.currentUser = {
                id: supabaseAuthUser.id,
                email: supabaseAuthUser.email,
                username: supabaseAuthUser.user_metadata?.username || supabaseAuthUser.email.split('@')[0],
                name: supabaseAuthUser.user_metadata?.name || supabaseAuthUser.email.split('@')[0]
            };
        }
    },

    async register(registrationCode, name, email, username, password) {
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

        // Validate password length
        if (password.length < 6) {
            throw new Error('Passwort muss mindestens 6 Zeichen lang sein');
        }

        // Check if username already exists
        const existingUser = await Storage.getUserByUsername(username);
        if (existingUser) {
            throw new Error('Benutzername bereits vergeben');
        }

        const sb = SupabaseClient.getClient();
        if (!sb) {
            throw new Error('Supabase nicht konfiguriert');
        }

        // Sign up with Supabase Auth
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    name
                }
            }
        });

        if (error) {
            console.error('Supabase signUp error:', error);
            
            // User-friendly error messages
            if (error.message.includes('User already registered') || error.message.includes('already been registered')) {
                throw new Error('Diese E-Mail-Adresse ist bereits registriert. Bitte logge dich ein oder verwende eine andere E-Mail.');
            }
            
            throw new Error(error.message || 'Registrierung fehlgeschlagen');
        }

        // The user profile is automatically created by the trigger
        // Wait for the trigger to complete and retry if needed
        if (data.user) {
            let profile = null;
            let attempts = 0;
            const maxAttempts = 5;
            
            while (!profile && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                profile = await Storage.getById('users', data.user.id);
                attempts++;
            }
            
            if (!profile) {
                throw new Error('Profil konnte nicht erstellt werden. Bitte lade die Seite neu und versuche dich einzuloggen.');
            }
            
            // Update the profile with username if needed
            if (profile.username !== username) {
                await Storage.update('users', data.user.id, { username });
                profile.username = username;
            }
            
            await this.setCurrentUser(data.user);
        }

        return data.user;
    },

    async login(usernameOrEmail, password) {
        // Validate inputs
        if (!usernameOrEmail || !password) {
            throw new Error('Benutzername/E-Mail und Passwort sind erforderlich');
        }

        const sb = SupabaseClient.getClient();
        if (!sb) {
            throw new Error('Supabase nicht konfiguriert');
        }

        // Check if input is email or username
        let email = usernameOrEmail;
        
        // If it's not an email format, look up the email by username
        if (!usernameOrEmail.includes('@')) {
            const profile = await Storage.getUserByUsername(usernameOrEmail);
            if (!profile) {
                throw new Error('Ungültiger Benutzername oder Passwort');
            }
            email = profile.email;
        }

        // Sign in with Supabase Auth
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Supabase signIn error:', error);
            throw new Error('Ungültiger Benutzername/E-Mail oder Passwort');
        }

        if (data.user) {
            await this.setCurrentUser(data.user);
        }

        return this.currentUser;
    },

    async logout() {
        const sb = SupabaseClient.getClient();
        if (sb) {
            const { error } = await sb.auth.signOut();
            if (error) {
                console.error('Supabase signOut error:', error);
            }
        }
        this.currentUser = null;
        this.supabaseUser = null;
    },

    isAuthenticated() {
        return this.currentUser !== null;
    },

    getCurrentUser() {
        // Return profile with Supabase auth ID
        return this.currentUser;
    },

    getSupabaseUser() {
        return this.supabaseUser;
    },

    async updateCurrentUser() {
        if (this.currentUser) {
            const updatedUser = await Storage.getById('users', this.currentUser.id);
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
    async canManageBand(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = await Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader';
    },

    // Check if user can change roles (admin or leader)
    async canChangeRoles(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = await Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader';
    },

    // Check if user can propose/edit rehearsals (leader or co-leader)
    async canProposeRehearsal(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = await Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user can confirm rehearsals (leader or co-leader)
    async canConfirmRehearsal(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = await Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user can edit band details (leader or co-leader)
    async canEditBandDetails(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = await Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user can manage events (leader or co-leader)
    async canManageEvents(bandId) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        const role = await Storage.getUserRoleInBand(this.currentUser.id, bandId);
        return role === 'leader' || role === 'co-leader';
    },

    // Check if user is member of band
    async isMemberOfBand(bandId) {
        if (!this.currentUser) return false;
        const role = await Storage.getUserRoleInBand(this.currentUser.id, bandId);
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