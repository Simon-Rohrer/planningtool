// Rehearsals Management Module

const Rehearsals = {
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
        const canManage = isCreator || isAdmin; // Simplified permission for demo

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

                        ${rehearsal.status === 'pending' ? `
                            <div class="date-options">
                                ${(await Promise.all(rehearsal.proposedDates.map((date, index) =>
            this.renderDateOption(rehearsal.id, date, index, user.id)
        ))).join('')}
                            </div>
                        ` : ''}

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

        return `
            <div class="date-option">
                <div class="date-info">
                    <div class="date-time">📅 ${UI.formatDate(date)}</div>
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
                </div>
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
        } else {
            // Open this accordion
            card.classList.add('expanded');
            if (content) content.style.display = 'block';
            if (toggle) toggle.textContent = '▼';
            this.expandedRehearsalId = rehearsalId;
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

        // Calculate statistics
        const dateStats = proposedDates.map((date, index) => {
            const dateVotes = votes.filter(v => v.dateIndex === index);
            const yesCount = dateVotes.filter(v => v.availability === 'yes').length;
            const maybeCount = dateVotes.filter(v => v.availability === 'maybe').length;
            const noCount = dateVotes.filter(v => v.availability === 'no').length;
            const totalVotes = dateVotes.length;
            const score = yesCount + (maybeCount * 0.5);

            return { date, index, yesCount, maybeCount, noCount, totalVotes, score };
        });

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
                                ${UI.formatDate(stat.date)}
                            </div>
                            <div class="vote-breakdown">
                                ✅ ${stat.yesCount} können • 
                                ❓ ${stat.maybeCount} vielleicht • 
                                ❌ ${stat.noCount} können nicht
                            </div>
                            <button class="btn btn-primary select-date-btn" 
                                    data-date-index="${stat.index}"
                                    data-date="${stat.date}">
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
        document.getElementById('selectedDateTime').textContent = UI.formatDate(date);

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
    async confirmRehearsal() {
        const rehearsalId = document.getElementById('confirmRehearsalId').value;
        const dateIndex = parseInt(document.getElementById('confirmDateIndex').value);
        const locationId = document.getElementById('confirmRehearsalLocation').value;

        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (!rehearsal) {
            console.error('Rehearsal not found:', rehearsalId);
            UI.showToast('Probe nicht gefunden', 'error');
            return;
        }

        // Check if proposedDates exists and has the selected index
        if (!Array.isArray(rehearsal.proposedDates) || !rehearsal.proposedDates[dateIndex]) {
            console.error('Invalid date index:', dateIndex, 'proposedDates:', rehearsal.proposedDates);
            UI.showToast('Ungültiger Termin ausgewählt', 'error');
            return;
        }

        const selectedDate = rehearsal.proposedDates[dateIndex];

        // Get selected members
        const checkboxes = document.querySelectorAll('#confirmMembersList input[type="checkbox"]:checked');
        const selectedMemberIds = Array.from(checkboxes).map(cb => cb.value);

        // Update rehearsal with confirmed date (not dateIndex)
        await Storage.updateRehearsal(rehearsalId, {
            status: 'confirmed',
            confirmedLocation: locationId || null,
            confirmedDate: selectedDate
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

        // Update only this rehearsal card instead of re-rendering entire list (preserves scroll position)
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

        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
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

        // Populate dates
        const container = document.getElementById('dateProposals');
        const proposedDates = Array.isArray(rehearsal.proposedDates) ? rehearsal.proposedDates : [];
        container.innerHTML = proposedDates.map(date => `
            <div class="date-proposal-item">
                <input type="datetime-local" class="date-input" value="${date.slice(0, 16)}" required>
                <span class="date-availability" style="margin-left:8px"></span>
                <button type="button" class="btn-icon remove-date">🗑️</button>
            </div>
        `).join('');

        // Attach remove handlers
        container.querySelectorAll('.remove-date').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.date-proposal-item').remove();
                this.updateRemoveButtons();
            });
        });

        this.updateRemoveButtons();

        // Attach availability listeners and trigger initial check
        if (typeof App !== 'undefined') {
            this.attachAvailabilityListeners();
            // Initial check to show status immediately, with loader if slow
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
            const input = item.querySelector('.date-input');
            const indicator = item.querySelector('.date-availability');
            if (!indicator) continue;
            if (!input.value || !locationId) {
                indicator.textContent = '';
                indicator.style.color = '';
                indicator.style.fontWeight = '';
                continue;
            }
            const availability = await this.checkSingleDateAvailability(locationId, new Date(input.value).toISOString());
            if (availability.available) {
                indicator.textContent = 'Ort ist frei';
                indicator.style.color = 'green';
                indicator.style.fontWeight = '600';
            } else {
                indicator.textContent = '⚠️ Ort belegt';
                indicator.style.color = 'red';
                indicator.style.fontWeight = '600';
            }
        }
    },

    attachAvailabilityListeners() {
        const locSelect = document.getElementById('rehearsalLocation');
        if (locSelect && !locSelect._availabilityBound) {
            locSelect.addEventListener('change', () => this.updateAvailabilityIndicators());
            locSelect._availabilityBound = true;
        }
        const inputs = document.querySelectorAll('#dateProposals .date-input');
        inputs.forEach(input => {
            if (!input._availabilityBound) {
                input.addEventListener('change', () => this.updateAvailabilityIndicators());
                input._availabilityBound = true;
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

        const newItem = document.createElement('div');
        newItem.className = 'date-proposal-item';
        newItem.innerHTML = `
            <input type="datetime-local" class="date-input" required>
            <span class="date-availability" style="margin-left:8px"></span>
            <button type="button" class="btn-icon remove-date">🗑️</button>
        `;

        container.appendChild(newItem);

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
        const inputs = document.querySelectorAll('#dateProposals .date-input');
        const dates = [];

        inputs.forEach(input => {
            if (input.value) {
                dates.push(new Date(input.value).toISOString());
            }
        });

        return dates;
    }
};