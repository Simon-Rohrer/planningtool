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
            // Reset form for new rehearsal
            document.getElementById('rehearsalModalTitle').textContent = 'Neuen Probetermin vorschlagen';
            document.getElementById('saveRehearsalBtn').textContent = 'Vorschlag erstellen';
            document.getElementById('editRehearsalId').value = '';
            UI.clearForm('createRehearsalForm');

            // Reset date proposals
            const container = document.getElementById('dateProposals');
            container.innerHTML = `
                <div class="date-proposal-item">
                    <input type="datetime-local" class="date-input" required>
                    <button type="button" class="btn-icon remove-date" disabled>🗑️</button>
                </div>
            `;

            Bands.populateBandSelects();
            this.populateLocationSelect();
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

        // Create event button
        document.getElementById('createEventBtn').addEventListener('click', () => {
            // Reset form for new event
            document.getElementById('eventModalTitle').textContent = 'Neuen Auftritt erstellen';
            document.getElementById('saveEventBtn').textContent = 'Auftritt erstellen';
            document.getElementById('editEventId').value = '';
            UI.clearForm('createEventForm');

            Events.populateBandSelect();
            UI.openModal('createEventModal');
        });

        // Create event form
        document.getElementById('createEventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateEvent();
        });

        // Event band change
        document.getElementById('eventBand').addEventListener('change', (e) => {
            const bandId = e.target.value;
            if (bandId) {
                Events.loadBandMembers(bandId);
                Events.loadRehearsalsForBand(bandId);
            }
        });

        // Event band filter
        document.getElementById('eventBandFilter').addEventListener('change', (e) => {
            Events.currentFilter = e.target.value;
            Events.renderEvents(e.target.value);
        });

        // Send confirmation button
        const sendConfirmBtn = document.getElementById('sendConfirmationBtn');
        if (sendConfirmBtn) {
            sendConfirmBtn.addEventListener('click', () => {
                Rehearsals.confirmRehearsal();
            });
        }

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

        // Settings tabs
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchSettingsTab(tabName);
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
    },

    // Auth tab switching
    switchAuthTab(tabName) {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

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
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === `${tabName}Tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    },

    // Settings tab switching
    switchSettingsTab(tabName) {
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        document.querySelectorAll('.settings-tab-content').forEach(content => {
            if (content.id === `${tabName}SettingsTab`) {
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

        const user = Auth.getCurrentUser();
        document.getElementById('currentUserName').textContent = user.name;

        const isAdmin = Auth.isAdmin();

        // Settings Button (renamed from Admin)
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.style.display = isAdmin ? 'inline-block' : 'none';
            const newBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);

            newBtn.addEventListener('click', () => {
                this.openSettingsModal();
            });
        }

        this.updateDashboard();
        this.navigateTo('dashboard');
    },

    // Open settings modal
    openSettingsModal() {
        UI.openModal('settingsModal');
        this.renderLocationsList();
        this.renderAllBandsList();
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

        container.querySelectorAll('.delete-location').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Standort wirklich löschen?')) {
                    Storage.deleteLocation(btn.dataset.id);
                    this.renderLocationsList();
                }
            });
        });
    },

    // Render all bands list for management
    renderAllBandsList() {
        const container = document.getElementById('allBandsList');
        const bands = Storage.getAllBands();

        if (bands.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Bands vorhanden.</p>';
            return;
        }

        container.innerHTML = bands.map(band => {
            const members = Storage.getBandMembers(band.id);
            return `
                <div class="band-management-item">
                    <div class="band-info">
                        <h4>${Bands.escapeHtml(band.name)}</h4>
                        <p>${members.length} Mitglieder • Beitrittscode: <code>${band.joinCode}</code></p>
                    </div>
                    <button class="btn btn-danger btn-sm delete-band-admin" data-id="${band.id}">Löschen</button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.delete-band-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const bandId = btn.dataset.id;
                const band = Storage.getBand(bandId);
                if (confirm(`Band "${band.name}" wirklich löschen?`)) {
                    Storage.deleteBand(bandId);
                    this.renderAllBandsList();
                    UI.showToast('Band gelöscht', 'success');
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

        switch (viewName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'bands':
                Bands.renderBands();
                break;
            case 'events':
                Events.populateBandSelect();
                Events.renderEvents();
                break;
            case 'rehearsals':
                Bands.populateBandSelects();
                this.populateLocationSelect();
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

        const bands = Storage.getUserBands(user.id);
        document.getElementById('bandCount').textContent = bands.length;

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

        const confirmedRehearsals = rehearsals.filter(r => r.status === 'confirmed');
        document.getElementById('confirmedRehearsals').textContent = confirmedRehearsals.length;

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
        const editId = document.getElementById('editRehearsalId').value;
        const bandId = document.getElementById('rehearsalBand').value;
        const title = document.getElementById('rehearsalTitle').value;
        const description = document.getElementById('rehearsalDescription').value;
        const locationId = document.getElementById('rehearsalLocation').value;
        const dates = Rehearsals.getDatesFromForm();

        if (dates.length === 0) {
            UI.showToast('Bitte füge mindestens einen Terminvorschlag hinzu', 'error');
            return;
        }

        if (editId) {
            // Update existing
            Rehearsals.updateRehearsal(editId, bandId, title, description, dates, locationId);
        } else {
            // Create new
            Rehearsals.createRehearsal(bandId, title, description, dates, locationId);
        }
    },

    // Handle create event
    handleCreateEvent() {
        const editId = document.getElementById('editEventId').value;
        const bandId = document.getElementById('eventBand').value;
        const title = document.getElementById('eventTitle').value;
        const date = new Date(document.getElementById('eventDate').value).toISOString();
        const location = document.getElementById('eventLocation').value;
        const info = document.getElementById('eventInfo').value;
        const techInfo = document.getElementById('eventTechInfo').value;
        const members = Events.getSelectedMembers();
        const guests = Events.getGuests();
        const rehearsals = Events.getSelectedRehearsals();

        if (editId) {
            // Update existing
            Events.updateEvent(editId, bandId, title, date, location, info, techInfo, members, guests, rehearsals);
        } else {
            // Create new
            Events.createEvent(bandId, title, date, location, info, techInfo, members, guests, rehearsals);
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});