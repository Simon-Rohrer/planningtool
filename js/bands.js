// Bands Management Module

const Bands = {
    currentBandId: null,

    instrumentIcons: {
        'drums': '🥁',
        'bass': '🎸',
        'acoustic_guitar': '🎸',
        'electric_guitar': '🎸',
        'keyboard': '🎹',
        'synth': '🎹',
        'violin': '🎻',
        'vocals': '🎤'
    },

    getInstrumentName(instrument) {
        const names = {
            'drums': 'Schlagzeug',
            'bass': 'Bass',
            'acoustic_guitar': 'Akustische Gitarre',
            'electric_guitar': 'Elektrische Gitarre',
            'keyboard': 'Keyboard',
            'synth': 'Synth',
            'violin': 'Geige',
            'vocals': 'Gesang'
        };
        return names[instrument] || '';
    },

    // Render all user's bands
    renderBands() {
        const container = document.getElementById('bandsList');
        const user = Auth.getCurrentUser();

        if (!user) return;

        // Hide create button if not allowed
        const createBtn = document.getElementById('createBandBtn');
        if (createBtn) {
            createBtn.style.display = Auth.canCreateBand() ? 'block' : 'none';
        }

        const bands = Storage.getUserBands(user.id);

        if (bands.length === 0) {
            UI.showEmptyState(container, '🎸', 'Du bist noch in keiner Band. Tritt einer Band bei!');
            return;
        }

        container.innerHTML = bands.map(band => {
            const members = Storage.getBandMembers(band.id);
            const memberCount = members.length;

            return `
                <div class="band-card" data-band-id="${band.id}" style="border-left: 4px solid ${band.color || '#6366f1'}">
                    <div class="band-card-header">
                        <div>
                            <h3>${this.escapeHtml(band.name)}</h3>
                        </div>
                        <span class="band-role-badge ${UI.getRoleClass(band.role)}">
                            ${UI.getRoleDisplayName(band.role)}
                        </span>
                    </div>
                    <p>${this.escapeHtml(band.description || 'Keine Beschreibung')}</p>
                    <div class="band-card-footer">
                        <span>👥 ${memberCount} Mitglied${memberCount !== 1 ? 'er' : ''}</span>
                        <span>${UI.formatRelativeTime(band.createdAt)}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.band-card').forEach(card => {
            card.addEventListener('click', () => {
                const bandId = card.dataset.bandId;
                this.showBandDetails(bandId);
            });
        });

        // Update nav visibility based on current membership
        this.updateNavVisibility();
    },

    // Show band details modal
    showBandDetails(bandId) {
        this.currentBandId = bandId;
        const band = Storage.getBand(bandId);
        const user = Auth.getCurrentUser();

        if (!band) return;

        // Set band name and add edit button if allowed
        const nameHeader = document.getElementById('bandDetailsName');
        const canEdit = Auth.canEditBandDetails(bandId);

        if (canEdit) {
            nameHeader.innerHTML = `
                ${this.escapeHtml(band.name)}
                <button class="btn-icon edit-band-name" title="Bandnamen ändern">✏️</button>
            `;

            // Add edit handler
            nameHeader.querySelector('.edit-band-name').addEventListener('click', () => {
                this.editBandName(bandId);
            });
        } else {
            nameHeader.textContent = band.name;
        }

        // Show modal
        UI.openModal('bandDetailsModal');

        // Render members
        this.renderBandMembers(bandId);

        // Show/hide settings based on permissions
        const canManage = Auth.canManageBand(bandId);
        const addMemberBtn = document.getElementById('addMemberBtn');
        const deleteBandBtn = document.getElementById('deleteBandBtn');

        if (addMemberBtn) {
            addMemberBtn.style.display = canManage ? 'inline-flex' : 'none';
        }
        if (deleteBandBtn) {
            deleteBandBtn.style.display = canManage ? 'inline-flex' : 'none';
        }

        // Show join code for leaders/admins
        const settingsTab = document.getElementById('settingsTab');
        if (canManage) {
            const existingCode = settingsTab.querySelector('.join-code-section');
            if (!existingCode) {
                const codeSection = document.createElement('div');
                codeSection.className = 'section join-code-section';
                codeSection.innerHTML = `
                    <h3>Band-Beitrittscode</h3>
                    <div class="join-code-display">
                        <b><code class="join-code">${band.joinCode || 'Kein Code'}</code></b>
                        <p class="help-text">Teile diesen Code mit neuen Mitgliedern, damit sie der Band beitreten können.</p>
                    </div>
                `;
                settingsTab.insertBefore(codeSection, settingsTab.firstChild);
            }
        } else {
            const existingCode = settingsTab.querySelector('.join-code-section');
            if (existingCode) existingCode.remove();
        }

        // Add Leave Band button (if not already present)
        const existingLeaveSection = settingsTab.querySelector('.leave-band-section');
        if (existingLeaveSection) existingLeaveSection.remove();

        const leaveSection = document.createElement('div');
        leaveSection.className = 'section leave-band-section';
        leaveSection.style.marginTop = 'var(--spacing-lg)';
        leaveSection.style.borderTop = '1px solid var(--color-border)';
        leaveSection.style.paddingTop = 'var(--spacing-md)';
        leaveSection.innerHTML = `
            <h3>Band verlassen</h3>
            <p class="help-text">Möchtest du diese Band verlassen?</p>
            <button class="btn btn-warning" id="leaveBandBtn">Band verlassen</button>
        `;

        // Insert before the delete section (which is the last section usually)
        // Or just append to settingsTab
        settingsTab.appendChild(leaveSection);

        leaveSection.querySelector('#leaveBandBtn').addEventListener('click', () => {
            this.leaveBand(bandId);
        });

        // Wire up song button
        const addBandSongBtn = document.getElementById('addBandSongBtn');
        if (addBandSongBtn) {
            const newBtn = addBandSongBtn.cloneNode(true);
            addBandSongBtn.parentNode.replaceChild(newBtn, addBandSongBtn);
            newBtn.addEventListener('click', () => {
                App.openSongModal(null, bandId, null);
            });
        }

        // Render band songs
        App.renderBandSongs(bandId);

        // Add 'Abwesenheiten' tab for leaders and co-leaders
        const roleOfUser = Storage.getUserRoleInBand(user.id, bandId);
        const tabButtons = document.querySelector('.tab-buttons');
        const existingAbsencesTabBtn = tabButtons ? tabButtons.querySelector('[data-tab="absences"]') : null;
        if ((roleOfUser === 'leader' || roleOfUser === 'co-leader') && tabButtons) {
            // If a static tab button exists (from HTML), unhide and bind it; otherwise create one
            if (!existingAbsencesTabBtn) {
                const absBtn = document.createElement('button');
                absBtn.className = 'tab-btn';
                absBtn.dataset.tab = 'absences';
                absBtn.textContent = 'Abwesenheiten';
                tabButtons.appendChild(absBtn);

                absBtn.addEventListener('click', () => {
                    if (window.App && typeof window.App.switchTab === 'function') {
                        window.App.switchTab('absences');
                    }
                });
            } else {
                // unhide existing button and ensure it has a click handler
                existingAbsencesTabBtn.style.display = '';
                // ensure event bound only once
                if (!existingAbsencesTabBtn._bound) {
                    existingAbsencesTabBtn.addEventListener('click', () => {
                        if (window.App && typeof window.App.switchTab === 'function') {
                            window.App.switchTab('absences');
                        }
                    });
                    existingAbsencesTabBtn._bound = true;
                }
            }

            // Use existing absences tab content if present (from HTML), otherwise create it
            let absencesTab = document.getElementById('absencesTab');
            if (!absencesTab) {
                absencesTab = document.createElement('div');
                absencesTab.id = 'absencesTab';
                absencesTab.className = 'tab-content';
                const section = document.createElement('div');
                section.className = 'section';
                section.innerHTML = `<h3>Abwesenheiten der Mitglieder</h3><div id="bandAbsencesList"></div>`;
                absencesTab.appendChild(section);
                const settingsPanel = document.getElementById('bandDetailsModal').querySelector('.modal-body');
                if (settingsPanel) settingsPanel.appendChild(absencesTab);
            }

            // Populate absences list (use date-only formatting)
            const absList = document.getElementById('bandAbsencesList');
            if (absList) {
                const members = Storage.getBandMembers(bandId);
                const rows = members.map(m => {
                    const u = Storage.getById('users', m.userId);
                    if (!u) return '';
                    const abs = Storage.getUserAbsences(u.id) || [];
                    if (abs.length === 0) return `
                        <div class="absence-member">
                            <strong>${this.escapeHtml(u.name)}</strong>
                            <div class="help-text">Keine Abwesenheiten</div>
                        </div>
                    `;

                    return `
                        <div class="absence-member">
                            <strong>${this.escapeHtml(u.name)}</strong>
                            <ul>
                                ${abs.sort((a,b)=> new Date(b.startDate)-new Date(a.startDate)).map(a => `<li>${UI.formatDateOnly(a.startDate)} — ${UI.formatDateOnly(a.endDate)}${a.reason ? ' — ' + this.escapeHtml(a.reason) : ''}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }).join('');

                absList.innerHTML = rows && rows.trim().length > 0 ? rows : '<p class="text-muted">Keine Abwesenheiten vorhanden.</p>';
            }
        } else {
            // Hide absences tab button if present and user not leader/co-leader
            if (existingAbsencesTabBtn) existingAbsencesTabBtn.style.display = 'none';
            const absencesTabEl = document.getElementById('absencesTab');
            if (absencesTabEl) absencesTabEl.remove();
        }
    },

    // Edit band name
    editBandName(bandId) {
        const band = Storage.getBand(bandId);
        if (!band) return;

        const newName = prompt('Neuer Bandname:', band.name);

        if (newName && newName.trim() !== '' && newName !== band.name) {
            // Check for duplicate name
            const allBands = Storage.getAllBands();
            const duplicate = allBands.find(b =>
                b.name.toLowerCase() === newName.trim().toLowerCase() &&
                b.id !== bandId
            );

            if (duplicate) {
                UI.showToast(`Eine Band mit dem Namen "${newName}" existiert bereits`, 'error');
                return;
            }

            Storage.updateBand(bandId, { name: newName.trim() });
            UI.showToast('Bandname aktualisiert', 'success');

            // Refresh view
            this.showBandDetails(bandId);
            this.renderBands();

            // Update dashboard
            if (typeof App !== 'undefined' && App.updateDashboard) {
                App.updateDashboard();
            }
        }
    },

    // Join band with code
    joinBand(joinCode) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const band = Storage.getBandByJoinCode(joinCode);

        if (!band) {
            UI.showToast('Ungültiger Beitrittscode', 'error');
            return;
        }

        // Check if already member
        if (Auth.isMemberOfBand(band.id)) {
            UI.showToast('Du bist bereits Mitglied dieser Band', 'error');
            return;
        }

        // Determine role: Admin gets leader, others get member
        const role = Auth.isAdmin() ? 'leader' : 'member';

        // Add as member or leader
        Storage.addBandMember(band.id, user.id, role);
        Auth.updateCurrentUser();

        UI.showToast(`Erfolgreich der Band "${band.name}" beigetreten!`, 'success');
        UI.closeModal('joinBandModal');
        this.renderBands();

        // Update dashboard
        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
    },

    // Render band members
    renderBandMembers(bandId) {
        const container = document.getElementById('membersList');
        const members = Storage.getBandMembers(bandId);
        const currentUser = Auth.getCurrentUser();
        const canManage = Auth.canManageBand(bandId);
        const canChangeRoles = Auth.canChangeRoles(bandId);

        if (members.length === 0) {
            UI.showEmptyState(container, '👥', 'Noch keine Mitglieder');
            return;
        }

        container.innerHTML = members.map(member => {
            const user = Storage.getById('users', member.userId);
            if (!user) return '';

            const isCurrentUser = user.id === currentUser.id;
            // Can remove if manager and not removing self (unless admin)
            const canRemove = canManage && (!isCurrentUser || Auth.isAdmin());

            // Role selector if can change roles
            let roleDisplay;
            if (canChangeRoles && !isCurrentUser) {
                roleDisplay = `
                    <select class="role-select" data-user-id="${user.id}">
                        <option value="member" ${member.role === 'member' ? 'selected' : ''}>Mitglied</option>
                        <option value="co-leader" ${member.role === 'co-leader' ? 'selected' : ''}>Co-Leiter</option>
                        <option value="leader" ${member.role === 'leader' ? 'selected' : ''}>Leiter</option>
                    </select>
                `;
            } else {
                roleDisplay = `
                    <span class="band-role-badge ${UI.getRoleClass(member.role)}">
                        ${UI.getRoleDisplayName(member.role)}
                    </span>
                `;
            }

            // Instrument display
            const instrumentIcon = user.instrument ? (this.instrumentIcons[user.instrument] || '') : '';

            return `
                <div class="member-item">
                    <div class="member-info">
                        <div class="member-avatar">
                            ${UI.getUserInitials(user.name)}
                        </div>
                        <div class="member-details">
                            <h4>${this.escapeHtml(user.name)} ${isCurrentUser ? '(Du)' : ''}</h4>
                            <p>${this.escapeHtml(user.email)}</p>
                            ${instrumentIcon ? `<p class="member-instrument-label">${instrumentIcon} ${this.getInstrumentName(user.instrument)}</p>` : ''}
                        </div>
                    </div>
                    <div class="member-actions">
                        ${roleDisplay}
                        ${canRemove ? `
                            <button class="btn-icon remove-member" data-user-id="${user.id}" title="Entfernen">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add remove handlers
        container.querySelectorAll('.remove-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                this.removeMember(bandId, userId);
            });
        });

        // Add role change handlers
        container.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                e.stopPropagation();
                const userId = select.dataset.userId;
                const newRole = e.target.value;
                this.updateMemberRole(bandId, userId, newRole);
            });
        });
    },

    // Render absences for all members of a band (helper, can be called from App)
    renderBandAbsences(bandId) {
        const container = document.getElementById('bandAbsencesList');
        if (!container) return;

        const members = Storage.getBandMembers(bandId);
        if (!members || members.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Mitglieder</p>';
            return;
        }
        // Determine if any member has absences
        const membersWithAbs = members.map(m => {
            const u = Storage.getById('users', m.userId);
            if (!u) return null;
            const abs = Storage.getUserAbsences(u.id) || [];
            return { user: u, absences: abs };
        }).filter(x => x !== null);

        const anyAbsences = membersWithAbs.some(m => m.absences && m.absences.length > 0);

        if (!anyAbsences) {
            container.innerHTML = '<p class="text-muted">Kein Mitglied hat eine Abwesenheit eingetragen.</p>';
            return;
        }

        // Render only members who have absences
        const rows = membersWithAbs.filter(m => m.absences && m.absences.length > 0).map(m => {
            const list = m.absences.sort((a,b)=> new Date(b.startDate)-new Date(a.startDate)).map(a => `
                <div style="padding:6px 0;">
                    <div><strong>${UI.formatDateOnly(a.startDate)} — ${UI.formatDateOnly(a.endDate)}</strong></div>
                    ${a.reason ? `<div class="help-text">${this.escapeHtml(a.reason)}</div>` : ''}
                </div>
            `).join('');

            return `
                <div class="absence-member" style="padding:8px; border-bottom:1px solid var(--color-border);">
                    <strong>${this.escapeHtml(m.user.name)}</strong>
                    <div class="absence-list">${list}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = rows;
    },

    // Update member role
    updateMemberRole(bandId, userId, newRole) {
        if (!Auth.canChangeRoles(bandId)) {
            UI.showToast('Keine Berechtigung', 'error');
            return;
        }

        Storage.updateBandMemberRole(bandId, userId, newRole);
        UI.showToast('Rolle aktualisiert', 'success');
        this.renderBandMembers(bandId);
    },

    // Create new band
    createBand(name, description) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        if (!Auth.canCreateBand()) {
            UI.showToast('Du hast keine Berechtigung, Bands zu erstellen', 'error');
            return;
        }

        // Check for duplicate name
        const allBands = Storage.getAllBands();
        const duplicate = allBands.find(b => b.name.toLowerCase() === name.trim().toLowerCase());

        if (duplicate) {
            UI.showToast(`Eine Band mit dem Namen "${name}" existiert bereits`, 'error');
            return;
        }

        // Create band (without automatically adding creator as member)
        const band = Storage.createBand({
            name,
            description,
            createdBy: user.id
        });

        UI.showToast(`Band "${name}" erstellt! Beitrittscode: ${band.joinCode}`, 'success');
        UI.closeModal('createBandModal');
        this.renderBands();

        return band;
    },

    // Add member to band
    addMember(bandId, username, role) {
        const user = Storage.getUserByUsername(username);

        if (!user) {
            UI.showToast('Benutzer nicht gefunden', 'error');
            return;
        }

        // Check if already a member
        const existingMembers = Storage.getBandMembers(bandId);
        const alreadyMember = existingMembers.some(m => m.userId === user.id);

        if (alreadyMember) {
            UI.showToast('Benutzer ist bereits Mitglied dieser Band', 'error');
            return;
        }

        // Add member
        Storage.addBandMember(bandId, user.id, role);

        UI.showToast('Mitglied erfolgreich hinzugefügt!', 'success');
        UI.closeModal('addMemberModal');
        this.renderBandMembers(bandId);
    },

    // Remove member from band
    removeMember(bandId, userId) {
        const user = Storage.getById('users', userId);
        if (!user) return;

        UI.showConfirm(`Möchtest du ${user.name} wirklich aus der Band entfernen?`, () => {
            Storage.removeBandMember(bandId, userId);
            UI.showToast('Mitglied entfernt', 'success');
            this.renderBandMembers(bandId);
        });
    },

    // Delete band
    deleteBand(bandId) {
        const band = Storage.getBand(bandId);
        if (!band) return;

        UI.showConfirm(`Möchtest du die Band "${band.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, () => {
            Storage.deleteBand(bandId);
            UI.showToast('Band gelöscht', 'success');
            UI.closeModal('bandDetailsModal');
            this.renderBands();
        });

        // Update dashboard if needed
        if (typeof App !== 'undefined' && App.updateDashboard) {
            App.updateDashboard();
        }
        // Update nav visibility after deleting a band
        this.updateNavVisibility();
    },

    // Leave band (current user)
    leaveBand(bandId) {
        const band = Storage.getBand(bandId);
        const user = Auth.getCurrentUser();
        if (!band || !user) return;

        UI.showConfirm('Willst du die Band wirklich verlassen?', () => {
            // Remove current user from band members
            const ok = Storage.removeBandMember(bandId, user.id);
            if (ok) {
                UI.showToast('Du hast die Band verlassen', 'success');
                UI.closeModal('bandDetailsModal');
                this.renderBands();
                if (typeof App !== 'undefined' && App.updateDashboard) App.updateDashboard();
                // Notify other modules
                document.dispatchEvent(new Event('bandsUpdated'));
                // Update nav visibility
                this.updateNavVisibility();
            } else {
                UI.showToast('Konnte die Band-Zugehörigkeit nicht entfernen', 'error');
            }
        });
    },

    // Show/hide navigation items depending on whether the current user is in at least one band
    updateNavVisibility() {
        try {
            const user = Auth.getCurrentUser();
            const count = user ? (Storage.getUserBands(user.id) || []).length : 0;
            const show = count > 0;

            const eventsBtn = document.querySelector('.nav-item[data-view="events"]');
            const rehearsalsBtn = document.querySelector('.nav-item[data-view="rehearsals"]');
            const absenceBtn = document.getElementById('absenceBtn');
            const settingsBtn = document.getElementById('settingsBtn');

            if (eventsBtn) eventsBtn.style.display = show ? '' : 'none';
            if (rehearsalsBtn) rehearsalsBtn.style.display = show ? '' : 'none';
            if (absenceBtn) absenceBtn.style.display = show ? '' : 'none';
            if (settingsBtn) settingsBtn.style.display = show ? '' : 'none';
        } catch (e) {
            console.error('updateNavVisibility error', e);
        }
    },

    // Populate band select dropdowns
    populateBandSelects() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bands = Storage.getUserBands(user.id);

        // Populate rehearsal band select (only bands where user can propose)
        const rehearsalSelect = document.getElementById('rehearsalBand');
        if (rehearsalSelect) {
            const eligibleBands = bands.filter(b =>
                b.role === 'leader' || b.role === 'co-leader'
            );

            rehearsalSelect.innerHTML = '<option value="">Band auswählen</option>' +
                eligibleBands.map(band =>
                    `<option value="${band.id}">${this.escapeHtml(band.name)}</option>`
                ).join('');
        }

        // Populate band filter
        const bandFilter = document.getElementById('bandFilter');
        if (bandFilter) {
            bandFilter.innerHTML = '<option value="">Alle Bands</option>' +
                bands.map(band =>
                    `<option value="${band.id}">${this.escapeHtml(band.name)}</option>`
                ).join('');
        }
    },

    // Utility: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
