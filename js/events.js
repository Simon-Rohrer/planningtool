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
    async renderEvents(filterBandId = '') {
        const container = document.getElementById('eventsList');
        const user = Auth.getCurrentUser();

        if (!user) return;

        let events = (await Storage.getUserEvents(user.id)) || [];

        // Apply filter
        if (filterBandId) {
            events = events.filter(e => e.bandId === filterBandId);
        }

        // Sort by date (Upcoming first, then past)
        const now = new Date();
        events.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            const isPastA = dateA < now;
            const isPastB = dateB < now;

            if (isPastA && !isPastB) return 1; // Past at bottom
            if (!isPastA && isPastB) return -1; // Future at top

            if (!isPastA && !isPastB) {
                // Both future: Ascending (nearest first)
                return dateA - dateB;
            } else {
                // Both past: Descending (most recent past first)
                return dateB - dateA;
            }
        });

        if (events.length === 0) {
            UI.showEmptyState(container, '🎤', 'Noch keine Auftritte vorhanden');
            return;
        }

        container.innerHTML = await Promise.all(events.map(event =>
            this.renderEventCard(event)
        )).then(cards => cards.join(''));

        // Add click handlers
        this.attachEventHandlers();
    },

    // Render single event card
    async renderEventCard(event) {
        // Use joined band data if available, otherwise fetch
        const band = event.band || await Storage.getBand(event.bandId);

        const isPast = new Date(event.date) < new Date();
        const isExpanded = this.expandedEventId === event.id;
        const canManage = await Auth.canManageEvents(event.bandId);

        // Get band color with fallback
        const bandColor = band ? (band.color || '#e11d48') : '#e11d48'; // Default pink-ish for events if no band color

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
                <div class="detail-label">👥 Bandmitglieder:</div>
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
                    <div class="detail-label">🎭 Gäste:</div>
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
                <div class="setlist-section">
                    <div class="setlist-header">
                        <div class="setlist-title">🎵 Setlist</div>
                        <button type="button" class="btn-pdf download-setlist-pdf" data-event-id="${event.id}">
                            <img src="images/pdf-download.png" class="btn-icon-img" alt="PDF icon"><span class="btn-text-mobile-hide"> Als PDF herunterladen</span>
                        </button>
                    </div>

                    <!-- Bulk Actions Bar -->
                    <div id="bulk-actions-${event.id}" class="bulk-actions-bar" style="display: none; background: var(--color-surface); padding: 0.5rem 1rem; border-radius: 8px; margin-bottom: 1rem; align-items: center; justify-content: space-between; border: 1px solid var(--color-accent);">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-weight: bold; color: var(--color-accent);">Ausgewählt: <span id="count-${event.id}">0</span></span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-danger btn-sm bulk-delete-event-songs" data-event-id="${event.id}">🗑️ Auswahl Löschen</button>
                            <button class="btn btn-primary btn-sm bulk-pdf-event-songs" data-event-id="${event.id}">📥 Auswahl als PDF herunterladen</button>
                        </div>
                    </div>
                    
                    <div class="setlist-grid" style="overflow-x: auto;">
                        <table class="songs-table" style="width: 100%; border-collapse: collapse; margin-top: var(--spacing-md);">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--color-border);">
                                    <th style="padding: var(--spacing-sm); text-align: center; width: 40px;">
                                        <input type="checkbox" class="select-all-event-songs" data-event-id="${event.id}">
                                    </th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Titel</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Interpret</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">BPM</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Time</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Tonart</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Orig.</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Lead</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Sprache</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">Tracks</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;" data-label="Infos">Infos</th>
                                    <th style="padding: var(--spacing-sm); text-align: left;">CCLI</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${eventSongs.map((s, idx) => `
                                    <tr style="border-bottom: 1px solid var(--color-border);">
                                        <td style="padding: var(--spacing-sm); text-align: center;" data-label="Auswählen">
                                            <input type="checkbox" class="event-song-checkbox" data-event-id="${event.id}" value="${s.id}">
                                        </td>
                                        <td style="padding: var(--spacing-sm);" data-label="Titel">${Bands.escapeHtml(s.title)}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="Interpret">${s.artist ? Bands.escapeHtml(s.artist) : '-'}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="BPM">${s.bpm || '-'}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="Time">${s.timeSignature || '-'}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="Tonart">${s.key || '-'}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="Orig.">${s.originalKey || '-'}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="Lead">${s.leadVocal ? Bands.escapeHtml(s.leadVocal) : '-'}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="Sprache">${s.language || '-'}</td>
                                        <td style="padding: var(--spacing-sm);" data-label="Tracks">${s.tracks === 'yes' ? 'Ja' : (s.tracks === 'no' ? 'Nein' : '-')}</td>
                                        <td style="padding: var(--spacing-sm); font-size: 0.9em;" data-label="Infos">${s.info ? Bands.escapeHtml(s.info) : '-'}</td>
                                        <td style="padding: var(--spacing-sm); font-family: monospace; font-size: 0.9em;" data-label="CCLI">${s.ccli || '-'}</td>
                                    </tr>
                                    ${(s.notes) ? `
                                        <tr>
                                            <td colspan="12" style="padding: 0 var(--spacing-sm) var(--spacing-sm) var(--spacing-sm); color: var(--color-text-secondary); font-size: 0.85em;">
                                                ${s.notes ? `<span style="font-style:italic;">📝 ${Bands.escapeHtml(s.notes)}</span>` : ''}
                                            </td>
                                        </tr>
                                    ` : ''}
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        return `
            <div class="event-card accordion-card ${isPast ? 'event-past' : ''} ${isExpanded ? 'expanded' : ''}" data-event-id="${event.id}" style="border-left: 4px solid ${bandColor}">
                <div class="accordion-header" data-event-id="${event.id}">
                    <div class="accordion-title">
                        <h3>${Bands.escapeHtml(event.title)}</h3>
                        <div class="event-band" style="color: ${bandColor}">
                            🎸 ${Bands.escapeHtml(band?.name || 'Unbekannte Band')}
                        </div>
                    </div>
                    <div class="accordion-actions">
                        <div class="event-quick-info">
                            <span class="quick-info-item">📅 ${UI.formatDateShort(event.date)}</span>
                            ${event.location && event.location.trim() !== '' ? `<span class="quick-info-item">📍 ${Bands.escapeHtml(event.location)}</span>` : ''}
                        </div>
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
                // Don't toggle if clicking on action buttons or inputs
                if (e.target.closest('.edit-event-icon') || e.target.closest('.accordion-toggle')) {
                    const eventId = header.dataset.eventId;
                    this.toggleAccordion(eventId);
                } else if (!e.target.closest('button') && e.target.tagName !== 'INPUT') {
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

        document.querySelectorAll('.download-setlist-pdf').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                await this.downloadSetlistPDF(eventId);
            });
        });

        // --- Bulk Actions Logic ---

        // Select All
        document.querySelectorAll('.select-all-event-songs').forEach(selectAll => {
            const eventId = selectAll.dataset.eventId;
            selectAll.addEventListener('click', (e) => e.stopPropagation());

            selectAll.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll(`.event-song-checkbox[data-event-id="${eventId}"]`);
                checkboxes.forEach(cb => cb.checked = e.target.checked);
                this.updateBulkActionsUI(eventId);
            });
        });

        // Individual Checkboxes
        document.querySelectorAll('.event-song-checkbox').forEach(cb => {
            cb.addEventListener('click', (e) => e.stopPropagation());
            cb.addEventListener('change', () => {
                this.updateBulkActionsUI(cb.dataset.eventId);
            });
        });

        // Bulk Delete
        document.querySelectorAll('.bulk-delete-event-songs').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                const checkboxes = document.querySelectorAll(`.event-song-checkbox[data-event-id="${eventId}"]:checked`);
                const songIds = Array.from(checkboxes).map(cb => cb.value);

                if (songIds.length === 0) return;

                if (await UI.confirmDelete(`${songIds.length} Songs wirklich aus dem Event entfernen?`)) {
                    for (const id of songIds) {
                        await Storage.deleteSong(id);
                    }
                    UI.showToast(`${songIds.length} Songs entfernt`, 'success');
                    // Refresh rendering
                    this.renderEvents(Events.currentFilter);
                }
            });
        });

        // Bulk PDF
        document.querySelectorAll('.bulk-pdf-event-songs').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                const checkboxes = document.querySelectorAll(`.event-song-checkbox[data-event-id="${eventId}"]:checked`);
                const songIds = Array.from(checkboxes).map(cb => cb.value);

                if (songIds.length > 0) {
                    this.downloadSetlistPDF(eventId, songIds);
                }
            });
        });
    },

    updateBulkActionsUI(eventId) {
        const checkboxes = document.querySelectorAll(`.event-song-checkbox[data-event-id="${eventId}"]:checked`);
        const bar = document.getElementById(`bulk-actions-${eventId}`);
        const countSpan = document.getElementById(`count-${eventId}`);

        if (bar && countSpan) {
            countSpan.textContent = checkboxes.length;
            bar.style.display = checkboxes.length > 0 ? 'flex' : 'none';
        }
    },

    // Download setlist as PDF
    async downloadSetlistPDF(eventId, selectedIds = null, preview = true) {
        try {
            const event = await Storage.getById('events', eventId);
            if (!event) {
                UI.showToast('Auftritt nicht gefunden', 'error');
                return;
            }

            let songs = await Storage.getEventSongs(eventId);
            if (!Array.isArray(songs) || songs.length === 0) {
                UI.showToast('Keine Songs in der Setlist', 'error');
                return;
            }

            // Filter if selectedIds provided
            if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) {
                songs = songs.filter(s => selectedIds.includes(s.id));
            }

            const band = await Storage.getBand(event.bandId);
            const bandName = band ? band.name : 'Unbekannte Band';

            // Prepare Metadata for Header (as HTML strings)
            const metaInfo = [
                `🎸 <b>${Bands.escapeHtml(bandName)}</b>`,
                `📅 ${UI.formatDate(event.date)}`
            ];
            if (event.location) {
                metaInfo.push(`📍 ${Bands.escapeHtml(event.location)}`);
            }

            const filename = `Setlist_${Bands.escapeHtml(event.title)}_${UI.formatDateShort(event.date)}.pdf`;

            const pdfData = await PDFGenerator.generateSetlistPDF({
                title: event.title,
                subtitle: '',
                metaInfo: metaInfo,
                songs: songs,
                showNotes: true,
                filename: filename,
                previewOnly: preview
            });

            if (preview && pdfData && pdfData.blobUrl) {
                if (typeof App !== 'undefined' && App.showPDFPreview) {
                    App.showPDFPreview(pdfData);
                } else {
                    // Fallback
                    pdfData.pdf.save(filename);
                }
            } else if (!preview) {
                UI.showToast('Setlist-PDF heruntergeladen!', 'success');
            }
        } catch (error) {
            console.error('Error downloading setlist PDF:', error);
            UI.showToast('Fehler beim Erstellen der PDF: ' + error.message, 'error');
        }
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