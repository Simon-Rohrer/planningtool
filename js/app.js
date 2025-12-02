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

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    UI.closeModal(modal.id);
                }
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

            // Clear event select initially
            const eventSelect = document.getElementById('rehearsalEvent');
            if (eventSelect) {
                eventSelect.innerHTML = '<option value="">Bitte zuerst eine Band auswählen</option>';
            }

            // Hide notification checkbox for new rehearsals
            const notifyGroup = document.getElementById('notifyMembersGroup');
            if (notifyGroup) {
                notifyGroup.style.display = 'none';
                document.getElementById('notifyMembersOnUpdate').checked = false;
            }

            UI.openModal('createRehearsalModal');
        });

        // Listen for band selection changes in rehearsal form
        const rehearsalBandSelect = document.getElementById('rehearsalBand');
        if (rehearsalBandSelect) {
            rehearsalBandSelect.addEventListener('change', (e) => {
                const bandId = e.target.value;
                if (bandId) {
                    this.populateEventSelect(bandId);
                } else {
                    const eventSelect = document.getElementById('rehearsalEvent');
                    if (eventSelect) {
                        eventSelect.innerHTML = '<option value="">Bitte zuerst eine Band auswählen</option>';
                    }
                }
            });
        }

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
                Events.loadBandMembers(bandId, null); // null = pre-select all
            }
        });

        // Add event song button
        const addEventSongBtn = document.getElementById('addEventSongBtn');
        if (addEventSongBtn) {
            addEventSongBtn.addEventListener('click', () => {
                const eventId = document.getElementById('editEventId').value;
                if (!eventId) {
                    UI.showToast('Bitte speichere den Auftritt erst, bevor du Songs hinzufügst', 'warning');
                    return;
                }
                this.openSongModal(eventId, null, null);
            });
        }

        // Event band filter
        document.getElementById('eventBandFilter').addEventListener('change', (e) => {
            Events.currentFilter = e.target.value;
            Events.renderEvents(e.target.value);
        });

        // Rehearsal band change - load events for selection
        document.getElementById('rehearsalBand').addEventListener('change', (e) => {
            const bandId = e.target.value;
            if (bandId) {
                this.populateEventSelect(bandId);
            }
        });

        // Onboarding handlers
        document.getElementById('onboardingCreateBandBtn').addEventListener('click', () => {
            UI.closeModal('onboardingModal');
            UI.openModal('createBandModal');
        });

        document.getElementById('onboardingJoinBandBtn').addEventListener('click', () => {
            UI.closeModal('onboardingModal');
            UI.openModal('joinBandModal');
        });

        document.getElementById('onboardingSkipBtn').addEventListener('click', () => {
            UI.closeModal('onboardingModal');
        });

        // Send confirmation button
        const sendConfirmBtn = document.getElementById('sendConfirmationBtn');
        if (sendConfirmBtn) {
            sendConfirmBtn.addEventListener('click', () => {
                Rehearsals.confirmRehearsal();
            });
        }

        // Modal close buttons
        document.querySelectorAll('.cancel').forEach(btn => {
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
                    // Don't close auth modal or onboarding modal on background click
                    if (modal.id === 'authModal' || modal.id === 'onboardingModal') {
                        return;
                    }
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

        // Update profile form
        const updateProfileForm = document.getElementById('updateProfileForm');
        if (updateProfileForm) {
            updateProfileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUpdateProfile();
            });
        }

        // Create absence form
        const createAbsenceForm = document.getElementById('createAbsenceForm');
        if (createAbsenceForm) {
            createAbsenceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateAbsence();
            });
        }

        // Create news button
        const createNewsBtn = document.getElementById('createNewsBtn');
        if (createNewsBtn) {
            createNewsBtn.addEventListener('click', () => {
                UI.openModal('createNewsModal');
            });
        }

        // Create news form
        const createNewsForm = document.getElementById('createNewsForm');
        if (createNewsForm) {
            createNewsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateNews();
            });
        }

        // Song form
        const songForm = document.getElementById('songForm');
        if (songForm) {
            songForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSaveSong();
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

    // Navigate to a specific view
    navigateTo(view) {
        const viewMap = {
            'dashboard': 'dashboardView',
            'bands': 'bandsView',
            'events': 'eventsView',
            'rehearsals': 'rehearsalsView',
            'statistics': 'statisticsView',
            'news': 'newsView'
        };

        const viewId = viewMap[view];
        if (viewId) {
            UI.showView(viewId);

            // Update active navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                if (item.dataset.view === view) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            // Render specific views
            if (view === 'bands') {
                Bands.renderBands();
            } else if (view === 'events') {
                Events.renderEvents();
            } else if (view === 'rehearsals') {
                Rehearsals.renderRehearsals();
            } else if (view === 'statistics') {
                Rehearsals.populateStatisticsSelect();
            } else if (view === 'news') {
                this.renderNewsView();

                // Show/hide create button based on admin status
                const createNewsBtn = document.getElementById('createNewsBtn');
                if (createNewsBtn) {
                    createNewsBtn.style.display = Auth.isAdmin() ? 'inline-flex' : 'none';
                }
            }
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
            Auth.login(username, password); // Auto-login after registration

            UI.showToast('Registrierung erfolgreich!', 'success');
            UI.clearForm('registerForm');

            // Show app first (behind modal)
            this.showApp();

            // Then show onboarding modal
            UI.openModal('onboardingModal');
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

    // News Management
    renderNewsView() {
        const container = document.getElementById('newsContainer');
        const newsItems = Storage.getAllNews();
        const isAdmin = Auth.isAdmin();

        if (newsItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📰</div>
                    <p>Noch keine News oder Updates vorhanden.</p>
                    <p>Hier wirst du auf dem laufenden gehalten.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = newsItems.map(news => {
            const date = new Date(news.createdAt).toLocaleDateString('de-DE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const deleteBtn = isAdmin ? `
                <button class="btn-icon delete-news" data-id="${news.id}" title="News löschen">
                    🗑️
                </button>
            ` : '';

            return `
                <div class="news-card" style="background: var(--color-surface); padding: var(--spacing-xl); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); margin-bottom: var(--spacing-lg); border-left: 4px solid var(--color-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-md);">
                        <div style="flex: 1;">
                            <h3 style="margin-bottom: var(--spacing-xs); color: var(--color-text);">${this.escapeHtml(news.title)}</h3>
                            <p style="font-size: 0.875rem; color: var(--color-text-light);">📅 ${date}</p>
                        </div>
                        ${deleteBtn}
                    </div>
                    <p style="color: var(--color-text-secondary); white-space: pre-wrap;">${this.escapeHtml(news.content)}</p>
                </div>
            `;
        }).join('');

        // Add delete handlers
        container.querySelectorAll('.delete-news').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteNews(btn.dataset.id);
            });
        });
    },

    handleCreateNews() {
        const title = document.getElementById('newsTitle').value;
        const content = document.getElementById('newsContent').value;
        const user = Auth.getCurrentUser();

        if (!user || !Auth.isAdmin()) {
            UI.showToast('Keine Berechtigung', 'error');
            return;
        }

        Storage.createNewsItem(title, content, user.id);
        UI.showToast('News veröffentlicht!', 'success');

        // Clear form and close modal
        document.getElementById('newsTitle').value = '';
        document.getElementById('newsContent').value = '';
        UI.closeModal('createNewsModal');

        // Refresh news view
        this.renderNewsView();
    },

    deleteNews(newsId) {
        if (!confirm('News wirklich löschen?')) return;

        Storage.deleteNewsItem(newsId);
        UI.showToast('News gelöscht', 'success');
        this.renderNewsView();
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Song Management
    openSongModal(eventId = null, bandId = null, songId = null) {
        document.getElementById('songId').value = songId || '';
        document.getElementById('songEventId').value = eventId || '';
        document.getElementById('songBandId').value = bandId || '';

        if (songId) {
            // Edit existing song
            const song = Storage.getById('songs', songId);
            if (song) {
                document.getElementById('songTitle').value = song.title;
                document.getElementById('songArtist').value = song.artist;
                document.getElementById('songBPM').value = song.bpm || '';
                document.getElementById('songKey').value = song.key || '';
                document.getElementById('songLeadVocal').value = song.leadVocal || '';
            }
        } else {
            // New song
            document.getElementById('songTitle').value = '';
            document.getElementById('songArtist').value = '';
            document.getElementById('songBPM').value = '';
            document.getElementById('songKey').value = '';
            document.getElementById('songLeadVocal').value = '';
        }

        UI.openModal('songModal');
    },

    handleSaveSong() {
        const songId = document.getElementById('songId').value;
        const eventId = document.getElementById('songEventId').value;
        const bandId = document.getElementById('songBandId').value;
        const title = document.getElementById('songTitle').value;
        const artist = document.getElementById('songArtist').value;
        const bpm = document.getElementById('songBPM').value;
        const key = document.getElementById('songKey').value;
        const leadVocal = document.getElementById('songLeadVocal').value;
        const user = Auth.getCurrentUser();

        const songData = {
            title,
            artist,
            bpm: bpm ? parseInt(bpm) : null,
            key: key || null,
            leadVocal: leadVocal || null,
            createdBy: user.id
        };

        if (eventId) songData.eventId = eventId;
        if (bandId) songData.bandId = bandId;

        if (songId) {
            // Update existing song
            Storage.updateSong(songId, songData);
            UI.showToast('Song aktualisiert', 'success');
        } else {
            // Create new song
            Storage.createSong(songData);
            UI.showToast('Song hinzugefügt', 'success');
        }

        UI.closeModal('songModal');

        // Refresh the appropriate list
        if (eventId) {
            this.renderEventSongs(eventId);
        } else if (bandId) {
            this.renderBandSongs(bandId);
        }
    },

    renderEventSongs(eventId) {
        const container = document.getElementById('eventSongsList');
        if (!container) return;

        const songs = Storage.getEventSongs(eventId);

        // Get band ID from event to show band songs
        const event = Storage.getById('events', eventId);
        const bandSongs = event && event.bandId ? Storage.getBandSongs(event.bandId) : [];

        if (songs.length === 0 && bandSongs.length === 0) {
            container.innerHTML = '<p class="text-muted">Noch keine Songs hinzugefügt.</p>';
            return;
        }

        let html = '';

        // Show button to copy from band if there are band songs
        if (bandSongs.length > 0) {
            html += `
                <div style="margin-bottom: var(--spacing-md);">
                    <button type="button" id="copyBandSongsBtn" class="btn btn-secondary btn-sm">
                        📋 Songs aus Band-Pool übernehmen
                    </button>
                </div>
            `;
        }

        if (songs.length > 0) {
            html += `
                <table class="songs-table" style="width: 100%; border-collapse: collapse; margin-top: var(--spacing-md);">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--color-border);">
                            <th style="padding: var(--spacing-sm); text-align: left;">Titel</th>
                            <th style="padding: var(--spacing-sm); text-align: left;">Interpret</th>
                            <th style="padding: var(--spacing-sm); text-align: left;">BPM</th>
                            <th style="padding: var(--spacing-sm); text-align: left;">Tonart</th>
                            <th style="padding: var(--spacing-sm); text-align: left;">Lead Vocal</th>
                            <th style="padding: var(--spacing-sm); text-align: center;">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${songs.map(song => `
                            <tr style="border-bottom: 1px solid var(--color-border);">
                                <td style="padding: var(--spacing-sm);">${this.escapeHtml(song.title)}</td>
                                <td style="padding: var(--spacing-sm);">${this.escapeHtml(song.artist)}</td>
                                <td style="padding: var(--spacing-sm);">${song.bpm || '-'}</td>
                                <td style="padding: var(--spacing-sm);">${song.key || '-'}</td>
                                <td style="padding: var(--spacing-sm);">${song.leadVocal || '-'}</td>
                                <td style="padding: var(--spacing-sm); text-align: center;">
                                    <button class="btn-icon edit-song" data-id="${song.id}" title="Bearbeiten">✏️</button>
                                    <button class="btn-icon delete-song" data-id="${song.id}" title="Löschen">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        container.innerHTML = html;

        // Add copy band songs handler
        const copyBtn = container.querySelector('#copyBandSongsBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.showBandSongSelector(eventId, bandSongs);
            });
        }

        // Add event listeners for edit/delete
        container.querySelectorAll('.edit-song').forEach(btn => {
            btn.addEventListener('click', () => {
                this.openSongModal(eventId, null, btn.dataset.id);
            });
        });

        container.querySelectorAll('.delete-song').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Song wirklich löschen?')) {
                    Storage.deleteSong(btn.dataset.id);
                    UI.showToast('Song gelöscht', 'success');
                    this.renderEventSongs(eventId);
                }
            });
        });
    },

    showBandSongSelector(eventId, bandSongs) {
        // Create a simple selection UI
        const songList = bandSongs.map(song => `
            <label style="display: block; padding: var(--spacing-sm); border-bottom: 1px solid var(--color-border);">
                <input type="checkbox" value="${song.id}" class="band-song-checkbox">
                <strong>${this.escapeHtml(song.title)}</strong> - ${this.escapeHtml(song.artist)}
                ${song.bpm ? `| ${song.bpm} BPM` : ''}
                ${song.key ? `| ${song.key}` : ''}
            </label>
        `).join('');

        const modalContent = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${songList}
            </div>
            <div style="margin-top: var(--spacing-md); display: flex; gap: var(--spacing-sm); justify-content: flex-end;">
                <button type="button" id="cancelCopySongs" class="btn">Abbrechen</button>
                <button type="button" id="confirmCopySongs" class="btn btn-primary">Ausgewählte kopieren</button>
            </div>
        `;

        // Use a temp container or toast-like modal
        const tempModal = document.createElement('div');
        tempModal.className = 'modal active';
        tempModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Songs aus Band-Pool wählen</h2>
                </div>
                <div class="modal-body">
                    ${modalContent}
                </div>
            </div>
        `;
        document.body.appendChild(tempModal);

        // Add handlers
        tempModal.querySelector('#cancelCopySongs').addEventListener('click', () => {
            tempModal.remove();
        });

        tempModal.querySelector('#confirmCopySongs').addEventListener('click', () => {
            const selectedIds = Array.from(tempModal.querySelectorAll('.band-song-checkbox:checked')).map(cb => cb.value);
            this.copyBandSongsToEvent(eventId, selectedIds);
            tempModal.remove();
        });

        // Close on overlay click
        tempModal.addEventListener('click', (e) => {
            if (e.target === tempModal) {
                tempModal.remove();
            }
        });
    },

    copyBandSongsToEvent(eventId, songIds) {
        const user = Auth.getCurrentUser();
        let count = 0;

        songIds.forEach(songId => {
            const bandSong = Storage.getById('songs', songId);
            if (bandSong) {
                // Create a copy for the event
                const eventSong = {
                    title: bandSong.title,
                    artist: bandSong.artist,
                    bpm: bandSong.bpm,
                    key: bandSong.key,
                    leadVocal: bandSong.leadVocal,
                    eventId: eventId,
                    createdBy: user.id
                };
                Storage.createSong(eventSong);
                count++;
            }
        });

        UI.showToast(`${count} Song${count !== 1 ? 's' : ''} kopiert`, 'success');
        this.renderEventSongs(eventId);
    },

    renderBandSongs(bandId) {
        const container = document.getElementById('bandSongsList');
        if (!container) return;

        const songs = Storage.getBandSongs(bandId);

        if (songs.length === 0) {
            container.innerHTML = '<p class="text-muted">Noch keine Songs hinzugefügt.</p>';
            return;
        }

        container.innerHTML = `
            <table class="songs-table" style="width: 100%; border-collapse: collapse; margin-top: var(--spacing-md);">
                <thead>
                    <tr style="border-bottom: 2px solid var(--color-border);">
                        <th style="padding: var(--spacing-sm); text-align: left;">Titel</th>
                        <th style="padding: var(--spacing-sm); text-align: left;">Interpret</th>
                        <th style="padding: var(--spacing-sm); text-align: left;">BPM</th>
                        <th style="padding: var(--spacing-sm); text-align: left;">Tonart</th>
                        <th style="padding: var(--spacing-sm); text-align: left;">Lead Vocal</th>
                        <th style="padding: var(--spacing-sm); text-align: center;">Aktionen</th>
                    </tr>
                </thead>
                <tbody>
                    ${songs.map(song => `
                        <tr style="border-bottom: 1px solid var(--color-border);">
                            <td style="padding: var(--spacing-sm);">${this.escapeHtml(song.title)}</td>
                            <td style="padding: var(--spacing-sm);">${this.escapeHtml(song.artist)}</td>
                            <td style="padding: var(--spacing-sm);">${song.bpm || '-'}</td>
                            <td style="padding: var(--spacing-sm);">${song.key || '-'}</td>
                            <td style="padding: var(--spacing-sm);">${song.leadVocal || '-'}</td>
                            <td style="padding: var(--spacing-sm); text-align: center;">
                                <button class="btn-icon edit-song" data-id="${song.id}" title="Bearbeiten">✏️</button>
                                <button class="btn-icon delete-song" data-id="${song.id}" title="Löschen">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Add event listeners
        container.querySelectorAll('.edit-song').forEach(btn => {
            btn.addEventListener('click', () => {
                this.openSongModal(null, bandId, btn.dataset.id);
            });
        });

        container.querySelectorAll('.delete-song').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Song wirklich löschen?')) {
                    Storage.deleteSong(btn.dataset.id);
                    UI.showToast('Song gelöscht', 'success');
                    this.renderBandSongs(bandId);
                }
            });
        });
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

        // Absence Button (visible for all users)
        const absenceBtn = document.getElementById('absenceBtn');
        if (absenceBtn) {
            absenceBtn.style.display = 'inline-block';
            const newAbsenceBtn = absenceBtn.cloneNode(true);
            absenceBtn.parentNode.replaceChild(newAbsenceBtn, absenceBtn);

            newAbsenceBtn.addEventListener('click', () => {
                this.openAbsenceModal();
            });
        }

        // Settings Button (visible to all now)
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.style.display = 'inline-block';
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
        const user = Auth.getCurrentUser();
        const isAdmin = Auth.isAdmin();

        // Show/Hide tabs based on role
        const locationsTab = document.getElementById('settingsTabLocations');
        const bandsTab = document.getElementById('settingsTabBands');

        if (locationsTab) locationsTab.style.display = isAdmin ? 'block' : 'none';
        if (bandsTab) bandsTab.style.display = isAdmin ? 'block' : 'none';

        // Pre-fill profile form
        document.getElementById('profileUsername').value = user.username;
        document.getElementById('profileEmail').value = user.email;
        document.getElementById('profileInstrument').value = user.instrument || '';
        document.getElementById('profilePassword').value = '';

        UI.openModal('settingsModal');

        // Default to profile tab for everyone initially
        this.switchSettingsTab('profile');

        if (isAdmin) {
            this.renderLocationsList();
            this.renderAllBandsList();
        }
    },

    // Render locations list
    renderLocationsList() {
        const container = document.getElementById('locationsList');
        const locations = Storage.getLocations();

        if (locations.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Probeorte vorhanden.</p>';
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
                if (confirm('Probeort wirklich löschen?')) {
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
            const isExpanded = this.expandedBandId === band.id;

            return `
                <div class="band-management-card accordion-card ${isExpanded ? 'expanded' : ''}" data-band-id="${band.id}">
                    <div class="accordion-header" data-band-id="${band.id}">
                        <div class="accordion-title">
                            <h4>${Bands.escapeHtml(band.name)}</h4>
                            <p class="band-meta">${members.length} Mitglieder • Code: <b><code>${band.joinCode}</code></b></p>
                        </div>
                        <div class="accordion-actions">
                            <button class="btn btn-danger btn-sm delete-band-admin" data-id="${band.id}">Löschen</button>
                            <button class="accordion-toggle" aria-label="Ausklappen">
                                <span class="toggle-icon">${isExpanded ? '▼' : '▶'}</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="accordion-content" style="display: ${isExpanded ? 'block' : 'none'};">
                        <div class="accordion-body">
                            <div class="band-details-expanded">
                                ${band.description ? `
                                    <div class="detail-row">
                                        <div class="detail-label">📝 Beschreibung:</div>
                                        <div class="detail-value">${Bands.escapeHtml(band.description)}</div>
                                    </div>
                                ` : ''}
                                
                                <div class="detail-row">
                                    <div class="detail-label">👥 Mitglieder (${members.length}):</div>
                                    <div class="detail-value">
                                        ${members.length > 0 ? members.map(member => {
                const user = Storage.getById('users', member.userId);
                if (!user) return '';

                const roleClass = `role-${member.role}`;
                const roleText = member.role === 'leader' ? 'Leiter' :
                    member.role === 'co-leader' ? 'Co-Leiter' : 'Mitglied';

                return `
                                                <div class="member-item">
                                                    <span class="member-name">${Bands.escapeHtml(user.name)}</span>
                                                    <span class="role-badge ${roleClass}">${roleText}</span>
                                                </div>
                                            `;
            }).join('') : '<p class="text-muted">Keine Mitglieder</p>'}
                                    </div>
                                </div>
                                
                                <div class="detail-row">
                                    <div class="detail-label">📅 Erstellt:</div>
                                    <div class="detail-value">${UI.formatDate(band.createdAt)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add accordion toggle handlers
        container.querySelectorAll('.band-management-card .accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // Don't toggle if clicking on delete button
                if (e.target.closest('.delete-band-admin')) {
                    return;
                }
                const bandId = header.dataset.bandId;
                this.toggleBandAccordion(bandId);
            });
        });

        // Add delete handlers
        container.querySelectorAll('.delete-band-admin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
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

    // Toggle band accordion in management view
    toggleBandAccordion(bandId) {
        const card = document.querySelector(`.band-management-card[data-band-id="${bandId}"]`);
        if (!card) return;

        const content = card.querySelector('.accordion-content');
        const toggle = card.querySelector('.toggle-icon');
        const wasExpanded = this.expandedBandId === bandId;

        // Close all accordions
        document.querySelectorAll('.band-management-card').forEach(c => {
            c.classList.remove('expanded');
            const cont = c.querySelector('.accordion-content');
            const tog = c.querySelector('.toggle-icon');
            if (cont) cont.style.display = 'none';
            if (tog) tog.textContent = '▶';
        });

        // If it was already expanded, just close it
        if (wasExpanded) {
            this.expandedBandId = null;
        } else {
            // Open this accordion
            card.classList.add('expanded');
            if (content) content.style.display = 'block';
            if (toggle) toggle.textContent = '▼';
            this.expandedBandId = bandId;
        }
    },

    // Handle profile update
    handleUpdateProfile() {
        const username = document.getElementById('profileUsername').value;
        const email = document.getElementById('profileEmail').value;
        const instrument = document.getElementById('profileInstrument').value;
        const password = document.getElementById('profilePassword').value;

        const user = Auth.getCurrentUser();
        if (!user) return;

        const updates = {
            username,
            email,
            instrument
        };

        if (password && password.trim() !== '') {
            updates.password = password;
        }

        Storage.updateUser(user.id, updates);

        // Update current session user data
        const updatedUser = Storage.getById('users', user.id);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));

        document.getElementById('currentUserName').textContent = updatedUser.name;
        UI.showToast('Profil erfolgreich aktualisiert', 'success');
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
            UI.showToast('Probeort erstellt', 'success');
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

        // Refresh band management list if admin
        if (Auth.isAdmin()) {
            this.renderAllBandsList();
        }
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
        const eventId = document.getElementById('rehearsalEvent').value;
        const dates = Rehearsals.getDatesFromForm();

        if (dates.length === 0) {
            UI.showToast('Bitte füge mindestens einen Terminvorschlag hinzu', 'error');
            return;
        }

        if (editId) {
            // Update existing
            const notifyMembers = document.getElementById('notifyMembersOnUpdate').checked;
            Rehearsals.updateRehearsal(editId, bandId, title, description, dates, locationId, eventId, notifyMembers);
        } else {
            // Create new
            Rehearsals.createRehearsal(bandId, title, description, dates, locationId, eventId);
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

        if (editId) {
            // Update existing
            Events.updateEvent(editId, bandId, title, date, location, info, techInfo, members, guests);
        } else {
            // Create new
            Events.createEvent(bandId, title, date, location, info, techInfo, members, guests);
        }
    },

    // Populate event select for rehearsal form
    populateEventSelect(bandId) {
        const select = document.getElementById('rehearsalEvent');
        if (!select) return;

        const events = Storage.getBandEvents(bandId);

        select.innerHTML = '<option value="">Kein Auftritt ausgewählt</option>' +
            events.map(event =>
                `<option value="${event.id}">${Bands.escapeHtml(event.title)} - ${UI.formatDateShort(event.date)}</option>`
            ).join('');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});