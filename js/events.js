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

        // Sort by date (nearest first)
        events.sort((a, b) => new Date(a.date) - new Date(b.date));

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
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <div class="detail-label">🎵 Setlist (${eventSongs.length}):</div>
                        <button type="button" class="btn btn-sm btn-secondary download-setlist-pdf" data-event-id="${event.id}" style="white-space: nowrap;">
                            📥 Als PDF herunterladen
                        </button>
                    </div>
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

        document.querySelectorAll('.download-setlist-pdf').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                await this.downloadSetlistPDF(eventId);
            });
        });
    },

    // Download setlist as PDF
    async downloadSetlistPDF(eventId) {
        try {
            const event = await Storage.getById('events', eventId);
            if (!event) {
                UI.showToast('Auftritt nicht gefunden', 'error');
                return;
            }

            const songs = await Storage.getEventSongs(eventId);
            if (!Array.isArray(songs) || songs.length === 0) {
                UI.showToast('Keine Songs in der Setlist', 'error');
                return;
            }

            const band = await Storage.getBand(event.bandId);
            const bandName = band ? band.name : 'Unbekannte Band';

            // Build HTML content
            let songsTableHTML = '';
            songs.forEach((song, idx) => {
                songsTableHTML += `
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 8px; text-align: left; font-weight: bold;">${idx + 1}</td>
                        <td style="padding: 8px; text-align: left;">${Bands.escapeHtml(song.title)}</td>
                        <td style="padding: 8px; text-align: left;">${Bands.escapeHtml(song.artist || '-')}</td>
                        <td style="padding: 8px; text-align: center;">${song.bpm || '-'}</td>
                        <td style="padding: 8px; text-align: center;">${song.key || '-'}</td>
                        <td style="padding: 8px; text-align: left;">${Bands.escapeHtml(song.leadVocal || '-')}</td>
                    </tr>
                `;
            });

            let additionalInfoHTML = '';
            if (songs.some(s => s.ccli || s.notes)) {
                additionalInfoHTML = '<div style="margin-top: 30px; background-color: #f9f9f9; padding: 15px; border-radius: 5px;"><h3 style="margin-top: 0; color: #333;">Zusätzliche Informationen</h3>';
                songs.forEach((song, idx) => {
                    if (song.ccli || song.notes) {
                        additionalInfoHTML += `
                            <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                                <strong>${idx + 1}. ${Bands.escapeHtml(song.title)}</strong>
                                ${song.ccli ? `<p style="margin: 5px 0; color: #666;">CCLI: ${Bands.escapeHtml(song.ccli)}</p>` : ''}
                                ${song.notes ? `<p style="margin: 5px 0; color: #666; font-style: italic;">📝 ${Bands.escapeHtml(song.notes)}</p>` : ''}
                            </div>
                        `;
                    }
                });
                additionalInfoHTML += '</div>';
            }

            // Create PDF HTML element
            const element = document.createElement('div');
            element.innerHTML = `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: white; color: #000;">
                    <h1 style="text-align: center; color: #333; margin: 0 0 10px 0; font-size: 24px;">${Bands.escapeHtml(event.title)}</h1>
                    <div style="text-align: center; color: #666; margin-bottom: 30px; font-size: 14px;">
                        <p style="margin: 5px 0;"><strong>Band:</strong> ${Bands.escapeHtml(bandName)}</p>
                        <p style="margin: 5px 0;"><strong>Datum:</strong> ${UI.formatDate(event.date)}</p>
                        ${event.location ? `<p style="margin: 5px 0;"><strong>Ort:</strong> ${Bands.escapeHtml(event.location)}</p>` : ''}
                    </div>

                    <h2 style="color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-top: 20px; font-size: 18px;">Setlist (${songs.length} Songs)</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
                        <thead>
                            <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
                                <th style="padding: 8px; text-align: left; font-weight: bold;">Nr.</th>
                                <th style="padding: 8px; text-align: left; font-weight: bold;">Titel</th>
                                <th style="padding: 8px; text-align: left; font-weight: bold;">Interpret</th>
                                <th style="padding: 8px; text-align: center; font-weight: bold;">BPM</th>
                                <th style="padding: 8px; text-align: center; font-weight: bold;">Tonart</th>
                                <th style="padding: 8px; text-align: left; font-weight: bold;">Lead Vocal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${songsTableHTML}
                        </tbody>
                    </table>

                    ${additionalInfoHTML}

                    <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; color: #999; font-size: 11px; text-align: center;">
                        <p style="margin: 5px 0;">Erstellt mit Band Planning Tool</p>
                        <p style="margin: 0;">Ausgedruckt am ${new Date().toLocaleString('de-DE')}</p>
                    </div>
                </div>
            `;
            
            element.style.backgroundColor = 'white';
            element.style.padding = '0';
            element.style.margin = '0';
            element.style.color = 'black';

            // Append to body temporarily
            document.body.appendChild(element);

            // Wait for rendering
            await new Promise(resolve => setTimeout(resolve, 200));

            // Generate canvas
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            // Create PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            let heightLeft = canvas.height * imgWidth / canvas.width;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, heightLeft);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - canvas.height * imgWidth / canvas.width;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, heightLeft);
                heightLeft -= pageHeight;
            }

            // Save PDF
            const filename = `Setlist_${Bands.escapeHtml(event.title)}_${UI.formatDateShort(event.date)}.pdf`;
            pdf.save(filename);

            // Cleanup
            document.body.removeChild(element);

            UI.showToast('Setlist-PDF heruntergeladen!', 'success');
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