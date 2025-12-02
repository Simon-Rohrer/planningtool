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
        // init draft song list for new events
        this.draftEventSongIds = [];
        this.lastSongModalContext = null; // { eventId, bandId, origin }
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
            // Clear draft song selection for new event
            this.draftEventSongIds = [];
            this.renderDraftEventSongs();
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
            addExistingEventSongBtn.addEventListener('click', () => {
                const eventId = document.getElementById('editEventId').value;
                const bandId = document.getElementById('eventBand').value;
                if (!bandId) {
                    UI.showToast('Bitte wähle zuerst eine Band aus', 'warning');
                    return;
                }

                const bandSongs = Storage.getBandSongs(bandId);
                if (!bandSongs || bandSongs.length === 0) {
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
        const currentUser = Auth.getCurrentUser();

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
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteNews(btn.dataset.id);
            });
        });

        // Add edit handlers
        container.querySelectorAll('.edit-news').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditNews(btn.dataset.id);
            });
        });

        // Mark news read on card click (when user explicitly clicks a news card)
        container.querySelectorAll('.news-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Ignore clicks on interactive buttons (they stopPropagation above)
                const id = card.dataset.id;
                const user = Auth.getCurrentUser();
                if (user) {
                    Storage.markNewsRead(id, user.id);
                    this.updateNewsNavBadge();
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
            const existing = Storage.getById('news', editId);
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

            Storage.updateNewsItem(editId, {
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
            Storage.createNewsItem(title, content, user.id, images);
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
        UI.closeModal('createNewsModal');

        // Refresh news view
        this.renderNewsView();
        this.updateNewsNavBadge();

        // reset edit id if any
        if (editIdInput) editIdInput.value = '';
    },

    deleteNews(newsId) {
        UI.showConfirm('News wirklich löschen?', () => {
            Storage.deleteNewsItem(newsId);
            UI.showToast('News gelöscht', 'success');
            this.renderNewsView();
            this.updateNewsNavBadge();
        });
    },

    // Open the create/edit news modal populated for editing
    openEditNews(newsId) {
        const news = Storage.getById('news', newsId);
        if (!news) return;
        const user = Auth.getCurrentUser();
        if (!user) return;

        // Only allow editing if admin or author
        if (!(Auth.isAdmin() || news.createdBy === user.id)) {
            UI.showToast('Keine Berechtigung zum Bearbeiten', 'error');
            return;
        }

        // Populate form
        document.getElementById('newsTitle').value = news.title || '';
        document.getElementById('newsContent').value = news.content || '';
        const editInput = document.getElementById('editNewsId');
        if (editInput) editInput.value = news.id;

        // Render previews from existing images
        const preview = document.getElementById('newsImagesPreview');
        if (preview) {
            preview.innerHTML = '';
            if (news.images && Array.isArray(news.images)) {
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

        // Update modal title
        const modalTitle = document.querySelector('#createNewsModal .modal-header h2');
        if (modalTitle) modalTitle.textContent = 'News bearbeiten';
        const submitBtn = document.querySelector('#createNewsModal .modal-actions .btn-primary');
        if (submitBtn) submitBtn.textContent = 'Speichern';

        UI.openModal('createNewsModal');
    },

    // Update the news nav item with an unread indicator for the current user
    updateNewsNavBadge() {
        const user = Auth.getCurrentUser();
        const navLabel = document.querySelector('.nav-item[data-view="news"] .nav-label');
        if (!navLabel) return;
        const existing = document.getElementById('newsUnreadBadge');
        const count = user ? Storage.getUnreadNewsCountForUser(user.id) : 0;
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
    getAbsenceConflicts(bandId, dates) {
        if (!bandId || !dates || dates.length === 0) return [];
        const members = Storage.getBandMembers(bandId) || [];
        const conflicts = [];

        members.forEach(m => {
            const user = Storage.getById('users', m.userId);
            if (!user) return;
            const badDates = [];
            dates.forEach(d => {
                if (!d) return;
                try {
                    if (Storage.isUserAbsentOnDate(user.id, d)) {
                        // Format date nicely
                        badDates.push(UI.formatDateOnly(new Date(d).toISOString()));
                    }
                } catch (e) {
                    // ignore parse errors
                }
            });
            if (badDates.length > 0) {
                conflicts.push({ name: user.name, userId: user.id, dates: badDates });
            }
        });

        return conflicts;
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

    handleSaveSong() {
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

        if (eventId) songData.eventId = eventId;
        if (bandId) songData.bandId = bandId;

        if (songId) {
            // Update existing song
            Storage.updateSong(songId, songData);
            UI.showToast('Song aktualisiert', 'success');
        } else {
            // Create new song
            const created = Storage.createSong(songData);
            UI.showToast('Song hinzugefügt', 'success');

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
        this.updateNavigationVisibility();
        this.navigateTo('dashboard');
        // Ensure create news button visibility immediately after login (so admins/leaders see it without navigating)
        const createNewsBtnGlobal = document.getElementById('createNewsBtn');
        if (createNewsBtnGlobal) {
            const user = Auth.getCurrentUser();
            let canCreate = Auth.isAdmin();
            if (!canCreate && user) {
                const userBands = Storage.getUserBands(user.id) || [];
                canCreate = userBands.some(b => b.role === 'leader' || b.role === 'co-leader');
            }
            createNewsBtnGlobal.style.display = canCreate ? 'inline-flex' : 'none';
        }
        // Update unread news badge
        this.updateNewsNavBadge();
    },

    // Update navigation visibility based on band membership
    updateNavigationVisibility() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bands = Storage.getUserBands(user.id);
        const hasBands = bands.length > 0;

        // Hide/Show Events and Rehearsals nav items
        const eventsNav = document.querySelector('.nav-item[data-view="events"]');
        const rehearsalsNav = document.querySelector('.nav-item[data-view="rehearsals"]');

        if (eventsNav) eventsNav.style.display = hasBands ? 'flex' : 'none';
        if (rehearsalsNav) rehearsalsNav.style.display = hasBands ? 'flex' : 'none';
    },

    // Open absence modal and render current user's absences
    openAbsenceModal() {
        // Render existing absences
        this.renderUserAbsences();
        UI.openModal('absenceModal');
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
                Rehearsals.populateStatsBandSelect();
                // Wire up band select change to render band stats
                const statsBandSelect = document.getElementById('statsBandSelect');
                if (statsBandSelect) {
                    statsBandSelect.addEventListener('change', (e) => {
                        const bandId = e.target.value;
                        if (bandId) {
                            Statistics.renderBandStatistics(bandId);
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
        const conflicts = this.getAbsenceConflicts(bandId, dates);
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
    handleCreateEvent() {
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

        const conflicts = this.getAbsenceConflicts(bandId, datesToCheck);
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
    handleCreateAbsence() {
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

        // Ensure ISO strings
        const startIso = new Date(start).toISOString();
        const endIso = new Date(end).toISOString();

        if (editId && editId.trim() !== '') {
            // update existing absence
            Storage.update('absences', editId, { startDate: startIso, endDate: endIso, reason });
            UI.showToast('Abwesenheit aktualisiert', 'success');
        } else {
            Storage.createAbsence(user.id, startIso, endIso, reason);
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
        this.renderUserAbsences();
        // If band details modal open and has absences tab, re-render band absences
        if (typeof Bands !== 'undefined' && Bands.currentBandId) {
            Bands.renderBandAbsences(Bands.currentBandId);
        }
    },

    // Render the current user's absences into the Absence modal
    renderUserAbsences() {
        const container = document.getElementById('absencesList');
        const user = Auth.getCurrentUser();
        if (!container || !user) return;

        const absences = Storage.getUserAbsences(user.id);
        if (!absences || absences.length === 0) {
            container.innerHTML = '<p class="text-muted">Du hast keine eingetragenen Abwesenheiten.</p>';
            return;
        }

        // sort by start date desc
        absences.sort((a,b)=> new Date(b.startDate) - new Date(a.startDate));

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
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                UI.showConfirm('Möchtest du diese Abwesenheit wirklich löschen?', () => {
                    Storage.deleteAbsence(id);
                    UI.showToast('Abwesenheit gelöscht', 'success');
                    this.renderUserAbsences();
                    if (typeof Bands !== 'undefined' && Bands.currentBandId) {
                        Bands.renderBandAbsences(Bands.currentBandId);
                    }
                });
            });
        });
    },

    // Start editing an absence: populate form and switch to edit-mode
    startEditAbsence(absenceId) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const absences = Storage.getUserAbsences(user.id) || [];
        const a = absences.find(x => x.id === absenceId);
        if (!a) return;

        // populate form
        document.getElementById('absenceStart').value = a.startDate.slice(0,10);
        document.getElementById('absenceEnd').value = a.endDate.slice(0,10);
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