// Events Management Module

const Events = {
    currentFilter: '',
    currentEventId: null,

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

        return `
            <div class="event-card ${isPast ? 'event-past' : ''}" data-event-id="${event.id}">
                <div class="event-header">
                    <div>
                        <h3>${Bands.escapeHtml(event.title)}</h3>
                        <div class="event-band">
                            🎸 ${Bands.escapeHtml(band?.name || 'Unbekannte Band')}
                        </div>
                    </div>
                    ${Auth.canManageEvents(event.bandId) ? `
                        <button class="btn-icon edit-event" data-event-id="${event.id}" title="Bearbeiten">✏️</button>
                    ` : ''}
                </div>
                <div class="event-details">
                    <div class="event-info-item">
                        <span class="info-icon">📅</span>
                        <span>${UI.formatDate(event.date)}</span>
                    </div>
                    <div class="event-info-item">
                        <span class="info-icon">📍</span>
                        <span>${Bands.escapeHtml(event.location)}</span>
                    </div>
                    ${event.info ? `
                        <div class="event-info-item">
                            <span class="info-icon">ℹ️</span>
                            <span>${Bands.escapeHtml(event.info)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Attach event handlers
    attachEventHandlers() {
        document.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.edit-event')) {
                    const eventId = card.dataset.eventId;
                    this.showEventDetails(eventId);
                }
            });
        });

        document.querySelectorAll('.edit-event').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                this.editEvent(eventId);
            });
        });
    },

    // Show event details
    showEventDetails(eventId) {
        const event = Storage.getEvent(eventId);
        if (!event) return;

        const band = Storage.getBand(event.bandId);
        const members = event.members.map(memberId => {
            const member = Storage.getById('users', memberId);
            return member ? member.name : 'Unbekannt';
        });

        const guests = event.guests || [];
        const rehearsals = event.rehearsals || [];
        const rehearsalNames = rehearsals.map(rId => {
            const r = Storage.getRehearsal(rId);
            return r ? r.title : 'Unbekannt';
        });

        document.getElementById('eventDetailsTitle').textContent = event.title;

        document.getElementById('eventDetailsContent').innerHTML = `
            <div class="event-details-view">
                <div class="detail-section">
                    <h3>🎸 Band</h3>
                    <p>${Bands.escapeHtml(band?.name || 'Unbekannt')}</p>
                </div>

                <div class="detail-section">
                    <h3>📅 Datum</h3>
                    <p>${UI.formatDate(event.date)}</p>
                </div>

                <div class="detail-section">
                    <h3>📍 Ort</h3>
                    <p>${Bands.escapeHtml(event.location)}</p>
                </div>

                ${event.info ? `
                    <div class="detail-section">
                        <h3>ℹ️ Event-Infos</h3>
                        <p>${Bands.escapeHtml(event.info)}</p>
                    </div>
                ` : ''}

                ${event.techInfo ? `
                    <div class="detail-section">
                        <h3>🔧 Technik-Infos</h3>
                        <p>${Bands.escapeHtml(event.techInfo)}</p>
                    </div>
                ` : ''}

                <div class="detail-section">
                    <h3>👥 Bandmitglieder (${members.length})</h3>
                    <ul class="detail-list">
                        ${members.map(name => `<li>${Bands.escapeHtml(name)}</li>`).join('')}
                    </ul>
                </div>

                ${guests.length > 0 ? `
                    <div class="detail-section">
                        <h3>🎭 Gäste (${guests.length})</h3>
                        <ul class="detail-list">
                            ${guests.map(guest => `<li>${Bands.escapeHtml(guest)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${rehearsalNames.length > 0 ? `
                    <div class="detail-section">
                        <h3>📅 Zugewiesene Proben (${rehearsalNames.length})</h3>
                        <ul class="detail-list">
                            ${rehearsalNames.map(name => `<li>${Bands.escapeHtml(name)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${Auth.canManageEvents(event.bandId) ? `
                    <div class="detail-actions">
                        <button class="btn btn-primary" onclick="Events.editEvent('${event.id}')">Bearbeiten</button>
                        <button class="btn btn-danger" onclick="Events.deleteEvent('${event.id}')">Löschen</button>
                    </div>
                ` : ''}
            </div>
        `;

        UI.openModal('eventDetailsModal');
    },

    // Create new event
    createEvent(bandId, title, date, location, info, techInfo, members, guests, rehearsals) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const event = {
            bandId,
            title,
            date,
            location,
            info,
            techInfo,
            members,
            guests,
            rehearsals,
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
        document.getElementById('eventGuests').value = (event.guests || []).join('\n');

        // Load band members
        this.loadBandMembers(event.bandId, event.members);

        // Load rehearsals
        this.loadRehearsalsForBand(event.bandId, event.rehearsals);

        UI.closeModal('eventDetailsModal');
        UI.openModal('createEventModal');
    },

    // Update event
    updateEvent(eventId, bandId, title, date, location, info, techInfo, members, guests, rehearsals) {
        Storage.updateEvent(eventId, {
            bandId,
            title,
            date,
            location,
            info,
            techInfo,
            members,
            guests,
            rehearsals
        });

        UI.showToast('Auftritt aktualisiert', 'success');
        UI.closeModal('createEventModal');
        this.renderEvents(this.currentFilter);
    },

    // Delete event
    deleteEvent(eventId) {
        if (!UI.confirm('Möchtest du diesen Auftritt wirklich löschen?')) {
            return;
        }

        Storage.deleteEvent(eventId);
        UI.showToast('Auftritt gelöscht', 'success');
        UI.closeModal('eventDetailsModal');
        this.renderEvents(this.currentFilter);
    },

    // Load band members for selection
    loadBandMembers(bandId, selectedMembers = []) {
        const container = document.getElementById('eventBandMembers');
        if (!container || !bandId) return;

        const members = Storage.getBandMembers(bandId);

        container.innerHTML = members.map(member => {
            const user = Storage.getById('users', member.userId);
            if (!user) return '';

            const isChecked = selectedMembers.includes(user.id);

            return `
                <div class="checkbox-item">
                    <input type="checkbox" id="member_${user.id}" value="${user.id}" ${isChecked ? 'checked' : ''}>
                    <label for="member_${user.id}">${Bands.escapeHtml(user.name)}</label>
                </div>
            `;
        }).join('');
    },

    // Load rehearsals for band
    loadRehearsalsForBand(bandId, selectedRehearsals = []) {
        const container = document.getElementById('eventRehearsals');
        if (!container || !bandId) return;

        const rehearsals = Storage.getBandRehearsals(bandId);

        if (rehearsals.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Probetermine vorhanden</p>';
            return;
        }

        container.innerHTML = rehearsals.map(rehearsal => {
            const isChecked = selectedRehearsals.includes(rehearsal.id);

            return `
                <div class="checkbox-item">
                    <input type="checkbox" id="rehearsal_${rehearsal.id}" value="${rehearsal.id}" ${isChecked ? 'checked' : ''}>
                    <label for="rehearsal_${rehearsal.id}">${Bands.escapeHtml(rehearsal.title)}</label>
                </div>
            `;
        }).join('');
    },

    // Get selected members
    getSelectedMembers() {
        const checkboxes = document.querySelectorAll('#eventBandMembers input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    },

    // Get selected rehearsals
    getSelectedRehearsals() {
        const checkboxes = document.querySelectorAll('#eventRehearsals input[type="checkbox"]:checked');
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