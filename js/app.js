// Main Application Controller

const App = {
    // Track deleted songs for potential rollback
    deletedEventSongs: [],
    
    async init() {
        // Initialize Supabase Auth first
        await Auth.init();
        
        // Apply saved theme on app start
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.classList.toggle('theme-dark', savedTheme === 'dark');
        }

        // Check authentication
        if (Auth.isAuthenticated()) {
            await this.showApp();
        } else {
            this.showAuth();
        }

        // Setup event listeners
        this.setupEventListeners();
        // init draft song list for new events
        this.draftEventSongIds = [];
        this.lastSongModalContext = null; // { eventId, bandId, origin }

        // Load calendar immediately if Tonstudio view is present
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('tonstudioView')) {
                if (typeof Calendar !== 'undefined' && Calendar.loadCalendar) {
                    Calendar.loadCalendar();
                }
            }
        });
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
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                try {
                    const view = item.dataset.view;
                    console.log(`[NAV CLICK] Clicked on nav item with view: "${view}"`);
                    this.navigateTo(view);
                } catch (error) {
                    console.error('[NAV CLICK] Error:', error);
                }
            });
        });
        console.log(`[INIT] Attached click handlers to ${document.querySelectorAll('.nav-item').length} nav items`);

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
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
        document.getElementById('deleteBandBtn').addEventListener('click', async () => {
            if (Bands.currentBandId) {
                await Bands.deleteBand(Bands.currentBandId);
            }
        });


        // Create rehearsal button
        document.getElementById('createRehearsalBtn').addEventListener('click', async () => {
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

            await Bands.populateBandSelects();
            await this.populateLocationSelect();

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
            rehearsalBandSelect.addEventListener('change', async (e) => {
                const bandId = e.target.value;
                if (bandId) {
                    await this.populateEventSelect(bandId);
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
            // Clear draft song selection and deleted songs for new event
            this.draftEventSongIds = [];
            this.deletedEventSongs = [];
            this.renderDraftEventSongs();
            UI.openModal('createEventModal');
        });

        // Create event form
        document.getElementById('createEventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateEvent();
        });

        // Event band change
        document.getElementById('eventBand').addEventListener('change', async (e) => {
            const bandId = e.target.value;
            if (bandId) {
                await Events.loadBandMembers(bandId, null); // null = pre-select all
            }
        });

        // Add event song button (create new song)
        const addEventSongBtn = document.getElementById('addEventSongBtn');
        if (addEventSongBtn) {
            addEventSongBtn.addEventListener('click', () => {
                const eventId = document.getElementById('editEventId').value;
                const bandId = document.getElementById('eventBand').value;
                // If editing existing event -> create song attached to event
                if (eventId) {
                    this.lastSongModalContext = { eventId, bandId: null, origin: 'event' };
                    this.openSongModal(eventId, null, null);
                    return;
                }

                // Creating new event -> require band selected, open song modal to create song for the band
                if (!bandId) {
                    UI.showToast('Bitte wähle zuerst eine Band aus', 'warning');
                    return;
                }
                this.lastSongModalContext = { eventId: null, bandId, origin: 'createEvent' };
                this.openSongModal(null, bandId, null);
            });
        }

        // Add existing event song button (pick from band's songs)
        const addExistingEventSongBtn = document.getElementById('addExistingEventSongBtn');
        if (addExistingEventSongBtn) {
            addExistingEventSongBtn.addEventListener('click', async () => {
                const eventId = document.getElementById('editEventId').value;
                const bandId = document.getElementById('eventBand').value;
                if (!bandId) {
                    UI.showToast('Bitte wähle zuerst eine Band aus', 'warning');
                    return;
                }

                const bandSongs = await Storage.getBandSongs(bandId);
                if (!Array.isArray(bandSongs) || bandSongs.length === 0) {
                    UI.showToast('Für diese Band sind noch keine Songs vorhanden', 'info');
                    return;
                }

                if (eventId) {
                    // Existing event: copy selected songs to event immediately
                    this.showBandSongSelector(eventId, bandSongs);
                } else {
                    // Draft mode: allow selecting songs and add to draft list
                    this.showBandSongSelectorForDraft(bandSongs);
                }
            });
        }

        // Event band filter
        document.getElementById('eventBandFilter').addEventListener('change', (e) => {
            Events.currentFilter = e.target.value;
            Events.renderEvents(e.target.value);
        });

        // Rehearsal band change - load events for selection
        document.getElementById('rehearsalBand').addEventListener('change', async (e) => {
            const bandId = e.target.value;
            if (bandId) {
                await this.populateEventSelect(bandId);
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
            btn.addEventListener('click', async () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    // If closing event modal, restore deleted songs
                    if (modal.id === 'createEventModal' && this.deletedEventSongs.length > 0) {
                        console.log('Restoring', this.deletedEventSongs.length, 'deleted songs');
                        for (const song of this.deletedEventSongs) {
                            await Storage.createSong(song);
                        }
                        this.deletedEventSongs = [];
                        UI.showToast('Änderungen verworfen', 'info');
                    }
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

        // Edit location form
        const editLocationForm = document.getElementById('editLocationForm');
        if (editLocationForm) {
            editLocationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditLocation();
            });
        }

        // Update profile form
        const updateProfileForm = document.getElementById('updateProfileForm');
        if (updateProfileForm) {
            updateProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleUpdateProfile();
            });
        }

        // Create absence form
        const createAbsenceForm = document.getElementById('createAbsenceForm');
        if (createAbsenceForm) {
            createAbsenceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateAbsence();
            });
        }

        // Add date validation for absence dates
        const absenceStartInput = document.getElementById('absenceStart');
        const absenceEndInput = document.getElementById('absenceEnd');
        if (absenceStartInput && absenceEndInput) {
            const validateDates = () => {
                if (absenceStartInput.value && absenceEndInput.value) {
                    const start = new Date(absenceStartInput.value);
                    const end = new Date(absenceEndInput.value);
                    if (start > end) {
                        absenceEndInput.setCustomValidity('Das "Bis"-Datum muss nach dem "Von"-Datum liegen');
                    } else {
                        absenceEndInput.setCustomValidity('');
                    }
                }
            };
            absenceStartInput.addEventListener('change', validateDates);
            absenceEndInput.addEventListener('change', validateDates);
        }

        // Cancel edit absence button
        const cancelEditBtn = document.getElementById('cancelEditAbsenceBtn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.cancelEditAbsence();
            });
        }

        // Create news button
        const createNewsBtn = document.getElementById('createNewsBtn');
        if (createNewsBtn) {
            createNewsBtn.addEventListener('click', () => {
                // Reset modal for new news
                const modalTitle = document.querySelector('#createNewsModal .modal-header h2');
                if (modalTitle) modalTitle.textContent = 'News erstellen';
                const submitBtn = document.querySelector('#createNewsModal .modal-actions .btn-primary');
                if (submitBtn) submitBtn.textContent = 'Veröffentlichen';
                const editInput = document.getElementById('editNewsId');
                if (editInput) editInput.value = '';
                const preview = document.getElementById('newsImagesPreview');
                if (preview) preview.innerHTML = '';
                const imagesInput = document.getElementById('newsImages');
                if (imagesInput) imagesInput.value = null;
                document.getElementById('newsTitle').value = '';
                document.getElementById('newsContent').value = '';

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

        // News images preview handler
        const newsImagesInput = document.getElementById('newsImages');
        const newsImagesPreview = document.getElementById('newsImagesPreview');
        if (newsImagesInput && newsImagesPreview) {
            newsImagesInput.addEventListener('change', () => {
                newsImagesPreview.innerHTML = '';
                const files = Array.from(newsImagesInput.files || []);
                files.slice(0, 6).forEach(file => {
                    if (!file.type.startsWith('image/')) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = document.createElement('img');
                        img.src = ev.target.result;
                        img.style.width = '80px';
                        img.style.height = '80px';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '6px';
                        newsImagesPreview.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                });
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

        // Calendar refresh button
        const refreshCalendarBtn = document.getElementById('refreshCalendarBtn');
        if (refreshCalendarBtn) {
            refreshCalendarBtn.addEventListener('click', () => {
                if (typeof Calendar !== 'undefined' && Calendar.loadCalendar) {
                    const activeTab = document.querySelector('.calendar-tab.active');
                    const activeCalendar = activeTab ? activeTab.dataset.calendar : 'tonstudio';
                    Calendar.loadCalendar(activeCalendar);
                }
            });
        }

        // Calendar tabs switching
        document.querySelectorAll('.calendar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const calendarType = tab.dataset.calendar;
                
                // Update active tab
                document.querySelectorAll('.calendar-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show/hide calendar containers
                document.querySelectorAll('.calendar-container').forEach(c => c.classList.remove('active'));
                const container = document.getElementById(`${calendarType}Calendar`);
                if (container) {
                    container.classList.add('active');
                }
                
                // Load calendar data
                if (typeof Calendar !== 'undefined' && Calendar.loadCalendar) {
                    Calendar.loadCalendar(calendarType);
                }
            });
        });

        // Musikpool refresh button
        const refreshMusikpoolBtn = document.getElementById('refreshMusikpoolBtn');
        if (refreshMusikpoolBtn) {
            refreshMusikpoolBtn.addEventListener('click', () => {
                if (typeof Musikpool !== 'undefined' && Musikpool.loadGroupData) {
                    Musikpool.loadGroupData();
                }
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
    async navigateTo(view) {
        console.log(`[navigateTo] Called with view: "${view}"`);
        
        const viewMap = {
            'dashboard': 'dashboardView',
            'bands': 'bandsView',
            'events': 'eventsView',
            'rehearsals': 'rehearsalsView',
            'statistics': 'statisticsView',
            'news': 'newsView',
            'probeorte': 'probeorteView',
            'tonstudio': 'probeorteView', // Redirect old tonstudio to probeorte
            'musikpool': 'musikpoolView'
        };

        const viewId = viewMap[view];
        console.log(`[navigateTo] Mapped to viewId: "${viewId}"`);
        
        if (viewId) {
            // Set nav active color per view for sticky bottom bar indicator
            const navActiveColorMap = {
                dashboard: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
                bands: '#10b981', // success green
                events: '#ec4899', // secondary pink
                rehearsals: '#6366f1', // primary
                statistics: '#2563eb', // blue
                news: '#f59e0b', // warning
                probeorte: '#9333ea', // purple
                musikpool: '#0ea5e9' // cyan
            };
            const navColor = navActiveColorMap[view] || getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
            document.documentElement.style.setProperty('--nav-active-color', navColor);

            UI.showView(viewId);

            // Update active navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                if (item.dataset.view === view || (view === 'tonstudio' && item.dataset.view === 'probeorte')) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            // Render specific views
            if (view === 'bands') {
                await Bands.renderBands();
            } else if (view === 'events') {
                await Events.renderEvents();
            } else if (view === 'rehearsals') {
                await Rehearsals.renderRehearsals();
            } else if (view === 'statistics') {
                await Rehearsals.populateStatisticsSelect();
            } else if (view === 'news') {
                await this.renderNewsView();

                // Show/hide create button based on admin or band leader/co-leader status
                const createNewsBtn = document.getElementById('createNewsBtn');
                if (createNewsBtn) {
                    const user = Auth.getCurrentUser();
                    let canCreate = Auth.isAdmin();
                    if (!canCreate && user) {
                        const userBands = Storage.getUserBands(user.id) || [];
                        canCreate = userBands.some(b => b.role === 'leader' || b.role === 'co-leader');
                    }
                    createNewsBtn.style.display = canCreate ? 'inline-flex' : 'none';
                }
            } else if (view === 'probeorte' || view === 'tonstudio') {
                // Ensure tonstudio tab and container are active first
                setTimeout(() => {
                    const tonstudioTab = document.querySelector('.calendar-tab[data-calendar="tonstudio"]');
                    const tonstudioContainer = document.getElementById('tonstudioCalendar');
                    
                    if (tonstudioTab) {
                        document.querySelectorAll('.calendar-tab').forEach(t => t.classList.remove('active'));
                        tonstudioTab.classList.add('active');
                    }
                    
                    if (tonstudioContainer) {
                        document.querySelectorAll('.calendar-container').forEach(c => c.classList.remove('active'));
                        tonstudioContainer.classList.add('active');
                    }
                    
                    // Load calendar when navigating to probeorte view
                    console.log('Navigating to probeorte, loading tonstudio calendar...');
                    if (typeof Calendar !== 'undefined' && Calendar.loadCalendar) {
                        console.log('Loading tonstudio calendar now...');
                        Calendar.loadCalendar('tonstudio');
                    } else {
                        console.error('Calendar object not found!');
                    }
                }, 50);
            } else if (view === 'musikpool') {
                // Load Musikpool members when navigating to view
                console.log('Navigating to musikpool, loading members...');
                if (typeof Musikpool !== 'undefined' && Musikpool.loadGroupData) {
                    Musikpool.loadGroupData();
                } else {
                    console.error('Musikpool object not found!');
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

        // Load users list when switching to users tab
        if (tabName === 'users' && Auth.isAdmin()) {
            this.renderUsersList();
        }
    },

    // Handle login
    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await Auth.login(username, password);
            UI.showToast('Erfolgreich angemeldet!', 'success');
            await this.showApp();
        } catch (error) {
            UI.showToast(error.message, 'error');
        }
    },

    // Handle registration
    async handleRegister() {
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
            UI.showLoading('Registriere Benutzer...');
            await Auth.register(registrationCode, name, email, username, password);
            // Supabase Auth automatically signs in after registration
            
            UI.hideLoading();
            UI.showToast('Registrierung erfolgreich!', 'success');
            UI.clearForm('registerForm');

            // Show app first (behind modal)
            await this.showApp();

            // Then show onboarding modal
            UI.openModal('onboardingModal');
        } catch (error) {
            UI.hideLoading();
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
    async renderNewsView() {
        console.log('[renderNewsView] Starting to render news...');
        const container = document.getElementById('newsContainer');
        const newsItems = await Storage.getAllNews();
        console.log('[renderNewsView] Fetched news items:', newsItems.length, newsItems);
        const isAdmin = Auth.isAdmin();
        const currentUser = Auth.getCurrentUser();

        if (newsItems.length === 0) {
            console.log('[renderNewsView] No news items found, showing empty state');
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📰</div>
                    <p>Noch keine News oder Updates vorhanden.</p>
                    <p>Hier wirst du auf dem laufenden gehalten.</p>
                </div>
            `;
            return;
        }

        console.log('[renderNewsView] Rendering', newsItems.length, 'news items');
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

            // allow editing for admins or the author
            let canEdit = false;
            if (currentUser) {
                canEdit = isAdmin || news.createdBy === currentUser.id;
            }

            const editBtn = canEdit ? `
                <button class="btn-icon edit-news" data-id="${news.id}" title="News bearbeiten">✏️</button>
            ` : '';

            // Render images if present
            let imagesHtml = '';
            if (news.images && Array.isArray(news.images) && news.images.length > 0) {
                const imgs = news.images.map(imgSrc => `
                    <div style="flex: 0 0 120px; max-width:120px;">
                        <img src="${imgSrc}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;" />
                    </div>
                `).join('');
                imagesHtml = `<div style="display:flex; gap:0.5rem; margin:0.75rem 0; flex-wrap:wrap;">${imgs}</div>`;
            }

            // mark unread for this user
            const isReadForUser = currentUser && Array.isArray(news.readBy) && news.readBy.includes(currentUser.id);

            return `
                <div class="news-card" data-id="${news.id}" style="background: var(--color-surface); padding: var(--spacing-xl); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); margin-bottom: var(--spacing-lg); border-left: 4px solid var(--color-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-md);">
                        <div style="flex: 1;">
                            <h3 style="margin-bottom: var(--spacing-xs); color: var(--color-text);">${this.escapeHtml(news.title)} ${!isReadForUser ? '<span style="color: #e11d48; font-size:0.75rem; margin-left:0.5rem;">NEU</span>' : ''}</h3>
                            <p style="font-size: 0.875rem; color: var(--color-text-light);">📅 ${date}</p>
                        </div>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            ${editBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                    ${imagesHtml}
                    <p style="color: var(--color-text-secondary); white-space: pre-wrap;">${this.escapeHtml(news.content)}</p>
                </div>
            `;
        }).join('');

        // Add delete handlers
        container.querySelectorAll('.delete-news').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteNews(btn.dataset.id);
            });
        });

        // Add edit handlers
        container.querySelectorAll('.edit-news').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.openEditNews(btn.dataset.id);
            });
        });

        // Mark news read on card click (when user explicitly clicks a news card)
        container.querySelectorAll('.news-card').forEach(card => {
            card.addEventListener('click', async (e) => {
                // Ignore clicks on interactive buttons (they stopPropagation above)
                const id = card.dataset.id;
                const user = Auth.getCurrentUser();
                if (user) {
                    await Storage.markNewsRead(id, user.id);
                    await this.updateNewsNavBadge();
                }
            });
        });
    },

    async handleCreateNews() {
        const title = document.getElementById('newsTitle').value;
        const content = document.getElementById('newsContent').value;
        const imagesInput = document.getElementById('newsImages');
        const editIdInput = document.getElementById('editNewsId');
        const user = Auth.getCurrentUser();

        if (!user || !Auth.isAdmin()) {
            UI.showToast('Keine Berechtigung', 'error');
            return;
        }

        // Read image files (convert to data URLs)
        const images = [];
        if (imagesInput && imagesInput.files && imagesInput.files.length > 0) {
            const files = Array.from(imagesInput.files).slice(0, 6); // limit to 6 images
            const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            try {
                const results = await Promise.all(files.map(f => readFileAsDataURL(f)));
                results.forEach(r => images.push(r));
            } catch (err) {
                console.error('Fehler beim Lesen der Bilddateien', err);
                UI.showToast('Fehler beim Verarbeiten der Bilder', 'error');
            }
        }

        // If edit mode -> update existing item, else create new
        const editId = editIdInput ? editIdInput.value : '';
        if (editId) {
            // fetch existing
            const existing = await Storage.getById('news', editId);
            if (!existing) {
                UI.showToast('News nicht gefunden', 'error');
                return;
            }

            // Only allow editor if admin or original author
            if (!(Auth.isAdmin() || existing.createdBy === user.id)) {
                UI.showToast('Keine Berechtigung zum Bearbeiten', 'error');
                return;
            }

            // If no new images selected, keep existing images
            let finalImages = existing.images || [];
            if (imagesInput && imagesInput.files && imagesInput.files.length > 0) {
                const files = Array.from(imagesInput.files).slice(0, 6);
                const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                try {
                    const results = await Promise.all(files.map(f => readFileAsDataURL(f)));
                    finalImages = results.slice();
                } catch (err) {
                    console.error('Fehler beim Lesen der Bilddateien', err);
                    UI.showToast('Fehler beim Verarbeiten der Bilder', 'error');
                }
            }

            await Storage.updateNewsItem(editId, {
                title,
                content,
                images: finalImages,
                updatedAt: new Date().toISOString(),
                updatedBy: user.id,
                // reset read state so others see it as new again
                readBy: [user.id]
            });
            UI.showToast('News aktualisiert!', 'success');
        } else {
            await Storage.createNewsItem(title, content, user.id, images);
            UI.showToast('News veröffentlicht!', 'success');
        }

        // Clear form and close modal
        document.getElementById('newsTitle').value = '';
        document.getElementById('newsContent').value = '';
        if (imagesInput) {
            imagesInput.value = null;
        }
        const preview = document.getElementById('newsImagesPreview');
        if (preview) preview.innerHTML = '';
        
        // reset edit id if any
        if (editIdInput) editIdInput.value = '';
        
        UI.closeModal('createNewsModal');

        // Navigate to news view (this will automatically call renderNewsView)
        await this.navigateTo('news');
        
        // Update badge
        await this.updateNewsNavBadge();
    },

    async deleteNews(newsId) {
        const confirmed = await UI.confirmDelete('Möchtest du diese News wirklich löschen?');
        if (confirmed) {
            await Storage.deleteNewsItem(newsId);
            UI.showToast('News gelöscht', 'success');
            await this.renderNewsView();
            await this.updateNewsNavBadge();
        }
    },

    // Open the create/edit news modal populated for editing
    async openEditNews(newsId) {
        const news = await Storage.getById('news', newsId);
        if (!news) {
            console.error('News not found:', newsId);
            UI.showToast('News nicht gefunden', 'error');
            return;
        }
        const user = Auth.getCurrentUser();
        if (!user) return;

        // Only allow editing if admin or author
        if (!(Auth.isAdmin() || news.createdBy === user.id)) {
            UI.showToast('Keine Berechtigung zum Bearbeiten', 'error');
            return;
        }

        console.log('Opening edit for news:', news);

        // Reset file input first
        const imagesInput = document.getElementById('newsImages');
        if (imagesInput) imagesInput.value = '';

        // Populate form
        const titleInput = document.getElementById('newsTitle');
        const contentInput = document.getElementById('newsContent');
        const editInput = document.getElementById('editNewsId');
        
        if (titleInput) titleInput.value = news.title || '';
        if (contentInput) contentInput.value = news.content || '';
        if (editInput) editInput.value = news.id;

        console.log('Populated fields - Title:', news.title, 'Content:', news.content);

        // Render previews from existing images
        const preview = document.getElementById('newsImagesPreview');
        if (preview) {
            preview.innerHTML = '';
            if (news.images && Array.isArray(news.images) && news.images.length > 0) {
                news.images.forEach(src => {
                    const img = document.createElement('img');
                    img.src = src;
                    img.style.width = '80px';
                    img.style.height = '80px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '6px';
                    preview.appendChild(img);
                });
            }
        }

        // Update modal title and button text
        const modalTitle = document.querySelector('#createNewsModal .modal-header h2');
        if (modalTitle) modalTitle.textContent = 'News bearbeiten';
        const submitBtn = document.querySelector('#createNewsModal .modal-actions .btn-primary');
        if (submitBtn) submitBtn.textContent = 'Speichern';

        UI.openModal('createNewsModal');
    },

    // Update the news nav item with an unread indicator for the current user
    async updateNewsNavBadge() {
        const user = Auth.getCurrentUser();
        const navLabel = document.querySelector('.nav-item[data-view="news"] .nav-label');
        if (!navLabel) return;
        const existing = document.getElementById('newsUnreadBadge');
        const count = user ? await Storage.getUnreadNewsCountForUser(user.id) : 0;
        if (count > 0) {
            if (!existing) {
                const span = document.createElement('span');
                span.id = 'newsUnreadBadge';
                span.textContent = ' •';
                span.style.color = '#e11d48';
                span.style.fontSize = '0.9rem';
                span.style.marginLeft = '6px';
                span.setAttribute('aria-hidden', 'true');
                navLabel.appendChild(span);
            }
        } else {
            if (existing) existing.remove();
        }
    },

    // Return array of conflicts for given band and dates (dates = array of ISO strings)
    async getAbsenceConflicts(bandId, dates) {
        if (!bandId || !dates || dates.length === 0) return [];
        const members = await Storage.getBandMembers(bandId);
        if (!Array.isArray(members)) return [];
        
        const conflicts = [];

        for (const m of members) {
            const user = await Storage.getById('users', m.userId);
            if (!user) continue;
            const badDates = [];
            for (const d of dates) {
                if (!d) continue;
                try {
                    if (await Storage.isUserAbsentOnDate(user.id, d)) {
                        // Format date nicely
                        badDates.push(UI.formatDateOnly(new Date(d).toISOString()));
                    }
                } catch (e) {
                    // ignore parse errors
                }
            }
            if (badDates.length > 0) {
                conflicts.push({ name: user.name, userId: user.id, dates: badDates });
            }
        }

        return conflicts;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Song Management
    async openSongModal(eventId = null, bandId = null, songId = null) {
        document.getElementById('songId').value = songId || '';
        document.getElementById('songEventId').value = eventId || '';
        document.getElementById('songBandId').value = bandId || '';

        if (songId) {
            // Edit existing song
            const song = await Storage.getById('songs', songId);
            if (song) {
                document.getElementById('songTitle').value = song.title;
                document.getElementById('songArtist').value = song.artist;
                document.getElementById('songBPM').value = song.bpm || '';
                document.getElementById('songKey').value = song.key || '';
                document.getElementById('songCcli').value = song.ccli || '';
                document.getElementById('songLeadVocal').value = song.leadVocal || '';
            }
        } else {
            // New song
            document.getElementById('songTitle').value = '';
            document.getElementById('songArtist').value = '';
            document.getElementById('songBPM').value = '';
            document.getElementById('songKey').value = '';
            document.getElementById('songCcli').value = '';
            document.getElementById('songLeadVocal').value = '';
        }

        UI.openModal('songModal');
    },

    async handleSaveSong() {
        const songId = document.getElementById('songId').value;
        const eventId = document.getElementById('songEventId').value;
        const bandId = document.getElementById('songBandId').value;
        const title = document.getElementById('songTitle').value;
        const artist = document.getElementById('songArtist').value;
        const bpm = document.getElementById('songBPM').value;
        const key = document.getElementById('songKey').value;
        const ccli = document.getElementById('songCcli').value;
        const leadVocal = document.getElementById('songLeadVocal').value;
        const user = Auth.getCurrentUser();

        const songData = {
            title,
            artist,
            bpm: bpm ? parseInt(bpm) : null,
            key: key || null,
            ccli: ccli || null,
            leadVocal: leadVocal || null,
            createdBy: user.id
        };

        // Only set one of eventId or bandId, not both
        if (eventId) {
            songData.eventId = eventId;
        } else if (bandId) {
            songData.bandId = bandId;
        }

        if (songId) {
            // Update existing song
            await Storage.updateSong(songId, songData);
            UI.showToast('Song aktualisiert', 'success');
        } else {
            // Create new song
            const created = await Storage.createSong(songData);
            
            // If song was created for an event, also add to band's general setlist
            if (created.eventId) {
                const event = await Storage.getEvent(created.eventId);
                if (event && event.bandId) {
                    // Create a band version of the song (without eventId)
                    await Storage.createSong({
                        title: created.title,
                        artist: created.artist,
                        bpm: created.bpm,
                        key: created.key,
                        ccli: created.ccli,
                        leadVocal: created.leadVocal,
                        bandId: event.bandId,
                        createdBy: user.id
                    });
                    UI.showToast('Song zu Auftritt und Band-Setlist hinzugefügt', 'success');
                    
                    // Update both event songs and band songs lists
                    await this.renderEventSongs(created.eventId);
                    await this.renderBandSongs(event.bandId);
                } else {
                    UI.showToast('Song hinzugefügt', 'success');
                }
            } else {
                UI.showToast('Song hinzugefügt', 'success');
            }

            // If this song was created from the create-event modal, add to draft list
            if (this.lastSongModalContext && this.lastSongModalContext.origin === 'createEvent') {
                if (!this.draftEventSongIds.includes(created.id)) {
                    this.draftEventSongIds.push(created.id);
                }
                this.renderDraftEventSongs();
            }
        }

        UI.closeModal('songModal');
        // reset last song modal context
        this.lastSongModalContext = null;

        // Refresh the appropriate list (if not already refreshed above)
        if (songId) {
            // For updates, refresh the current list
            if (eventId) {
                await this.renderEventSongs(eventId);
            } else if (bandId) {
                await this.renderBandSongs(bandId);
            }
        }
    },

    async renderEventSongs(eventId) {
        const container = document.getElementById('eventSongsList');
        if (!container) {
            console.warn('eventSongsList container not found');
            return;
        }

        const songs = await Storage.getEventSongs(eventId);
        console.log('renderEventSongs - eventId:', eventId, 'songs:', songs);

        // Get band ID from event to show band songs
        const event = await Storage.getById('events', eventId);
        const bandSongs = event && event.bandId ? await Storage.getBandSongs(event.bandId) : [];

        if ((!Array.isArray(songs) || songs.length === 0) && (!Array.isArray(bandSongs) || bandSongs.length === 0)) {
            container.innerHTML = '<p class="text-muted">Noch keine Songs hinzugefügt.</p>';
            return;
        }

        let html = '';

        // Show button to copy from band if there are band songs
        if (Array.isArray(bandSongs) && bandSongs.length > 0) {
            html += `
                <div style="margin-bottom: var(--spacing-md);">
                    <button type="button" id="copyBandSongsBtn" class="btn btn-secondary btn-sm">
                        📋 Songs aus Band-Pool übernehmen
                    </button>
                </div>
            `;
        }

        if (Array.isArray(songs) && songs.length > 0) {
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
                                    <button type="button" class="btn-icon edit-song" data-id="${song.id}" title="Bearbeiten">✏️</button>
                                    <button type="button" class="btn-icon delete-song" data-id="${song.id}" title="Löschen">🗑️</button>
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
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openSongModal(eventId, null, btn.dataset.id);
            });
        });

        container.querySelectorAll('.delete-song').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const confirmed = await UI.confirmDelete('Möchtest du diesen Song wirklich löschen?');
                if (confirmed) {
                    const songId = btn.dataset.id;
                    console.log('Deleting song:', songId, 'for event:', eventId);
                    
                    // Save song data before deleting for potential rollback
                    const song = await Storage.getById('songs', songId);
                    if (song) {
                        this.deletedEventSongs.push(song);
                    }
                    
                    await Storage.deleteSong(songId);
                    UI.showToast('Song gelöscht', 'success');
                    console.log('Re-rendering event songs only');
                    await this.renderEventSongs(eventId);
                    console.log('Finished re-rendering event songs');
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

    // Similar to showBandSongSelector but adds selected songs to the draft for a new event
    showBandSongSelectorForDraft(bandSongs) {
        const songList = bandSongs.map(song => `
            <label style="display: block; padding: var(--spacing-sm); border-bottom: 1px solid var(--color-border);">
                <input type="checkbox" value="${song.id}" class="band-song-checkbox-draft">
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
                <button type="button" id="cancelDraftSongs" class="btn">Abbrechen</button>
                <button type="button" id="confirmDraftSongs" class="btn btn-primary">Ausgewählte hinzufügen</button>
            </div>
        `;

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

        tempModal.querySelector('#cancelDraftSongs').addEventListener('click', () => {
            tempModal.remove();
        });

        tempModal.querySelector('#confirmDraftSongs').addEventListener('click', () => {
            const selectedIds = Array.from(tempModal.querySelectorAll('.band-song-checkbox-draft:checked')).map(cb => cb.value);
            // Merge into draft list (avoid duplicates)
            selectedIds.forEach(id => {
                if (!this.draftEventSongIds.includes(id)) this.draftEventSongIds.push(id);
            });
            this.renderDraftEventSongs();
            tempModal.remove();
        });

        tempModal.addEventListener('click', (e) => {
            if (e.target === tempModal) tempModal.remove();
        });
    },

    async copyBandSongsToEvent(eventId, songIds) {
        const user = Auth.getCurrentUser();
        let count = 0;

        for (const songId of songIds) {
            const bandSong = await Storage.getById('songs', songId);
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
                await Storage.createSong(eventSong);
                count++;
            }
        }

        UI.showToast(`${count} Song${count !== 1 ? 's' : ''} kopiert`, 'success');
        await this.renderEventSongs(eventId);
    },

    async renderBandSongs(bandId) {
        const container = document.getElementById('bandSongsList');
        if (!container) return;

        const songs = await Storage.getBandSongs(bandId);

        if (!Array.isArray(songs) || songs.length === 0) {
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
            btn.addEventListener('click', async () => {
                const confirmed = await UI.confirmDelete('Möchtest du diesen Song wirklich löschen?');
                if (confirmed) {
                    await Storage.deleteSong(btn.dataset.id);
                    UI.showToast('Song gelöscht', 'success');
                    await this.renderBandSongs(bandId);
                }
            });
        });
    },

    renderDraftEventSongs() {
        const container = document.getElementById('eventSongsList');
        if (!container) return;

        if (!this.draftEventSongIds || this.draftEventSongIds.length === 0) {
            container.innerHTML = '<p class="text-muted">Noch keine Songs für diesen Auftritt ausgewählt.</p>';
            return;
        }

        const items = this.draftEventSongIds.map((songId, idx) => {
            const s = Storage.getById('songs', songId);
            if (!s) return '';
            return `
                <div class="draft-song-item" data-id="${songId}" style="display:flex; justify-content:space-between; align-items:center; padding:0.25rem 0;">
                    <div>${idx + 1}. ${this.escapeHtml(s.title)} — ${this.escapeHtml(s.artist || '-')}</div>
                    <div>
                        <button class="btn btn-sm btn-secondary remove-draft-song" data-id="${songId}">Entfernen</button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = items;

        container.querySelectorAll('.remove-draft-song').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.draftEventSongIds = this.draftEventSongIds.filter(x => x !== id);
                this.renderDraftEventSongs();
            });
        });
    },

    // Show authentication screen
    showAuth() {
        document.getElementById('authModal').classList.add('active');
        document.getElementById('app').style.display = 'none';
    },

    // Show main application
    async showApp() {
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

            newAbsenceBtn.addEventListener('click', async () => {
                await this.openAbsenceModal();
            });
        }

        // Settings Button (visible to all now)
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.style.display = 'inline-block';
            const newBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);

            newBtn.addEventListener('click', async () => {
                await this.openSettingsModal();
            });
        }

        await this.updateDashboard();
        await this.updateNavigationVisibility();
        this.navigateTo('dashboard');
        // Ensure create news button visibility immediately after login (so admins/leaders see it without navigating)
        const createNewsBtnGlobal = document.getElementById('createNewsBtn');
        if (createNewsBtnGlobal) {
            const user = Auth.getCurrentUser();
            let canCreate = Auth.isAdmin();
            if (!canCreate && user) {
                const userBands = await Storage.getUserBands(user.id) || [];
                canCreate = userBands.some(b => b.role === 'leader' || b.role === 'co-leader');
            }
            createNewsBtnGlobal.style.display = canCreate ? 'inline-flex' : 'none';
        }
        // Update unread news badge
        await this.updateNewsNavBadge();

        // Load calendar right after login so it is ready without manual refresh
        if (document.getElementById('tonstudioView')) {
            if (typeof Calendar !== 'undefined' && Calendar.loadCalendar) {
                Calendar.loadCalendar();
            }
        }
    },

    // Update navigation visibility based on band membership
    async updateNavigationVisibility() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bands = await Storage.getUserBands(user.id);
        const hasBands = Array.isArray(bands) && bands.length > 0;

        // Hide/Show Events and Rehearsals nav items
        const eventsNav = document.querySelector('.nav-item[data-view="events"]');
        const rehearsalsNav = document.querySelector('.nav-item[data-view="rehearsals"]');

        if (eventsNav) eventsNav.style.display = hasBands ? 'flex' : 'none';
        if (rehearsalsNav) rehearsalsNav.style.display = hasBands ? 'flex' : 'none';
    },

    // Open absence modal and render current user's absences
    async openAbsenceModal() {
        // Render existing absences
        await this.renderUserAbsences();
        UI.openModal('absenceModal');
    },

    // Open settings modal
    async openSettingsModal() {
        const user = Auth.getCurrentUser();
        const isAdmin = Auth.isAdmin();

        // Show/Hide tabs based on role
        const locationsTab = document.getElementById('settingsTabLocations');
        const bandsTab = document.getElementById('settingsTabBands');
        const usersTab = document.getElementById('settingsTabUsers');

        if (locationsTab) locationsTab.style.display = isAdmin ? 'block' : 'none';
        if (bandsTab) bandsTab.style.display = isAdmin ? 'block' : 'none';
        if (usersTab) usersTab.style.display = isAdmin ? 'block' : 'none';

        // Pre-fill profile form
        document.getElementById('profileUsername').value = user.username;
        document.getElementById('profileEmail').value = user.email;
        document.getElementById('profileInstrument').value = user.instrument || '';
        document.getElementById('profilePassword').value = '';

        UI.openModal('settingsModal');

        // Default to profile tab for everyone initially
        this.switchSettingsTab('profile');

        // Theme toggle setup
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const savedTheme = localStorage.getItem('theme');
            const isDark = savedTheme === 'dark' || (savedTheme === null && document.documentElement.classList.contains('theme-dark'));
            themeToggle.checked = isDark;
            const applyTheme = (dark) => {
                document.documentElement.classList.toggle('theme-dark', dark);
                localStorage.setItem('theme', dark ? 'dark' : 'light');
            };
            // Ensure current theme reflects toggle
            applyTheme(isDark);
            // Bind change
            const newToggle = themeToggle.cloneNode(true);
            themeToggle.parentNode.replaceChild(newToggle, themeToggle);
            newToggle.addEventListener('change', (e) => applyTheme(e.target.checked));
        }

        if (isAdmin) {
            await this.renderLocationsList();
            await this.renderAllBandsList();
        }
    },

    // Render locations list
    async renderLocationsList() {
        const container = document.getElementById('locationsList');
        const locations = await Storage.getLocations();

        console.log('[renderLocationsList] Locations:', locations);

        if (locations.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Probeorte vorhanden.</p>';
            return;
        }

        container.innerHTML = locations.map(loc => {
            console.log('[renderLocationsList] Processing location:', loc);
            
            // Support new format (linkedCalendar string) and old formats
            let linkedCalendar = loc.linkedCalendar || '';
            
            // Migration from old linkedCalendars object
            if (!linkedCalendar && loc.linkedCalendars) {
                if (loc.linkedCalendars.tonstudio) linkedCalendar = 'tonstudio';
                else if (loc.linkedCalendars.festhalle) linkedCalendar = 'festhalle';
                else if (loc.linkedCalendars.ankersaal) linkedCalendar = 'ankersaal';
            } else if (!linkedCalendar && loc.linkedToCalendar) {
                linkedCalendar = 'tonstudio';
            }
            
            console.log('[renderLocationsList] linkedCalendar for', loc.name, ':', linkedCalendar);
            
            const calendarNames = {
                'tonstudio': '🎙️ Tonstudio',
                'festhalle': '🏛️ JMS Festhalle',
                'ankersaal': '⚓ Ankersaal'
            };
            
            const linkedBadge = linkedCalendar ? `<br><span style="color: var(--color-primary); font-size: 0.875rem;">🔗 ${calendarNames[linkedCalendar]}</span>` : '';
            
            console.log('[renderLocationsList] linkedBadge:', linkedBadge);
            
            return `
                <div class="location-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--color-border);">
                    <div>
                        <strong>${Bands.escapeHtml(loc.name)}</strong>
                        ${loc.address ? `<br><small>${Bands.escapeHtml(loc.address)}</small>` : ''}
                        ${linkedBadge}
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon edit-location" data-id="${loc.id}" title="Bearbeiten">✏️</button>
                        <button class="btn-icon delete-location" data-id="${loc.id}" title="Löschen">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        // Edit handlers
        container.querySelectorAll('.edit-location').forEach(btn => {
            btn.addEventListener('click', async () => {
                const locationId = btn.dataset.id;
                await this.openEditLocationModal(locationId);
            });
        });

        // Delete handlers
        container.querySelectorAll('.delete-location').forEach(btn => {
            btn.addEventListener('click', async () => {
                const confirmed = await UI.confirmDelete('Möchtest du diesen Probeort wirklich löschen?');
                if (confirmed) {
                    await Storage.deleteLocation(btn.dataset.id);
                    await this.renderLocationsList();
                    UI.showToast('Probeort gelöscht', 'success');
                }
            });
        });
    },

    // Render all bands list for management
    async renderAllBandsList() {
        const container = document.getElementById('allBandsList');
        const bands = await Storage.getAllBands();

        if (bands.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Bands vorhanden.</p>';
            return;
        }

        container.innerHTML = await Promise.all(bands.map(async band => {
            const members = await Storage.getBandMembers(band.id);
            const isExpanded = this.expandedBandId === band.id;

            return `
                <div class="band-management-card accordion-card ${isExpanded ? 'expanded' : ''}" data-band-id="${band.id}">
                    <div class="accordion-header" data-band-id="${band.id}">
                        <div class="accordion-title">
                            <h4>${Bands.escapeHtml(band.name)}</h4>
                            <p class="band-meta">${members.length} Mitglieder • Code: <b><code id="joinCode_${band.id}">${band.joinCode}</code></b></p>
                        </div>
                        <div class="accordion-actions">
                            <button class="btn btn-secondary btn-sm copy-code-btn" data-code="${band.joinCode}" data-id="${band.id}">📋 Code kopieren</button>
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
                                        ${members.length > 0 ? (await Promise.all(members.map(async member => {
                const user = await Storage.getById('users', member.userId);
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
            }))).join('') : '<p class="text-muted">Keine Mitglieder</p>'}
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
        })).then(results => results.join(''));

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
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const bandId = btn.dataset.id;
                const band = await Storage.getBand(bandId);
                const confirmed = await UI.confirmDelete(`Möchtest du die Band "${band.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`);
                if (confirmed) {
                    await Storage.deleteBand(bandId);
                    await this.renderAllBandsList();
                    UI.showToast('Band gelöscht', 'success');
                }
            });
        });

        // Add copy code handlers
        container.querySelectorAll('.copy-code-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = btn.dataset.code;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code).then(() => {
                        UI.showToast('Beitrittscode in die Zwischenablage kopiert', 'success');
                    }).catch(() => {
                        UI.showToast('Konnte Code nicht kopieren', 'error');
                    });
                } else {
                    // Fallback: select the code element text
                    const codeEl = document.getElementById(`joinCode_${btn.dataset.id}`);
                    if (codeEl) {
                        const range = document.createRange();
                        range.selectNodeContents(codeEl);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                        try {
                            document.execCommand('copy');
                            UI.showToast('Beitrittscode in die Zwischenablage kopiert', 'success');
                        } catch (err) {
                            UI.showToast('Konnte Code nicht kopieren', 'error');
                        }
                        sel.removeAllRanges();
                    }
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

    // Render users list (Admin only)
    async renderUsersList() {
        if (!Auth.isAdmin()) return;

        const container = document.getElementById('usersList');
        const users = await Storage.getAll('users');

        if (!users || users.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Benutzer vorhanden.</p>';
            return;
        }

        // Sort users: admins first, then by name
        users.sort((a, b) => {
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            return (a.name || a.username).localeCompare(b.name || b.username);
        });

        container.innerHTML = await Promise.all(users.map(async user => {
            // Get user's bands
            const userBands = await Storage.getUserBands(user.id);
            const bandDetails = (await Promise.all(
                userBands.map(async ub => {
                    const band = await Storage.getBand(ub.bandId);
                    if (!band) return null; // Band existiert nicht mehr
                    return { 
                        name: band.name, 
                        role: ub.role,
                        color: band.color || '#6366f1'
                    };
                })
            )).filter(bd => bd !== null); // Filtere gelöschte Bands heraus

            const isCurrentUser = Auth.getCurrentUser().id === user.id;

            return `
                <div class="user-management-card">
                    <div class="user-card-header">
                        <div class="user-card-info">
                            <h4>
                                ${Bands.escapeHtml(user.name || user.username)}
                                ${user.isAdmin ? '<span class="admin-badge">👑 ADMIN</span>' : ''}
                            </h4>
                            <div class="user-meta">
                                <span>👤 @${Bands.escapeHtml(user.username)}</span>
                                <span>📧 ${Bands.escapeHtml(user.email)}</span>
                                ${user.instrument ? `<span>🎵 ${Bands.getInstrumentName(user.instrument)}</span>` : ''}
                            </div>
                        </div>
                        <div class="user-card-actions">
                            ${!user.isAdmin ? `
                                <button class="btn btn-sm btn-primary make-admin-btn" data-user-id="${user.id}" title="Zum Admin machen">
                                    👑 Admin machen
                                </button>
                            ` : (isCurrentUser ? '' : `
                                <button class="btn btn-sm btn-secondary remove-admin-btn" data-user-id="${user.id}" title="Admin entfernen">
                                    Admin entfernen
                                </button>
                            `)}
                            ${!isCurrentUser ? `
                                <button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${user.id}" title="Benutzer löschen">
                                    🗑️ Löschen
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    ${bandDetails.length > 0 ? `
                        <div class="user-bands-list">
                            <h5>Bands (${bandDetails.length})</h5>
                            <div class="user-band-tags">
                                ${bandDetails.map(bd => `
                                    <span class="user-band-tag" style="border-left: 3px solid ${bd.color}">
                                        ${Bands.escapeHtml(bd.name)}
                                        <span class="role-badge role-${bd.role}">${UI.getRoleDisplayName(bd.role)}</span>
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : '<p class="text-muted" style="margin-top: var(--spacing-sm); font-size: 0.875rem;">Nicht in einer Band</p>'}
                </div>
            `;
        })).then(results => results.join(''));

        // Add event listeners
        container.querySelectorAll('.make-admin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const userId = btn.dataset.userId;
                    const user = await Storage.getById('users', userId);
                    if (!user) {
                        UI.showToast('Benutzer nicht gefunden', 'error');
                        return;
                    }
                    
                    const confirmed = await UI.confirmAction(
                        `Möchtest du ${user.name || user.username} wirklich zum Admin machen? Als Admin hat dieser Benutzer vollen Zugriff auf alle Funktionen.`,
                        'Admin-Rechte erteilen?',
                        'Zum Admin machen',
                        'btn-primary'
                    );
                    
                    if (confirmed) {
                        await this.toggleUserAdmin(userId, true);
                    }
                } catch (error) {
                    console.error('Error in make-admin-btn handler:', error);
                    UI.showToast('Fehler: ' + error.message, 'error');
                }
            });
        });

        container.querySelectorAll('.remove-admin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const userId = btn.dataset.userId;
                    const user = await Storage.getById('users', userId);
                    if (!user) {
                        UI.showToast('Benutzer nicht gefunden', 'error');
                        return;
                    }
                    
                    const confirmed = await UI.confirmAction(
                        `Möchtest du die Admin-Rechte von ${user.name || user.username} wirklich entfernen?`,
                        'Admin-Rechte entfernen?',
                        'Admin entfernen',
                        'btn-secondary'
                    );
                    
                    if (confirmed) {
                        await this.toggleUserAdmin(userId, false);
                    }
                } catch (error) {
                    console.error('Error in remove-admin-btn handler:', error);
                    UI.showToast('Fehler: ' + error.message, 'error');
                }
            });
        });

        container.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const userId = btn.dataset.userId;
                    console.log('Delete user button clicked for:', userId);
                    
                    const user = await Storage.getById('users', userId);
                    console.log('User found:', user);
                    
                    if (!user) {
                        UI.showToast('Benutzer nicht gefunden', 'error');
                        return;
                    }
                    
                    const confirmed = await UI.confirmDelete(`Möchtest du den Benutzer ${user.name || user.username} wirklich löschen? Dies kann nicht rückgängig gemacht werden!`);
                    console.log('User confirmed deletion:', confirmed);
                    
                    if (confirmed) {
                        await this.deleteUser(userId);
                    }
                } catch (error) {
                    console.error('Error in delete-user-btn handler:', error);
                    UI.showToast('Fehler beim Löschen: ' + error.message, 'error');
                }
            });
        });
    },

    // Toggle user admin status
    async toggleUserAdmin(userId, makeAdmin) {
        try {
            console.log('Toggling admin status:', { userId, makeAdmin });
            
            const sb = SupabaseClient.getClient();
            if (!sb) {
                throw new Error('Supabase Client nicht verfügbar');
            }
            
            // First verify the user exists
            const { data: existingUser, error: fetchError } = await sb
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            
            if (fetchError) {
                console.error('Error fetching user:', fetchError);
                throw new Error('Benutzer konnte nicht gefunden werden');
            }
            
            if (!existingUser) {
                throw new Error('Benutzer existiert nicht');
            }
            
            console.log('Current user state:', existingUser);
            
            // Update admin status without expecting a return value
            const { error: updateError } = await sb
                .from('users')
                .update({ isAdmin: makeAdmin })
                .eq('id', userId);
            
            if (updateError) {
                console.error('Supabase error toggling admin:', updateError);
                throw new Error(updateError.message || 'Fehler beim Aktualisieren');
            }
            
            console.log('Admin status updated successfully');
            UI.showToast(makeAdmin ? 'Benutzer ist jetzt Admin' : 'Admin-Rechte entfernt', 'success');
            await this.renderUsersList();
        } catch (error) {
            console.error('Error toggling admin:', error);
            UI.showToast('Fehler beim Ändern der Admin-Rechte: ' + error.message, 'error');
        }
    },

    // Delete user
    async deleteUser(userId) {
        try {
            console.log('Deleting user:', userId);
            UI.showLoading('Lösche Benutzer...');
            
            // Remove user from all bands
            const userBands = await Storage.getUserBands(userId);
            console.log('User bands:', userBands);
            for (const ub of userBands) {
                await Storage.removeBandMember(ub.bandId, userId);
            }
            
            // Delete all user's votes
            const sb = SupabaseClient.getClient();
            if (sb) {
                const { error } = await sb.from('votes').delete().eq('userId', userId);
                if (error) {
                    console.error('Error deleting votes:', error);
                }
            }
            
            // Delete user
            const deleted = await Storage.delete('users', userId);
            if (!deleted) {
                throw new Error('Benutzer konnte nicht gelöscht werden (RLS/Policy?)');
            }
            
            console.log('User deleted successfully');
            UI.hideLoading();
            UI.showToast('Benutzer gelöscht', 'success');
            await this.renderUsersList();
        } catch (error) {
            UI.hideLoading();
            console.error('Error deleting user:', error);
            UI.showToast('Fehler beim Löschen des Benutzers: ' + error.message, 'error');
        }
    },

    // Handle profile update
    async handleUpdateProfile() {
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

        await Storage.updateUser(user.id, updates);

        // Update current session user data
        await Auth.updateCurrentUser();
        const updatedUser = Auth.getCurrentUser();

        // Update header
        document.getElementById('currentUserName').textContent = updatedUser.name;
        
        // Clear password field after successful update
        document.getElementById('profilePassword').value = '';
        
        // Reload profile form with updated values
        document.getElementById('profileUsername').value = updatedUser.username;
        document.getElementById('profileEmail').value = updatedUser.email;
        document.getElementById('profileInstrument').value = updatedUser.instrument || '';
        
        UI.showToast('Profil erfolgreich aktualisiert', 'success');
        UI.closeModal('settingsModal');
    },

    // Handle create location
    async handleCreateLocation() {
        const nameInput = document.getElementById('newLocationName');
        const addressInput = document.getElementById('newLocationAddress');
        const linkedCalendarSelect = document.getElementById('newLocationLinkedCalendar');

        const name = nameInput.value;
        const address = addressInput.value;
        const linkedCalendar = linkedCalendarSelect.value; // '' | 'tonstudio' | 'festhalle' | 'ankersaal'

        if (name) {
            await Storage.createLocation({ name, address, linkedCalendar });
            nameInput.value = '';
            addressInput.value = '';
            linkedCalendarSelect.value = '';
            await this.renderLocationsList();
            UI.showToast('Probeort erstellt', 'success');
        }
    },

    // Open edit location modal
    async openEditLocationModal(locationId) {
        const location = await Storage.getLocation(locationId);
        if (!location) return;

        document.getElementById('editLocationId').value = location.id;
        document.getElementById('editLocationName').value = location.name;
        document.getElementById('editLocationAddress').value = location.address || '';
        
        // Support both old formats (linkedToCalendar, linkedCalendars) and new (linkedCalendar)
        let linkedCalendar = location.linkedCalendar || '';
        
        // Migration from old format
        if (!linkedCalendar && location.linkedCalendars) {
            if (location.linkedCalendars.tonstudio) linkedCalendar = 'tonstudio';
            else if (location.linkedCalendars.festhalle) linkedCalendar = 'festhalle';
            else if (location.linkedCalendars.ankersaal) linkedCalendar = 'ankersaal';
        } else if (!linkedCalendar && location.linkedToCalendar) {
            linkedCalendar = 'tonstudio'; // Old single calendar was always tonstudio
        }
        
        document.getElementById('editLocationLinkedCalendar').value = linkedCalendar;

        UI.openModal('editLocationModal');
    },

    // Handle edit location
    async handleEditLocation() {
        const locationId = document.getElementById('editLocationId').value;
        const name = document.getElementById('editLocationName').value;
        const address = document.getElementById('editLocationAddress').value;
        const linkedCalendar = document.getElementById('editLocationLinkedCalendar').value;

        if (name) {
            await Storage.updateLocation(locationId, { name, address, linkedCalendar });
            UI.closeModal('editLocationModal');
            await this.renderLocationsList();
            UI.showToast('Probeort aktualisiert', 'success');
        }
    },

    // Check if location is available (for calendar-linked locations)
    async checkLocationAvailability(locationId, startDate, endDate) {
        const location = await Storage.getLocation(locationId);
        
        // Support new format (linkedCalendar string) and old formats
        let linkedCalendar = location.linkedCalendar || '';
        
        // Migration from old formats
        if (!linkedCalendar && location.linkedCalendars) {
            if (location.linkedCalendars.tonstudio) linkedCalendar = 'tonstudio';
            else if (location.linkedCalendars.festhalle) linkedCalendar = 'festhalle';
            else if (location.linkedCalendars.ankersaal) linkedCalendar = 'ankersaal';
        } else if (!linkedCalendar && location.linkedToCalendar) {
            linkedCalendar = 'tonstudio';
        }
        
        if (!location || !linkedCalendar) {
            // Location not linked to any calendar, always available
            return { available: true };
        }

        // Check calendar for conflicts
        if (typeof Calendar === 'undefined' || !Calendar.calendars) {
            console.warn('Calendar not loaded, skipping availability check');
            return { available: true };
        }

        const startTime = new Date(startDate);
        const endTime = new Date(endDate);
        
        // Check the linked calendar
        const calendar = Calendar.calendars[linkedCalendar];
        if (!calendar || !calendar.events || calendar.events.length === 0) {
            return { available: true };
        }
        
        // Find overlapping events
        const conflicts = calendar.events.filter(event => {
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);

            // Check if times overlap
            return (startTime < eventEnd && endTime > eventStart);
        });
        
        if (conflicts.length > 0) {
            return {
                available: false,
                conflicts: conflicts.map(e => ({
                    summary: e.summary,
                    startDate: e.startDate,
                    endDate: e.endDate,
                    calendar: linkedCalendar
                }))
            };
        }

        return { available: true };
    },

    // Populate location select
    async populateLocationSelect() {
        const select = document.getElementById('rehearsalLocation');
        if (!select) return;

        const locations = (await Storage.getLocations()) || [];

        select.innerHTML = '<option value="">Kein Ort ausgewählt</option>' +
            locations.map(loc =>
                `<option value="${loc.id}">${Bands.escapeHtml(loc.name)}</option>`
            ).join('');
    },

    // Navigate to view
    async navigateTo(viewName) {
        UI.showView(`${viewName}View`);

        switch (viewName) {
            case 'dashboard':
                await this.updateDashboard();
                break;
            case 'bands':
                await Bands.renderBands();
                break;
            case 'events':
                await Events.populateBandSelect();
                await Events.renderEvents();
                break;
            case 'rehearsals':
                await Bands.populateBandSelects();
                await this.populateLocationSelect();
                await Rehearsals.renderRehearsals();
                break;
            case 'statistics':
                await Rehearsals.populateStatsSelect();
                await Rehearsals.populateStatsBandSelect();
                // Wire up band select change to render band stats
                const statsBandSelect = document.getElementById('statsBandSelect');
                if (statsBandSelect) {
                    statsBandSelect.addEventListener('change', async (e) => {
                        const bandId = e.target.value;
                        if (bandId) {
                            await Statistics.renderBandStatistics(bandId);
                        } else {
                            // Clear or show rehearsal selection
                            document.getElementById('statisticsContent').innerHTML = '';
                        }
                    });
                }
                break;
        }
    },

    // Update dashboard
    async updateDashboard() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bands = await Storage.getUserBands(user.id);
        document.getElementById('bandCount').textContent = bands.length;

        const rehearsals = (await Storage.getUserRehearsals(user.id)) || [];
        const pendingRehearsals = rehearsals.filter(r => r.status === 'pending');

        let pendingVotesCount = 0;
        for (const rehearsal of pendingRehearsals) {
            for (let index = 0; index < rehearsal.proposedDates.length; index++) {
                const vote = await Storage.getUserVoteForDate(user.id, rehearsal.id, index);
                if (!vote) {
                    pendingVotesCount++;
                }
            }
        }

        document.getElementById('pendingVotes').textContent = pendingVotesCount;

        const confirmedRehearsals = rehearsals.filter(r => r.status === 'confirmed');
        document.getElementById('confirmedRehearsals').textContent = confirmedRehearsals.length;

        await this.renderUpcomingList();
    },

    // Render upcoming events and rehearsals sorted by date
    async renderUpcomingList() {
        const container = document.getElementById('upcomingList');
        const user = Auth.getCurrentUser();
        if (!container || !user) return;

        const now = new Date();
        const events = (await Storage.getUserEvents(user.id)) || [];
        const rehearsals = (await Storage.getUserRehearsals(user.id)) || [];

        const upcomingEvents = events
            .filter(e => new Date(e.date) >= now)
            .map(e => ({
                type: 'event',
                date: new Date(e.date).toISOString(),
                title: e.title,
                bandId: e.bandId,
                location: e.location || null,
                id: e.id
            }));

        const upcomingRehearsals = rehearsals
            .filter(r => r.status === 'confirmed' && r.confirmedDateIndex !== undefined)
            .map(r => {
                const iso = r.proposedDates[r.confirmedDateIndex];
                return {
                    type: 'rehearsal',
                    date: iso,
                    title: r.title,
                    bandId: r.bandId,
                    locationId: r.locationId || null,
                    id: r.id
                };
            })
            .filter(item => new Date(item.date) >= now);

        const combined = [...upcomingEvents, ...upcomingRehearsals]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 5);

        if (combined.length === 0) {
            UI.showEmptyState(container, '📅', 'Keine anstehenden Termine');
            return;
        }

        const rows = await Promise.all(combined.map(async item => {
            const band = await Storage.getBand(item.bandId);
            const bandName = band?.name || 'Band';
            const dateText = UI.formatDateShort(item.date);
            const typeIcon = item.type === 'event' ? '🎤' : '📅';

            let locationText = '-';
            if (item.type === 'event') {
                locationText = item.location ? Bands.escapeHtml(item.location) : '-';
            } else if (item.type === 'rehearsal' && item.locationId) {
                const loc = await Storage.getLocation(item.locationId);
                locationText = loc ? Bands.escapeHtml(loc.name) : '-';
            }

            return `
                <div class="date-option">
                    <div class="date-info">
                        <div class="date-time">${typeIcon} ${UI.formatDate(item.date)}</div>
                        <div class="vote-summary">
                            <span class="vote-count">🎸 ${Bands.escapeHtml(bandName)}</span>
                            <span class="vote-count">📍 ${locationText}</span>
                        </div>
                    </div>
                    <div class="vote-actions">
                        ${item.type === 'event' ? `<button class="btn btn-secondary" onclick="App.navigateTo('events')">Öffnen</button>` : `<button class="btn btn-secondary" onclick="App.navigateTo('rehearsals')">Öffnen</button>`}
                    </div>
                </div>
            `;
        }));

        container.innerHTML = rows.join('');
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
    async handleCreateRehearsal() {
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

        const proceed = () => {
            if (editId) {
                // Update existing
                const notifyMembers = document.getElementById('notifyMembersOnUpdate').checked;
                Rehearsals.updateRehearsal(editId, bandId, title, description, dates, locationId, eventId, notifyMembers);
            } else {
                // Create new
                Rehearsals.createRehearsal(bandId, title, description, dates, locationId, eventId);
            }
        };

        // Check for absence conflicts
        const conflicts = await this.getAbsenceConflicts(bandId, dates);
        if (conflicts && conflicts.length > 0) {
            // Build message
            const lines = conflicts.map(c => `${c.name}: ${c.dates.join(', ')}`);
            const msg = `Achtung — Folgende Mitglieder haben für die ausgewählten Termine Abwesenheiten eingetragen:\n\n${lines.join('\n')}\n\nTrotzdem fortfahren?`;
            UI.showConfirm(msg, () => {
                proceed();
            });
        } else {
            proceed();
        }
    },

    // Handle create event
    async handleCreateEvent() {
        const editId = document.getElementById('editEventId').value;
        const bandId = document.getElementById('eventBand').value;
        const title = document.getElementById('eventTitle').value;
        const date = new Date(document.getElementById('eventDate').value).toISOString();
        const soundcheckInput = document.getElementById('eventSoundcheckDate').value;
        const soundcheckDate = soundcheckInput ? new Date(soundcheckInput).toISOString() : null;
        const soundcheckLocation = document.getElementById('eventSoundcheckLocation').value || null;
        const location = document.getElementById('eventLocation').value;
        const info = document.getElementById('eventInfo').value;
        const techInfo = document.getElementById('eventTechInfo').value;
        const members = Events.getSelectedMembers();
        const guests = Events.getGuests();

        const proceed = () => {
            // Clear deleted songs list - changes are being saved
            this.deletedEventSongs = [];
            
            if (editId) {
                // Update existing
                Events.updateEvent(editId, bandId, title, date, location, info, techInfo, members, guests, soundcheckDate, soundcheckLocation);
                // If there are draft songs, copy them to the existing event
                if (this.draftEventSongIds && this.draftEventSongIds.length > 0) {
                    this.copyBandSongsToEvent(editId, this.draftEventSongIds);
                    this.draftEventSongIds = [];
                }
            } else {
                // Create new
                const saved = Events.createEvent(bandId, title, date, location, info, techInfo, members, guests, soundcheckDate, soundcheckLocation);
                if (saved && saved.id && this.draftEventSongIds && this.draftEventSongIds.length > 0) {
                    this.copyBandSongsToEvent(saved.id, this.draftEventSongIds);
                    this.draftEventSongIds = [];
                }
            }
        };

        // Build list of dates to check (event date and optional soundcheck)
        const datesToCheck = [date];
        if (soundcheckDate) datesToCheck.push(soundcheckDate);

        const conflicts = await this.getAbsenceConflicts(bandId, datesToCheck);
        if (conflicts && conflicts.length > 0) {
            const lines = conflicts.map(c => `${c.name}: ${c.dates.join(', ')}`);
            const msg = `Achtung — Folgende Mitglieder sind an den gewählten Terminen abwesend:<br><b>\n\n${lines.join('\n')}\n\n </b><br>Trotzdem fortfahren?`;
            UI.showConfirm(msg, () => {
                proceed();
            });
        } else {
            proceed();
        }
    },

    // Handle create absence
    async handleCreateAbsence() {
        const start = document.getElementById('absenceStart').value;
        const end = document.getElementById('absenceEnd').value;
        const reason = document.getElementById('absenceReason').value || '';
        const editIdEl = document.getElementById('editAbsenceId');
        const editId = editIdEl ? editIdEl.value : '';

        const user = Auth.getCurrentUser();
        if (!user) return;

        if (!start || !end) {
            UI.showToast('Bitte Anfangs- und Enddatum angeben', 'error');
            return;
        }

        // Validate that start date is not after end date
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (startDate > endDate) {
            UI.showToast('Das "Von"-Datum darf nicht nach dem "Bis"-Datum liegen', 'error');
            return;
        }

        // Ensure ISO strings
        const startIso = startDate.toISOString();
        const endIso = endDate.toISOString();

        if (editId && editId.trim() !== '') {
            // update existing absence
            await Storage.update('absences', editId, { startDate: startIso, endDate: endIso, reason });
            UI.showToast('Abwesenheit aktualisiert', 'success');
        } else {
            await Storage.createAbsence(user.id, startIso, endIso, reason);
            UI.showToast('Abwesenheit eingetragen', 'success');
        }

        // Clear form
        document.getElementById('absenceStart').value = '';
        document.getElementById('absenceEnd').value = '';
        document.getElementById('absenceReason').value = '';
        if (editIdEl) {
            editIdEl.value = '';
        }
        // reset save button / cancel
        const saveBtn = document.getElementById('saveAbsenceBtn');
        const cancelBtn = document.getElementById('cancelEditAbsenceBtn');
        if (saveBtn) saveBtn.textContent = 'Abwesenheit hinzufügen';
        if (cancelBtn) cancelBtn.style.display = 'none';

        // Re-render lists
        await this.renderUserAbsences();
        // If band details modal open and has absences tab, re-render band absences
        if (typeof Bands !== 'undefined' && Bands.currentBandId) {
            Bands.renderBandAbsences(Bands.currentBandId);
        }
    },

    // Render the current user's absences into the Absence modal
    async renderUserAbsences() {
        const container = document.getElementById('absencesList');
        const user = Auth.getCurrentUser();
        if (!container || !user) return;

        const absences = await Storage.getUserAbsences(user.id);
        if (!absences || absences.length === 0) {
            container.innerHTML = '<p class="text-muted">Du hast keine eingetragenen Abwesenheiten.</p>';
            return;
        }

        // sort by start date desc
        absences.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        container.innerHTML = absences.map(a => `
            <div class="absence-item" data-id="${a.id}" style="padding:8px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div>
                    <div><strong>${UI.formatDateOnly(a.startDate)} — ${UI.formatDateOnly(a.endDate)}</strong></div>
                    ${a.reason ? `<div class="help-text">${Bands.escapeHtml(a.reason)}</div>` : ''}
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-secondary btn-sm edit-absence" data-id="${a.id}">✏️ Bearbeiten</button>
                    <button class="btn btn-danger btn-sm delete-absence" data-id="${a.id}">🗑️ Löschen</button>
                </div>
            </div>
        `).join('');

        // Wire up edit/delete handlers
        container.querySelectorAll('.edit-absence').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.startEditAbsence(id);
            });
        });

        container.querySelectorAll('.delete-absence').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const confirmed = await UI.confirmDelete('Möchtest du diese Abwesenheit wirklich löschen?');
                if (confirmed) {
                    await Storage.deleteAbsence(id);
                    UI.showToast('Abwesenheit gelöscht', 'success');
                    await this.renderUserAbsences();
                    if (typeof Bands !== 'undefined' && Bands.currentBandId) {
                        Bands.renderBandAbsences(Bands.currentBandId);
                    }
                }
            });
        });
    },

    // Start editing an absence: populate form and switch to edit-mode
    async startEditAbsence(absenceId) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const absences = await Storage.getUserAbsences(user.id) || [];
        const a = Array.isArray(absences) ? absences.find(x => x.id === absenceId) : null;
        if (!a) return;

        // populate form
        document.getElementById('absenceStart').value = a.startDate.slice(0, 10);
        document.getElementById('absenceEnd').value = a.endDate.slice(0, 10);
        document.getElementById('absenceReason').value = a.reason || '';
        document.getElementById('editAbsenceId').value = a.id;

        // change submit button text and show cancel
        const saveBtn = document.getElementById('saveAbsenceBtn');
        const cancelBtn = document.getElementById('cancelEditAbsenceBtn');
        if (saveBtn) saveBtn.textContent = 'Speichern';
        if (cancelBtn) cancelBtn.style.display = '';

        // ensure modal open
        UI.openModal('absenceModal');
    },

    // Cancel editing absence
    cancelEditAbsence() {
        // reset form
        document.getElementById('absenceStart').value = '';
        document.getElementById('absenceEnd').value = '';
        document.getElementById('absenceReason').value = '';
        const editIdEl = document.getElementById('editAbsenceId');
        if (editIdEl) editIdEl.value = '';
        const saveBtn = document.getElementById('saveAbsenceBtn');
        const cancelBtn = document.getElementById('cancelEditAbsenceBtn');
        if (saveBtn) saveBtn.textContent = 'Abwesenheit hinzufügen';
        if (cancelBtn) cancelBtn.style.display = 'none';
    },

    // Populate event select for rehearsal form
    async populateEventSelect(bandId) {
        const select = document.getElementById('rehearsalEvent');
        if (!select) return;

        const events = await Storage.getBandEvents(bandId);

        select.innerHTML = '<option value="">Kein Auftritt ausgewählt</option>' +
            (Array.isArray(events) ? events.map(event =>
                `<option value="${event.id}">${Bands.escapeHtml(event.title)} - ${UI.formatDateShort(event.date)}</option>`
            ).join('') : '');
    }
};

// Make App globally accessible
window.App = App;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});