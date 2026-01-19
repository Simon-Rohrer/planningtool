// Events Management Module

const Events = {
    currentFilter: '',
    currentEventId: null,
    expandedEventId: null,

    // Helper to get display name
    _getUserName(user) {
        if (!user) return 'Unbekannt';
        // Try various name fields
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
        if (user.first_name) return user.first_name;
        if (user.name) return user.name; // Legacy/fallback
        if (user.username) return user.username;
        return 'Unbekannt';
    },

    // Render all events
    async renderEvents(filterBandId = '', forceReload = false) {
        // Nur laden, wenn noch keine Events im Speicher und kein forceReload
        if (!forceReload && this.events && Array.isArray(this.events) && this.events.length > 0 && !filterBandId) {
            this.renderEventsList(this.events);
            return;
        }
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
        }
        const container = document.getElementById('eventsList');
        const user = Auth.getCurrentUser();
        if (!user) return;
        // Check if user is member of any band
        const userBands = await Storage.getUserBands(user.id);
        const hasBands = Array.isArray(userBands) && userBands.length > 0;
        if (!hasBands) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎤</div>
                    <h3>Du bist aktuell in keiner Band</h3>
                    <p>Um Auftritte zu sehen oder zu erstellen, trete einer Band bei oder erstelle eine neue Band.</p>
                    <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                        <button class="btn btn-primary" id="events_join_band_btn">Band beitreten</button>
                        <button class="btn btn-secondary" id="events_create_band_btn">Neue Band erstellen</button>
                    </div>
                </div>
            `;
            // Wire CTAs
            const joinBtn = document.getElementById('events_join_band_btn');
            const createBtn = document.getElementById('events_create_band_btn');
            if (joinBtn) joinBtn.addEventListener('click', () => UI.openModal('joinBandModal'));
            if (createBtn) createBtn.addEventListener('click', () => UI.openModal('createBandModal'));
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 400);
            }
            return;
        }
        let events = (await Storage.getUserEvents(user.id)) || [];
        this.events = events;
        // Apply filter
        if (filterBandId) {
            events = events.filter(e => e.bandId === filterBandId);
        }
        // Sort by date (nearest first)
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        if (events.length === 0) {
            UI.showEmptyState(container, '🎤', 'Noch keine Auftritte vorhanden');
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 400);
            }
            return;
        }

        container.innerHTML = await Promise.all(events.map(event =>
            this.renderEventCard(event)
        )).then(cards => cards.join(''));

        // Add click handlers
        this.attachEventHandlers();

        // Hide loading overlay after all data/UI is ready
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 400);
        }
    },

    // Render single event card
    async renderEventCard(event) {
        const band = await Storage.getBand(event.bandId);
        const isPast = new Date(event.date) < new Date();
        const isExpanded = this.expandedEventId === event.id;
        const canManage = await Auth.canManageEvents(event.bandId);

        // Get member info and absences
        const members = await Promise.all(event.members.map(async memberId => {
            const member = await Storage.getById('users', memberId);
            if (!member) return { name: 'Unbekannt', absence: null };
            const absences = await Storage.getUserAbsences(memberId);
            // Find absence covering event date
            const eventDate = new Date(event.date);
            const absence = absences.find(a => {
                const start = new Date(a.startDate);
                const end = new Date(a.endDate);
                return eventDate >= start && eventDate <= end;
            });
            return { name: this._getUserName(member), absence };
        }));

        const guests = event.guests || [];

        // get event songs to show inside expanded card
        const eventSongs = await Storage.getEventSongs(event.id);

        // Dynamisch Felder nur anzeigen, wenn sie befüllt sind
        let detailsHtml = '';
        // Datum (immer anzeigen)
        detailsHtml += `
            <div class="detail-row">
                <div class="detail-label">📅 Datum:</div>
                <div class="detail-value">${UI.formatDate(event.date)}</div>
            </div>
        `;
        // Ort
        if (event.location && event.location.trim() !== '') {
            detailsHtml += `
                <div class="detail-row">
                    <div class="detail-label">📍 Ort:</div>
                    <div class="detail-value">${Bands.escapeHtml(event.location)}</div>
                </div>
            `;
        }
        // Info
        if (event.info && event.info.trim() !== '') {
            detailsHtml += `
                <div class="detail-row">
                    <div class="detail-label">ℹ️ Event-Infos:</div>
                    <div class="detail-value">${Bands.escapeHtml(event.info)}</div>
                </div>
            `;
        }
        // Technik
        if (event.techInfo && event.techInfo.trim() !== '') {
            detailsHtml += `
                <div class="detail-row">
                    <div class="detail-label">🔧 Technik:</div>
                    <div class="detail-value">${Bands.escapeHtml(event.techInfo)}</div>
                </div>
            `;
        }
        // Mitglieder (immer anzeigen)
        detailsHtml += `
            <div class="detail-row">
                <div class="detail-label">👥 Bandmitglieder (${members.length}):</div>
                <div class="detail-value">
                    ${members.map(m => `
                        <span class="member-tag" style="margin-right: 0.5em;">
                            ${Bands.escapeHtml(m.name)}
                            ${m.absence ? `<span style="color: orange; font-weight: bold; margin-left: 0.5em;">Abwesenheit: ${Bands.escapeHtml(m.absence.reason || '')} (${UI.formatDateOnly(m.absence.startDate)} - ${UI.formatDateOnly(m.absence.endDate)})</span>` : ''}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
        // Gäste
        if (guests.length > 0) {
            detailsHtml += `
                <div class="detail-row">
                    <div class="detail-label">🎭 Gäste (${guests.length}):</div>
                    <div class="detail-value">
                        ${guests.map(guest => `<span class="guest-tag">${Bands.escapeHtml(guest)}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        // Soundcheck
        if (event.soundcheckLocation && event.soundcheckLocation.trim() !== '') {
            detailsHtml += `
                <div class="detail-row">
                    <div class="detail-label">🎚️ Infos zum Soundcheck:</div>
                    <div class="detail-value">${Bands.escapeHtml(event.soundcheckLocation)}</div>
                </div>
            `;
        }
        // Setlist
        if (Array.isArray(eventSongs) && eventSongs.length > 0) {
            detailsHtml += `
                <div class="detail-row">
                    <div class="detail-label">🎵 Setlist (${eventSongs.length}):</div>
                    <div class="detail-value">
                        <div style="display: flex; align-items: center; gap: 1.5rem; font-weight: bold; color: var(--color-text-secondary); font-size: 0.97em; border-bottom: 2px solid var(--color-border); padding-bottom: 0.3rem; margin-bottom: 0.2rem;">
                            <span style="min-width: 120px;">Titel</span>
                            <span style="min-width: 100px;">Interpret</span>
                            <span style="min-width: 70px;">BPM</span>
                            <span style="min-width: 70px;">Tonart</span>
                            <span style="min-width: 100px;">Lead Vocal</span>
                        </div>
                        <ol class="event-songs-list" style="padding:0; margin:0;">
                            ${eventSongs.map((s, idx) => `
                                <li style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; padding: 0.5rem 0; border-bottom: ${idx < eventSongs.length - 1 ? '1px solid var(--color-border)' : 'none'};">
                                    <span style="min-width: 120px; font-weight: bold;">${Bands.escapeHtml(s.title)}</span>
                                    <span style="min-width: 100px;">${s.artist ? Bands.escapeHtml(s.artist) : ''}</span>
                                    <span style="min-width: 70px;">${s.bpm ? Bands.escapeHtml(s.bpm) : ''}</span>
                                    <span style="min-width: 70px;">${s.key ? Bands.escapeHtml(s.key) : ''}</span>
                                    <span style="min-width: 100px;">${s.leadVocal ? Bands.escapeHtml(s.leadVocal) : ''}</span>
                                    <span style="display: flex; gap: 1rem; flex-wrap: wrap; color: var(--color-text-secondary); font-size: 0.95em;">
                                        ${s.ccli ? `<span>CCLI: ${Bands.escapeHtml(s.ccli)}</span>` : ''}
                                        ${s.notes ? `<span style='font-style:italic;'>📝 ${Bands.escapeHtml(s.notes)}</span>` : ''}
                                    </span>
                                </li>
                            `).join('')}
                        </ol>
                    </div>
                </div>
            `;
        }

        return `
            <div class="event-card accordion-card ${isPast ? 'event-past' : ''} ${isExpanded ? 'expanded' : ''}" data-event-id="${event.id}">
                <div class="accordion-header" data-event-id="${event.id}">
                    <div class="accordion-title">
                        <h3>${Bands.escapeHtml(event.title)}</h3>
                        <div class="event-band">
                            🎸 ${Bands.escapeHtml(band?.name || 'Unbekannte Band')}
                        </div>
                    </div>
                    <div class="accordion-actions">
                        <div class="event-quick-info">
                            <span class="quick-info-item">📅 ${UI.formatDateShort(event.date)}</span>
                            ${event.location && event.location.trim() !== '' ? `<span class="quick-info-item">📍 ${Bands.escapeHtml(event.location)}</span>` : ''}
                        </div>
                        ${canManage ? `
                            <button class="btn-icon edit-event-icon" data-event-id="${event.id}" title="Bearbeiten">✏️</button>
                        ` : ''}
                        <button class="accordion-toggle" aria-label="Ausklappen">
                            <span class="toggle-icon">${isExpanded ? '▼' : '▶'}</span>
                        </button>
                    </div>
                </div>
                <div class="accordion-content" style="display: ${isExpanded ? 'block' : 'none'};">
                    <div class="accordion-body">
                        <div class="event-details-expanded">
                            ${detailsHtml}
                        </div>
                        ${canManage ? `
                            <div class="event-action-buttons">
                                <button class="btn btn-secondary edit-event" data-event-id="${event.id}">
                                    ✏️ Bearbeiten
                                </button>
                                <button class="btn btn-danger delete-event" data-event-id="${event.id}">
                                    🗑️ Löschen
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    // Attach event handlers
    attachEventHandlers() {
        // Accordion toggle handlers
        document.querySelectorAll('.event-card .accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // Don't toggle if clicking on action buttons
                if (e.target.closest('.edit-event-icon') || e.target.closest('.accordion-toggle')) {
                    const eventId = header.dataset.eventId;
                    this.toggleAccordion(eventId);
                } else if (!e.target.closest('button')) {
                    const eventId = header.dataset.eventId;
                    this.toggleAccordion(eventId);
                }
            });
        });

        document.querySelectorAll('.edit-event-icon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                this.editEvent(eventId);
            });
        });

        document.querySelectorAll('.edit-event').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                await this.editEvent(eventId);
            });
        });

        document.querySelectorAll('.delete-event').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                await this.deleteEvent(eventId);
            });
        });
    },

    // Toggle accordion
    toggleAccordion(eventId) {
        const card = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
        if (!card) return;

        const content = card.querySelector('.accordion-content');
        const toggle = card.querySelector('.toggle-icon');
        const wasExpanded = this.expandedEventId === eventId;

        // Close all accordions
        document.querySelectorAll('.event-card').forEach(c => {
            c.classList.remove('expanded');
            const cont = c.querySelector('.accordion-content');
            const tog = c.querySelector('.toggle-icon');
            if (cont) cont.style.display = 'none';
            if (tog) tog.textContent = '▶';
        });

        // If it was already expanded, just close it
        if (wasExpanded) {
            this.expandedEventId = null;
        } else {
            // Open this accordion
            card.classList.add('expanded');
            if (content) content.style.display = 'block';
            if (toggle) toggle.textContent = '▼';
            this.expandedEventId = eventId;
        }
    },

    // Create new event
    createEvent(bandId, title, date, location, info, techInfo, members, guests, soundcheckDate, soundcheckLocation) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const event = {
            bandId,
            title,
            date,
            location,
            info,
            techInfo,
            soundcheckDate,
            soundcheckLocation,
            members,
            guests,
            createdBy: user.id
        };

        const savedEvent = Storage.createEvent(event);
        UI.showToast('Auftritt erstellt', 'success');
        UI.closeModal('createEventModal');
        this.renderEvents(this.currentFilter, true);
        return savedEvent;
    },

    // Edit event
    async editEvent(eventId) {
        const event = await Storage.getEvent(eventId);
        if (!event) return;

        this.currentEventId = eventId;

        // Clear deleted songs list when opening edit modal
        if (window.App) {
            window.App.deletedEventSongs = [];
        }

        // Set modal title
        document.getElementById('eventModalTitle').textContent = 'Auftritt bearbeiten';
        document.getElementById('saveEventBtn').textContent = 'Änderungen speichern';
        document.getElementById('editEventId').value = eventId;

        // WICHTIG: Erst Band-Select befüllen, dann Wert setzen
        await this.populateBandSelect();

        // Populate form
        document.getElementById('eventBand').value = event.bandId;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = event.date.slice(0, 16);
        document.getElementById('eventLocation').value = event.location;
        document.getElementById('eventInfo').value = event.info || '';
        document.getElementById('eventTechInfo').value = event.techInfo || '';
        // Combine previous separate soundcheck date+location into a single info field.
        if (event.soundcheckDate) {
            try {
                const dt = new Date(event.soundcheckDate);
                const dtStr = dt.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
                document.getElementById('eventSoundcheckLocation').value = dtStr + (event.soundcheckLocation ? ' — ' + event.soundcheckLocation : '');
            } catch (e) {
                document.getElementById('eventSoundcheckLocation').value = event.soundcheckLocation || '';
            }
        } else {
            document.getElementById('eventSoundcheckLocation').value = event.soundcheckLocation || '';
        }
        document.getElementById('eventGuests').value = (event.guests || []).join('\n');

        // Open modal first so the container exists
        UI.openModal('createEventModal');

        // Then load band members and songs (in parallel)
        console.log('editEvent - loading songs and members for eventId:', eventId);
        console.log('window.App exists:', !!window.App, 'renderEventSongs exists:', !!(window.App && window.App.renderEventSongs));

        await Promise.all([
            this.loadBandMembers(event.bandId, event.members),
            window.App && window.App.renderEventSongs ? window.App.renderEventSongs(eventId) : Promise.resolve()
        ]);

        console.log('editEvent - finished loading');
    },

    // Update event
    updateEvent(eventId, bandId, title, date, location, info, techInfo, members, guests, soundcheckDate, soundcheckLocation) {
        Storage.updateEvent(eventId, {
            bandId,
            title,
            date,
            location,
            info,
            techInfo,
            soundcheckDate,
            soundcheckLocation,
            members,
            guests
        });

        UI.showToast('Auftritt aktualisiert', 'success');
        UI.closeModal('createEventModal');

        // Remember which event was expanded
        const wasExpanded = this.expandedEventId;
        this.renderEvents(this.currentFilter, true);

        // Re-expand the event after rendering
        if (wasExpanded === eventId) {
            // Use setTimeout to ensure DOM is updated
            setTimeout(() => {
                this.expandedEventId = null; // Reset so toggle works
                this.toggleAccordion(eventId);
            }, 100);
        }
    },

    // Delete event
    async deleteEvent(eventId) {
        const confirmed = await UI.confirmDelete('Möchtest du diesen Auftritt wirklich löschen?');
        if (confirmed) {
            Storage.deleteEvent(eventId);
            UI.showToast('Auftritt gelöscht', 'success');
            this.renderEvents(this.currentFilter);
        }
    },

    // Load band members for selection
    async loadBandMembers(bandId, selectedMembers = null) {
        const container = document.getElementById('eventBandMembers');
        if (!container || !bandId) return;

        const members = await Storage.getBandMembers(bandId);

        // Defensive check
        if (!Array.isArray(members)) {
            container.innerHTML = '<p class="text-muted">Keine Mitglieder gefunden</p>';
            return;
        }

        // Pre-select all members if selectedMembers is null (new event)
        const membersToSelect = selectedMembers !== null ? selectedMembers : members.map(m => m.userId);

        // Fetch all users in parallel
        const userPromises = members.map(m => Storage.getById('users', m.userId));
        const users = await Promise.all(userPromises);

        container.innerHTML = await Promise.all(members.map(async (member, idx) => {
            const user = users[idx];
            if (!user) return '';
            const isChecked = membersToSelect.includes(user.id);
            let absenceHtml = '';
            const eventDateInput = document.getElementById('eventDate');
            let eventDate = eventDateInput && eventDateInput.value ? new Date(eventDateInput.value) : null;
            if (eventDate && isChecked) {
                const absences = await Storage.getUserAbsences(user.id);
                const absence = absences.find(a => {
                    const start = new Date(a.startDate);
                    const end = new Date(a.endDate);
                    return eventDate >= start && eventDate <= end;
                });
                if (absence) {
                    absenceHtml = `<span style=\"color: orange; font-weight: bold; margin-left: 0.5em;\">Abwesenheit: ${Bands.escapeHtml(absence.reason || '')} (${UI.formatDateOnly(absence.startDate)} - ${UI.formatDateOnly(absence.endDate)})</span>`;
                }
            }
            return `
                <div class="checkbox-item">
                    <input type="checkbox" id="member_${user.id}" value="${user.id}" ${isChecked ? 'checked' : ''}>
                    <label for="member_${user.id}">${Bands.escapeHtml(this._getUserName(user))}${absenceHtml}</label>
                </div>
            `;
            // Checkboxen für Extras/Gäste korrekt setzen
            const showExtras = (event.soundcheckLocation && event.soundcheckLocation.trim() !== '') || (event.info && event.info.trim() !== '') || (event.techInfo && event.techInfo.trim() !== '');
            document.getElementById('eventShowExtras').checked = !!showExtras;
            // Zeige/Verstecke die Felder entsprechend
            document.getElementById('eventExtrasFields').style.display = showExtras ? '' : 'none';

            const showGuests = Array.isArray(event.guests) && event.guests.length > 0;
            document.getElementById('eventShowGuests').checked = !!showGuests;
            document.getElementById('eventGuestsField').style.display = showGuests ? '' : 'none';
        })).then(items => items.join(''));
        // Add event listener for date change to update absences live
        const eventDateInput = document.getElementById('eventDate');
        if (eventDateInput) {
            eventDateInput.addEventListener('change', async () => {
                await Events.loadBandMembers(bandId, Events.getSelectedMembers());
            });
        }
    },

    // Get selected members
    getSelectedMembers() {
        const checkboxes = document.querySelectorAll('#eventBandMembers input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    },

    // Get guests from textarea
    getGuests() {
        const textarea = document.getElementById('eventGuests');
        const text = textarea.value.trim();
        if (!text) return [];
        return text.split('\n').map(line => line.trim()).filter(line => line);
    },

    // Populate band select
    async populateBandSelect() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bands = (await Storage.getUserBands(user.id)) || [];
        // Rolle egal: alle Bands, in denen der Nutzer Mitglied ist
        const eligibleBands = bands;

        const select = document.getElementById('eventBand');
        if (select) {
            select.innerHTML = '<option value="">Band auswählen</option>' +
                eligibleBands.map(band =>
                    `<option value="${band.id}">${Bands.escapeHtml(band.name)}</option>`
                ).join('');

            // Vorauswahl: wenn genau eine Band vorhanden ist
            if (eligibleBands.length === 1) {
                select.value = eligibleBands[0].id;
                // Trigger change to load members
                select.dispatchEvent(new Event('change'));
            }
        }

        // Filter select
        const filterSelect = document.getElementById('eventBandFilter');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Alle Bands</option>' +
                bands.map(band =>
                    `<option value="${band.id}">${Bands.escapeHtml(band.name)}</option>`
                ).join('');

            // Preselect filter if user is only in one band
            if (bands.length === 1) {
                filterSelect.value = bands[0].id;
                filterSelect.dispatchEvent(new Event('change'));
            }
        }
    }
};