// Main Application Controller

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    App.setupDashboardFeatures();

    // Song form submit handler: ensure only one handler is registered
    const songForm = document.getElementById('songForm');
    if (songForm) {
        // Remove all previous submit event listeners by replacing the node
        const newSongForm = songForm.cloneNode(true);
        songForm.parentNode.replaceChild(newSongForm, songForm);
        let songFormSubmitting = false;
        newSongForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (songFormSubmitting) return;
            songFormSubmitting = true;
            try {
                await App.handleSaveSong();
            } finally {
                songFormSubmitting = false;
            }
        });
    }
});
// Main Application Controller

const App = {

    // Track deleted songs for potential rollback
    deletedEventSongs: [],

    // Account löschen Logik
    async handleDeleteAccount() {
        try {
            UI.showToast('Account wird gelöscht...', 'error');
            // 1. User aus Supabase Auth löschen
            await Auth.deleteCurrentUser();
            // 2. User aus eigener Datenbank löschen
            const user = Auth.getCurrentUser();
            if (user) {
                await Storage.deleteUser(user.id);
            }
            UI.showToast('Account und alle Daten wurden gelöscht.', 'success');
            UI.closeModal('deleteAccountModal');
            // 3. Logout und zurück zur Landing-Page
            await Auth.logout();
            this.showAuth();
        } catch (err) {
            UI.showToast('Fehler beim Löschen: ' + (err.message || err), 'error');
        }
    },
    setupQuickAccessEdit() {
        const editBtn = document.getElementById('editQuickAccessBtn');
        const modal = document.getElementById('quickAccessModal');
        const form = document.getElementById('quickAccessForm');
        const optionsDiv = document.getElementById('quickAccessOptions');
        const cancelBtn = document.getElementById('cancelQuickAccessBtn');
        const quickLinks = [
            { key: 'kalender', label: '📆 Mein Kalender', view: 'kalender' },
            { key: 'news', label: '📰 News', view: 'news' },
            { key: 'musikpool', label: '🎵 Musikerpool', view: 'musikpool' },
            { key: 'bands', label: '🎸 Meine Bands', view: 'bands' },
            { key: 'rehearsals', label: '📅 Probetermine', view: 'rehearsals' },
            { key: 'events', label: '🎤 Auftritte', view: 'events' },
            { key: 'statistics', label: '📊 Statistiken', view: 'statistics' },
        ];
        if (!editBtn || !modal || !form || !optionsDiv || !cancelBtn) return;
        editBtn.onclick = (e) => {
            e.stopPropagation();
            let selected = [];
            try {
                selected = JSON.parse(localStorage.getItem('quickAccessLinks') || 'null');
            } catch { }
            if (!Array.isArray(selected) || selected.length === 0) {
                selected = ['kalender', 'news', 'musikpool'];
            }
            optionsDiv.innerHTML = quickLinks.map(l =>
                `<label style="display:flex;align-items:center;gap:0.5em;">
                    <input type="checkbox" name="quickAccess" value="${l.key}" ${selected.includes(l.key) ? 'checked' : ''}>
                    <span>${l.label}</span>
                </label>`
            ).join('');
            modal.classList.add('active');
        };
        cancelBtn.onclick = (e) => {
            e.preventDefault();
            modal.classList.remove('active');
        };
        form.onsubmit = (e) => {
            e.preventDefault();
            const checked = Array.from(form.querySelectorAll('input[name="quickAccess"]:checked')).map(i => i.value);
            localStorage.setItem('quickAccessLinks', JSON.stringify(checked));
            modal.classList.remove('active');
            App.updateDashboard();
        };
        // Close modal on outside click
        window.addEventListener('click', function handler(ev) {
            if (ev.target === modal) {
                modal.classList.remove('active');
            }
        });
    },

    // Call this after DOMContentLoaded
    setupDashboardFeatures() {
        this.setupQuickAccessEdit();
    },
    // Update header submenu buttons depending on active main view
    updateHeaderSubmenu(view) {
        const submenuMap = {
            dashboard: [
                { key: 'dashboard', label: 'Dashboard', icon: '🏠' },
                { key: 'bands', label: 'Meine Bands', icon: '🎸' },
                { key: 'musikpool', label: 'Musikerpool', icon: '🎵' }
            ],
            rehearsals: [
                { key: 'rehearsals', label: 'Probetermine', icon: '📅' },
                { key: 'probeorte', label: 'Probeorte', icon: '🎙️' },
                { key: 'kalender', label: 'Mein Kalender', icon: '📆' }
            ],
            events: [
                { key: 'events', label: 'Auftritte', icon: '🎸' }
            ],
            statistics: [
                { key: 'statistics', label: 'Statistiken', icon: '📊' },
                { key: 'news', label: 'News', icon: '📰' }
            ],
            settings: [
                { key: 'settings', label: 'Einstellungen', icon: '⚙️' }
            ]
        };

        const items = submenuMap[view] || [];
        const container = document.getElementById('headerSubmenu');
        if (!container) return;
        container.innerHTML = items.map(i => `<button type="button" class="header-submenu-btn" data-view="${i.key}" onclick="App.navigateTo('${i.key}')"><span class=\"nav-icon\">${i.icon}</span><span class=\"header-submenu-label\">${i.label}</span></button>`).join('');
        console.log('[updateHeaderSubmenu] populated for', view, 'items:', items.map(i => i.key));

        // After rendering submenu buttons, set underline widths to match label+icon
        setTimeout(() => {
            try { this.updateHeaderUnderlineWidths(); } catch (e) { /* ignore */ }
        }, 0);

        // Attach a delegated click handler once to the container to reliably
        // capture clicks on dynamically created buttons.
        if (!container.dataset.delegationAttached) {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('.header-submenu-btn');
                if (!btn) return;
                const viewKey = btn.getAttribute('data-view');
                console.log('[HEADER SUBMENU] delegated click sync', viewKey, 'target:', e.target);
                if (!viewKey) return;
                try {
                    if (typeof App !== 'undefined' && App.navigateTo) {
                        App.navigateTo(viewKey);
                        console.log('[HEADER SUBMENU] navigateTo invoked sync for', viewKey);
                    } else if (this && this.navigateTo) {
                        this.navigateTo(viewKey);
                        console.log('[HEADER SUBMENU] this.navigateTo invoked sync for', viewKey);
                    } else {
                        console.warn('[HEADER SUBMENU] navigateTo not available for', viewKey);
                    }
                } catch (err) {
                    console.error('[HEADER SUBMENU] navigateTo error for', viewKey, err);
                }
            });
            container.dataset.delegationAttached = 'true';
        }
    },

    /* ===== Tutorial / Guided Tour ===== */
    showTutorialSuggestBanner() {
        try {
            const banner = document.getElementById('tutorialSuggestBanner');
            const startBtn = document.getElementById('tutorialStartBannerBtn');
            const dismissBtn = document.getElementById('tutorialDismissBannerBtn');
            if (!banner) return;

            // If dismissed before, don't show
            if (localStorage.getItem('tutorialBannerDismissed') === '1') return;

            banner.style.display = 'flex';
            if (startBtn) startBtn.onclick = (e) => { e.preventDefault(); this.startTutorial(); banner.style.display = 'none'; };
            if (dismissBtn) dismissBtn.onclick = (e) => { e.preventDefault(); banner.style.display = 'none'; localStorage.setItem('tutorialBannerDismissed', '1'); };
        } catch (err) {
            console.error('Error showing tutorial banner:', err);
        }
    },

    async startTutorial(steps) {
        // Default steps if none provided
        this.tour = this.tour || {};
        this.tour.steps = steps || [
            { navigate: 'dashboard', sel: '.nav-item[data-view="dashboard"]', title: 'Start / Dashboard', body: 'Das Dashboard gibt dir einen schnellen Überblick über Bands, nächste Termine und Aktivitäten.' },
            { navigate: 'bands', sel: '#bandsView .view-header h2', title: 'Meine Bands', body: 'Hier findest du alle Bands, in denen du Mitglied bist. Klicke auf eine Band, um Details zu sehen.' },
            { navigate: 'rehearsals', sel: '.nav-item[data-view="rehearsals"]', title: 'Probetermine', body: 'Erstelle neue Proben oder bearbeite bestehende Termine. Du kannst Teilnehmer einladen und Zeiten vorschlagen.' },
            { navigate: 'events', sel: '.nav-item[data-view="events"]', title: 'Auftritte', body: 'Verwalte Auftritte, erstelle Setlists und lade Musiker ein.' },
            { navigate: 'dashboard', sel: '#dashboardView .dashboard-card:nth-child(1) .card-icon', title: 'Dashboard-Karten', body: 'Die Karten zeigen Metriken — klicke eine Karte, um zur entsprechenden Ansicht zu springen.' },
            { navigate: 'settings', tab: 'profile', sel: '#profileSettingsTab .section h3', title: 'Profil bearbeiten', body: 'Bearbeite hier Benutzername, E-Mail und Instrument. Passwörter kannst du hier ändern.' },
            { navigate: 'settings', tab: 'absences', sel: '#absencesSettingsTab .section h3', title: 'Abwesenheiten', body: 'Trage deine Abwesenheiten ein, damit andere Mitglieder Bescheid wissen.' },
            { navigate: 'settings', tab: 'users', sel: '#settingsTabUsers', title: 'Benutzerverwaltung', body: 'Admins können hier Benutzer verwalten (sichtbar nur für Admins).', adminOnly: true }
        ];
        this.tour.index = 0;
        this.tourOverlay = document.getElementById('tutorialOverlay');
        this.tourHighlight = document.getElementById('tourHighlight');
        this.tourTooltip = document.getElementById('tourTooltip');

        if (!this.tourOverlay || !this.tourHighlight || !this.tourTooltip) {
            console.error('Tutorial elements missing');
            return;
        }

        this.tourOverlay.style.display = 'block';
        this.tourOverlay.classList.add('active');

        // Wire up controls
        document.getElementById('tourNextBtn').onclick = () => this.nextTutorialStep();
        document.getElementById('tourPrevBtn').onclick = () => this.prevTutorialStep();
        document.getElementById('tourEndBtn').onclick = () => this.endTutorial();

        // Keyboard navigation
        this._tourKeyHandler = (e) => {
            if (e.key === 'Escape') this.endTutorial();
            if (e.key === 'ArrowRight') this.nextTutorialStep();
            if (e.key === 'ArrowLeft') this.prevTutorialStep();
        };
        document.addEventListener('keydown', this._tourKeyHandler);

        await this.renderTutorialStep(this.tour.index);
    },

    async renderTutorialStep(idx) {
        // If the step requires navigation, do it first
        if (!this.tour || !Array.isArray(this.tour.steps)) return;
        if (idx < 0 || idx >= this.tour.steps.length) {
            this.endTutorial();
            return;
        }
        this.tour.index = idx;
        const step = this.tour.steps[idx];
        // Optional navigation: if step.navigate is provided, navigate there first
        try {
            if (step.navigate) {
                await this.navigateTo(step.navigate);
                // small delay for view DOM to render
                await new Promise(r => setTimeout(r, 200));
            }
            if (step.tab && step.navigate === 'settings') {
                // ensure settings tab is shown
                this.switchSettingsTab(step.tab);
                await new Promise(r => setTimeout(r, 120));
            }
        } catch (navErr) {
            console.warn('Tour navigation error:', navErr);
        }

        // Skip admin-only steps when current user is not admin
        if (step.adminOnly && !(Auth && Auth.isAdmin && Auth.isAdmin())) {
            // jump to next step
            setTimeout(() => this.nextTutorialStep(), 10);
            return;
        }

        const el = document.querySelector(step.sel);

        // Update tooltip text
        const titleEl = document.getElementById('tourTitle');
        const bodyEl = document.getElementById('tourBody');
        titleEl.textContent = step.title || 'Schritt ' + (idx + 1);
        bodyEl.textContent = step.body || '';

        // Update buttons
        document.getElementById('tourPrevBtn').style.display = idx === 0 ? 'none' : 'inline-block';
        document.getElementById('tourNextBtn').textContent = idx === this.tour.steps.length - 1 ? 'Fertig' : 'Weiter';

        if (!el) {
            console.warn('Tour: target not found for selector', step.sel);
            setTimeout(() => this.nextTutorialStep(), 300);
            return;
        }

        // Try to find a visible/fallback element if the target is hidden or tiny
        let target = el;
        const getRect = (node) => node ? node.getBoundingClientRect() : { width: 0, height: 0, top: 0, left: 0, bottom: 0 };
        let rect = getRect(target);
        if ((rect.width < 8 || rect.height < 8) && step.navigate) {
            const candidates = [
                document.querySelector(`.nav-item[data-view="${step.navigate}"]`),
                document.querySelector(`.nav-subitem[data-view="${step.navigate}"]`),
                document.querySelector(`#headerSubmenu .header-submenu-btn[data-view="${step.navigate}"]`),
                target.closest('.nav-item'),
                target.closest('.nav-subitem')
            ].filter(Boolean);
            for (const c of candidates) {
                const r = getRect(c);
                if (r.width > 8 && r.height > 8) {
                    target = c;
                    rect = r;
                    break;
                }
            }
        }

        // Bring the chosen element into view
        try { target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch { }
        // Recompute rect after scroll
        rect = getRect(target);

        // Position highlight around element (ensure minimum size)
        const pad = 10;
        const highlightStyle = this.tourHighlight.style;
        const hWidth = Math.max(rect.width + pad * 2, 24);
        const hHeight = Math.max(rect.height + pad * 2, 24);
        highlightStyle.top = (window.scrollY + rect.top - pad) + 'px';
        highlightStyle.left = (window.scrollX + rect.left - pad) + 'px';
        highlightStyle.width = hWidth + 'px';
        highlightStyle.height = hHeight + 'px';

        // Position tooltip centered under (or above if not enough space)
        const tooltip = this.tourTooltip;
        tooltip.style.display = 'block';
        // Allow browser to compute tooltip size
        const ttWidth = tooltip.offsetWidth || 300;
        const ttHeight = tooltip.offsetHeight || 120;
        const viewportWidth = document.documentElement.clientWidth;
        const centerLeft = window.scrollX + rect.left + (rect.width / 2) - (ttWidth / 2);
        let ttLeft = Math.max(8 + window.scrollX, Math.min(centerLeft, window.scrollX + viewportWidth - ttWidth - 8));
        // Prefer below element
        let ttTop = window.scrollY + rect.bottom + 12;
        const viewportBottom = window.scrollY + document.documentElement.clientHeight;
        if (ttTop + ttHeight > viewportBottom - 8) {
            // not enough space below, show above
            ttTop = window.scrollY + rect.top - ttHeight - 12;
        }

        // Special case: on small screens the logout icon is tiny and the
        // centered tooltip may appear off. Anchor the tooltip to the
        // logout button center, but increase highlight padding so the
        // small icon is still visible and the tooltip doesn't overlap
        // header items.
        // remove special-case logout positioning: tooltip defaults handle placement

        tooltip.style.top = ttTop + 'px';
        tooltip.style.left = ttLeft + 'px';
        // Ensure overlay active
        this.tourOverlay.classList.add('active');
    },

    async nextTutorialStep() {
        if (!this.tour) return;
        if (this.tour.index >= this.tour.steps.length - 1) {
            this.endTutorial();
        } else {
            await this.renderTutorialStep(this.tour.index + 1);
        }
    },

    async prevTutorialStep() {
        if (!this.tour) return;
        await this.renderTutorialStep(Math.max(0, this.tour.index - 1));
    },

    endTutorial() {
        try {
            if (this.tourOverlay) {
                this.tourOverlay.style.display = 'none';
                this.tourOverlay.classList.remove('active');
            }
            if (this.tourHighlight) {
                this.tourHighlight.style.width = '0px';
            }
            document.removeEventListener('keydown', this._tourKeyHandler);
            this.tour = null;
            this._tourKeyHandler = null;
            UI.showToast('Tutorial beendet', 'success');
        } catch (err) {
            console.error('Error ending tutorial:', err);
        }
    },

    // Measure header submenu button label widths and store in CSS variable
    updateHeaderUnderlineWidths() {
        const container = document.getElementById('headerSubmenu');
        if (!container) return;
        const btns = container.querySelectorAll('.header-submenu-btn');
        btns.forEach(btn => {
            // measure content width (approx): clientWidth minus horizontal padding
            const cs = getComputedStyle(btn);
            const paddingLeft = parseFloat(cs.paddingLeft) || 0;
            const paddingRight = parseFloat(cs.paddingRight) || 0;
            const contentWidth = Math.max(20, Math.round(btn.clientWidth - paddingLeft - paddingRight));
            btn.style.setProperty('--underline-width', contentWidth + 'px');
        });
    },
    setupMobileSubmenuToggle() {
        const navBar = document.getElementById('appNav');
        if (!navBar) {
            console.warn('Fehler: #appNav Element für mobile Navigation nicht gefunden.');
            return;
        }

        // On desktop we keep the click/hover behaviour that shows nav-submenu.
        // On mobile we do not attach the old toggle handler because mobile will
        // show the submenu in the header instead.
        if (window.innerWidth <= 768) {
            return;
        }

        navBar.addEventListener('click', (e) => {
            // Findet das geklickte .nav-item (oder dessen Elternelement)
            const clickedItem = e.target.closest('.nav-item');
            if (!clickedItem) return;

            const navGroup = clickedItem.closest('.nav-group');

            // Prüfen, ob das geklickte Element Teil einer Gruppe mit Submenü ist
            if (navGroup && navGroup.querySelector('.nav-submenu')) {
                e.preventDefault(); // Verhindert, dass der Link (#) die Seite neu lädt oder springt
                e.stopPropagation(); // Verhindert sofortiges Schließen durch globalen Handler

                // 1. Alle anderen offenen Submenüs schließen
                document.querySelectorAll('.nav-group.submenu-open').forEach(group => {
                    // Schließe nur, wenn es nicht die aktuell geklickte Gruppe ist
                    if (group !== navGroup) {
                        group.classList.remove('submenu-open');
                    }
                });

                // 2. Das geklickte Submenü öffnen/schließen (Toggle)
                navGroup.classList.toggle('submenu-open');
            }
        });

        // Submenüs schließen, wenn man irgendwo anders klickt (Globale Schließlogik)
        document.addEventListener('click', (e) => {
            const isClickInsideNav = e.target.closest('.app-nav');
            const isClickInsideSubmenu = e.target.closest('.nav-submenu');
            // Schließe alle Submenüs, wenn der Klick NICHT in der Nav-Bar und NICHT im Submenü war
            if (!isClickInsideNav && !isClickInsideSubmenu) {
                document.querySelectorAll('.nav-group.submenu-open').forEach(group => {
                    group.classList.remove('submenu-open');
                });
            }
        });
    },

    async init() {
        // Initialisierung
        // Initialize Supabase Auth first
        this.setupMobileSubmenuToggle();

        // NOTE: tutorial banner will be shown after auth initialization below

        await Auth.init();

        // Apply saved theme on app start (and update icon if present)
        const savedTheme = localStorage.getItem('theme');
        const themeToggleHeader = document.getElementById('themeToggleHeader');
        const themeToggleIcon = document.getElementById('themeToggleIcon');
        let isDark = false;
        if (savedTheme) {
            isDark = savedTheme === 'dark';
        } else {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        document.documentElement.classList.toggle('theme-dark', isDark);
        if (themeToggleIcon && themeToggleHeader) {
            themeToggleIcon.textContent = isDark ? '☀️' : '🌙';
            themeToggleHeader.title = isDark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren';
        }

        // Check authentication
        if (Auth.isAuthenticated()) {
            await this.showApp();
            // Pre-load standard calendars after login
            this.preloadStandardCalendars();
            // Clean up past events and rehearsals
            await Storage.cleanupPastItems();

            // Show tutorial suggest banner for admins (if not dismissed)
            try {
                if (Auth.isAdmin && Auth.isAdmin()) {
                    setTimeout(() => this.showTutorialSuggestBanner(), 350);
                }
            } catch (err) { /* ignore */ }
        } else {
            this.showAuth();
        }

        // Setup event listeners
        this.setupEventListeners();
        // Initialize header submenu for default view on mobile only
        if (window.innerWidth <= 768) {
            this.updateHeaderSubmenu('dashboard');
        }
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

    preloadStandardCalendars() {
        // Pre-load Tonstudio, JMS Festhalle, and Ankersaal calendars
        if (typeof Calendar !== 'undefined' && Calendar.ensureLocationCalendar) {
            const standardCalendars = [
                { id: 'tonstudio', name: 'Tonstudio' },
                { id: 'jms-festhalle', name: 'JMS Festhalle' },
                { id: 'ankersaal', name: 'Ankersaal' }
            ];

            standardCalendars.forEach(cal => {
                Calendar.ensureLocationCalendar(cal.id, cal.name)
                    .catch(err => console.error(`[App] Kalender konnte nicht geladen werden: ${cal.name}`, err));
            });
        }
    },

    setupEventListeners() {
        // Zeige '+ Neuer Auftritt' nur, wenn User in mindestens einer Band ist
        const createEventBtn = document.getElementById('createEventBtn');
        const user = Auth.getCurrentUser();
        if (createEventBtn && user) {
            Storage.getUserBands(user.id).then(bands => {
                createEventBtn.style.display = (bands && bands.length > 0) ? '' : 'none';
            });
        }
        // Ensure 'Auftritte' and 'Planung' main navigation tabs are always visible (desktop & mobile)
        document.querySelectorAll('.nav-item[data-view="events"], .nav-item[data-view="rehearsals"]').forEach(item => {
            item.style.display = '';
        });
        // Also ensure mobile tabs are always visible
        document.querySelectorAll('.nav-subitem[data-view="events"], .nav-subitem[data-view="rehearsals"], .nav-subitem[data-view="probeorte"], .nav-subitem[data-view="kalender"]').forEach(item => {
            item.style.display = '';
        });

        // Hide 'Neuen Probetermin' button if user is not in a band
        const user2 = Auth.getCurrentUser();
        if (user2) {
            Storage.getUserBands(user2.id).then(bands => {
                const createRehearsalBtn = document.getElementById('createRehearsalBtn');
                if (createRehearsalBtn) {
                    createRehearsalBtn.style.display = (bands && bands.length > 0) ? '' : 'none';
                }
            });
        }
        // Band löschen Button
        // (Removed duplicate deleteBandBtn handler; handled below with Bands.currentBandId)
        // Show/hide extra event fields in modal
        const extrasCheckbox = document.getElementById('eventShowExtras');
        const extrasFields = document.getElementById('eventExtrasFields');
        const guestsCheckbox = document.getElementById('eventShowGuests');
        const guestsField = document.getElementById('eventGuestsField');
        if (extrasCheckbox && extrasFields) {
            extrasCheckbox.addEventListener('change', function () {
                extrasFields.style.display = this.checked ? '' : 'none';
            });
        }
        if (guestsCheckbox && guestsField) {
            guestsCheckbox.addEventListener('change', function () {
                guestsField.style.display = this.checked ? '' : 'none';
            });
        }
        // When opening the modal, reset extras and guest fields visibility
        const createEventModal = document.getElementById('createEventModal');
        if (createEventModal) {
            createEventModal.addEventListener('show', function () {
                if (extrasCheckbox && extrasFields) {
                    extrasFields.style.display = extrasCheckbox.checked ? '' : 'none';
                }
                if (guestsCheckbox && guestsField) {
                    guestsField.style.display = guestsCheckbox.checked ? '' : 'none';
                }
            });
        }
        // Account löschen Button
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                UI.openModal('deleteAccountModal');
            });
        }

        // Modal: Abbrechen
        const cancelDeleteAccountBtn = document.getElementById('cancelDeleteAccountBtn');
        if (cancelDeleteAccountBtn) {
            cancelDeleteAccountBtn.addEventListener('click', () => {
                UI.closeModal('deleteAccountModal');
            });
        }

        // Modal: Bestätigen
        const confirmDeleteAccountBtn = document.getElementById('confirmDeleteAccountBtn');
        if (confirmDeleteAccountBtn) {
            confirmDeleteAccountBtn.addEventListener('click', async () => {
                await App.handleDeleteAccount();
            });
        }
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
            const rememberMe = document.getElementById('loginRememberMe')?.checked;
            await this.handleLogin(undefined, undefined, rememberMe);
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

        // Navigation - Main items and subitems
        // Remove any logic that hides the 'Planung' tab based on band membership.
        document.querySelectorAll('.nav-item, .nav-subitem').forEach(item => {
            item.addEventListener('click', async (e) => {
                try {
                    const isMobile = window.innerWidth <= 768;
                    const isMainNav = item.classList.contains('nav-main');
                    const navGroup = item.closest('.nav-group');
                    const hasSubmenu = navGroup && navGroup.querySelector('.nav-submenu');

                    if (isMobile && isMainNav && hasSubmenu) {
                        e.preventDefault();
                        e.stopPropagation();
                        const mainView = item.dataset.view;
                        if (mainView) {
                            this.updateHeaderSubmenu(mainView);
                            const submenuMap = {
                                dashboard: ['dashboard', 'bands', 'musikpool'],
                                rehearsals: ['rehearsals', 'probeorte', 'kalender'],
                                events: ['events'],
                                statistics: ['statistics', 'news'],
                                settings: ['settings']
                            };
                            const first = (submenuMap[mainView] && submenuMap[mainView][0]) || mainView;
                            try {
                                await this.navigateTo(first);
                            } catch (navErr) {
                                console.error('[MOBILE NAV] navigateTo error for', first, navErr);
                            }
                        }
                        return;
                    }

                    if (isMobile && item.classList.contains('nav-subitem') && navGroup) {
                        navGroup.classList.remove('submenu-open');
                    }

                    e.stopPropagation();
                    const view = item.dataset.view;
                    if (!view) return;
                    if (isMobile && item.classList.contains('nav-main')) {
                        this.updateHeaderSubmenu(view);
                    }
                    const settingsTab = item.dataset.settingsTab;
                    await App.navigateTo(view);
                    if (view === 'settings' && settingsTab) {
                        setTimeout(() => {
                            const tabButton = document.querySelector(`.settings-tab-btn[data-tab="${settingsTab}"]`);
                            if (tabButton) {
                                tabButton.click();
                            }
                        }, 100);
                    }
                } catch (error) {
                    console.error('[NAV CLICK] Error:', error);
                }
            });
        });

        // Close mobile submenus when clicking outside
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return;

            const clickedInsideNav = e.target.closest('.app-nav');
            if (!clickedInsideNav) {
                document.querySelectorAll('.nav-group.submenu-open').forEach(g => {
                    g.classList.remove('submenu-open');
                });
            }
        });

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

        // Create band button (using event delegation since button is in settings modal)
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'createBandBtn') {
                UI.openModal('createBandModal');
            }
        });

        // Create band form
        const createBandForm = document.getElementById('createBandForm');
        if (createBandForm) {
            createBandForm.onsubmit = (e) => {
                e.preventDefault();
                this.handleCreateBand();
            };
        }

        // Edit band form
        const editBandForm = document.getElementById('editBandForm');
        if (editBandForm) {
            editBandForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleEditBand();
            });
        }

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


        // Show 'Probetermine hinzufügen' button only if user is in at least one band
        const createRehearsalBtn = document.getElementById('createRehearsalBtn');
        if (createRehearsalBtn) {
            const user = Auth.getCurrentUser();
            if (user) {
                Storage.getUserBands(user.id).then(bands => {
                    createRehearsalBtn.style.display = (bands && bands.length > 0) ? '' : 'none';
                });
            }
            createRehearsalBtn.addEventListener('click', async () => {
                // Reset form for new rehearsal
                document.getElementById('rehearsalModalTitle').textContent = 'Neuen Probetermin vorschlagen';
                document.getElementById('saveRehearsalBtn').textContent = 'Vorschlag erstellen';
                document.getElementById('editRehearsalId').value = '';
                UI.clearForm('createRehearsalForm');

                // Hide delete button for new rehearsal
                const deleteBtn = document.getElementById('deleteRehearsalBtn');
                if (deleteBtn) {
                    deleteBtn.style.display = 'none';
                }

                // Reset date proposals
                const container = document.getElementById('dateProposals');
                container.innerHTML = `
                    <div class="date-proposal-item" data-confirmed="false">
                        <div class="date-time-range">
                            <input type="date" class="date-input-date">
                            <input type="time" class="date-input-start">
                            <span class="time-separator">bis</span>
                            <input type="time" class="date-input-end">
                        </div>
                        <span class="date-availability" style="margin-left:8px"></span>
                        <button type="button" class="btn btn-sm confirm-proposal-btn">✓ Bestätigen</button>
                        <button type="button" class="btn-icon remove-date" disabled>🗑️</button>
                    </div>
                `;

                // Attach event handlers to the new elements
                Rehearsals.attachVoteHandlers(container);

                await Bands.populateBandSelects();
                await this.populateLocationSelect();

                // Attach availability listeners for initial input
                if (typeof Rehearsals !== 'undefined' && Rehearsals.attachAvailabilityListeners) {
                    Rehearsals.attachAvailabilityListeners();
                }

                // Event-Dropdown richtig vorbelegen
                const eventSelect = document.getElementById('rehearsalEvent');
                const bandSelect = document.getElementById('rehearsalBand');
                if (eventSelect && bandSelect) {
                    const user = Auth.getCurrentUser();
                    if (user) {
                        const bands = await Storage.getUserBands(user.id);
                        if (bands && bands.length === 1 && bandSelect.value) {
                            // Wenn nur eine Band, direkt Events dieser Band laden
                            await App.populateEventSelect(bandSelect.value);
                        } else {
                            eventSelect.innerHTML = '<option value="">Bitte zuerst eine Band auswählen</option>';
                        }
                    }
                }

                // Hide notification checkbox for new rehearsals
                const notifyGroup = document.getElementById('notifyMembersGroup');
                if (notifyGroup) {
                    notifyGroup.style.display = 'none';
                    document.getElementById('notifyMembersOnUpdate').checked = false;
                }

                UI.openModal('createRehearsalModal');
            });
        }

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
        const createRehearsalForm = document.getElementById('createRehearsalForm');
        if (createRehearsalForm) {
            createRehearsalForm.onsubmit = (e) => {
                e.preventDefault();
                this.handleCreateRehearsal();
            };
        }

        // Add date button
        const addDateBtn = document.getElementById('addDateBtn');
        if (addDateBtn) {
            // Vorherige Listener entfernen
            addDateBtn.replaceWith(addDateBtn.cloneNode(true));
            const newAddDateBtn = document.getElementById('addDateBtn');
            newAddDateBtn.addEventListener('click', () => {
                Rehearsals.addDateProposal();
            });
        }

        // Delete rehearsal button
        document.getElementById('deleteRehearsalBtn').addEventListener('click', async () => {
            const rehearsalId = document.getElementById('editRehearsalId').value;
            if (rehearsalId) {
                await Rehearsals.deleteRehearsal(rehearsalId);
                UI.closeModal('createRehearsalModal');
            }
        });

        // Band filter
        document.getElementById('bandFilter').addEventListener('change', (e) => {
            Rehearsals.currentFilter = e.target.value;
            Rehearsals.renderRehearsals(e.target.value);
        });

        // Statistics rehearsal select

        document.getElementById('statsRehearsalSelect').addEventListener('change', (e) => {
            const rehearsalId = e.target.value;
            if (rehearsalId) {
                Statistics.renderStatistics(rehearsalId);
            } else {
                // If a band is selected but no rehearsal, show band stats
                const bandId = document.getElementById('statsBandSelect').value;
                if (bandId) {
                    Statistics.renderBandStatistics(bandId);
                } else {
                    const container = document.getElementById('statisticsContent');
                    UI.showEmptyState(container, '📊', 'Wähle eine Band oder einen Probetermin aus, um die Statistiken zu sehen');
                }
            }
        });

        document.getElementById('statsBandSelect').addEventListener('change', (e) => {
            const bandId = e.target.value;
            const rehearsalId = document.getElementById('statsRehearsalSelect').value;
            if (rehearsalId) {
                Statistics.renderStatistics(rehearsalId);
            } else if (bandId) {
                Statistics.renderBandStatistics(bandId);
            } else {
                const container = document.getElementById('statisticsContent');
                UI.showEmptyState(container, '📊', 'Wähle eine Band oder einen Probetermin aus, um die Statistiken zu sehen');
            }
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
        const createEventForm = document.getElementById('createEventForm');
        if (createEventForm) {
            createEventForm.onsubmit = (e) => {
                e.preventDefault();
                this.handleCreateEvent();
            };
        }

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
        // Support both button IDs for band song copy (legacy and new)
        const addExistingEventSongBtn = document.getElementById('addExistingEventSongBtn');
        const copyBandSongsBtn = document.getElementById('copyBandSongsBtn');
        const handleCopyBandSongs = async () => {
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
                this.showBandSongSelector(eventId, bandSongs);
            } else {
                this.showBandSongSelectorForDraft(bandSongs);
            }
        };
        if (addExistingEventSongBtn) {
            addExistingEventSongBtn.addEventListener('click', handleCopyBandSongs);
        }
        if (copyBandSongsBtn) {
            copyBandSongsBtn.addEventListener('click', handleCopyBandSongs);
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
            sendConfirmBtn.addEventListener('click', async () => {
                await Rehearsals.confirmRehearsal();
            });
        }

        // Time suggestion modal handlers
        const saveTimeSuggestionBtn = document.getElementById('saveTimeSuggestionBtn');
        if (saveTimeSuggestionBtn) {
            saveTimeSuggestionBtn.addEventListener('click', async () => {
                await Rehearsals.saveTimeSuggestion();
            });
        }

        const deleteTimeSuggestionBtn = document.getElementById('deleteTimeSuggestionBtn');
        if (deleteTimeSuggestionBtn) {
            deleteTimeSuggestionBtn.addEventListener('click', async () => {
                await Rehearsals.deleteTimeSuggestion();
            });
        }

        // Confirmation modal time validation
        const confirmStartTime = document.getElementById('confirmRehearsalStartTime');
        const confirmEndTime = document.getElementById('confirmRehearsalEndTime');
        if (confirmStartTime && confirmEndTime) {
            const validateConfirmTimes = () => {
                if (confirmStartTime.value && confirmEndTime.value) {
                    const startDateTime = new Date(confirmStartTime.value);
                    const endDateTime = new Date(confirmEndTime.value);

                    if (endDateTime <= startDateTime) {
                        confirmEndTime.setCustomValidity('Endzeit muss nach Startzeit liegen');
                        confirmEndTime.reportValidity();
                    } else {
                        confirmEndTime.setCustomValidity('');
                    }
                }
            };

            confirmStartTime.addEventListener('change', validateConfirmTimes);
            confirmEndTime.addEventListener('change', validateConfirmTimes);
        }

        // Location conflict modal handlers
        const abortConfirmationBtn = document.getElementById('abortConfirmationBtn');
        if (abortConfirmationBtn) {
            abortConfirmationBtn.addEventListener('click', () => {
                UI.closeModal('locationConflictModal');

                // Check if we're in creation or confirmation mode
                if (window._pendingRehearsalCreation) {
                    UI.openModal('createRehearsalModal'); // Return to creation modal
                } else {
                    UI.openModal('confirmRehearsalModal'); // Return to confirmation modal
                }
            });
        }

        const proceedAnywayBtn = document.getElementById('proceedAnywayBtn');
        if (proceedAnywayBtn) {
            proceedAnywayBtn.addEventListener('click', async () => {
                // Check if we're in creation mode
                if (window._pendingRehearsalCreation) {
                    window._pendingRehearsalCreation(); // Execute stored proceed function
                    window._pendingRehearsalCreation = null; // Clear it
                    UI.closeModal('locationConflictModal');
                } else {
                    // Confirmation mode
                    await Rehearsals.confirmRehearsal(true); // Force confirm despite conflicts
                }
            });
        }

        // Modal close buttons
        document.querySelectorAll('.cancel').forEach(btn => {
            btn.addEventListener('click', async () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    // If closing event modal, restore deleted songs
                    if (modal.id === 'createEventModal' && this.deletedEventSongs.length > 0) {
                        // Wiederherstellen gelöschter Songs
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

        // Subscribe calendar button
        const subscribeCalendarBtn = document.getElementById('subscribeCalendarBtn');
        if (subscribeCalendarBtn) {
            subscribeCalendarBtn.addEventListener('click', () => {
                this.showCalendarSubscriptionModal();
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

        // Song form (Handler wird nur im DOMContentLoaded-Block registriert)

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

        // Add Own Member button (placeholder)
        const addOwnMemberBtn = document.getElementById('addOwnMemberBtn');
        if (addOwnMemberBtn) {
            addOwnMemberBtn.addEventListener('click', () => {
                UI.showToast('Diese Funktion wird in Kürze verfügbar sein', 'success');
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

        // Add User Button (Admin only) - using event delegation
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'addUserBtn') {
                // Reset form
                document.getElementById('addUserForm').reset();
                UI.openModal('addUserModal');
            }
        });

        // Add User Form (Admin only)
        const addUserForm = document.getElementById('addUserForm');
        if (addUserForm) {
            addUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    await this.handleAddUser();
                } catch (error) {
                    console.error('[addUserForm] Fehler beim Hinzufügen:', error);
                    UI.hideLoading();
                    UI.showToast('Fehler: ' + error.message, 'error');
                }
            });
        }

        // News Banner Buttons
        const newsBannerButton = document.getElementById('newsBannerButton');
        if (newsBannerButton) {
            newsBannerButton.addEventListener('click', () => {
                this.navigateTo('news');
                this.hideNewsBanner();
            });
        }

        const newsBannerClose = document.getElementById('newsBannerClose');
        if (newsBannerClose) {
            newsBannerClose.addEventListener('click', () => {
                this.hideNewsBanner();
                // Mark as dismissed in localStorage so it doesn't show again until next new news
                const user = Auth.getCurrentUser();
                if (user) {
                    localStorage.setItem(`newsBanner_dismissed_${user.id}`, Date.now().toString());
                }
            });
        }

        // Create Band Button (in Bands View)
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'createBandBtnView') {
                UI.openModal('createBandModal');
            }
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
        // Lade-Overlay wird nur noch in den jeweiligen Datenladefunktionen angezeigt
        try {
            console.log('[navigateTo] called with view:', view);
            const viewMap = {
                'dashboard': 'dashboardView',
                'bands': 'bandsView',
                'events': 'eventsView',
                'rehearsals': 'rehearsalsView',
                'statistics': 'statisticsView',
                'news': 'newsView',
                'probeorte': 'probeorteView',
                'tonstudio': 'probeorteView', // Redirect old tonstudio to probeorte
                'kalender': 'kalenderView',
                'musikpool': 'musikpoolView',
                'settings': 'settingsView'
            };

            const viewId = viewMap[view];

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
                    kalender: '#f43f5e', // rose
                    musikpool: '#0ea5e9' // cyan
                };
                const navColor = navActiveColorMap[view] || getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
                document.documentElement.style.setProperty('--nav-active-color', navColor);

                try {
                    UI.showView(viewId);
                } catch (uiErr) {
                    console.error('[navigateTo] UI.showView error:', uiErr);
                }

                // Update active navigation (both main items and subitems)
                document.querySelectorAll('.nav-item, .nav-subitem').forEach(item => {
                    if (item.dataset.view === view || (view === 'tonstudio' && item.dataset.view === 'probeorte')) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });

                // Update header submenu active state (underline) if present
                try {
                    document.querySelectorAll('.header-submenu-btn').forEach(btn => {
                        const v = btn.getAttribute('data-view');
                        if (v === view || (view === 'tonstudio' && v === 'probeorte')) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                } catch (err) {
                    // ignore if header submenu not present in DOM
                }

                // Recalculate underline widths in case layout changed
                try { this.updateHeaderUnderlineWidths(); } catch (e) { }

                // Render specific views
                if (view === 'bands') {
                    await Bands.renderBands();
                } else if (view === 'events') {
                    await Bands.populateBandSelects();
                    await Events.renderEvents();
                } else if (view === 'rehearsals') {
                    await Bands.populateBandSelects();
                    await Rehearsals.renderRehearsals();
                } else if (view === 'statistics') {
                    await Bands.populateBandSelects();
                    await Rehearsals.populateStatsSelect();
                } else if (view === 'news') {
                    await this.renderNewsView();

                    // Hide news banner when viewing news
                    this.hideNewsBanner();

                    // Show/hide create button based on admin or band leader/co-leader status
                    const createNewsBtn = document.getElementById('createNewsBtn');
                    if (createNewsBtn) {
                        const user = Auth.getCurrentUser();
                        let canCreate = Auth.isAdmin();
                        if (!canCreate && user) {
                            const userBands = await Storage.getUserBands(user.id);
                            canCreate = Array.isArray(userBands) && userBands.some(b => b.role === 'leader' || b.role === 'co-leader');
                        }
                        createNewsBtn.style.display = canCreate ? 'inline-flex' : 'none';
                    }

                    // Hide loading overlay after view/data is loaded (immer, egal ob admin oder nicht)
                    if (overlay && shouldShowLoading) {
                        overlay.style.opacity = '0';
                        setTimeout(() => overlay.style.display = 'none', 400);
                    }

                    // Update donate button visibility and link
                    this.updateDonateButton();
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
                        if (typeof Calendar !== 'undefined' && Calendar.loadCalendar) {
                            Calendar.loadCalendar('tonstudio');
                        } else {
                            console.error('Calendar object not found!');
                        }
                    }, 50);
                } else if (view === 'musikpool') {
                    // Musikerpool mit Timeout und garantiertem Ausblenden des Overlays laden
                    if (typeof Musikpool !== 'undefined' && Musikpool.loadGroupData) {
                        let overlayTimeout;
                        let overlay = document.getElementById('globalLoadingOverlay');
                        let shouldShowLoading = true;
                        let finished = false;
                        // Timeout nach 15 Sekunden
                        overlayTimeout = setTimeout(() => {
                            if (!finished && overlay && shouldShowLoading) {
                                overlay.style.opacity = '0';
                                setTimeout(() => overlay.style.display = 'none', 400);
                                UI.showToast('Musikerpool-Daten konnten nicht geladen werden (Timeout).', 'error');
                            }
                        }, 15000);
                        try {
                            await Musikpool.loadGroupData();
                        } catch (err) {
                            UI.showToast('Musikerpool-Daten konnten nicht geladen werden.', 'error');
                        } finally {
                            finished = true;
                            clearTimeout(overlayTimeout);
                            if (overlay && shouldShowLoading) {
                                overlay.style.opacity = '0';
                                setTimeout(() => overlay.style.display = 'none', 400);
                            }
                        }
                    } else {
                        console.error('Musikpool object not found!');
                    }
                } else if (view === 'kalender') {
                    // Load personal calendar when navigating to view
                    if (typeof PersonalCalendar !== 'undefined' && PersonalCalendar.loadPersonalCalendar) {
                        PersonalCalendar.loadPersonalCalendar();
                    } else {
                        console.error('[navigateTo] PersonalCalendar object not found!');
                    }
                } else if (view === 'settings') {
                    // Load settings view content
                    this.renderSettingsView();
                }
            } else {
                // Kein View gefunden
            }
        } catch (error) {
            console.error('[navigateTo] Fehler:', error);
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
        const rememberMe = arguments.length > 2 ? arguments[2] : false;

        try {
            await Auth.login(username, password, rememberMe);
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
            const instrument = document.getElementById('registerInstrument').value;
            await Auth.register(registrationCode, name, email, username, password, instrument);
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

    // Handle adding a new user (Admin only)
    async handleAddUser() {
        console.log('[handleAddUser] Starting...');
        if (!Auth.isAdmin()) {
            UI.showToast('Keine Berechtigung', 'error');
            return;
        }

        const name = document.getElementById('newUserName').value.trim();
        const email = document.getElementById('newUserEmail').value.trim();
        const username = document.getElementById('newUserUsername').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const isAdmin = document.getElementById('newUserIsAdmin').checked;

        console.log('[handleAddUser] Form values:', { name, email, username, passwordLength: password.length, isAdmin });

        if (!name || !email || !username || !password) {
            UI.showToast('Bitte fülle alle Felder aus', 'error');
            return;
        }

        if (password.length < 6) {
            UI.showToast('Passwort muss mindestens 6 Zeichen lang sein', 'error');
            return;
        }

        let loadingTimeout;
        try {
            UI.showLoading('Erstelle Benutzer...');
            loadingTimeout = setTimeout(() => {
                UI.hideLoading();
                UI.showToast('Timeout beim Erstellen des Benutzers. Bitte prüfe die Verbindung.', 'error');
            }, 15000);
            console.log('[handleAddUser] Loading shown, checking existing users...');

            // Check if username or email already exists
            const existingUsers = await Storage.getAll('users');
            console.log('[handleAddUser] Existing users count:', existingUsers.length);

            const usernameExists = existingUsers.some(u => u.username.toLowerCase() === username.toLowerCase());
            const emailExists = existingUsers.some(u => u.email.toLowerCase() === email.toLowerCase());

            if (usernameExists) {
                clearTimeout(loadingTimeout);
                UI.hideLoading();
                UI.showToast('Benutzername existiert bereits', 'error');
                return;
            }

            if (emailExists) {
                clearTimeout(loadingTimeout);
                UI.hideLoading();
                UI.showToast('E-Mail-Adresse existiert bereits', 'error');
                return;
            }

            console.log('[handleAddUser] Creating user via Auth.createUserByAdmin...');
            // Create user via Auth module (without registration code check)
            const userId = await Auth.createUserByAdmin(name, email, username, password, isAdmin);
            console.log('[handleAddUser] User created with ID:', userId);

            clearTimeout(loadingTimeout);
            UI.hideLoading();
            UI.showToast(`Benutzer "${name}" erfolgreich angelegt!`, 'success');
            UI.closeModal('addUserModal');
            UI.clearForm('addUserForm');

            // Refresh users list
            await this.renderUsersList();
            console.log('[handleAddUser] Done!');
        } catch (error) {
            clearTimeout(loadingTimeout);
            console.error('[handleAddUser] Error:', error);
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
        // Nur laden, wenn noch keine News im Speicher
        if (this.newsItems && Array.isArray(this.newsItems) && this.newsItems.length > 0) {
            this.renderNewsList(this.newsItems);
            return;
        }
        // Show loading overlay if present
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
        }
        console.log('[renderNewsView] Starting to render news...');
        const newsItems = await Storage.getAllNews();
        this.newsItems = newsItems;
        this.renderNewsList(newsItems);
    },

    renderNewsList(newsItems) {
        const overlay = document.getElementById('globalLoadingOverlay');
        const container = document.getElementById('newsContainer');
        const isAdmin = Auth.isAdmin();
        const currentUser = Auth.getCurrentUser();

        if (!newsItems || newsItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📰</div>
                    <p>Noch keine News oder Updates vorhanden.</p>
                    <p>Hier wirst du auf dem laufenden gehalten.</p>
                </div>
            `;
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 400);
            }
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
        // Overlay ausblenden, wenn alles fertig
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 400);
        }
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

    // Check for unread news and show banner
    async checkAndShowNewsBanner() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const unreadCount = await Storage.getUnreadNewsCountForUser(user.id);
        if (unreadCount === 0) return;

        // Check if user has dismissed the banner recently (within last 24 hours)
        const dismissedTime = localStorage.getItem(`newsBanner_dismissed_${user.id}`);
        if (dismissedTime) {
            const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
            if (hoursSinceDismissed < 24) {
                return; // Don't show if dismissed within last 24 hours
            }
        }

        // Get the latest unread news
        const allNews = await Storage.getAllNews();
        const unreadNews = allNews.filter(n => !n.readBy || !n.readBy.includes(user.id));

        if (unreadNews.length === 0) return;

        // Show banner with count
        const banner = document.getElementById('newsBanner');
        const message = document.getElementById('newsBannerMessage');

        if (banner && message) {
            const newsText = unreadCount === 1
                ? '1 neue News verfügbar'
                : `${unreadCount} neue News verfügbar`;
            message.textContent = newsText;
            banner.style.display = 'block';
        }
    },

    hideNewsBanner() {
        const banner = document.getElementById('newsBanner');
        if (banner) {
            banner.style.display = 'none';
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
                // Nach dem Hinzufügen eines Songs zur Band-Setlist sofort neu rendern
                if (bandId) {
                    await this.renderBandSongs(bandId);
                }
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

                // Hide loading overlay after all data/UI is ready
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.style.display = 'none', 400);
                }
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
                    <div>
                        <strong>${idx + 1}. ${this.escapeHtml(s.title)}</strong>
                        ${s.artist ? ` — <span>${this.escapeHtml(s.artist)}</span>` : ''}
                        ${s.bpm ? ` | <span>${this.escapeHtml(s.bpm)} BPM</span>` : ''}
                        ${s.key ? ` | <span>${this.escapeHtml(s.key)}</span>` : ''}
                        ${s.leadVocal ? ` | <span>Lead: ${this.escapeHtml(s.leadVocal)}</span>` : ''}
                        ${s.ccli ? ` | <span>CCLI: ${this.escapeHtml(s.ccli)}</span>` : ''}
                    </div>
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
        // Show landing page instead of modal
        const landingPage = document.getElementById('landingPage');
        const mainApp = document.getElementById('mainApp');

        if (landingPage) landingPage.classList.add('active');
        if (mainApp) mainApp.style.display = 'none';

        document.getElementById('app').style.display = 'none';
    },

    // Show main application
    async showApp() {
        // Hide landing page and show main app
        const landingPage = document.getElementById('landingPage');
        const mainApp = document.getElementById('mainApp');

        if (landingPage) landingPage.classList.remove('active');
        if (mainApp) mainApp.style.display = 'block';

        document.getElementById('app').style.display = 'flex';

        const user = Auth.getCurrentUser();
        document.getElementById('currentUserName').textContent = user.username || user.name;

        // Render header profile image
        this.renderProfileImageHeader(user);

        // Theme toggle header initialisieren (falls noch nicht gesetzt)
        const themeToggleHeader = document.getElementById('themeToggleHeader');
        const themeToggleIcon = document.getElementById('themeToggleIcon');
        if (themeToggleHeader && themeToggleIcon && !themeToggleHeader._themeInit) {
            function updateThemeIcon() {
                const isDark = document.documentElement.classList.contains('theme-dark');
                themeToggleIcon.textContent = isDark ? '☀️' : '🌙';
                themeToggleHeader.title = isDark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren';
                // Update the logout icon depending on theme
                try {
                    const logoutImg = document.querySelector('#logoutBtn img.icon-img') || document.querySelector('#logoutBtn img');
                    if (logoutImg) {
                        // Use a dark-mode specific asset when in dark theme, otherwise the white/light asset
                        logoutImg.src = isDark ? 'images/logout darkmode.jpg' : 'images/logout whitemode.jpg';
                        // Ensure alt text for accessibility
                        logoutImg.alt = isDark ? 'Abmelden (dark)' : 'Abmelden (light)';
                    }
                } catch (e) {
                    // ignore if element not present yet
                }
            }
            const savedTheme = localStorage.getItem('theme');
            const isDark = savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.classList.toggle('theme-dark', isDark);
            updateThemeIcon();
            themeToggleHeader.addEventListener('click', () => {
                const dark = !document.documentElement.classList.contains('theme-dark');
                document.documentElement.classList.toggle('theme-dark', dark);
                localStorage.setItem('theme', dark ? 'dark' : 'light');
                updateThemeIcon();
            });
            themeToggleHeader._themeInit = true;
        }

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
                const userBands = await Storage.getUserBands(user.id);
                canCreate = Array.isArray(userBands) && userBands.some(b => b.role === 'leader' || b.role === 'co-leader');
            }
            createNewsBtnGlobal.style.display = canCreate ? 'inline-flex' : 'none';
        }
        // Update unread news badge
        await this.updateNewsNavBadge();

        // Check for unread news and show banner
        await this.checkAndShowNewsBanner();

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

        // Hide/Show Rehearsals nav item. Events should always be visible.
        const eventsNav = document.querySelector('.nav-item[data-view="events"]');
        const rehearsalsNav = document.querySelector('.nav-item[data-view="rehearsals"]');

        if (eventsNav) eventsNav.style.display = 'flex';
        if (rehearsalsNav) rehearsalsNav.style.display = hasBands ? 'flex' : 'none';
    },

    // Open absence modal and render current user's absences
    async openAbsenceModal() {
        // Render existing absences
        await this.renderUserAbsences();
        UI.openModal('absenceModal');
    },

    // Open settings modal
    // Render Settings View
    async renderSettingsView() {
        const container = document.getElementById('settingsViewContent');
        if (!container) return;

        const user = Auth.getCurrentUser();
        const isAdmin = Auth.isAdmin();

        // Clone the settings modal content
        const modalBody = document.querySelector('#settingsModal .modal-body');
        if (modalBody) {
            container.innerHTML = modalBody.innerHTML;

            // Re-initialize all event listeners for the cloned content
            await this.initializeSettingsViewListeners(isAdmin);
        }
    },

    async initializeSettingsViewListeners(isAdmin) {
        const user = Auth.getCurrentUser();
        const root = document.getElementById('settingsViewContent');
        if (!root) return;

        // Re-attach event listeners to settings tab buttons (scoped)
        root.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchSettingsTab(tabName);
            });
        });

        // Show/Hide tabs based on role
        const locationsTab = root.querySelector('#settingsTabLocations');
        const bandsTab = root.querySelector('#settingsTabBands');
        const usersTab = root.querySelector('#settingsTabUsers');

        if (locationsTab) locationsTab.style.display = isAdmin ? 'block' : 'none';
        if (bandsTab) bandsTab.style.display = isAdmin ? 'block' : 'none';
        if (usersTab) usersTab.style.display = isAdmin ? 'block' : 'none';

        // Pre-fill profile form (scoped)
        const profileUsername = root.querySelector('#profileUsername');
        const profileEmail = root.querySelector('#profileEmail');
        const profileInstrument = root.querySelector('#profileInstrument');
        const profilePassword = root.querySelector('#profilePassword');
        const profilePasswordConfirm = root.querySelector('#profilePasswordConfirm');
        const profilePasswordConfirmGroup = root.querySelector('#profilePasswordConfirmGroup');

        if (profileUsername) profileUsername.value = user.username || '';
        if (profileEmail) profileEmail.value = user.email || '';
        if (profileInstrument) profileInstrument.value = user.instrument || '';
        if (profilePassword) profilePassword.value = '';

        // Password confirmation field toggle
        if (profilePassword && profilePasswordConfirmGroup) {
            profilePassword.addEventListener('input', () => {
                if (profilePassword.value.trim()) {
                    profilePasswordConfirmGroup.style.display = 'block';
                    if (profilePasswordConfirm) profilePasswordConfirm.required = true;
                } else {
                    profilePasswordConfirmGroup.style.display = 'none';
                    if (profilePasswordConfirm) profilePasswordConfirm.required = false;
                    if (profilePasswordConfirm) profilePasswordConfirm.value = '';
                }
            });
        }

        // Default to profile tab
        this.switchSettingsTab('profile');

        // Admin-only: show tutorial/test button in profile settings (scoped)
        try {
            const adminTutorialSection = root.querySelector('#adminTutorialSection');
            const adminTutorialBtn = root.querySelector('#adminShowTutorialBtn');
            if (adminTutorialSection) adminTutorialSection.style.display = isAdmin ? 'block' : 'none';
            if (adminTutorialBtn) {
                adminTutorialBtn.style.display = isAdmin ? 'inline-block' : 'none';
                adminTutorialBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Start the interactive tutorial/tour
                    try {
                        this.startTutorial();
                        UI.showToast('Tutorial wird gestartet', 'info');
                    } catch (err) {
                        console.error('Fehler beim Starten des Tutorials:', err);
                        UI.showToast('Fehler beim Starten des Tutorials', 'error');
                    }
                });
            }
        } catch (err) {
            console.error('Error initializing admin tutorial button:', err);
        }

        // Donate link (scoped)
        const donateLinkInput = root.querySelector('#donateLink');
        const saveDonateBtn = root.querySelector('#saveDonateLink');
        if (donateLinkInput && saveDonateBtn) {
            // Lade gespeicherten Link aus Supabase
            const savedLink = await Storage.getSetting('donateLink');
            if (savedLink) {
                donateLinkInput.value = savedLink;
            }
            saveDonateBtn.addEventListener('click', async () => {
                const link = donateLinkInput.value.trim();
                try {
                    await Storage.setSetting('donateLink', link);
                    if (link) {
                        UI.showToast('Spenden-Link gespeichert!', 'success');
                    } else {
                        UI.showToast('Spenden-Link entfernt', 'info');
                    }
                    await this.updateDonateButton();
                } catch (error) {
                    console.error('Error saving donate link:', error);
                    UI.showToast('Fehler beim Speichern: ' + error.message, 'error');
                }
            });
        }

        // Profile form in settings view (scoped)
        const updateProfileForm = root.querySelector('#updateProfileForm');
        if (updateProfileForm) {
            updateProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const username = (root.querySelector('#profileUsername') || {}).value;
                const email = (root.querySelector('#profileEmail') || {}).value;
                const instrument = (root.querySelector('#profileInstrument') || {}).value;
                const password = (root.querySelector('#profilePassword') || {}).value;
                const passwordConfirm = (root.querySelector('#profilePasswordConfirm') || {}).value;

                // Validate password confirmation
                if (password && password.trim() !== '') {
                    if (password !== passwordConfirm) {
                        UI.showToast('Passwörter stimmen nicht überein', 'error');
                        return;
                    }
                }

                UI.showLoading('Profil wird aktualisiert...');

                try {
                    // Update in users table
                    const updates = {
                        username,
                        email,
                        instrument
                    };

                    // Handle Image Upload (scoped to view)
                    const imageInput = root.querySelector('#profileImageInput');
                    if (imageInput && imageInput.files && imageInput.files[0]) {
                        let file = imageInput.files[0];
                        // Compress with timeout safety
                        try {
                            // Race compression with a 5s timeout
                            const compressionPromise = this.compressImage(file);
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Bildkomprimierung Zeitüberschreitung')), 5000)
                            );
                            file = await Promise.race([compressionPromise, timeoutPromise]);
                        } catch (cErr) {
                            console.warn('Compression failed or timed out, using original file', cErr);
                        }

                        const fileExt = file.name.split('.').pop();
                        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                        const filePath = `${fileName}`;

                        const sb = SupabaseClient.getClient();

                        const { error: uploadError } = await sb.storage
                            .from('profile-images')
                            .upload(filePath, file, {
                                upsert: true
                            });

                        if (uploadError) {
                            throw new Error('Fehler beim Bilder-Upload: ' + uploadError.message);
                        }

                        const { data } = sb.storage
                            .from('profile-images')
                            .getPublicUrl(filePath);

                        if (data && data.publicUrl) {
                            updates.profile_image_url = data.publicUrl;
                        }
                    }

                    console.log('Updating user profile with:', updates);

                    if (password && password.trim() !== '') {
                        updates.password = password;
                    }

                    const updateResult = await Storage.updateUser(user.id, updates);
                    console.log('Update result:', updateResult);

                    // Update email in Supabase Auth if changed
                    if (email !== user.email) {
                        const sb = SupabaseClient.getClient();
                        const { error } = await sb.auth.updateUser({ email });
                        if (error) {
                            console.error('Error updating auth email:', error);
                            UI.showToast('Hinweis: E-Mail für Login konnte nicht geändert werden.', 'warning');
                        }
                    }

                    // Update password in Supabase Auth if provided
                    if (password && password.trim() !== '') {
                        const sb = SupabaseClient.getClient();
                        const { error } = await sb.auth.updateUser({ password });
                        if (error) {
                            console.error('Error updating password:', error);
                        }
                    }

                    // Update current session user data
                    await Auth.updateCurrentUser();
                    const updatedUser = Auth.getCurrentUser();
                    console.log('Updated user:', updatedUser);

                    // Update header
                    const currentUserElem = document.getElementById('currentUserName');
                    if (currentUserElem) currentUserElem.textContent = updatedUser.username;
                    this.renderProfileImageHeader(updatedUser);

                    // Clear password field (scoped to settings view)
                    const pwdEl = root.querySelector('#profilePassword');
                    const pwdConfirmEl = root.querySelector('#profilePasswordConfirm');
                    const pwdConfirmGroupEl = root.querySelector('#profilePasswordConfirmGroup');
                    if (pwdEl) pwdEl.value = '';
                    if (pwdConfirmEl) pwdConfirmEl.value = '';
                    if (pwdConfirmGroupEl) pwdConfirmGroupEl.style.display = 'none';

                    // Reload form with updated values (scoped)
                    const usernameEl = root.querySelector('#profileUsername');
                    const emailEl = root.querySelector('#profileEmail');
                    const instrumentEl = root.querySelector('#profileInstrument');
                    if (usernameEl) usernameEl.value = updatedUser.username;
                    if (emailEl) emailEl.value = updatedUser.email;
                    if (instrumentEl) instrumentEl.value = updatedUser.instrument || '';

                    UI.showToast('Profil erfolgreich aktualisiert!', 'success');

                    // Render updated profile image
                    this.renderProfileImageSettings(updatedUser);
                } catch (error) {
                    console.error('Error updating profile:', error);
                    UI.showToast('Fehler beim Aktualisieren: ' + error.message, 'error');
                } finally {
                    UI.hideLoading();
                }
            });
        }

        if (isAdmin) {
            this.renderLocationsList();
            this.renderAllBandsList();
        }

        // Render profile image initially
        this.renderProfileImageSettings(user);

        // Delete profile image button (scoped)
        const deleteImgBtn = root.querySelector('#deleteProfileImageBtn');
        if (deleteImgBtn) {
            // Clone to remove old listeners
            const newBtn = deleteImgBtn.cloneNode(true);
            deleteImgBtn.parentNode.replaceChild(newBtn, deleteImgBtn);

            newBtn.addEventListener('click', async () => {
                if (confirm('Möchtest du dein Profilbild wirklich entfernen?')) {
                    try {
                        UI.showLoading('Profilbild wird entfernt...');

                        // Try to remove file from storage if URL exists
                        if (user.profile_image_url) {
                            try {
                                const urlPart = user.profile_image_url.split('/profile-images/')[1];
                                if (urlPart) {
                                    const sb = SupabaseClient.getClient();
                                    await sb.storage.from('profile-images').remove([urlPart]);
                                }
                            } catch (e) {
                                console.warn('Could not remove file from storage:', e);
                            }
                        }

                        await Storage.updateUser(user.id, { profile_image_url: null });
                        await Auth.updateCurrentUser();
                        const updatedUser = Auth.getCurrentUser();
                        this.renderProfileImageSettings(updatedUser);
                        this.renderProfileImageHeader(updatedUser);

                        const imageInput = root.querySelector('#profileImageInput');
                        if (imageInput) imageInput.value = '';

                        UI.hideLoading();
                        UI.showToast('Profilbild entfernt', 'success');
                    } catch (err) {
                        UI.hideLoading();
                        console.error(err);
                        UI.showToast('Fehler beim Entfernen: ' + err.message, 'error');
                    }
                }
            });
        }

        // Setup absences form in settings
        const absenceFormSettings = document.getElementById('createAbsenceFormSettings');
        if (absenceFormSettings) {
            absenceFormSettings.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateAbsenceFromSettings();
            });
        }

        // Render absences list in settings
        this.renderAbsencesListSettings();
    },

    async handleCreateAbsenceFromSettings() {
        const startInput = document.getElementById('absenceStartSettings');
        const endInput = document.getElementById('absenceEndSettings');
        const reasonInput = document.getElementById('absenceReasonSettings');
        const editIdInput = document.getElementById('editAbsenceIdSettings');

        const start = startInput.value;
        const end = endInput.value;
        const reason = reasonInput.value.trim();
        const editId = editIdInput.value;

        const user = Auth.getCurrentUser();
        if (!user) return;

        if (editId) {
            // Update existing absence
            await Storage.update('absences', editId, {
                startDate: start,
                endDate: end,
                reason
            });
            UI.showToast('Abwesenheit aktualisiert', 'success');
        } else {
            // Create new absence
            await Storage.createAbsence(user.id, start, end, reason);
            UI.showToast('Abwesenheit eingetragen', 'success');
        }

        // Reset form
        document.getElementById('createAbsenceFormSettings').reset();
        editIdInput.value = '';
        document.getElementById('saveAbsenceBtnSettings').textContent = 'Abwesenheit hinzufügen';
        document.getElementById('cancelEditAbsenceBtnSettings').style.display = 'none';

        // Refresh list
        this.renderAbsencesListSettings();
    },

    async renderAbsencesListSettings() {
        const container = document.getElementById('absencesListSettings');
        if (!container) return;

        const user = Auth.getCurrentUser();
        if (!user) return;

        const absences = await Storage.getUserAbsences(user.id) || [];

        if (absences.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Abwesenheiten eingetragen.</p>';
            return;
        }

        container.innerHTML = absences.map(absence => `
            <div class="absence-item" data-absence-id="${absence.id}">
                <div class="absence-info">
                        <strong>${UI.formatDateOnly(absence.startDate)} - ${UI.formatDateOnly(absence.endDate)}</strong>
                    ${absence.reason ? `<p>${Bands.escapeHtml(absence.reason)}</p>` : ''}
                </div>
                <div class="absence-actions">
                    <button class="btn-icon edit-absence-settings" data-absence-id="${absence.id}" title="Bearbeiten">✏️</button>
                    <button class="btn-icon delete-absence-settings" data-absence-id="${absence.id}" title="Löschen">🗑️</button>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        container.querySelectorAll('.edit-absence-settings').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.absenceId;
                this.editAbsenceSettings(id);
            });
        });

        container.querySelectorAll('.delete-absence-settings').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.absenceId;
                await this.deleteAbsenceSettings(id);
            });
        });
    },

    async editAbsenceSettings(absenceId) {
        const absence = await Storage.getById('absences', absenceId);
        if (!absence) return;

        document.getElementById('absenceStartSettings').value = absence.start;
        document.getElementById('absenceEndSettings').value = absence.end;
        document.getElementById('absenceReasonSettings').value = absence.reason || '';
        document.getElementById('editAbsenceIdSettings').value = absenceId;
        document.getElementById('saveAbsenceBtnSettings').textContent = 'Änderungen speichern';
        document.getElementById('cancelEditAbsenceBtnSettings').style.display = 'inline-block';

        const cancelBtn = document.getElementById('cancelEditAbsenceBtnSettings');
        cancelBtn.onclick = () => {
            document.getElementById('createAbsenceFormSettings').reset();
            document.getElementById('editAbsenceIdSettings').value = '';
            document.getElementById('saveAbsenceBtnSettings').textContent = 'Abwesenheit hinzufügen';
            cancelBtn.style.display = 'none';
        };
    },

    async deleteAbsenceSettings(absenceId) {
        const confirmed = await UI.confirmDelete('Möchtest du diese Abwesenheit wirklich löschen?');
        if (confirmed) {
            await Storage.deleteAbsence(absenceId);
            UI.showToast('Abwesenheit gelöscht', 'success');
            this.renderAbsencesListSettings();
        }
    },

    showCalendarSubscriptionModal() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        // Generate webcal URL (this would need a backend endpoint to generate the iCal feed)
        const webcalUrl = `webcal://your-domain.com/api/calendar/${user.id}`;
        const httpUrl = `https://your-domain.com/api/calendar/${user.id}`;

        UI.showToast(`
            <div>
                <strong>Kalender abonnieren</strong><br>
                <p style="margin-top: 0.5rem; font-size: 0.9em;">
                    Um deinen persönlichen Kalender zu abonnieren, benötigst du eine iCal-URL.<br>
                    Diese Funktion erfordert ein Backend zur Generierung des Kalender-Feeds.
                </p>
                <p style="margin-top: 0.5rem; font-size: 0.9em;">
                    <strong>In Apple Kalender:</strong><br>
                    Datei → Neues Kalender-Abo → URL eingeben
                </p>
                <p style="margin-top: 0.5rem; font-size: 0.9em;">
                    <strong>In Google Calendar:</strong><br>
                    Einstellungen → Kalender hinzufügen → Über URL
                </p>
            </div>
        `, 'info', 8000);
    },

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

        // Donate link setup
        const donateLinkInput = document.getElementById('donateLink');
        const saveDonateBtn = document.getElementById('saveDonateLink');
        if (donateLinkInput && saveDonateBtn) {
            // Load saved donate link from Supabase
            const savedLink = await Storage.getSetting('donateLink');
            if (savedLink) {
                donateLinkInput.value = savedLink;
            }

            // Save donate link
            const newSaveBtn = saveDonateBtn.cloneNode(true);
            saveDonateBtn.parentNode.replaceChild(newSaveBtn, saveDonateBtn);
            newSaveBtn.addEventListener('click', async () => {
                const link = donateLinkInput.value.trim();
                try {
                    await Storage.setSetting('donateLink', link);
                    if (link) {
                        UI.showToast('Spenden-Link gespeichert!', 'success');
                    } else {
                        UI.showToast('Spenden-Link entfernt', 'info');
                    }
                    // Update donate button visibility in news view
                    await this.updateDonateButton();
                } catch (error) {
                    console.error('Error saving donate link:', error);
                    UI.showToast('Fehler beim Speichern: ' + error.message, 'error');
                }
            });
        }

        if (isAdmin) {
            await this.renderLocationsList();
            await this.renderAllBandsList();
            await this.renderUsersList();
        }

        // Render profile image for all users
        this.renderProfileImageSettings(user);
    },

    // Render profile image in settings
    renderProfileImageSettings(user) {
        const containers = document.querySelectorAll('#profileImageSettingsContainer');
        containers.forEach(container => {
            container.innerHTML = '';

            if (user.profile_image_url) {
                const img = document.createElement('img');
                img.src = user.profile_image_url;
                img.alt = 'Profilbild';
                img.style.width = '100px';
                img.style.height = '100px';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                img.style.border = '2px solid var(--color-border)';
                container.appendChild(img);
            } else {
                // Render initials
                const initials = UI.getUserInitials(user.name || user.username);
                const placeholder = document.createElement('div');
                placeholder.className = 'profile-initials-large';
                placeholder.style.width = '100px';
                placeholder.style.height = '100px';
                placeholder.style.borderRadius = '50%';
                placeholder.style.backgroundColor = 'var(--color-primary)';
                placeholder.style.color = '#fff';
                placeholder.style.display = 'flex';
                placeholder.style.alignItems = 'center';
                placeholder.style.justifyContent = 'center';
                placeholder.style.fontSize = '2.5rem';
                placeholder.style.fontWeight = 'bold';
                placeholder.textContent = initials;
                container.appendChild(placeholder);
            }
        });
    },

    // Render profile image in header
    renderProfileImageHeader(user) {
        const container = document.getElementById('headerProfileImage');
        if (!container) return;

        container.innerHTML = '';
        container.style.display = 'inline-block';

        if (user.profile_image_url) {
            const img = document.createElement('img');
            img.src = user.profile_image_url;
            img.alt = 'Profilbild';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            container.appendChild(img);
        } else {
            // Render initials
            const initials = UI.getUserInitials(user.name || user.username);
            container.style.backgroundColor = '#e5e7eb'; // Default light
            container.style.color = '#444';
            container.textContent = initials;

            // Adjust styles for text
            container.style.lineHeight = '36px';
            container.style.fontSize = '1.1em';
            container.style.fontWeight = '600';
            container.style.textAlign = 'center';
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
                    // Refresh band cards in "Meine Bands" view
                    if (typeof Bands.renderBands === 'function') {
                        await Bands.renderBands();
                    }
                    // Always update dashboard after band deletion
                    if (typeof App.updateDashboard === 'function') {
                        await App.updateDashboard();
                    }
                    // Show/hide 'Neuer Auftritt' and 'Neuer Probetermin' buttons
                    const user = Auth.getCurrentUser();
                    let userBands = [];
                    if (user) {
                        userBands = await Storage.getUserBands(user.id);
                    }
                    const createEventBtn = document.getElementById('createEventBtn');
                    if (createEventBtn) {
                        createEventBtn.style.display = (userBands && userBands.length > 0) ? '' : 'none';
                    }
                    const createRehearsalBtn = document.getElementById('createRehearsalBtn');
                    if (createRehearsalBtn) {
                        createRehearsalBtn.style.display = (userBands && userBands.length > 0) ? '' : 'none';
                    }
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
            // userBands is an array of band objects with .name, .role, .color
            const currentUser = Auth.getCurrentUser();
            const isCurrentUser = currentUser ? currentUser.id === user.id : false;

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
                    ${userBands.length > 0 ? `
                        <div class="user-bands-list">
                            <h5>Bands (${userBands.length})</h5>
                            <div class="user-band-tags">
                                ${userBands.map(band => `
                                    <span class="user-band-tag" style="border-left: 3px solid ${band.color || '#6366f1'}">
                                        ${Bands.escapeHtml(band.name)}
                                        <span class="role-badge role-${band.role}">${UI.getRoleDisplayName(band.role)}</span>
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

    // Helper: Compress image if larger than 100KB
    async compressImage(file) {
        const MAX_SIZE = 100 * 1024; // 100KB
        if (file.size <= MAX_SIZE) return file;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimensions
                const MAX_DIMENSION = 1200;
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width > height) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    } else {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Reduce quality
                let quality = 0.9;
                const tryCompress = () => {
                    canvas.toBlob(blob => {
                        if (!blob) {
                            reject(new Error('Compression failed'));
                            return;
                        }
                        if (blob.size <= MAX_SIZE || quality <= 0.1) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            quality -= 0.1;
                            tryCompress();
                        }
                    }, 'image/jpeg', quality);
                };
                tryCompress();
            };
            img.onerror = (err) => reject(err);
        });
    },

    // Handle profile update
    async handleUpdateProfile() {
        const username = document.getElementById('profileUsername').value;
        const email = document.getElementById('profileEmail').value;
        const instrument = document.getElementById('profileInstrument').value;
        const password = document.getElementById('profilePassword').value;
        const imageInput = document.getElementById('profileImageInput');

        const user = Auth.getCurrentUser();
        if (!user) return;

        UI.showLoading('Profil wird aktualisiert...');

        try {
            // Update in users table
            const updates = {
                username,
                email,
                instrument
            };

            // Handle Image Upload
            if (imageInput && imageInput.files && imageInput.files[0]) {
                let file = imageInput.files[0];

                // Compress if needed with timeout
                try {
                    const compressionPromise = this.compressImage(file);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Bildkomprimierung Zeitüberschreitung')), 5000)
                    );
                    file = await Promise.race([compressionPromise, timeoutPromise]);
                } catch (cErr) {
                    console.warn('Image compression failed or timed out, trying original file', cErr);
                }

                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const sb = SupabaseClient.getClient();

                const { error: uploadError } = await sb.storage
                    .from('profile-images')
                    .upload(filePath, file, {
                        upsert: true
                    });

                if (uploadError) {
                    throw new Error('Fehler beim Bilder-Upload: ' + uploadError.message);
                }

                const { data } = sb.storage
                    .from('profile-images')
                    .getPublicUrl(filePath);

                if (data && data.publicUrl) {
                    updates.profile_image_url = data.publicUrl;
                }
            }

            // Update password if provided
            if (password && password.trim() !== '') {
                updates.password = password;
            }

            // Update in DB
            await Storage.updateUser(user.id, updates);

            // Update email in Supabase Auth if changed
            if (email !== user.email) {
                const sb = SupabaseClient.getClient();
                const { error } = await sb.auth.updateUser({ email });
                if (error) {
                    console.error('Error updating auth email:', error);
                    UI.showToast('E-Mail aktualisiert, aber Login-Email bleibt alt (Auth-Fehler)', 'warning');
                }
            }

            // Update password in Supabase Auth if provided
            if (password && password.trim() !== '') {
                const sb = SupabaseClient.getClient();
                const { error } = await sb.auth.updateUser({ password });
                if (error) {
                    console.error('Error updating password:', error);
                }
            }

            // Update current session user data
            await Auth.updateCurrentUser();
            const updatedUser = Auth.getCurrentUser();

            // Update header
            document.getElementById('currentUserName').textContent = updatedUser.username;
            this.renderProfileImageHeader(updatedUser);

            // Clear password field after successful update
            document.getElementById('profilePassword').value = '';

            // Update inputs
            document.getElementById('profileUsername').value = updatedUser.username;
            document.getElementById('profileEmail').value = updatedUser.email;
            document.getElementById('profileInstrument').value = updatedUser.instrument || '';

            UI.showToast('Profil erfolgreich aktualisiert', 'success');

            // Refresh settings view to show updated values if open
            // but handleUpdateProfile is often used from modal which might not be settings view
            // If this is used, we might want to also re-render settings list
            if (document.getElementById('settingsView').classList.contains('active')) {
                await this.renderSettingsView();
            }

        } catch (error) {
            console.error('Error updating profile:', error);
            UI.showToast('Fehler beim Aktualisieren: ' + error.message, 'error');
        } finally {
            UI.hideLoading();
        }
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

    // Update dashboard
    async updateDashboard() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bands = await Storage.getUserBands(user.id);
        document.getElementById('bandCount').textContent = bands.length;
        // Make dashboard cards clickable for navigation
        const dashboardCards = document.querySelectorAll('.dashboard-card');
        if (dashboardCards.length >= 4) {
            // Meine Bands
            dashboardCards[0].style.cursor = 'pointer';
            dashboardCards[0].onclick = () => this.navigateTo('bands');
            // Nächste Auftritte
            dashboardCards[1].style.cursor = 'pointer';
            dashboardCards[1].onclick = () => this.navigateTo('events');
            // Offene Abstimmungen
            dashboardCards[2].style.cursor = 'pointer';
            dashboardCards[2].onclick = () => this.navigateTo('rehearsals');
            // Geplante Proben
            dashboardCards[3].style.cursor = 'pointer';
            dashboardCards[3].onclick = () => this.navigateTo('rehearsals');
        }


        // --- Fix: Upcoming Events Count ---
        const events = (await Storage.getUserEvents(user.id)) || [];
        const now = new Date();
        const upcomingEvents = events.filter(e => new Date(e.date) >= now);
        document.getElementById('upcomingEvents').textContent = upcomingEvents.length;

        // Pending votes logic (unchanged)
        const rehearsals = (await Storage.getUserRehearsals(user.id)) || [];
        const pendingRehearsals = rehearsals.filter(r => r.status === 'pending');
        let openPollsCount = 0;
        const nowTs = Date.now();
        for (const rehearsal of pendingRehearsals) {
            // Prüfe, ob mindestens ein Vorschlag noch offen ist (Endzeit in der Zukunft)
            const hasOpenProposal = rehearsal.proposedDates && rehearsal.proposedDates.some(p => {
                // Endzeit kann je nach Datenmodell unterschiedlich heißen
                // Versuche endTime, ansonsten fallback auf startTime + 2h
                let endTs = null;
                if (p.endTime) {
                    endTs = new Date(p.endTime).getTime();
                } else if (p.startTime) {
                    endTs = new Date(p.startTime).getTime() + 2 * 60 * 60 * 1000; // 2h default
                }
                return endTs && endTs > nowTs;
            });
        }
        document.getElementById('pendingVotes').textContent = openPollsCount;

        // Confirmed rehearsals logic (unchanged)
        const confirmedRehearsals = rehearsals.filter(r => r.status === 'confirmed');
        document.getElementById('confirmedRehearsals').textContent = confirmedRehearsals.length;

        // Dashboard Sections Drag & Drop
        const dashboardSectionsContainer = document.querySelector('.dashboard-sections');
        if (dashboardSectionsContainer) {
            const sectionIds = [
                'dashboardNewsSection',
                'dashboardQuickAccessSection',
                'dashboardCalendarSection',
                'dashboardActivitySection'
            ];
            // Reihenfolge aus localStorage holen
            let order = [];
            try {
                order = JSON.parse(localStorage.getItem('dashboardSectionOrder') || 'null');
            } catch { }
            if (!Array.isArray(order) || order.length !== sectionIds.length) {
                order = sectionIds;
            }
            // Sortiere die Sections nach gespeicherter Reihenfolge
            order.forEach(id => {
                const el = document.getElementById(id);
                if (el) dashboardSectionsContainer.appendChild(el);
            });
            // Drag & Drop Setup
            sectionIds.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.setAttribute('draggable', 'true');
                el.ondragstart = (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', id);
                    el.classList.add('dragging');
                };
                el.ondragend = () => {
                    el.classList.remove('dragging');
                    el.classList.remove('drag-over');
                };
                el.ondragover = (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    el.classList.add('drag-over');
                };
                el.ondragleave = (e) => {
                    el.classList.remove('drag-over');
                };
                el.ondrop = (e) => {
                    e.preventDefault();
                    el.classList.remove('drag-over');
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (!draggedId || draggedId === id) return;
                    const draggedEl = document.getElementById(draggedId);
                    if (draggedEl) {
                        dashboardSectionsContainer.insertBefore(draggedEl, el);
                        // Neue Reihenfolge speichern
                        const newOrder = Array.from(dashboardSectionsContainer.children).map(child => child.id);
                        localStorage.setItem('dashboardSectionOrder', JSON.stringify(newOrder));
                    }
                };
            });
        }
        await this.renderUpcomingList();
        // Populate Letzte News
        const newsSection = document.getElementById('dashboardNewsList');
        if (newsSection) {
            const news = await Storage.getAllNews();
            if (news.length === 0) {
                newsSection.innerHTML = '<div class="empty-state"><div class="empty-icon">📰</div><p>Keine News vorhanden.</p></div>';
            } else {
                // Render each news item with a clear heading (icon removed) and make it clickable
                newsSection.innerHTML = news.slice(0, 3).map(n => `
                    <div class="dashboard-news-item clickable" data-id="${n.id}">
                        <div class="news-heading"><strong>📰 News</strong></div>
                        <div class="news-title">${Bands.escapeHtml(n.title)}</div>
                        <div class="news-date">${UI.formatDateShort(n.createdAt)}</div>
                        <div class="news-content">${Bands.escapeHtml(n.content).slice(0, 80)}${n.content.length > 80 ? '…' : ''}</div>
                    </div>
                `).join('');

                // Attach click handlers to navigate to news view and mark the item as read
                const self = this;
                newsSection.querySelectorAll('.dashboard-news-item.clickable').forEach(item => {
                    item.addEventListener('click', async (e) => {
                        const id = item.dataset.id;
                        const user = Auth.getCurrentUser();
                        if (user && id) {
                            try { await Storage.markNewsRead(id, user.id); } catch (err) { console.warn('markNewsRead failed', err); }
                            if (typeof self.updateNewsNavBadge === 'function') await self.updateNewsNavBadge();
                        }
                        self.navigateTo('news');
                    });
                });
            }
        }

        // Populate Schnellzugriff (Quick Access)
        const quickLinksDiv = document.getElementById('dashboardQuickLinks');
        if (quickLinksDiv) {
            // Define available quick links (same as in setupQuickAccessEdit)
            const quickLinks = [
                { key: 'kalender', label: '📆 Mein Kalender', view: 'kalender' },
                { key: 'news', label: '📰 News', view: 'news' },
                { key: 'musikpool', label: '🎵 Musikerpool', view: 'musikpool' },
                { key: 'bands', label: '🎸 Meine Bands', view: 'bands' },
                { key: 'rehearsals', label: '📅 Probetermine', view: 'rehearsals' },
                { key: 'events', label: '🎤 Auftritte', view: 'events' },
                { key: 'statistics', label: '📊 Statistiken', view: 'statistics' },
            ];
            let selected = [];
            try {
                selected = JSON.parse(localStorage.getItem('quickAccessLinks') || 'null');
            } catch { }
            if (!Array.isArray(selected) || selected.length === 0) {
                selected = ['kalender', 'news', 'musikpool'];
            }
            const linksToShow = quickLinks.filter(l => selected.includes(l.key));
            if (linksToShow.length === 0) {
                quickLinksDiv.innerHTML = '<span class="text-muted">Keine Schnellzugriffs-Links ausgewählt.</span>';
            } else {
                quickLinksDiv.innerHTML = linksToShow.map(l =>
                    `<button class="btn btn-primary btn-quick-link" data-view="${l.view}" style="margin:0 0.5em 0.5em 0;">${l.label}</button>`
                ).join('');
                // Add click handlers
                quickLinksDiv.querySelectorAll('.btn-quick-link').forEach(btn => {
                    btn.onclick = (e) => {
                        e.preventDefault();
                        this.navigateTo(btn.dataset.view);
                    };
                });
            }
        }

        // Populate Neue Aktivität (recent events, rehearsals, news)
        const activitySection = document.getElementById('dashboardActivityList');
        if (activitySection) {
            const user = Auth.getCurrentUser();
            const [events, rehearsals, news] = await Promise.all([
                Storage.getUserEvents(user.id),
                Storage.getUserRehearsals(user.id),
                Storage.getAllNews()
            ]);
            // Get most recent 5 items (events, rehearsals, news)
            let activities = [];
            activities = activities.concat(
                (events || []).map(e => ({
                    type: 'event',
                    date: e.date,
                    title: e.title,
                })),
                (rehearsals || []).filter(r => r.status === 'confirmed' && r.confirmedDateIndex !== undefined).map(r => ({
                    type: 'rehearsal',
                    date: r.proposedDates[r.confirmedDateIndex],
                    title: r.title,
                })),
                (news || []).map(n => ({
                    type: 'news',
                    date: n.createdAt,
                    title: n.title,
                }))
            );
            activities = activities.filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
            if (activities.length === 0) {
                activitySection.innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div><p>Keine neue Aktivität.</p></div>';
            } else {
                // Include type label and make each activity clickable
                // Ensure we include IDs if available when building activities above
                activitySection.innerHTML = activities.map(a => `
                    <div class="dashboard-activity-item clickable" data-type="${a.type}" data-id="${a.id || ''}">
                        <div style="display:flex; flex-direction:column; gap:0.2rem;">
                            <div class="activity-heading">${a.type === 'event' ? '🎤 Auftritt' : a.type === 'rehearsal' ? '📅 Probetermin' : '📰 News'}</div>
                            <div style="display:flex; gap:0.5rem; align-items:center;">
                                <div class="activity-title">${Bands.escapeHtml(a.title)}</div>
                            </div>
                            <div class="activity-date">${UI.formatDateShort(a.date)}</div>
                        </div>
                    </div>
                `).join('');

                const self = this;
                activitySection.querySelectorAll('.dashboard-activity-item.clickable').forEach(item => {
                    item.addEventListener('click', async () => {
                        const type = item.dataset.type;
                        // Navigate to the correct view depending on type
                        if (type === 'event') {
                            self.navigateTo('events');
                        } else if (type === 'rehearsal') {
                            self.navigateTo('rehearsals');
                        } else {
                            self.navigateTo('news');
                        }
                    });
                });
            }
        }
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
            .filter(r => r.status === 'confirmed' && ((r.confirmedDate && r.confirmedDate !== '') || (r.confirmedDateIndex !== undefined && r.proposedDates && r.proposedDates[r.confirmedDateIndex])))
            .map(r => {
                // Prefer confirmedDate if present, else fallback to proposedDates[confirmedDateIndex]
                const dateIso = r.confirmedDate ? r.confirmedDate : (r.proposedDates && r.confirmedDateIndex !== undefined ? r.proposedDates[r.confirmedDateIndex] : null);
                return {
                    type: 'rehearsal',
                    date: dateIso,
                    title: r.title,
                    bandId: r.bandId,
                    locationId: r.locationId || null,
                    id: r.id
                };
            })
            .filter(item => item.date && new Date(item.date) >= now);

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
            const typeLabel = item.type === 'event' ? 'Auftritt' : 'Probetermin';

            let locationText = '-';
            if (item.type === 'event') {
                locationText = item.location ? Bands.escapeHtml(item.location) : '-';
            } else if (item.type === 'rehearsal' && item.locationId) {
                const loc = await Storage.getLocation(item.locationId);
                locationText = loc ? Bands.escapeHtml(loc.name) : '-';
            }

            return `
                <div class="dashboard-card upcoming-card">
                    <div style="display:flex; align-items:center; gap:0.8rem; flex:1;">
                        <div style="font-size:1.4rem;">${typeIcon}</div>
                        <div style="display:flex; flex-direction:column;">
                            <div style="font-weight:600;">${Bands.escapeHtml(item.title)}</div>
                            <div style="font-size:0.9rem; color:var(--color-text-secondary); line-height:1.4;">
                                <span style="font-weight:500; color:var(--color-primary);">${typeLabel}</span><br>
                                ${UI.formatDate(item.date)}<br>
                                🎸 ${Bands.escapeHtml(bandName)}<br>
                                📍 ${locationText}
                            </div>
                        </div>
                    </div>
                    <div style="margin-left: 0.5rem;">
                        ${item.type === 'event' ? `<button class=\"btn btn-secondary\" onclick=\"App.navigateTo('events')\">Öffnen</button>` : `<button class=\"btn btn-secondary\" onclick=\"App.navigateTo('rehearsals')\">Öffnen</button>`}
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

        Bands.createBand(name, description).then(async () => {
            UI.clearForm('createBandForm');
            UI.closeModal('createBandModal');
            // Refresh band cards in "Meine Bands" view
            if (typeof Bands.renderBands === 'function') {
                await Bands.renderBands();
            }
            // Always update dashboard after band creation
            if (typeof this.updateDashboard === 'function') {
                await this.updateDashboard();
            }
            // Show 'Neuer Auftritt' and 'Neuer Probetermin' buttons if user is now in a band
            const user = Auth.getCurrentUser();
            let userBands = [];
            if (user) {
                userBands = await Storage.getUserBands(user.id);
            }
            const createEventBtn = document.getElementById('createEventBtn');
            if (createEventBtn) {
                createEventBtn.style.display = (userBands && userBands.length > 0) ? '' : 'none';
            }
            const createRehearsalBtn = document.getElementById('createRehearsalBtn');
            if (createRehearsalBtn) {
                createRehearsalBtn.style.display = (userBands && userBands.length > 0) ? '' : 'none';
            }
            // Refresh band management list if admin
            if (Auth.isAdmin() && typeof this.renderAllBandsList === 'function') {
                await this.renderAllBandsList();
            }
            // Navigate to bands view so user sees their new band
            if (typeof App.navigateTo === 'function') {
                App.navigateTo('bands');
            }
        });
    },

    // Handle edit band
    async handleEditBand() {
        const bandId = document.getElementById('editBandId').value;
        const name = document.getElementById('editBandName').value.trim();
        const description = document.getElementById('editBandDescription').value.trim();

        if (!name) {
            UI.showToast('Bitte gib einen Bandnamen ein', 'error');
            return;
        }

        // Check for duplicate band names
        const allBands = await Storage.getAllBands();
        if (Array.isArray(allBands)) {
            const duplicate = allBands.find(b => b.name.toLowerCase() === name.toLowerCase() && b.id !== bandId);

            if (duplicate) {
                UI.showToast('Eine Band mit diesem Namen existiert bereits', 'error');
                return;
            }
        }

        // Update band
        const success = await Storage.updateBand(bandId, { name, description });

        if (success) {
            UI.closeModal('editBandModal');
            UI.clearForm('editBandForm');
            UI.showToast('Band wurde aktualisiert', 'success');

            // Refresh band details view if currently viewing this band
            if (Bands.currentBandId === bandId) {
                await Bands.showBandDetails(bandId);
            }

            // Band-Cache leeren, damit die Übersicht neu geladen wird
            Bands.bands = null;
            await Bands.renderBands();

            // Wenn die aktuelle Ansicht "bands" ist, Ansicht neu laden
            if (this.currentView === 'bands') {
                await this.navigateTo('bands');
            }

            // Refresh band management list if admin
            if (Auth.isAdmin()) {
                await this.renderAllBandsList();
            }

            // Update dashboard if visible
            if (this.currentView === 'dashboard') {
                await this.updateDashboard();
            }
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
    async handleCreateRehearsal(forceCreate = false) {
        const editId = document.getElementById('editRehearsalId').value;
        const title = document.getElementById('rehearsalTitle').value;
        const description = document.getElementById('rehearsalDescription').value;
        const bandId = document.getElementById('rehearsalBand').value;
        const locationId = document.getElementById('rehearsalLocation').value;
        const eventId = document.getElementById('rehearsalEvent').value || null;

        if (!title || !bandId) {
            UI.showToast('Bitte Titel und Band auswählen', 'error');
            return;
        }

        const dates = Rehearsals.getDatesFromForm();

        // Check if there's at least one confirmed proposal
        const confirmedProposals = document.querySelectorAll('#dateProposals .date-proposal-item[data-confirmed="true"]');

        if (confirmedProposals.length === 0) {
            UI.showToast('Bitte mindestens einen Terminvorschlag bestätigen', 'error');
            return;
        }

        if (dates.length === 0) {
            UI.showToast('Bitte mindestens einen Terminvorschlag machen', 'error');
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

        // Check for location conflicts if location is selected and not forcing creation
        if (locationId && !forceCreate && this.checkLocationAvailability) {
            const allConflicts = [];

            // Check each proposed date (jetzt: {startTime, endTime})
            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];
                let startDate, endDate;
                if (typeof date === 'object' && date !== null && date.startTime && date.endTime) {
                    startDate = new Date(date.startTime);
                    endDate = new Date(date.endTime);
                } else {
                    startDate = new Date(date);
                    endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // fallback: 2h
                }

                const availability = await this.checkLocationAvailability(locationId, startDate, endDate);

                if (!availability.available && availability.conflicts && availability.conflicts.length > 0) {
                    allConflicts.push({
                        date: date,
                        dateIndex: i,
                        conflicts: availability.conflicts
                    });
                }
            }

            // If there are any conflicts, show warning modal
            if (allConflicts.length > 0) {
                const location = await Storage.getLocation(locationId);
                const conflictDetailsHtml = `
                    <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid var(--color-danger);">
                        <p><strong>Ort:</strong> ${Bands.escapeHtml(location?.name || 'Unbekannt')}</p>
                        <p style="margin-top: 0.5rem;"><strong>${allConflicts.length} von ${dates.length} Terminen haben Konflikte:</strong></p>
                        ${allConflicts.map(dateConflict => {
                    let dateLabel = '';
                    if (dateConflict.date && typeof dateConflict.date === 'object' && dateConflict.date.startTime) {
                        dateLabel = UI.formatDate(dateConflict.date.startTime);
                        if (dateConflict.date.endTime) {
                            const start = new Date(dateConflict.date.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            const end = new Date(dateConflict.date.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            dateLabel += ` (${start} - ${end})`;
                        }
                    } else {
                        dateLabel = UI.formatDate(dateConflict.date);
                    }
                    return `
                                <div style="margin-top: 1rem; padding: 0.75rem; background: var(--color-surface); border-radius: var(--radius-sm);">
                                    <p><strong>📅 ${dateLabel}</strong></p>
                                    <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                                        ${dateConflict.conflicts.map(conflict => {
                        const start = new Date(conflict.startDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        const end = new Date(conflict.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        return `<li><strong>${Bands.escapeHtml(conflict.summary)}</strong><br><small>${start} - ${end}</small></li>`;
                    }).join('')}
                                    </ul>
                                </div>
                            `;
                }).join('')}
                    </div>
                `;

                document.getElementById('conflictDetails').innerHTML = conflictDetailsHtml;

                // Store the proceed function for later use
                window._pendingRehearsalCreation = proceed;

                // Close create modal and open conflict modal
                UI.closeModal('createRehearsalModal');
                UI.openModal('locationConflictModal');

                return; // Stop here, wait for user decision
            }
        }

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
        // Soundcheck: we now store combined info in a single text field
        const soundcheckDate = null; // removed separate date field
        const location = document.getElementById('eventLocation').value;
        let soundcheckLocation = null, info = null, techInfo = null;
        if (document.getElementById('eventShowExtras').checked) {
            soundcheckLocation = document.getElementById('eventSoundcheckLocation').value || null;
            info = document.getElementById('eventInfo').value;
            techInfo = document.getElementById('eventTechInfo').value;
        }
        const members = Events.getSelectedMembers();
        const guests = Events.getGuests();

        const proceed = async () => {
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
            // Always update dashboard after event changes
            await this.updateDashboard();
        };

        // Only check absences for selected members
        const selectedMembers = members;
        const absences = await Promise.all(selectedMembers.map(async memberId => {
            const abs = await Storage.getUserAbsences(memberId);
            const eventDate = new Date(date);
            return abs.find(a => {
                const start = new Date(a.startDate);
                const end = new Date(a.endDate);
                return eventDate >= start && eventDate <= end;
            });
        }));
        const absentMembers = absences.filter(a => !!a);
        if (absentMembers.length > 0) {
            UI.showConfirm('Mindestens ein ausgewähltes Bandmitglied ist am Termin abwesend. Trotzdem speichern?', () => {
                proceed();
            });
            return;
        }
        proceed();
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
    },

    // Update donate button visibility and link
    async updateDonateButton() {
        const donateBtn = document.getElementById('donateBtn');
        if (!donateBtn) return;

        const savedLink = await Storage.getSetting('donateLink');
        if (savedLink && savedLink.trim()) {
            // Wenn Link vorhanden, öffne externe Seite
            donateBtn.style.display = 'inline-flex';
            donateBtn.href = savedLink;
            donateBtn.target = '_blank';
            donateBtn.rel = 'noopener noreferrer';
        } else {
            // Wenn kein Link, führe zu Settings um Link zu konfigurieren
            donateBtn.style.display = 'inline-flex';
            donateBtn.href = '#';
            donateBtn.removeAttribute('target');
            donateBtn.removeAttribute('rel');
            donateBtn.onclick = (e) => {
                e.preventDefault();
                this.navigateTo('settings');
                UI.showToast('Bitte konfiguriere deinen Spenden-Link in den Einstellungen', 'info');
            };
        }
    }
};

// Make App globally accessible
window.App = App;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});