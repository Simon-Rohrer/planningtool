// Rehearsals Management Module

const Rehearsals = {
        // Attach listeners to date/time inputs for availability checks
        attachAvailabilityListeners(context = document) {
            const dateInputs = context.querySelectorAll('.date-input-date');
            const startInputs = context.querySelectorAll('.date-input-start');
            const endInputs = context.querySelectorAll('.date-input-end');

            [...dateInputs, ...startInputs, ...endInputs].forEach(input => {
                if (!input._availabilityBound) {
                    input.addEventListener('change', () => this.updateAvailabilityIndicators());
                    input._availabilityBound = true;
                }
            });
        },
    currentFilter: '',
    currentRehearsalId: null,
    expandedRehearsalId: null,

    // Render all rehearsals
    async renderRehearsals(filterBandId = '') {
        const container = document.getElementById('rehearsalsList');
        const user = Auth.getCurrentUser();

        if (!user) return;

        let rehearsals = (await Storage.getUserRehearsals(user.id)) || [];

        // Apply filter
        if (filterBandId) {
            rehearsals = rehearsals.filter(r => r.bandId === filterBandId);
        }

        // Sort by creation date (newest first)
        rehearsals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (rehearsals.length === 0) {
            UI.showEmptyState(container, '📅', 'Noch keine Probetermine vorhanden');
            return;
        }

        container.innerHTML = await Promise.all(rehearsals.map(rehearsal =>
            this.renderRehearsalCard(rehearsal)
        )).then(cards => cards.join(''));

        // Add vote handlers
        this.attachVoteHandlers(container);
    },

    // Render single rehearsal card
    async renderRehearsalCard(rehearsal) {
        const band = await Storage.getBand(rehearsal.bandId);
        const proposer = await Storage.getById('users', rehearsal.proposedBy);
        const user = Auth.getCurrentUser();
        const isExpanded = this.expandedRehearsalId === rehearsal.id;

        // Get location name if set
        const bandName = band ? band.name : 'Unbekannte Band';
        const bandColor = band ? (band.color || '#6366f1') : '#6366f1';
        const location = rehearsal.locationId ? await Storage.getLocation(rehearsal.locationId) : null;
        const locationName = location ? location.name : (rehearsal.location || 'Kein Ort');

        const isCreator = rehearsal.createdBy === user.id;
        const isAdmin = Auth.isAdmin();
        let isLeader = false;
        let isCoLeader = false;
        if (user && band) {
            const role = await Storage.getUserRoleInBand(user.id, band.id);
            isLeader = role === 'leader';
            isCoLeader = role === 'co-leader';
        }
        const canManage = isCreator || isAdmin || isLeader || isCoLeader;

        let dateOptionsHtml = '';
        if (rehearsal.status === 'pending') {
            if (rehearsal.proposedDates && rehearsal.proposedDates.length > 0) {
                dateOptionsHtml = `<div class="date-options">
                    ${(await Promise.all(rehearsal.proposedDates.map((date, index) =>
                        this.renderDateOption(rehearsal.id, date, index, user.id)
                    ))).join('')}
                </div>`;
            } else {
                dateOptionsHtml = `<div class="date-options empty">
                    <em>Keine Terminvorschläge vorhanden.</em>
                </div>`;
            }
        }

        return `
            <div class="rehearsal-card accordion-card ${isExpanded ? 'expanded' : ''}" data-rehearsal-id="${rehearsal.id}" style="border-left: 4px solid ${bandColor}">
                <div class="accordion-header" data-rehearsal-id="${rehearsal.id}">
                    <div class="accordion-title">
                        <h3>${Bands.escapeHtml(rehearsal.title)}</h3>
                        <div class="rehearsal-band" style="color: ${bandColor}">
                            🎸 ${Bands.escapeHtml(bandName)}
                        </div>
                    </div>
                    <div class="accordion-actions">
                        <span class="rehearsal-status status-${rehearsal.status}">
                            ${rehearsal.status === 'pending' ? 'Abstimmung läuft' : 'Bestätigt'}
                        </span>
                        <button class="accordion-toggle" aria-label="Ausklappen">
                            <span class="toggle-icon">${isExpanded ? '▼' : '▶'}</span>
                        </button>
                    </div>
                </div>
                
                <div class="accordion-content" style="display: ${isExpanded ? 'block' : 'none'};">
                    <div class="accordion-body">
                        <div class="rehearsal-info">
                            <p><strong>Vorgeschlagen von:</strong> ${Bands.escapeHtml(proposer?.name || 'Unbekannt')}</p>
                            ${rehearsal.description ? `
                                <p><strong>Beschreibung:</strong> ${Bands.escapeHtml(rehearsal.description)}</p>
                            ` : ''}
                            ${rehearsal.status === 'confirmed' && rehearsal.confirmedDate ? `
                                <p><strong>✅ Bestätigter Termin:</strong> ${UI.formatDate(rehearsal.confirmedDate)}</p>
                                ${locationName ? `<p><strong>📍 Ort:</strong> ${locationName}</p>` : ''}
                            ` : ''}
                            ${rehearsal.status === 'pending' && rehearsal.proposedDates && rehearsal.proposedDates.length > 0 ? `
                                <p><strong>📅 Vorgeschlagene Termine:</strong> ${rehearsal.proposedDates.length} Option(en)</p>
                            ` : ''}
                        </div>

                        ${dateOptionsHtml}

                        <div class="rehearsal-action-buttons">
                            ${canManage && rehearsal.status === 'pending' ? `
                                <button class="btn btn-primary open-rehearsal-btn" 
                                        data-rehearsal-id="${rehearsal.id}">
                                    Öffnen & Bestätigen
                                </button>
                            ` : ''}
                            ${canManage ? `
                                <button class="btn btn-secondary edit-rehearsal" data-rehearsal-id="${rehearsal.id}">
                                    ✏️ Bearbeiten
                                </button>
                                <button class="btn btn-danger delete-rehearsal" data-rehearsal-id="${rehearsal.id}">
                                    🗑️ Löschen
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Render single date option with voting
    async renderDateOption(rehearsalId, date, dateIndex, userId) {
        const votes = (await Storage.getRehearsalVotes(rehearsalId)) || [];
        const dateVotes = votes.filter(v => v.dateIndex === dateIndex);

        const yesCount = dateVotes.filter(v => v.availability === 'yes').length;
        const maybeCount = dateVotes.filter(v => v.availability === 'maybe').length;
        const noCount = dateVotes.filter(v => v.availability === 'no').length;

        const userVote = await Storage.getUserVoteForDate(userId, rehearsalId, dateIndex);
        const userAvailability = userVote ? userVote.availability : null;

        // Get time suggestions for this date
        const timeSuggestions = (await Storage.getTimeSuggestionsForDate(rehearsalId, dateIndex)) || [];
        const userTimeSuggestion = await Storage.getUserTimeSuggestionForDate(userId, rehearsalId, dateIndex);

        // Group suggestions by time
        const suggestionsByTime = {};
        for (const suggestion of timeSuggestions) {
            const time = suggestion.suggestedTime;
            if (!suggestionsByTime[time]) {
                suggestionsByTime[time] = [];
            }
            const user = await Storage.getById('users', suggestion.userId);
            if (user) {
                suggestionsByTime[time].push(user.name);
            }
        }

        // Handle both old format (string) and new format (object with startTime/endTime)
        const dateString = typeof date === 'string' ? date : date.startTime;
        const endTimeString = typeof date === 'object' && date.endTime ? date.endTime : null;

        // Format date display
        let dateDisplay = UI.formatDate(dateString);
        if (endTimeString) {
            const startTime = new Date(dateString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(endTimeString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            dateDisplay += ` (${startTime} - ${endTime})`;
        }

        return `
            <div class="date-option">
                <div class="date-info">
                    <div class="date-time">📅 ${dateDisplay}</div>
                    <div class="vote-summary">
                        <span class="vote-count">✅ ${yesCount}</span>
                        <span class="vote-count">❓ ${maybeCount}</span>
                        <span class="vote-count">❌ ${noCount}</span>
                    </div>
                </div>
                <div class="vote-actions">
                    <button class="vote-btn vote-none ${!userAvailability ? 'active' : ''}" 
                            data-rehearsal-id="${rehearsalId}" 
                            data-date-index="${dateIndex}" 
                            data-availability="none"
                            title="Noch nicht abgestimmt / Abstimmung zurückziehen">
                        ➖
                    </button>
                    <button class="vote-btn vote-yes ${userAvailability === 'yes' ? 'active' : ''}" 
                            data-rehearsal-id="${rehearsalId}" 
                            data-date-index="${dateIndex}" 
                            data-availability="yes"
                            title="Ich kann">
                        ✅
                    </button>
                    <button class="vote-btn vote-maybe ${userAvailability === 'maybe' ? 'active' : ''}" 
                            data-rehearsal-id="${rehearsalId}" 
                            data-date-index="${dateIndex}" 
                            data-availability="maybe"
                            title="Vielleicht">
                        ❓
                    </button>
                    <button class="vote-btn vote-no ${userAvailability === 'no' ? 'active' : ''}" 
                            data-rehearsal-id="${rehearsalId}" 
                            data-date-index="${dateIndex}" 
                            data-availability="no"
                            title="Ich kann nicht">
                        ❌
                    </button>
                    <button class="suggest-time-btn ${userTimeSuggestion ? 'has-suggestion' : ''}" 
                            data-rehearsal-id="${rehearsalId}" 
                            data-date-index="${dateIndex}"
                            title="${userTimeSuggestion ? 'Zeitvorschlag bearbeiten' : 'Alternative Zeit vorschlagen'}">
                        🕐
                    </button>
                </div>
                ${Object.keys(suggestionsByTime).length > 0 ? `
                    <div class="time-suggestions">
                        <strong>Vorgeschlagene Uhrzeiten:</strong>
                        ${Object.entries(suggestionsByTime).map(([time, users]) => `
                            <div class="time-suggestion-item">
                                <span class="suggested-time">🕐 ${time}</span>
                                <span class="suggested-by">(${users.join(', ')})</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Attach vote and open handlers
    attachVoteHandlers(context = document) {
        // Accordion toggle handlers
        context.querySelectorAll('.accordion-header').forEach(header => {
            // Remove existing listeners to prevent duplicates
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);

            newHeader.addEventListener('click', (e) => {
                // Don't toggle if clicking on action buttons or vote buttons
                if (e.target.closest('button') && !e.target.closest('.accordion-toggle')) {
                    return;
                }

                const card = newHeader.closest('.rehearsal-card');
                this.toggleAccordion(card);
            });
        });

        context.querySelectorAll('.suggest-time-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                const dateIndex = parseInt(btn.dataset.dateIndex);
                await this.suggestTime(rehearsalId, dateIndex);
            });
        });

        // Confirm proposal button handler
        context.querySelectorAll('.confirm-proposal-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = btn.closest('.date-proposal-item');
                if (!item) return;

                const dateInput = item.querySelector('.date-input-date');
                const startInput = item.querySelector('.date-input-start');
                const endInput = item.querySelector('.date-input-end');
                const availabilitySpan = item.querySelector('.date-availability');

                // Validate inputs
                if (!dateInput || !dateInput.value || !startInput || !startInput.value || !endInput || !endInput.value) {
                    UI.showToast('Bitte alle Felder ausfüllen', 'error');
                    return;
                }

                // Validate end time is after start time
                if (endInput.value <= startInput.value) {
                    UI.showToast('Endzeit muss nach Startzeit liegen', 'error');
                    return;
                }

                // Get location and check availability
                const locationId = document.getElementById('rehearsalLocation')?.value;
                let availabilityText = availabilitySpan?.textContent || '';
                let hasConflict = false;
                let conflictDetails = null;

                if (locationId && typeof App !== 'undefined' && App.checkLocationAvailability) {
                    const startDateTime = `${dateInput.value}T${startInput.value}`;
                    const endDateTime = `${dateInput.value}T${endInput.value}`;

                    const availability = await App.checkLocationAvailability(
                        locationId,
                        new Date(startDateTime),
                        new Date(endDateTime)
                    );

                    if (!availability.available && availability.conflicts && availability.conflicts.length > 0) {
                        hasConflict = true;
                        conflictDetails = availability.conflicts;
                    }
                }

                // Format date and time for display
                const date = new Date(dateInput.value);
                const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
                const timeStr = `${startInput.value} - ${endInput.value}`;

                // Create confirmed display
                const confirmedDisplay = document.createElement('div');
                confirmedDisplay.className = 'confirmed-proposal-display';
                confirmedDisplay.innerHTML = `
                    <span class="confirmed-date">📅 ${dateStr}, ${timeStr}</span>
                    <span class="confirmed-availability ${hasConflict ? 'has-conflict' : 'is-available'}">${availabilityText}</span>
                `;

                // Store data in dataset
                item.dataset.confirmed = 'true';
                item.dataset.startTime = new Date(`${dateInput.value}T${startInput.value}`).toISOString();
                item.dataset.endTime = new Date(`${dateInput.value}T${endInput.value}`).toISOString();
                item.dataset.hasConflict = hasConflict;

                // Clear item and add confirmed display
                item.innerHTML = '';
                item.appendChild(confirmedDisplay);

                // Add conflict details if there are conflicts
                if (hasConflict && conflictDetails) {
                    const detailsBox = document.createElement('div');
                    detailsBox.className = 'conflict-details-box';
                    detailsBox.innerHTML = `
                        <div class="conflict-details-header">Konflikte:</div>
                        ${conflictDetails.map(c => {
                        const start = new Date(c.startDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        const end = new Date(c.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        return `<div class="conflict-item">• ${Bands.escapeHtml(c.summary)} (${start}-${end})</div>`;
                    }).join('')}
                    `;
                    item.appendChild(detailsBox);
                }

                // Add delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-icon remove-confirmed';
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.addEventListener('click', () => {
                    item.remove();
                    this.updateRemoveButtons();
                });
                item.appendChild(deleteBtn);

                // Kein automatisches Hinzufügen eines neuen Vorschlags mehr
            });
        });

        context.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                const dateIndex = parseInt(btn.dataset.dateIndex);
                const availability = btn.dataset.availability;
                await this.vote(rehearsalId, dateIndex, availability);
            });
        });

        context.querySelectorAll('.open-rehearsal-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                await this.openRehearsalDetails(rehearsalId);
            });
        });

        context.querySelectorAll('.edit-rehearsal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                this.editRehearsal(rehearsalId);
            });
        });

        context.querySelectorAll('.delete-rehearsal').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                await this.deleteRehearsal(rehearsalId);
            });
        });

        context.querySelectorAll('.suggest-time-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                const dateIndex = parseInt(btn.dataset.dateIndex);
                await this.suggestTime(rehearsalId, dateIndex);
            });
        });
    },

    // Toggle accordion
    toggleAccordion(cardOrId) {
        let card;
        let rehearsalId;

        if (typeof cardOrId === 'string') {
            // Legacy support or call by ID (finds first match)
            rehearsalId = cardOrId;
            card = document.querySelector(`.rehearsal-card[data-rehearsal-id="${rehearsalId}"]`);
        } else {
            // Call with element
            card = cardOrId;
            rehearsalId = card.dataset.rehearsalId;
        }

        if (!card) return;

        const content = card.querySelector('.accordion-content');
        const toggle = card.querySelector('.toggle-icon');

        // Check if THIS card is expanded
        const wasExpanded = card.classList.contains('expanded');

        // Close all accordions
        document.querySelectorAll('.rehearsal-card').forEach(c => {
            c.classList.remove('expanded');
            const cont = c.querySelector('.accordion-content');
            const tog = c.querySelector('.toggle-icon');
            if (cont) cont.style.display = 'none';
            if (tog) tog.textContent = '▶';
        });

        // If it was already expanded, just close it (already done above)
        if (wasExpanded) {
            this.expandedRehearsalId = null;
            this.renderRehearsals(this.currentFilter);
        } else {
            // Open this accordion
            this.expandedRehearsalId = rehearsalId;
            this.renderRehearsals(this.currentFilter);
        }
    },

    // Open rehearsal details for confirmation
    async openRehearsalDetails(rehearsalId) {
        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (!rehearsal) {
            console.error('Rehearsal not found:', rehearsalId);
            return;
        }

        this.currentRehearsalId = rehearsalId;

        const band = await Storage.getBand(rehearsal.bandId);
        const members = await Storage.getBandMembers(rehearsal.bandId);
        const votes = await Storage.getRehearsalVotes(rehearsalId);

        // Check if proposedDates exists and is an array
        const proposedDates = Array.isArray(rehearsal.proposedDates) ? rehearsal.proposedDates : [];

        if (proposedDates.length === 0) {
            console.warn('No proposed dates found for rehearsal:', rehearsalId);
            UI.showToast('Keine vorgeschlagenen Termine gefunden', 'warning');
            return;
        }

        // Calculate statistics and get time suggestions for each date
        const dateStats = await Promise.all(proposedDates.map(async (date, index) => {
            const dateVotes = votes.filter(v => v.dateIndex === index);
            const yesCount = dateVotes.filter(v => v.availability === 'yes').length;
            const maybeCount = dateVotes.filter(v => v.availability === 'maybe').length;
            const noCount = dateVotes.filter(v => v.availability === 'no').length;
            const totalVotes = dateVotes.length;
            const score = yesCount + (maybeCount * 0.5);

            // Get time suggestions for this date
            const timeSuggestions = await Storage.getTimeSuggestionsForDate(rehearsalId, index);

            // Group suggestions by time with user names
            const suggestionsByTime = {};
            for (const suggestion of timeSuggestions) {
                const time = suggestion.suggestedTime;
                if (!suggestionsByTime[time]) {
                    suggestionsByTime[time] = [];
                }
                const user = await Storage.getById('users', suggestion.userId);
                if (user) {
                    suggestionsByTime[time].push(user.name);
                }
            }

            return { date, index, yesCount, maybeCount, noCount, totalVotes, score, timeSuggestions: suggestionsByTime };
            const proposedDates = Array.isArray(rehearsal.proposedDates) ? rehearsal.proposedDates : [];
            proposedDates.forEach(date => {
                let start = '';
                let end = '';
                if (typeof date === 'object' && date !== null && date.startTime && date.endTime) {
                    start = date.startTime.slice(0, 10);
                    const startTime = date.startTime.slice(11, 16);
                    end = date.endTime.slice(11, 16);
                    // Neues Feld wie im Standardformular
                    const newItem = document.createElement('div');
                    newItem.className = 'date-proposal-item';
                    newItem.dataset.confirmed = 'false';
                    newItem.innerHTML = `
                        <div class="date-time-range">
                            <input type="date" class="date-input-date" value="${start}" required>
                            <input type="time" class="date-input-start" value="${startTime}" required>
                            <span class="time-separator">bis</span>
                            <input type="time" class="date-input-end" value="${end}" required>
                        </div>
                    `;
                    container.appendChild(newItem);
                }
            });
        }));

        // Find best date
        const bestDate = dateStats.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        // Get members who haven't voted
        const votedUserIds = new Set(votes.map(v => v.userId));
        const notVoted = members.filter(m => !votedUserIds.has(m.userId))
            .map(m => Storage.getById('users', m.userId)?.name)
            .filter(Boolean);

        document.getElementById('rehearsalDetailsTitle').textContent = rehearsal.title;

        document.getElementById('rehearsalDetailsContent').innerHTML = `
            <div class="rehearsal-details-view">
                <div class="detail-section">
                    <h3>📊 Abstimmungsübersicht</h3>
                    <p><strong>Band:</strong> ${Bands.escapeHtml(band?.name || '')}</p>
                    <p><strong>Abgestimmt:</strong> ${votedUserIds.size} von ${members.length} Mitgliedern</p>
                    ${notVoted.length > 0 ? `
                        <p><strong>Noch nicht abgestimmt:</strong> ${notVoted.map(n => Bands.escapeHtml(n)).join(', ')}</p>
                    ` : ''}
                </div>

                <div class="detail-section">
                    <h3>🏆 Beste Termine</h3>
                    ${dateStats.sort((a, b) => b.score - a.score).map((stat, idx) => `
                        <div class="best-date-option ${idx === 0 ? 'is-best' : ''}">
                            <div class="date-header">
                                ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📅'} 
                                ${(() => {
                                    if (stat.date && typeof stat.date === 'object' && stat.date.startTime) {
                                        let label = UI.formatDate(stat.date.startTime);
                                        if (stat.date.endTime) {
                                            const start = new Date(stat.date.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                                            const end = new Date(stat.date.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                                            label += ` (${start} - ${end})`;
                                        }
                                        return label;
                                    } else {
                                        return UI.formatDate(stat.date);
                                    }
                                })()}
                            </div>
                            <div class="vote-breakdown">
                                ✅ ${stat.yesCount} können • 
                                ❓ ${stat.maybeCount} vielleicht • 
                                ❌ ${stat.noCount} können nicht
                            </div>
                            ${Object.keys(stat.timeSuggestions).length > 0 ? `
                                <div class="time-suggestions-compact">
                                    <strong>🕐 Zeitvorschläge:</strong>
                                    ${Object.entries(stat.timeSuggestions).map(([time, users]) => `
                                        <span class="time-suggestion-tag">${time} (${users.join(', ')})</span>
                                    `).join('')}
                                </div>
                            ` : ''}
                            <button class="btn btn-primary select-date-btn" 
                                    data-date-index="${stat.index}"
                                    data-date="${typeof stat.date === 'string' ? stat.date : stat.date.startTime}">
                                Diesen Termin auswählen
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Attach select date handlers
        document.querySelectorAll('.select-date-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const dateIndex = parseInt(btn.dataset.dateIndex);
                const date = btn.dataset.date;
                await this.showConfirmationModal(rehearsalId, dateIndex, date);
            });
        });

        UI.openModal('rehearsalDetailsModal');
    },

    // Show confirmation modal
    async showConfirmationModal(rehearsalId, dateIndex, date) {
        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (!rehearsal) {
            console.error('Rehearsal not found:', rehearsalId);
            return;
        }

        document.getElementById('confirmRehearsalId').value = rehearsalId;
        document.getElementById('confirmDateIndex').value = dateIndex;

        // Populate editable fields
        document.getElementById('confirmRehearsalTitle').value = rehearsal.title;
        document.getElementById('confirmRehearsalDescription').value = rehearsal.description || '';

        // Handle both old format (string) and new format (object with startTime/endTime)
        const dateString = typeof date === 'string' ? date : date.startTime;
        const endTimeString = typeof date === 'object' && date.endTime ? date.endTime : null;

        // Set start time from the selected date
        document.getElementById('confirmRehearsalStartTime').value = dateString.slice(0, 16);

        // Set end time
        let endDate;
        if (endTimeString) {
            endDate = new Date(endTimeString);
        } else {
            // Default to 2 hours after start
            const startDate = new Date(dateString);
            endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
        }
        document.getElementById('confirmRehearsalEndTime').value = endDate.toISOString().slice(0, 16);

        // Get time suggestions for this date
        const timeSuggestions = await Storage.getTimeSuggestionsForDate(rehearsalId, dateIndex);

        // Display time suggestions if any exist
        const startTimeGroup = document.getElementById('confirmRehearsalStartTime').closest('.form-group');
        let suggestionsHtml = '';

        if (timeSuggestions && timeSuggestions.length > 0) {
            // Group suggestions by time
            const suggestionsByTime = {};
            for (const suggestion of timeSuggestions) {
                const time = suggestion.suggestedTime;
                if (!suggestionsByTime[time]) {
                    suggestionsByTime[time] = [];
                }
                const user = await Storage.getById('users', suggestion.userId);
                if (user) {
                    suggestionsByTime[time].push(user.name);
                }
            }

            suggestionsHtml = `
                <div class="time-suggestions-info" style="margin-top: 0.5rem;">
                    <small style="color: var(--color-text-secondary); display: block; margin-bottom: 0.25rem;">
                        <strong>🕐 Vorgeschlagene Uhrzeiten:</strong>
                    </small>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                        ${Object.entries(suggestionsByTime).map(([time, users]) => `
                            <button type="button" class="time-suggestion-quick-select" data-time="${time}" 
                                    style="padding: 0.25rem 0.5rem; background: var(--color-primary); color: white; 
                                           border: none; border-radius: 4px; cursor: pointer; font-size: 0.8125rem;">
                                ${time} (${users.join(', ')})
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Remove any existing suggestions display
        const existingSuggestions = startTimeGroup.querySelector('.time-suggestions-info');
        if (existingSuggestions) {
            existingSuggestions.remove();
        }

        // Add suggestions after the start time input
        if (suggestionsHtml) {
            startTimeGroup.insertAdjacentHTML('beforeend', suggestionsHtml);

            // Add click handlers for quick-select buttons
            startTimeGroup.querySelectorAll('.time-suggestion-quick-select').forEach(btn => {
                btn.addEventListener('click', () => {
                    const selectedTime = btn.dataset.time;
                    const currentDateTime = document.getElementById('confirmRehearsalStartTime').value;

                    // Extract date part and combine with selected time
                    if (currentDateTime) {
                        const datePart = currentDateTime.split('T')[0];
                        document.getElementById('confirmRehearsalStartTime').value = `${datePart}T${selectedTime}`;
                    }
                });
            });
        }

        // Populate location select
        const locationSelect = document.getElementById('confirmRehearsalLocation');
        const locations = await Storage.getLocations();
        const locationsArray = Array.isArray(locations) ? locations : [];
        locationSelect.innerHTML = '<option value="">Kein Ort ausgewählt</option>' +
            locationsArray.map(loc => `<option value="${loc.id}">${Bands.escapeHtml(loc.name)}</option>`).join('');

        // Pre-select location if already set
        if (rehearsal.locationId) {
            locationSelect.value = rehearsal.locationId;
        }

        // Populate members list with checkboxes
        const members = await Storage.getBandMembers(rehearsal.bandId);
        const membersArray = Array.isArray(members) ? members : [];
        const membersList = document.getElementById('confirmMembersList');

        // Load all users first
        const userPromises = membersArray.map(member => Storage.getById('users', member.userId));
        const users = await Promise.all(userPromises);

        membersList.innerHTML = users.map(user => {
            if (!user) return '';

            return `
                <div class="checkbox-item">
                    <input type="checkbox" id="notify_${user.id}" value="${user.id}" checked>
                    <label for="notify_${user.id}">
                        ${Bands.escapeHtml(user.name)} (${Bands.escapeHtml(user.email)})
                    </label>
                </div>
            `;
        }).join('');

        UI.closeModal('rehearsalDetailsModal');
        UI.openModal('confirmRehearsalModal');
    },

    // Confirm rehearsal and send emails
    async confirmRehearsal(forceConfirm = false) {
        const rehearsalId = document.getElementById('confirmRehearsalId').value;
        const dateIndex = parseInt(document.getElementById('confirmDateIndex').value);
        const locationId = document.getElementById('confirmRehearsalLocation').value;

        // Get edited values
        const editedTitle = document.getElementById('confirmRehearsalTitle').value;
        const editedDescription = document.getElementById('confirmRehearsalDescription').value;
        const editedStartTime = document.getElementById('confirmRehearsalStartTime').value;
        const editedEndTime = document.getElementById('confirmRehearsalEndTime').value;

        if (!editedTitle || !editedStartTime || !editedEndTime) {
            UI.showToast('Bitte Titel, Start- und Endzeit ausfüllen', 'error');
            return;
        }

        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (!rehearsal) {
            console.error('Rehearsal not found:', rehearsalId);
            UI.showToast('Probe nicht gefunden', 'error');
            return;
        }

        // Use edited start time
        const selectedDate = new Date(editedStartTime).toISOString();
        const selectedEndTime = new Date(editedEndTime).toISOString();

        // Check location availability if location is selected and not forcing confirmation
        if (locationId && !forceConfirm && typeof App !== 'undefined' && App.checkLocationAvailability) {
            const startDate = new Date(editedStartTime);
            const endDate = new Date(editedEndTime);

            const availability = await App.checkLocationAvailability(locationId, startDate, endDate);

            if (!availability.available && availability.conflicts && availability.conflicts.length > 0) {
                // Show conflict warning modal
                const location = await Storage.getLocation(locationId);
                let dateLabel = '';
                if (editedStartTime) {
                    dateLabel = UI.formatDate(editedStartTime);
                    if (editedEndTime) {
                        const start = new Date(editedStartTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        const end = new Date(editedEndTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        dateLabel += ` (${start} - ${end})`;
                    }
                }
                const conflictDetailsHtml = `
                    <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid var(--color-danger);">
                        <p><strong>Ort:</strong> ${Bands.escapeHtml(location?.name || 'Unbekannt')}</p>
                        <p><strong>Gewählte Zeit:</strong> ${dateLabel}</p>
                        <div style="margin-top: 1rem;">
                            <strong>Konflikte:</strong>
                            <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                                ${availability.conflicts.map(conflict => {
                    const start = new Date(conflict.startDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    const end = new Date(conflict.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    return `<li><strong>${Bands.escapeHtml(conflict.summary)}</strong><br><small>${start} - ${end}</small></li>`;
                }).join('')}
                            </ul>
                        </div>
                    </div>
                `;

                document.getElementById('conflictDetails').innerHTML = conflictDetailsHtml;

                // Close confirmation modal and open conflict modal
                UI.closeModal('confirmRehearsalModal');
                UI.openModal('locationConflictModal');

                return; // Stop here, wait for user decision
            }
        }

        // Get selected members
        const checkboxes = document.querySelectorAll('#confirmMembersList input[type="checkbox"]:checked');
        const selectedMemberIds = Array.from(checkboxes).map(cb => cb.value);

        // Update rehearsal with confirmed date and edited details
        await Storage.updateRehearsal(rehearsalId, {
            status: 'confirmed',
            title: editedTitle,
            description: editedDescription,
            confirmedLocation: locationId || null,
            confirmedDate: selectedDate,
            endTime: selectedEndTime
        });

        // Only send emails if members are selected
        if (selectedMemberIds.length > 0) {
            const members = await Storage.getBandMembers(rehearsal.bandId);
            const selectedMembers = members.filter(m => selectedMemberIds.includes(m.userId));

            UI.showToast('Termin bestätigt. Sende E-Mails...', 'info');

            // Send emails
            const result = await EmailService.sendRehearsalConfirmation(rehearsal, selectedDate, selectedMembers);

            if (result.success) {
                UI.showToast(result.message, 'success');
            } else {
                UI.showToast(result.message, 'warning');
            }
        } else {
            UI.showToast('Termin bestätigt (keine E-Mails versendet)', 'success');
        }

        UI.closeModal('confirmRehearsalModal');
        UI.closeModal('locationConflictModal'); // Close conflict modal if it was open
        await this.renderRehearsals(this.currentFilter);

        if (typeof App !== 'undefined' && App.updateDashboard) {
            await App.updateDashboard();
        }
    },

    // Vote on a date
    async vote(rehearsalId, dateIndex, availability) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const existingVote = await Storage.getUserVoteForDate(user.id, rehearsalId, dateIndex);

        if (availability === 'none') {
            // Explicitly retract vote
            if (existingVote) {
                await Storage.deleteVote(existingVote.id);
                UI.showToast('Abstimmung zurückgezogen', 'info');
            }
        } else if (existingVote && existingVote.availability === availability) {
            // Toggle off if clicking the same option (optional, but consistent)
            await Storage.deleteVote(existingVote.id);
            UI.showToast('Abstimmung zurückgezogen', 'info');
        } else {
            // Delete existing vote if changing from one option to another
            if (existingVote) {
                await Storage.deleteVote(existingVote.id);
            }
            // Create new vote
            await Storage.createVote({
                rehearsalId,
                userId: user.id,
                dateIndex,
                availability
            });
            UI.showToast('Abstimmung gespeichert!', 'success');
        }

        // Update only this rehearsal card and scroll back to it
        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (rehearsal) {
            const card = document.querySelector(`.rehearsal-card[data-rehearsal-id="${rehearsalId}"]`);
            if (card) {
                const previousScrollY = window.scrollY;
                const newCardHtml = await this.renderRehearsalCard(rehearsal);
                card.outerHTML = newCardHtml;

                setTimeout(() => {
                    window.scrollTo({ top: previousScrollY });
                    const updatedCard = document.querySelector(`.rehearsal-card[data-rehearsal-id="${rehearsalId}"]`);
                    if (updatedCard) {
                        this.attachVoteHandlers(updatedCard);
                    }
                }, 50);
            }
        }

        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
    },

    // Suggest alternative time for a date
    async suggestTime(rehearsalId, dateIndex) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const existingSuggestion = await Storage.getUserTimeSuggestionForDate(user.id, rehearsalId, dateIndex);

        // Set hidden fields
        document.getElementById('suggestTimeRehearsalId').value = rehearsalId;
        document.getElementById('suggestTimeDateIndex').value = dateIndex;

        // Set existing time if available
        const timeInput = document.getElementById('suggestedTimeInput');
        if (existingSuggestion) {
            timeInput.value = existingSuggestion.suggestedTime;
            document.getElementById('deleteTimeSuggestionBtn').style.display = 'inline-block';
        } else {
            timeInput.value = '';
            document.getElementById('deleteTimeSuggestionBtn').style.display = 'none';
        }

        // Open modal
        UI.openModal('timeSuggestionModal');
    },

    // Save time suggestion from modal
    async saveTimeSuggestion() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const rehearsalId = document.getElementById('suggestTimeRehearsalId').value;
        const dateIndex = parseInt(document.getElementById('suggestTimeDateIndex').value);
        const timeInput = document.getElementById('suggestedTimeInput').value;

        if (!timeInput) {
            UI.showToast('Bitte eine Uhrzeit auswählen', 'error');
            return;
        }

        // Delete existing suggestion if changing
        const existingSuggestion = await Storage.getUserTimeSuggestionForDate(user.id, rehearsalId, dateIndex);
        if (existingSuggestion) {
            await Storage.deleteTimeSuggestion(existingSuggestion.id);
        }

        // Create new suggestion
        await Storage.createTimeSuggestion({
            rehearsalId,
            userId: user.id,
            dateIndex,
            suggestedTime: timeInput
        });

        UI.showToast('Zeitvorschlag gespeichert!', 'success');
        UI.closeModal('timeSuggestionModal');

        // Update the rehearsal card
        await this.refreshRehearsalCard(rehearsalId);
    },

    // Delete time suggestion from modal
    async deleteTimeSuggestion() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const rehearsalId = document.getElementById('suggestTimeRehearsalId').value;
        const dateIndex = parseInt(document.getElementById('suggestTimeDateIndex').value);

        const existingSuggestion = await Storage.getUserTimeSuggestionForDate(user.id, rehearsalId, dateIndex);
        if (existingSuggestion) {
            await Storage.deleteTimeSuggestion(existingSuggestion.id);
            UI.showToast('Zeitvorschlag gelöscht', 'info');
            UI.closeModal('timeSuggestionModal');

            // Update the rehearsal card
            await this.refreshRehearsalCard(rehearsalId);
        }
    },

    // Helper to refresh a single rehearsal card
    async refreshRehearsalCard(rehearsalId) {
        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (rehearsal) {
            const card = document.querySelector(`.rehearsal-card[data-rehearsal-id="${rehearsalId}"]`);
            if (card) {
                const newCardHtml = await this.renderRehearsalCard(rehearsal);
                card.outerHTML = newCardHtml;

                // Re-attach handlers to the updated card
                const updatedCard = document.querySelector(`.rehearsal-card[data-rehearsal-id="${rehearsalId}"]`);
                if (updatedCard) {
                    this.attachVoteHandlers(updatedCard);
                }
            }
        }
    },

    // Create new rehearsal
    async createRehearsal(bandId, title, description, dates, locationId = null, eventId = null) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        if (!(await Auth.canProposeRehearsal(bandId))) {
            UI.showToast('Du hast keine Berechtigung, Proben vorzuschlagen', 'error');
            return;
        }

        // Check location availability if location is calendar-linked
        if (locationId && typeof App !== 'undefined' && App.checkLocationAvailability) {
            for (const date of dates) {
                const startDate = new Date(`${date.date}T${date.startTime}`);
                const endDate = new Date(`${date.date}T${date.endTime}`);

                const availability = await App.checkLocationAvailability(locationId, startDate, endDate);

                if (!availability.available) {
                    const location = await Storage.getLocation(locationId);
                    const conflictList = availability.conflicts.map(c => {
                        const start = new Date(c.startDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        const end = new Date(c.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        return `• ${c.summary} (${start} - ${end})`;
                    }).join('\n');

                    const proceed = confirm(
                        `⚠️ Achtung: ${location.name} ist zu dieser Zeit bereits belegt!\n\n` +
                        `Konflikte am ${date.date}:\n${conflictList}\n\n` +
                        `Möchtest du trotzdem fortfahren?`
                    );

                    if (!proceed) {
                        return;
                    }
                }
            }
        }

        const rehearsal = {
            bandId,
            proposedBy: user.id,
            title,
            description,
            locationId,
            eventId,
            proposedDates: dates,
            status: 'pending'
        };

        const savedRehearsal = await Storage.createRehearsal(rehearsal);

        // No auto-vote for proposer anymore - they start with 'maybe' (no vote)
        // Votes will be created when they interact with the buttons

        UI.showToast('Probetermin vorgeschlagen', 'success');
        UI.closeModal('createRehearsalModal');

        this.renderRehearsals();

        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }

        return savedRehearsal;
    },

    // Edit rehearsal
    async editRehearsal(rehearsalId) {
        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return;

        this.currentRehearsalId = rehearsalId;

        // Set modal title
        document.getElementById('rehearsalModalTitle').textContent = 'Probetermin bearbeiten';
        document.getElementById('saveRehearsalBtn').textContent = 'Änderungen speichern';
        document.getElementById('editRehearsalId').value = rehearsalId;

        // Show delete button
        const deleteBtn = document.getElementById('deleteRehearsalBtn');
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
        }

        // Populate band and location selects
        await Bands.populateBandSelects();
        if (typeof App !== 'undefined' && App.populateLocationSelect) {
            await App.populateLocationSelect();
        }

        // Populate form
        document.getElementById('rehearsalBand').value = rehearsal.bandId;
        document.getElementById('rehearsalTitle').value = rehearsal.title;
        document.getElementById('rehearsalDescription').value = rehearsal.description || '';
        document.getElementById('rehearsalLocation').value = rehearsal.locationId || '';

        // Populate event select
        if (typeof App !== 'undefined' && App.populateEventSelect) {
            await App.populateEventSelect(rehearsal.bandId);
            document.getElementById('rehearsalEvent').value = rehearsal.eventId || '';
        }


        // Nur initial die Felder aus der Datenbank hinzufügen, vorhandene DOM-Felder beibehalten
        const container = document.getElementById('dateProposals');
        container.innerHTML = '';
        const proposedDates = Array.isArray(rehearsal.proposedDates) ? rehearsal.proposedDates : [];
        // Zeige alle Vorschläge als Kärtchen mit Details (wie bei Neuanlage)
        // Zeige alle Vorschläge als Kärtchen mit Verfügbarkeits-/Konfliktinfo
        const locationId = rehearsal.locationId;
        (async () => {
            for (const date of proposedDates) {
                if (typeof date === 'object' && date !== null && date.startTime && date.endTime) {
                    const dateObj = new Date(date.startTime);
                    const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
                    const timeStr = `${date.startTime.slice(11, 16)} - ${date.endTime.slice(11, 16)}`;
                    let availability = { available: true, conflicts: [] };
                    if (locationId && typeof App !== 'undefined' && App.checkLocationAvailability) {
                        availability = await this.checkSingleDateAvailability(locationId, date.startTime);
                    }
                    const conflictDetails = availability.conflicts && availability.conflicts.length > 0
                        ? `<div class='conflict-details-box'><div class='conflict-details-header'>Konflikte:</div>${availability.conflicts.map(c => `<div class='conflict-item'>• ${Bands.escapeHtml(c.summary)}</div>`).join('')}</div>`
                        : '';
                    const card = document.createElement('div');
                    card.className = 'date-proposal-item';
                    card.dataset.confirmed = date.confirmed ? 'true' : 'false';
                    card.dataset.startTime = date.startTime;
                    card.dataset.endTime = date.endTime;
                    card.style.border = `2px solid ${availability.available ? 'green' : 'red'}`;
                    card.innerHTML = `
                        <div class="confirmed-proposal-display">
                            <span class="confirmed-date">📅 ${dateStr}, ${timeStr}</span>
                            <span class="confirmed-availability ${availability.available ? 'is-available' : 'has-conflict'}">${availability.available ? '✓ Ort ist frei' : '⚠️ Raum belegt'}</span>
                        </div>
                        ${conflictDetails}
                        <button type="button" class="btn-icon remove-confirmed">🗑️</button>
                    `;
                    card.querySelector('.remove-confirmed').addEventListener('click', () => {
                        card.remove();
                        this.updateRemoveButtons();
                    });
                    container.appendChild(card);
                }
            }
        })();
        // Event-Handler für Bestätigen-Buttons neu setzen
        this.attachVoteHandlers(container);

        // Attach remove handlers und Availability
        container.querySelectorAll('.remove-date').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.date-proposal-item').remove();
                this.updateRemoveButtons();
            });
        });
        this.updateRemoveButtons();
        if (typeof App !== 'undefined') {
            this.attachAvailabilityListeners();
            UI.showLoading('Kalender wird geladen…');
            Promise.resolve(this.updateAvailabilityIndicators())
                .finally(() => UI.hideLoading());
            const locSelect = document.getElementById('rehearsalLocation');
            if (locSelect) {
                const evt = new Event('change', { bubbles: true });
                locSelect.dispatchEvent(evt);
            }
        }

        // Show notification checkbox for editing
        const notifyGroup = document.getElementById('notifyMembersGroup');
        if (notifyGroup) {
            notifyGroup.style.display = 'block';
            document.getElementById('notifyMembersOnUpdate').checked = false;
        }

        UI.openModal('createRehearsalModal');
    },

    // Update rehearsal
    updateRehearsal(rehearsalId, bandId, title, description, dates, locationId, eventId, notifyMembers = false) {
        const updatedRehearsal = Storage.updateRehearsal(rehearsalId, {
            bandId,
            title,
            description,
            locationId,
            eventId,
            proposedDates: dates
        });

        if (notifyMembers) {
            EmailService.sendRehearsalUpdate(updatedRehearsal).then(result => {
                if (result.success) {
                    UI.showToast('Update-E-Mails wurden versendet', 'success');
                } else {
                    UI.showToast('Fehler beim Senden der E-Mails', 'error');
                }
            });
        }

        UI.showToast('Probetermin aktualisiert', 'success');
        UI.closeModal('createRehearsalModal');
        this.renderRehearsals(this.currentFilter);
    },

    // Delete rehearsal
    async deleteRehearsal(rehearsalId) {
        const confirmed = await UI.confirmDelete('Möchtest du diesen Probentermin wirklich löschen?');
        if (confirmed) {
            await Storage.deleteRehearsal(rehearsalId);
            UI.showToast('Probentermin gelöscht', 'success');
            await this.renderRehearsals(this.currentFilter);
        }
    },

    // Availability helpers
    async checkSingleDateAvailability(locationId, isoString) {
        try {
            if (!locationId || !isoString || typeof App === 'undefined' || !App.checkLocationAvailability) {
                return { available: true, conflicts: [] };
            }

            // Get the location to find its linked calendar
            const location = await Storage.getLocation(locationId);
            if (!location) {
                return { available: true, conflicts: [] };
            }

            // Determine linked calendar
            let linkedCalendar = location.linkedCalendar || '';
            if (!linkedCalendar && location.linkedCalendars) {
                if (location.linkedCalendars.tonstudio) linkedCalendar = 'tonstudio';
                else if (location.linkedCalendars.festhalle) linkedCalendar = 'jms-festhalle';
                else if (location.linkedCalendars.ankersaal) linkedCalendar = 'ankersaal';
            } else if (!linkedCalendar && location.linkedToCalendar) {
                linkedCalendar = 'tonstudio';
            }

            if (!linkedCalendar) {
                // No calendar linked, always available
                return { available: true, conflicts: [] };
            }

            // Ensure calendar data is loaded
            if (typeof Calendar !== 'undefined' && Calendar.ensureLocationCalendar) {
                try {
                    await Calendar.ensureLocationCalendar(linkedCalendar, location.name);
                    console.log(`[Rehearsals] Calendar loaded: ${linkedCalendar}`);
                } catch (err) {
                    console.error(`[Rehearsals] Failed to load calendar ${linkedCalendar}:`, err);
                    // Don't return true here - the calendar might have data that failed to refresh
                }
            }

            const startDate = new Date(isoString);
            const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
            return await App.checkLocationAvailability(locationId, startDate, endDate);
        } catch (e) {
            console.error('Availability check failed', e);
            return { available: true, conflicts: [] };
        }
    },

    async updateAvailabilityIndicators() {
        const locationId = document.getElementById('rehearsalLocation')?.value || '';
        const items = document.querySelectorAll('#dateProposals .date-proposal-item');

        for (const item of items) {
            // Skip confirmed proposals
            if (item.dataset.confirmed === 'true') {
                continue;
            }

            const dateInput = item.querySelector('.date-input-date');
            const startInput = item.querySelector('.date-input-start');
            const endInput = item.querySelector('.date-input-end');
            const indicator = item.querySelector('.date-availability');

            if (!indicator) continue;

            if (!dateInput || !dateInput.value || !startInput || !startInput.value || !endInput || !endInput.value || !locationId) {
                indicator.textContent = '';
                indicator.style.color = '';
                indicator.style.fontWeight = '';
                continue;
            }

            // Combine date with start and end times
            const startDateTime = `${dateInput.value}T${startInput.value}`;
            const endDateTime = `${dateInput.value}T${endInput.value}`;

            // Check availability for the full time range
            if (typeof App !== 'undefined' && App.checkLocationAvailability) {
                const availability = await App.checkLocationAvailability(
                    locationId,
                    new Date(startDateTime),
                    new Date(endDateTime)
                );

                // Remove any existing conflict details box
                const existingDetails = item.querySelector('.conflict-details-box');
                if (existingDetails) {
                    existingDetails.remove();
                }

                if (availability.available) {
                    indicator.textContent = '✓ Ort ist frei';
                    indicator.style.color = 'green';
                    indicator.style.fontWeight = '600';
                } else {
                    const conflictCount = availability.conflicts?.length || 0;
                    indicator.textContent = `⚠️ ${conflictCount} Konflikt${conflictCount > 1 ? 'e' : ''}`;
                    indicator.style.color = 'red';
                    indicator.style.fontWeight = '600';
                }
            }
        }

        // Add time validation listeners
        items.forEach(item => {
            const startInput = item.querySelector('.date-input-start');
            const endInput = item.querySelector('.date-input-end');

            if (startInput && endInput && !startInput._timeValidationBound) {
                const validateTimes = () => {
                    if (startInput.value && endInput.value) {
                        if (endInput.value <= startInput.value) {
                            endInput.setCustomValidity('Endzeit muss nach Startzeit liegen');
                            endInput.reportValidity();
                        } else {
                            endInput.setCustomValidity('');
                        }
                    }
                };

                startInput.addEventListener('change', validateTimes);
                endInput.addEventListener('change', validateTimes);
                startInput._timeValidationBound = true;
            }
        });
    },

    // Render recent votes for dashboard
    async renderRecentVotes() {
        const container = document.getElementById('recentVotes');
        const user = Auth.getCurrentUser();

        if (!user) return;

        let rehearsals = (await Storage.getUserRehearsals(user.id)) || [];
        rehearsals = rehearsals.filter(r => r.status === 'pending');
        rehearsals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        rehearsals = rehearsals.slice(0, 3);

        if (rehearsals.length === 0) {
            UI.showEmptyState(container, '📅', 'Keine offenen Abstimmungen');
            return;
        }

        const cards = await Promise.all(rehearsals.map(rehearsal =>
            this.renderRehearsalCard(rehearsal)
        ));
        container.innerHTML = cards.join('');

        this.attachVoteHandlers(container);
    },

    // Populate statistics rehearsal select
    async populateStatsSelect() {
        const select = document.getElementById('statsRehearsalSelect');
        const user = Auth.getCurrentUser();

        if (!select || !user) return;

        const rehearsals = (await Storage.getUserRehearsals(user.id)) || [];

        const options = await Promise.all(rehearsals.map(async r => {
            const band = await Storage.getBand(r.bandId);
            return `<option value="${r.id}">${Bands.escapeHtml(r.title)} (${Bands.escapeHtml(band?.name || '')})</option>`;
        }));

        select.innerHTML = '<option value="">Probetermin auswählen</option>' + options.join('');
    },

    // Populate band select for statistics
    async populateStatsBandSelect() {
        const select = document.getElementById('statsBandSelect');
        const user = Auth.getCurrentUser();
        if (!select || !user) return;

        const bands = (await Storage.getUserBands(user.id)) || [];

        select.innerHTML = '<option value="">Band auswählen</option>' +
            bands.map(b => `<option value="${b.id}">${Bands.escapeHtml(b.name)}</option>`).join('');

        // Wenn der Nutzer genau in einer Band ist, automatisch vorauswählen
        if (bands.length === 1) {
            select.value = bands[0].id;
            // change-Event auslösen, damit abhängige UI sofort aktualisiert
            const evt = new Event('change', { bubbles: true });
            select.dispatchEvent(evt);
        }
    },

    // Add date proposal field
    addDateProposal() {
        const container = document.getElementById('dateProposals');
        if (!container) return;

        // Neues Feld als zusätzlicher Vorschlag, ohne bestehende zu überschreiben
        const newItem = document.createElement('div');
        newItem.className = 'date-proposal-item';
        newItem.dataset.confirmed = 'false';
        newItem.innerHTML = `
            <div class="date-time-range">
                <input type="date" class="date-input-date" required>
                <input type="time" class="date-input-start" required>
                <span class="time-separator">bis</span>
                <input type="time" class="date-input-end" required>
            </div>
            <span class="date-availability" style="margin-left:8px"></span>
            <button type="button" class="btn btn-sm confirm-proposal-btn">✓ Bestätigen</button>
            <button type="button" class="btn-icon remove-date">🗑️</button>
        `;

        container.appendChild(newItem);

        // Attach event handlers to the new item
        this.attachVoteHandlers(newItem);

        newItem.querySelector('.remove-date').addEventListener('click', () => {
            newItem.remove();
            this.updateRemoveButtons();
        });

        this.updateRemoveButtons();
        // Bind availability checks for new input
        this.attachAvailabilityListeners();
        // Run an immediate check to render status, with loader if slow
        UI.showLoading('Kalender wird geladen…');
        Promise.resolve(this.updateAvailabilityIndicators())
            .finally(() => UI.hideLoading());
    },

    // Update remove button states
    updateRemoveButtons() {
        const container = document.getElementById('dateProposals');
        const items = container.querySelectorAll('.date-proposal-item');
        const removeButtons = container.querySelectorAll('.remove-date');

        removeButtons.forEach((btn, index) => {
            btn.disabled = items.length <= 1;
        });
    },

    // Get dates from form
    getDatesFromForm() {
        // Sammle alle Kärtchen und offenen Inputs
        const items = document.querySelectorAll('#dateProposals .date-proposal-item');
        const dates = [];
        items.forEach(item => {
            if (item.dataset.confirmed === 'true') {
                // Kärtchen: confirmed
                const start = item.dataset.startTime;
                const end = item.dataset.endTime;
                if (start && end) {
                    dates.push({ startTime: start, endTime: end, confirmed: true });
                }
            } else {
                // Offene Inputs
                const dateInput = item.querySelector('.date-input-date');
                const startInput = item.querySelector('.date-input-start');
                const endInput = item.querySelector('.date-input-end');
                if (dateInput && startInput && endInput && dateInput.value && startInput.value && endInput.value) {
                    const startTime = `${dateInput.value}T${startInput.value}`;
                    const endTime = `${dateInput.value}T${endInput.value}`;
                    dates.push({ startTime, endTime, confirmed: false });
                }
            }
        });
        return dates;
    }
};

window.Rehearsals = Rehearsals;