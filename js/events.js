// Events Management Module

const Events = {
    currentFilter: '',
    currentEventId: null,
    expandedEventId: null,

    // Render all events
    renderEvents(filterBandId = '') {
        const container = document.getElementById('eventsList');
        const user = Auth.getCurrentUser();

        if (!user) return;

        let events = Storage.getUserEvents(user.id);

        // Apply filter
        if (filterBandId) {
            events = events.filter(e => e.bandId === filterBandId);
        }

        // Sort by date (nearest first)
        events.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (events.length === 0) {
            UI.showEmptyState(container, '🎤', 'Noch keine Auftritte vorhanden');
            return;
        }

        container.innerHTML = events.map(event =>
            this.renderEventCard(event)
        ).join('');

        // Add click handlers
        this.attachEventHandlers();
    },

    // Render single event card
    renderEventCard(event) {
        const band = Storage.getBand(event.bandId);
        const isPast = new Date(event.date) < new Date();
        const isExpanded = this.expandedEventId === event.id;

        // Get member names
        const members = event.members.map(memberId => {
            const member = Storage.getById('users', memberId);
            return member ? member.name : 'Unbekannt';
        });

        const guests = event.guests || [];

        // get event songs to show inside expanded card
        const eventSongs = Storage.getEventSongs(event.id || event.id);

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
                            <span class="quick-info-item">📍 ${event.location ? Bands.escapeHtml(event.location) : '-'}</span>
                        </div>
                        ${Auth.canManageEvents(event.bandId) ? `
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
                            <div class="detail-row">
                                <div class="detail-label">📅 Datum:</div>
                                <div class="detail-value">${UI.formatDate(event.date)}</div>
                            </div>
                            
                            <div class="detail-row">
                                <div class="detail-label">📍 Ort:</div>
                                <div class="detail-value">${event.location ? Bands.escapeHtml(event.location) : '-'}</div>
                            </div>

                            ${event.info ? `
                                <div class="detail-row">
                                    <div class="detail-label">ℹ️ Event-Infos:</div>
                                    <div class="detail-value">${Bands.escapeHtml(event.info)}</div>
                                </div>
                            ` : ''}

                            ${event.techInfo ? `
                                <div class="detail-row">
                                    <div class="detail-label">🔧 Technik:</div>
                                    <div class="detail-value">${Bands.escapeHtml(event.techInfo)}</div>
                                </div>
                            ` : ''}

                            <div class="detail-row">
                                <div class="detail-label">👥 Bandmitglieder (${members.length}):</div>
                                <div class="detail-value">
                                    ${members.map(name => `<span class="member-tag">${Bands.escapeHtml(name)}</span>`).join('')}
                                </div>
                            </div>

                            ${guests.length > 0 ? `
                                <div class="detail-row">
                                    <div class="detail-label">🎭 Gäste (${guests.length}):</div>
                                    <div class="detail-value">
                                        ${guests.map(guest => `<span class="guest-tag">${Bands.escapeHtml(guest)}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <div class="detail-row">
                                <div class="detail-label">🎚️ Soundcheck Datum & Uhrzeit:</div>
                                <div class="detail-value">${event.soundcheckDate ? UI.formatDate(event.soundcheckDate) : '-'}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">🎚️ Soundcheck Ort:</div>
                                <div class="detail-value">${event.soundcheckLocation ? Bands.escapeHtml(event.soundcheckLocation) : '-'}</div>
                            </div>

                            ${eventSongs && eventSongs.length > 0 ? `
                                <div class="detail-row">
                                    <div class="detail-label">🎵 Setlist (${eventSongs.length}):</div>
                                    <div class="detail-value">
                                        <ol class="event-songs-list">
                                            ${eventSongs.map(s => `<li>${Bands.escapeHtml(s.title)}</li>`).join('')}
                                        </ol>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        ${Auth.canManageEvents(event.bandId) ? `
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
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                this.editEvent(eventId);
            });
        });

        document.querySelectorAll('.delete-event').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                this.deleteEvent(eventId);
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
        this.renderEvents(this.currentFilter);
        return savedEvent;
    },

    // Edit event
    editEvent(eventId) {
        const event = Storage.getEvent(eventId);
        if (!event) return;

        this.currentEventId = eventId;

        // Set modal title
        document.getElementById('eventModalTitle').textContent = 'Auftritt bearbeiten';
        document.getElementById('saveEventBtn').textContent = 'Änderungen speichern';
        document.getElementById('editEventId').value = eventId;

        // Populate form
        document.getElementById('eventBand').value = event.bandId;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = event.date.slice(0, 16);
        document.getElementById('eventLocation').value = event.location;
        document.getElementById('eventInfo').value = event.info || '';
    document.getElementById('eventTechInfo').value = event.techInfo || '';
    document.getElementById('eventSoundcheckDate').value = event.soundcheckDate ? event.soundcheckDate.slice(0,16) : '';
    document.getElementById('eventSoundcheckLocation').value = event.soundcheckLocation || '';
        document.getElementById('eventGuests').value = (event.guests || []).join('\n');

        // Load band members with existing selection
        this.loadBandMembers(event.bandId, event.members);

        // Render setlist
        if (window.App && window.App.renderEventSongs) {
            window.App.renderEventSongs(eventId);
        }

        UI.openModal('createEventModal');
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
        this.renderEvents(this.currentFilter);
    },

    // Delete event
    deleteEvent(eventId) {
        UI.showConfirm('Möchtest du diesen Auftritt wirklich löschen?', () => {
            Storage.deleteEvent(eventId);
            UI.showToast('Auftritt gelöscht', 'success');
            this.renderEvents(this.currentFilter);
        });
    },

    // Load band members for selection
    loadBandMembers(bandId, selectedMembers = null) {
        const container = document.getElementById('eventBandMembers');
        if (!container || !bandId) return;

        const members = Storage.getBandMembers(bandId);

        // Pre-select all members if selectedMembers is null (new event)
        const membersToSelect = selectedMembers !== null ? selectedMembers : members.map(m => m.userId);

        container.innerHTML = members.map(member => {
            const user = Storage.getById('users', member.userId);
            if (!user) return '';

            const isChecked = membersToSelect.includes(user.id);

            return `
                <div class="checkbox-item">
                    <input type="checkbox" id="member_${user.id}" value="${user.id}" ${isChecked ? 'checked' : ''}>
                    <label for="member_${user.id}">${Bands.escapeHtml(user.name)}</label>
                </div>
            `;
        }).join('');
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
    populateBandSelect() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bands = Storage.getUserBands(user.id);
        const eligibleBands = bands.filter(b =>
            b.role === 'leader' || b.role === 'co-leader'
        );

        const select = document.getElementById('eventBand');
        if (select) {
            select.innerHTML = '<option value="">Band auswählen</option>' +
                eligibleBands.map(band =>
                    `<option value="${band.id}">${Bands.escapeHtml(band.name)}</option>`
                ).join('');
        }

        // Filter select
        const filterSelect = document.getElementById('eventBandFilter');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Alle Bands</option>' +
                bands.map(band =>
                    `<option value="${band.id}">${Bands.escapeHtml(band.name)}</option>`
                ).join('');
        }
    }
};