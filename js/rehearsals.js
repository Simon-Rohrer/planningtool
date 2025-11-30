// Rehearsals Management Module

const Rehearsals = {
    currentFilter: '',
    currentRehearsalId: null,

    // Render all rehearsals
    renderRehearsals(filterBandId = '') {
        const container = document.getElementById('rehearsalsList');
        const user = Auth.getCurrentUser();

        if (!user) return;

        let rehearsals = Storage.getUserRehearsals(user.id);

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

        container.innerHTML = rehearsals.map(rehearsal =>
            this.renderRehearsalCard(rehearsal)
        ).join('');

        // Add vote handlers
        this.attachVoteHandlers();
    },

    // Render single rehearsal card
    renderRehearsalCard(rehearsal) {
        const band = Storage.getBand(rehearsal.bandId);
        const proposer = Storage.getById('users', rehearsal.proposedBy);
        const user = Auth.getCurrentUser();
        const canManage = Auth.canConfirmRehearsal(rehearsal.bandId);

        return `
            <div class="rehearsal-card" data-rehearsal-id="${rehearsal.id}">
                <div class="rehearsal-header">
                    <div>
                        <h3>${Bands.escapeHtml(rehearsal.title)}</h3>
                        <div class="rehearsal-band">
                            🎸 ${Bands.escapeHtml(band?.name || 'Unbekannte Band')} • 
                            Vorgeschlagen von ${Bands.escapeHtml(proposer?.name || 'Unbekannt')}
                        </div>
                    </div>
                    <div class="rehearsal-actions">
                        <span class="rehearsal-status status-${rehearsal.status}">
                            ${rehearsal.status === 'pending' ? 'Abstimmung läuft' : 'Bestätigt'}
                        </span>
                        ${canManage && rehearsal.status === 'pending' ? `
                            <button class="btn btn-sm btn-primary open-rehearsal-btn" 
                                    data-rehearsal-id="${rehearsal.id}">
                                Öffnen & Bestätigen
                            </button>
                        ` : ''}
                        ${canManage ? `
                            <button class="btn-icon edit-rehearsal" data-rehearsal-id="${rehearsal.id}" title="Bearbeiten">✏️</button>
                        ` : ''}
                    </div>
                </div>
                ${rehearsal.description ? `
                    <p class="rehearsal-description">${Bands.escapeHtml(rehearsal.description)}</p>
                ` : ''}
                <div class="date-options">
                    ${rehearsal.proposedDates.map((date, index) =>
            this.renderDateOption(rehearsal.id, date, index, user.id)
        ).join('')}
                </div>
            </div>
        `;
    },

    // Render single date option with voting
    renderDateOption(rehearsalId, date, dateIndex, userId) {
        const votes = Storage.getRehearsalVotes(rehearsalId);
        const dateVotes = votes.filter(v => v.dateIndex === dateIndex);

        const yesCount = dateVotes.filter(v => v.availability === 'yes').length;
        const maybeCount = dateVotes.filter(v => v.availability === 'maybe').length;
        const noCount = dateVotes.filter(v => v.availability === 'no').length;

        const userVote = Storage.getUserVoteForDate(userId, rehearsalId, dateIndex);
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
    attachVoteHandlers() {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rehearsalId = btn.dataset.rehearsalId;
                const dateIndex = parseInt(btn.dataset.dateIndex);
                const availability = btn.dataset.availability;
                this.vote(rehearsalId, dateIndex, availability);
            });
        });

        document.querySelectorAll('.open-rehearsal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                this.openRehearsalDetails(rehearsalId);
            });
        });

        document.querySelectorAll('.edit-rehearsal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rehearsalId = btn.dataset.rehearsalId;
                this.editRehearsal(rehearsalId);
            });
        });
    },

    // Open rehearsal details for confirmation
    openRehearsalDetails(rehearsalId) {
        const rehearsal = Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return;

        this.currentRehearsalId = rehearsalId;

        const band = Storage.getBand(rehearsal.bandId);
        const members = Storage.getBandMembers(rehearsal.bandId);
        const votes = Storage.getRehearsalVotes(rehearsalId);

        // Calculate statistics
        const dateStats = rehearsal.proposedDates.map((date, index) => {
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
            btn.addEventListener('click', () => {
                const dateIndex = parseInt(btn.dataset.dateIndex);
                const date = btn.dataset.date;
                this.showConfirmationModal(rehearsalId, dateIndex, date);
            });
        });

        UI.openModal('rehearsalDetailsModal');
    },

    // Show confirmation modal
    showConfirmationModal(rehearsalId, dateIndex, date) {
        const rehearsal = Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return;

        document.getElementById('confirmRehearsalId').value = rehearsalId;
        document.getElementById('confirmDateIndex').value = dateIndex;
        document.getElementById('selectedDateTime').textContent = UI.formatDate(date);

        // Populate location select
        const locationSelect = document.getElementById('confirmRehearsalLocation');
        const locations = Storage.getLocations();
        locationSelect.innerHTML = '<option value="">Kein Ort ausgewählt</option>' +
            locations.map(loc => `<option value="${loc.id}">${Bands.escapeHtml(loc.name)}</option>`).join('');

        // Pre-select location if already set
        if (rehearsal.locationId) {
            locationSelect.value = rehearsal.locationId;
        }

        // Populate members list with checkboxes
        const members = Storage.getBandMembers(rehearsal.bandId);
        const membersList = document.getElementById('confirmMembersList');
        membersList.innerHTML = members.map(member => {
            const user = Storage.getById('users', member.userId);
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

        const rehearsal = Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return;

        // Get selected members
        const checkboxes = document.querySelectorAll('#confirmMembersList input[type="checkbox"]:checked');
        const selectedMemberIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedMemberIds.length === 0) {
            UI.showToast('Bitte wähle mindestens ein Bandmitglied aus', 'error');
            return;
        }

        // Update rehearsal with location
        Storage.updateRehearsal(rehearsalId, {
            status: 'confirmed',
            locationId: locationId || null,
            confirmedDateIndex: dateIndex
        });

        const selectedDate = rehearsal.proposedDates[dateIndex];
        const members = Storage.getBandMembers(rehearsal.bandId);
        const selectedMembers = members.filter(m => selectedMemberIds.includes(m.userId));

        UI.showToast('Termin bestätigt. Sende E-Mails...', 'info');

        // Send emails
        const result = await EmailService.sendRehearsalConfirmation(rehearsal, selectedDate, selectedMembers);

        if (result.success) {
            UI.showToast(result.message, 'success');
        } else {
            UI.showToast(result.message, 'warning');
        }

        UI.closeModal('confirmRehearsalModal');
        this.renderRehearsals(this.currentFilter);

        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
    },

    // Vote on a date
    vote(rehearsalId, dateIndex, availability) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        Storage.createVote({
            rehearsalId,
            userId: user.id,
            dateIndex,
            availability
        });

        UI.showToast('Abstimmung gespeichert!', 'success');
        this.renderRehearsals(this.currentFilter);

        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
    },

    // Create new rehearsal
    createRehearsal(bandId, title, description, dates, locationId = null) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        if (!Auth.canProposeRehearsal(bandId)) {
            UI.showToast('Du hast keine Berechtigung, Proben vorzuschlagen', 'error');
            return;
        }

        const rehearsal = {
            bandId,
            proposedBy: user.id,
            title,
            description,
            locationId,
            proposedDates: dates,
            status: 'pending'
        };

        const savedRehearsal = Storage.createRehearsal(rehearsal);

        // Create initial votes for proposer (auto-yes)
        dates.forEach((_, index) => {
            Storage.createVote({
                rehearsalId: savedRehearsal.id,
                userId: user.id,
                dateIndex: index,
                availability: 'yes'
            });
        });

        UI.showToast('Probetermin vorgeschlagen', 'success');
        UI.closeModal('createRehearsalModal');

        this.renderRehearsals();

        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }

        return savedRehearsal;
    },

    // Edit rehearsal
    editRehearsal(rehearsalId) {
        const rehearsal = Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return;

        this.currentRehearsalId = rehearsalId;

        // Set modal title
        document.getElementById('rehearsalModalTitle').textContent = 'Probetermin bearbeiten';
        document.getElementById('saveRehearsalBtn').textContent = 'Änderungen speichern';
        document.getElementById('editRehearsalId').value = rehearsalId;

        // Populate form
        document.getElementById('rehearsalBand').value = rehearsal.bandId;
        document.getElementById('rehearsalTitle').value = rehearsal.title;
        document.getElementById('rehearsalDescription').value = rehearsal.description || '';
        document.getElementById('rehearsalLocation').value = rehearsal.locationId || '';

        // Populate dates
        const container = document.getElementById('dateProposals');
        container.innerHTML = rehearsal.proposedDates.map(date => `
            <div class="date-proposal-item">
                <input type="datetime-local" class="date-input" value="${date.slice(0, 16)}" required>
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

        UI.openModal('createRehearsalModal');
    },

    // Update rehearsal
    updateRehearsal(rehearsalId, bandId, title, description, dates, locationId) {
        Storage.updateRehearsal(rehearsalId, {
            bandId,
            title,
            description,
            locationId,
            proposedDates: dates
        });

        UI.showToast('Probetermin aktualisiert', 'success');
        UI.closeModal('createRehearsalModal');
        this.renderRehearsals(this.currentFilter);
    },

    // Delete rehearsal
    deleteRehearsal(rehearsalId) {
        if (!UI.confirm('Möchtest du diesen Probetermin wirklich löschen?')) {
            return;
        }

        Storage.deleteRehearsal(rehearsalId);
        UI.showToast('Probetermin gelöscht', 'success');
        this.renderRehearsals(this.currentFilter);
    },

    // Render recent votes for dashboard
    renderRecentVotes() {
        const container = document.getElementById('recentVotes');
        const user = Auth.getCurrentUser();

        if (!user) return;

        let rehearsals = Storage.getUserRehearsals(user.id);
        rehearsals = rehearsals.filter(r => r.status === 'pending');
        rehearsals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        rehearsals = rehearsals.slice(0, 3);

        if (rehearsals.length === 0) {
            UI.showEmptyState(container, '📅', 'Keine offenen Abstimmungen');
            return;
        }

        container.innerHTML = rehearsals.map(rehearsal =>
            this.renderRehearsalCard(rehearsal)
        ).join('');

        this.attachVoteHandlers();
    },

    // Populate statistics rehearsal select
    populateStatsSelect() {
        const select = document.getElementById('statsRehearsalSelect');
        const user = Auth.getCurrentUser();

        if (!select || !user) return;

        const rehearsals = Storage.getUserRehearsals(user.id);

        select.innerHTML = '<option value="">Probetermin auswählen</option>' +
            rehearsals.map(r => {
                const band = Storage.getBand(r.bandId);
                return `<option value="${r.id}">${Bands.escapeHtml(r.title)} (${Bands.escapeHtml(band?.name || '')})</option>`;
            }).join('');
    },

    // Add date proposal field
    addDateProposal() {
        const container = document.getElementById('dateProposals');

        const newItem = document.createElement('div');
        newItem.className = 'date-proposal-item';
        newItem.innerHTML = `
            <input type="datetime-local" class="date-input" required>
            <button type="button" class="btn-icon remove-date">🗑️</button>
        `;

        container.appendChild(newItem);

        newItem.querySelector('.remove-date').addEventListener('click', () => {
            newItem.remove();
            this.updateRemoveButtons();
        });

        this.updateRemoveButtons();
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