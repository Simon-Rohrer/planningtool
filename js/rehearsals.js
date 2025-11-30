// Rehearsals Management Module

const Rehearsals = {
    currentFilter: '',

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
                    <span class="rehearsal-status status-${rehearsal.status}">
                        ${rehearsal.status === 'pending' ? 'Abstimmung läuft' : 'Bestätigt'}
                    </span>
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
        const rehearsal = Storage.getRehearsal(rehearsalId);

        const yesCount = dateVotes.filter(v => v.availability === 'yes').length;
        const maybeCount = dateVotes.filter(v => v.availability === 'maybe').length;
        const noCount = dateVotes.filter(v => v.availability === 'no').length;

        const userVote = Storage.getUserVoteForDate(userId, rehearsalId, dateIndex);
        const userAvailability = userVote ? userVote.availability : null;

        const canConfirm = Auth.canConfirmRehearsal(rehearsal.bandId) && rehearsal.status === 'pending';

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
                    ${canConfirm ? `
                        <button class="btn btn-sm btn-primary confirm-date-btn" 
                                data-rehearsal-id="${rehearsalId}" 
                                data-date-index="${dateIndex}">
                            Bestätigen & E-Mail senden
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Attach vote and confirm handlers
    attachVoteHandlers() {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rehearsalId = btn.dataset.rehearsalId;
                const dateIndex = parseInt(btn.dataset.dateIndex);
                const availability = btn.dataset.availability;
                this.vote(rehearsalId, dateIndex, availability);
            });
        });

        document.querySelectorAll('.confirm-date-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rehearsalId = btn.dataset.rehearsalId;
                const dateIndex = parseInt(btn.dataset.dateIndex);
                this.confirmRehearsal(rehearsalId, dateIndex);
            });
        });
    },

    // Confirm rehearsal and send emails
    async confirmRehearsal(rehearsalId, dateIndex) {
        const rehearsal = Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return;

        if (!confirm('Möchtest du diesen Termin wirklich bestätigen? Alle Bandmitglieder werden per E-Mail benachrichtigt.')) {
            return;
        }

        // Update status
        Storage.updateRehearsal(rehearsalId, { status: 'confirmed' });

        // Get band members for email
        const members = Storage.getBandMembers(rehearsal.bandId);
        const selectedDate = rehearsal.proposedDates[dateIndex];

        UI.showToast('Termin bestätigt. Sende E-Mails...', 'info');

        // Send emails
        const result = await EmailService.sendRehearsalConfirmation(rehearsal, selectedDate, members);

        if (result.success) {
            UI.showToast(result.message, 'success');
        } else {
            UI.showToast(result.message, 'warning');
        }

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

        // Update dashboard
        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
    },

    // Create new rehearsal
    createRehearsal(bandId, title, description, dates, locationId = null) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        // Check permissions
        if (!Auth.canProposeRehearsal(bandId)) {
            UI.showToast('Du hast keine Berechtigung, Proben vorzuschlagen', 'error');
            return;
        }

        const rehearsal = {
            bandId,
            proposedBy: user.id,
            title,
            description,
            locationId, // Store location ID
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

        // Refresh view
        this.renderRehearsals();

        // Update dashboard
        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }

        return savedRehearsal;
    },

    // Render recent votes for dashboard
    renderRecentVotes() {
        const container = document.getElementById('recentVotes');
        const user = Auth.getCurrentUser();

        if (!user) return;

        let rehearsals = Storage.getUserRehearsals(user.id);

        // Filter to only pending rehearsals
        rehearsals = rehearsals.filter(r => r.status === 'pending');

        // Sort by creation date
        rehearsals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Take only first 3
        rehearsals = rehearsals.slice(0, 3);

        if (rehearsals.length === 0) {
            UI.showEmptyState(container, '📅', 'Keine offenen Abstimmungen');
            return;
        }

        container.innerHTML = rehearsals.map(rehearsal =>
            this.renderRehearsalCard(rehearsal)
        ).join('');

        // Add vote handlers
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
        const dateCount = container.querySelectorAll('.date-proposal-item').length;

        const newItem = document.createElement('div');
        newItem.className = 'date-proposal-item';
        newItem.innerHTML = `
            <input type="datetime-local" class="date-input" required>
            <button type="button" class="btn-icon remove-date">🗑️</button>
        `;

        container.appendChild(newItem);

        // Add remove handler
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
