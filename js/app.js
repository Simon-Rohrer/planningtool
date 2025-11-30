// Main Application Controller

const App = {
    init() {
        // Check authentication
        if (Auth.isAuthenticated()) {
            this.showApp();
        } else {
            this.showAuth();
        }

        // Setup event listeners
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Auth form tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchAuthTab(tabName);
            });
        });

        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.navigateTo(view);
            });
        });

        // Create band button
        document.getElementById('createBandBtn').addEventListener('click', () => {
            UI.openModal('createBandModal');
        });

        // Create band form
        document.getElementById('createBandForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateBand();
        });

        // Add member button
        document.getElementById('addMemberBtn').addEventListener('click', () => {
            UI.openModal('addMemberModal');
        });

        // Add member form
        document.getElementById('addMemberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddMember();
        });

        // Delete band button
        document.getElementById('deleteBandBtn').addEventListener('click', () => {
            if (Bands.currentBandId) {
                Bands.deleteBand(Bands.currentBandId);
            }
        });

        // Create rehearsal button
        document.getElementById('createRehearsalBtn').addEventListener('click', () => {
            Bands.populateBandSelects();
            UI.openModal('createRehearsalModal');
        });

        // Create rehearsal form
        document.getElementById('createRehearsalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateRehearsal();
        });

        // Add date button
        document.getElementById('addDateBtn').addEventListener('click', () => {
            Rehearsals.addDateProposal();
        });

        // Band filter
        document.getElementById('bandFilter').addEventListener('change', (e) => {
            Rehearsals.currentFilter = e.target.value;
            Rehearsals.renderRehearsals(e.target.value);
        });

        // Statistics rehearsal select
        document.getElementById('statsRehearsalSelect').addEventListener('change', (e) => {
            Statistics.renderStatistics(e.target.value);
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    UI.closeModal(modal.id);
                }
            });
        });

        // Close modals on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    UI.closeModal(modal.id);
                }
            });
        });

        // Create location form
        const createLocationForm = document.getElementById('createLocationForm');
        if (createLocationForm) {
            createLocationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateLocation();
            });
        }

        // Tab switching in band details
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Join Band Button
        const joinBandBtn = document.getElementById('joinBandBtn');
        if (joinBandBtn) {
            joinBandBtn.addEventListener('click', () => {
                UI.openModal('joinBandModal');
            });
        }

        // Join Band Form
        const joinBandForm = document.getElementById('joinBandForm');
        if (joinBandForm) {
            joinBandForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const code = document.getElementById('joinBandCode').value;
                Bands.joinBand(code);
            });
        }

        // Email Settings Form
        const emailSettingsForm = document.getElementById('emailSettingsForm');
        if (emailSettingsForm) {
            emailSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const serviceId = document.getElementById('emailServiceId').value;
                const templateId = document.getElementById('emailTemplateId').value;
                const publicKey = document.getElementById('emailPublicKey').value;

                EmailService.saveConfig(serviceId, templateId, publicKey);
                UI.showToast('E-Mail Einstellungen gespeichert', 'success');
                UI.closeModal('emailSettingsModal');
            });
        }

        // Test Email Button
        const testEmailBtn = document.getElementById('testEmailBtn');
        if (testEmailBtn) {
            testEmailBtn.addEventListener('click', async () => {
                const user = Auth.getCurrentUser();
                if (!user || !user.email) {
                    UI.showToast('Keine E-Mail-Adresse gefunden', 'error');
                    return;
                }

                // Save current values temporarily for test
                const serviceId = document.getElementById('emailServiceId').value;
                const templateId = document.getElementById('emailTemplateId').value;
                const publicKey = document.getElementById('emailPublicKey').value;

                EmailService.init(serviceId, templateId, publicKey);

                UI.showToast('Sende Test-E-Mail...', 'info');
                const result = await EmailService.testConfiguration(user.email);

                if (result.success) {
                    UI.showToast(result.message, 'success');
                } else {
                    UI.showToast(result.message, 'error');
                }
            });
        }
    },

    // Auth tab switching
    switchAuthTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.auth-tab').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update forms
        document.querySelectorAll('.auth-form').forEach(form => {
            if (form.id === `${tabName}Form`) {
                form.classList.add('active');
            } else {
                form.classList.remove('active');
            }
        });
    },

    // Tab switching in modals
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === `${tabName}Tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    },

    // Handle login
    handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            Auth.login(username, password);
            UI.showToast('Erfolgreich angemeldet!', 'success');
            this.showApp();
        } catch (error) {
            UI.showToast(error.message, 'error');
        }
    },

    // Handle registration
    handleRegister() {
        const registrationCode = document.getElementById('registerCode').value;
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

        // Validate password confirmation
        if (password !== passwordConfirm) {
            UI.showToast('Passwörter stimmen nicht überein', 'error');
            return;
        }

        try {
            Auth.register(registrationCode, name, email, username, password);
            UI.showToast('Registrierung erfolgreich! Bitte melde dich an.', 'success');
            this.switchAuthTab('login');
            UI.clearForm('registerForm');
        } catch (error) {
            UI.showToast(error.message, 'error');
        }
    },

    // Handle logout
    handleLogout() {
        Auth.logout();
        UI.showToast('Erfolgreich abgemeldet', 'success');
        this.showAuth();
    },

    // Show authentication screen
    showAuth() {
        document.getElementById('authModal').classList.add('active');
        document.getElementById('app').style.display = 'none';
    },

    // Show main application
    showApp() {
        document.getElementById('authModal').classList.remove('active');
        document.getElementById('app').style.display = 'flex';

        // Update user name
        const user = Auth.getCurrentUser();
        document.getElementById('currentUserName').textContent = user.name;

        // Show admin buttons if admin
        const isAdmin = Auth.isAdmin();

        // Admin Settings Button
        const adminBtn = document.getElementById('adminSettingsBtn');
        if (adminBtn) {
            adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
            // Remove old listener
            const newBtn = adminBtn.cloneNode(true);
            adminBtn.parentNode.replaceChild(newBtn, adminBtn);

            newBtn.addEventListener('click', () => {
                if (EmailService.config) {
                    document.getElementById('emailServiceId').value = EmailService.config.serviceId || '';
                    document.getElementById('emailTemplateId').value = EmailService.config.templateId || '';
                    document.getElementById('emailPublicKey').value = EmailService.config.publicKey || '';
                }
                UI.openModal('emailSettingsModal');
            });
        }

        // Locations Button
        const locationsBtn = document.getElementById('manageLocationsBtn');
        if (locationsBtn) {
            locationsBtn.style.display = isAdmin ? 'inline-block' : 'none';
            // Remove old listener
            const newBtn = locationsBtn.cloneNode(true);
            locationsBtn.parentNode.replaceChild(newBtn, locationsBtn);

            newBtn.addEventListener('click', () => {
                this.openLocationsModal();
            });
        }

        // Load initial data
        this.updateDashboard();
        this.navigateTo('dashboard');
    },

    // Open locations modal
    openLocationsModal() {
        UI.openModal('locationsModal');
        this.renderLocationsList();
    },

    // Render locations list
    renderLocationsList() {
        const container = document.getElementById('locationsList');
        const locations = Storage.getLocations();

        if (locations.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Standorte vorhanden.</p>';
            return;
        }

        container.innerHTML = locations.map(loc => `
            <div class="location-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--color-border);">
                <div>
                    <strong>${Bands.escapeHtml(loc.name)}</strong>
                    ${loc.address ? `<br><small>${Bands.escapeHtml(loc.address)}</small>` : ''}
                </div>
                <button class="btn-icon delete-location" data-id="${loc.id}" title="Löschen">🗑️</button>
            </div>
        `).join('');

        // Add delete handlers
        container.querySelectorAll('.delete-location').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Standort wirklich löschen?')) {
                    Storage.deleteLocation(btn.dataset.id);
                    this.renderLocationsList();
                }
            });
        });
    },

    // Handle create location
    handleCreateLocation() {
        const nameInput = document.getElementById('newLocationName');
        const addressInput = document.getElementById('newLocationAddress');

        const name = nameInput.value;
        const address = addressInput.value;

        if (name) {
            Storage.createLocation(name, address);
            nameInput.value = '';
            addressInput.value = '';
            this.renderLocationsList();
            UI.showToast('Standort erstellt', 'success');
        }
    },

    // Populate location select
    populateLocationSelect() {
        const select = document.getElementById('rehearsalLocation');
        if (!select) return;

        const locations = Storage.getLocations();

        select.innerHTML = '<option value="">Kein Ort ausgewählt</option>' +
            locations.map(loc =>
                `<option value="${loc.id}">${Bands.escapeHtml(loc.name)}</option>`
            ).join('');
    },

    // Navigate to view
    navigateTo(viewName) {
        UI.showView(`${viewName}View`);

        // Load view-specific data
        switch (viewName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'bands':
                Bands.renderBands();
                break;
            case 'rehearsals':
                Bands.populateBandSelects();
                this.populateLocationSelect(); // Added this line
                Rehearsals.renderRehearsals();
                break;
            case 'statistics':
                Rehearsals.populateStatsSelect();
                break;
        }
    },

    // Update dashboard
    updateDashboard() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        // Update band count
        const bands = Storage.getUserBands(user.id);
        document.getElementById('bandCount').textContent = bands.length;

        // Update pending votes count
        const rehearsals = Storage.getUserRehearsals(user.id);
        const pendingRehearsals = rehearsals.filter(r => r.status === 'pending');

        let pendingVotesCount = 0;
        pendingRehearsals.forEach(rehearsal => {
            rehearsal.proposedDates.forEach((date, index) => {
                const vote = Storage.getUserVoteForDate(user.id, rehearsal.id, index);
                if (!vote) {
                    pendingVotesCount++;
                }
            });
        });

        document.getElementById('pendingVotes').textContent = pendingVotesCount;

        // Update confirmed rehearsals count
        const confirmedRehearsals = rehearsals.filter(r => r.status === 'confirmed');
        document.getElementById('confirmedRehearsals').textContent = confirmedRehearsals.length;

        // Render recent votes
        Rehearsals.renderRecentVotes();
    },

    // Handle create band
    handleCreateBand() {
        const name = document.getElementById('bandName').value;
        const description = document.getElementById('bandDescription').value;

        Bands.createBand(name, description);
        UI.clearForm('createBandForm');
    },

    // Handle add member
    handleAddMember() {
        const username = document.getElementById('memberUsername').value;
        const role = document.getElementById('memberRole').value;

        if (Bands.currentBandId) {
            Bands.addMember(Bands.currentBandId, username, role);
            UI.clearForm('addMemberForm');
        }
    },

    // Handle create rehearsal
    handleCreateRehearsal() {
        const bandId = document.getElementById('rehearsalBand').value;
        const title = document.getElementById('rehearsalTitle').value;
        const description = document.getElementById('rehearsalDescription').value;
        const locationId = document.getElementById('rehearsalLocation').value;
        const dates = Rehearsals.getDatesFromForm();

        if (dates.length === 0) {
            UI.showToast('Bitte füge mindestens einen Terminvorschlag hinzu', 'error');
            return;
        }

        Rehearsals.createRehearsal(bandId, title, description, dates, locationId);
        UI.clearForm('createRehearsalForm');

        // Reset date proposals to one field
        const container = document.getElementById('dateProposals');
        container.innerHTML = `
            <div class="date-proposal-item">
                <input type="datetime-local" class="date-input" required>
                <button type="button" class="btn-icon remove-date" disabled>🗑️</button>
            </div>
        `;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
