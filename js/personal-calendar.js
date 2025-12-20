// Personal Calendar Module - Shows user's rehearsals and events

console.log('[PersonalCalendar] Module loading...');

const PersonalCalendar = {
    events: [],
    rehearsals: [],
    userBands: [],
    currentMonth: new Date(),

    async loadPersonalCalendar() {
        // Nur laden, wenn noch keine Daten im Speicher
        if (this.events && this.events.length > 0 && this.rehearsals && this.rehearsals.length > 0 && this.userBands && this.userBands.length > 0) {
            this.renderCalendar();
            return;
        }
        console.log('[PersonalCalendar] loadPersonalCalendar called');
        const container = document.getElementById('personalCalendarContainer');
        if (!container) {
            console.error('[PersonalCalendar] Container not found!');
            return;
        }
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Lade Termine...</p></div>';
        let overlay = document.getElementById('globalLoadingOverlay');
        try {
            const user = Auth.getCurrentUser();
            console.log('[PersonalCalendar] Current user:', user);
            if (!user) {
                throw new Error('Benutzer nicht angemeldet');
            }
            // Load user's bands to filter relevant data
            const userBands = await Storage.getUserBands(user.id);
            console.log('[PersonalCalendar] User bands:', userBands);
            if (!Array.isArray(userBands) || userBands.length === 0) {
                console.log('[PersonalCalendar] No bands found for user');
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📅</div>
                        <p>Du bist noch keiner Band beigetreten.</p>
                        <p>Trete einer Band bei, um deine Termine zu sehen.</p>
                    </div>
                `;
                return;
            }
            const bandIds = userBands.map(b => b.id || b.band_id || b.bandId);
            console.log('[PersonalCalendar] Band IDs:', bandIds);
            // Load all events and rehearsals
            const [allEvents, allRehearsals] = await Promise.all([
                this.loadUserEvents(bandIds),
                this.loadUserRehearsals(bandIds)
            ]);
            console.log('[PersonalCalendar] Loaded events:', allEvents.length);
            console.log('[PersonalCalendar] Loaded rehearsals:', allRehearsals.length);
            this.events = allEvents;
            this.rehearsals = allRehearsals;
            this.userBands = userBands;
            this.renderCalendar();

        } catch (error) {
            console.error('[PersonalCalendar] Error loading personal calendar:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>Termine konnten nicht geladen werden.</p>
                    <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                        ${this.escapeHtml(error.message)}
                    </p>
                    <button onclick="PersonalCalendar.loadPersonalCalendar()" class="btn btn-primary" style="margin-top: 1rem;">
                        🔄 Erneut versuchen
                    </button>
                </div>
            `;
        } finally {
            // Lade-Overlay immer ausblenden
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 400);
            }
        }
    },

    async loadUserEvents(bandIds) {
        if (!bandIds || bandIds.length === 0) return [];

        try {
            // Try to get from Supabase
            if (SupabaseClient.client) {
                const { data, error } = await SupabaseClient.client
                    .from('events')
                    .select('*')
                    .in('bandId', bandIds)
                    .order('date', { ascending: true });

                if (error) throw error;
                return data || [];
            } else {
                throw new Error('Supabase client not initialized');
            }
        } catch (error) {
            console.error('[PersonalCalendar] Error loading events:', error);
            // Fallback to storage
            const allEvents = await Storage.getAllEvents() || [];
            return allEvents.filter(event => bandIds.includes(event.bandId));
        }
    },

    async loadUserRehearsals(bandIds) {
        if (!bandIds || bandIds.length === 0) return [];

        try {
            // Try to get from Supabase
            if (SupabaseClient.client) {
                const { data, error } = await SupabaseClient.client
                    .from('rehearsals')
                    .select('*')
                    .in('bandId', bandIds)
                    .eq('status', 'confirmed')
                    .order('confirmedDate', { ascending: true });

                if (error) throw error;
                return data || [];
            } else {
                throw new Error('Supabase client not initialized');
            }
        } catch (error) {
            console.error('[PersonalCalendar] Error loading rehearsals:', error);
            // Fallback to storage
            const allRehearsals = await Storage.getAllRehearsals() || [];
            return allRehearsals.filter(rehearsal =>
                bandIds.includes(rehearsal.bandId) && rehearsal.status === 'confirmed'
            );
        }
    },

    renderCalendar() {
        const container = document.getElementById('personalCalendarContainer');
        if (!container) return;

        // Combine and sort all items by date
        const allItems = [
            ...this.events.map(e => ({ ...e, type: 'event', sortDate: new Date(e.date) })),
            ...this.rehearsals.map(r => ({ ...r, type: 'rehearsal', sortDate: new Date(r.confirmed_date) }))
        ].sort((a, b) => a.sortDate - b.sortDate);

        if (allItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <p>Keine Termine vorhanden</p>
                    <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                        Proben und Auftritte deiner Bands werden hier angezeigt.
                    </p>
                </div>
            `;
            return;
        }

        // Group items by month
        const itemsByMonth = this.groupByMonth(allItems);

        let html = '<div class="personal-calendar-timeline">';

        Object.keys(itemsByMonth).sort().forEach(monthKey => {
            const items = itemsByMonth[monthKey];
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

            html += `
                <div class="calendar-month-section">
                    <h3 class="calendar-month-header">${monthName}</h3>
                    <div class="calendar-items-list">
            `;

            items.forEach(item => {
                if (item.type === 'event') {
                    html += this.renderEventItem(item);
                } else {
                    html += this.renderRehearsalItem(item);
                }
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    groupByMonth(items) {
        const grouped = {};
        items.forEach(item => {
            const date = item.type === 'event' ? new Date(item.date) : new Date(item.confirmedDate);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    },

    renderEventItem(event) {
        const band = this.userBands.find(b => b.id === event.bandId);
        const bandName = band ? band.name : 'Unbekannte Band';
        const date = new Date(event.date);
        const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = event.time || '';
        const isPast = date < new Date();

        return `
            <div class="calendar-item event-item ${isPast ? 'past-item' : ''}">
                <div class="calendar-item-icon">🎤</div>
                <div class="calendar-item-content">
                    <div class="calendar-item-title">${this.escapeHtml(event.name)}</div>
                    <div class="calendar-item-meta">
                        <span class="calendar-item-band">🎸 ${this.escapeHtml(bandName)}</span>
                        <span class="calendar-item-date">📅 ${dateStr}</span>
                        ${timeStr ? `<span class="calendar-item-time">🕐 ${this.escapeHtml(timeStr)}</span>` : ''}
                        ${event.location ? `<span class="calendar-item-location">📍 ${this.escapeHtml(event.location)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    renderRehearsalItem(rehearsal) {
        const band = this.userBands.find(b => b.id === rehearsal.bandId);
        const bandName = band ? band.name : 'Unbekannte Band';
        const date = new Date(rehearsal.confirmedDate);
        const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = rehearsal.confirmedTime || '';
        const isPast = date < new Date();

        return `
            <div class="calendar-item rehearsal-item ${isPast ? 'past-item' : ''}">
                <div class="calendar-item-icon">📅</div>
                <div class="calendar-item-content">
                    <div class="calendar-item-title">${this.escapeHtml(rehearsal.name || 'Probe')}</div>
                    <div class="calendar-item-meta">
                        <span class="calendar-item-band">🎸 ${this.escapeHtml(bandName)}</span>
                        <span class="calendar-item-date">📅 ${dateStr}</span>
                        ${timeStr ? `<span class="calendar-item-time">🕐 ${this.escapeHtml(timeStr)}</span>` : ''}
                        ${rehearsal.confirmed_location ? `<span class="calendar-item-location">📍 ${this.escapeHtml(rehearsal.confirmed_location)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    renderCalendar() {
        const container = document.getElementById('personalCalendarContainer');
        if (!container) return;

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const monthName = this.currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

        // Get first and last day of month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Get day of week for first day (Monday = 0)
        let startDay = firstDay.getDay() - 1;
        if (startDay === -1) startDay = 6; // Sunday becomes 6

        const daysInMonth = lastDay.getDate();

        // Build calendar HTML
        let html = `
            <div class="calendar-header">
                <button onclick="PersonalCalendar.previousMonth()" class="btn btn-icon" style="font-size: 1.5rem;">‹</button>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <h3 style="color: var(--color-text); margin: 0; font-size: 1.5rem; font-weight: 700;">${monthName}</h3>
                    <button onclick="PersonalCalendar.goToToday()" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.75rem;">📅 Heute</button>
                </div>
                <button onclick="PersonalCalendar.nextMonth()" class="btn btn-icon" style="font-size: 1.5rem;">›</button>
            </div>
            
            <div class="calendar-grid">
                <div class="calendar-day-header">Mo</div>
                <div class="calendar-day-header">Di</div>
                <div class="calendar-day-header">Mi</div>
                <div class="calendar-day-header">Do</div>
                <div class="calendar-day-header">Fr</div>
                <div class="calendar-day-header">Sa</div>
                <div class="calendar-day-header">So</div>
        `;

        // Add empty cells before month starts
        for (let i = 0; i < startDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Add actual days
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);

            const isToday = currentDate.getTime() === today.getTime();
            const dayItems = this.getItemsForDate(currentDate);

            let dayClass = 'calendar-day';
            if (isToday) dayClass += ' today';
            if (dayItems.length > 0) dayClass += ' has-events';

            html += `
                <div class="${dayClass}">
                    <div class="calendar-day-number">${day}</div>
                    <div class="calendar-day-events">
                        ${dayItems.map(item => this.renderCalendarItem(item)).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    getItemsForDate(date) {
        const items = [];

        // Add events for this date
        this.events.forEach(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            if (eventDate.getTime() === date.getTime()) {
                items.push({ ...event, type: 'event' });
            }
        });

        // Add rehearsals for this date
        this.rehearsals.forEach(rehearsal => {
            const rehearsalDate = new Date(rehearsal.confirmedDate);
            rehearsalDate.setHours(0, 0, 0, 0);
            if (rehearsalDate.getTime() === date.getTime()) {
                items.push({ ...rehearsal, type: 'rehearsal' });
            }
        });

        return items;
    },

    renderCalendarItem(item) {
        if (item.type === 'event') {
            const band = this.userBands.find(b => b.id === item.bandId);
            const bandName = band ? band.name : 'Unbekannte Band';
            const eventName = item.title || 'Auftritt';

            return `
                <div class="calendar-event event-type" onclick="PersonalCalendar.showItemDetails('${item.id}', 'event')" style="cursor: pointer;">
                    <div class="calendar-event-type">🎤 Auftritt</div>
                    <div class="calendar-event-title">${this.escapeHtml(eventName)}</div>
                    <div class="calendar-event-band">${this.escapeHtml(bandName)}</div>
                </div>
            `;
        } else {
            const band = this.userBands.find(b => b.id === item.bandId);
            const bandName = band ? band.name : 'Unbekannte Band';
            const title = item.title || 'Probe';

            return `
                <div class="calendar-event rehearsal-type" onclick="PersonalCalendar.showItemDetails('${item.id}', 'rehearsal')" style="cursor: pointer;">
                    <div class="calendar-event-type">📅 Probe</div>
                    <div class="calendar-event-title">${this.escapeHtml(title)}</div>
                    <div class="calendar-event-band">${this.escapeHtml(bandName)}</div>
                </div>
            `;
        }
    },

    previousMonth() {
        this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
        this.renderCalendar();
    },

    nextMonth() {
        this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
        this.renderCalendar();
    },

    goToToday() {
        this.currentMonth = new Date();
        this.renderCalendar();
    },

    async showItemDetails(itemId, itemType) {
        let item;


        if (itemType === 'event') {
            item = this.events.find(e => e.id === itemId);
        } else {
            item = this.rehearsals.find(r => r.id === itemId);
        }

        if (!item) {
            console.error('Item not found:', itemId, itemType);
            return;
        }

        const band = this.userBands.find(b => b.id === item.bandId);
        const bandName = band ? band.name : 'Unbekannte Band';

        let detailsHTML = '';

        if (itemType === 'event') {
            const date = new Date(item.date);
            const dateStr = date.toLocaleDateString('de-DE', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            // Get band members for this event, fetch user names
            let membersHTML = '';
            if (item.bandId) {
                const members = await Storage.getBandMembers(item.bandId);
                let memberUsers = [];
                if (members && members.length > 0) {
                    // Fetch all user objects in parallel
                    memberUsers = await Promise.all(members.map(async m => {
                        const user = await Storage.getById('users', m.userId);
                        return {
                            ...m,
                            name: user ? (user.name || user.username || user.email || m.userId) : m.userId
                        };
                    }));
                    membersHTML = `
                        <div style="margin-top: 1rem;">
                            <strong style="color: var(--color-text);">Band-Mitglieder:</strong>
                            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${memberUsers.map(m => `
                                    <span style="background: var(--color-bg); padding: 0.25rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.875rem;">
                                        ${this.escapeHtml(m.name)}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            }

            // Get setlist
            let setlistHTML = '';
            const songs = await Storage.getEventSongs(item.id);
            if (songs && songs.length > 0) {
                setlistHTML = `
                    <div style="margin-top: 1rem;">
                        <strong style="color: var(--color-text);">Setlist:</strong>
                        <div style="margin-top: 0.5rem;">
                            ${songs.map((song, idx) => `
                                <div style="padding: 0.5rem; background: var(--color-bg); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
                                    <strong>${idx + 1}. ${this.escapeHtml(song.title)}</strong>
                                    ${song.artist ? ` - ${this.escapeHtml(song.artist)}` : ''}
                                    ${song.key ? ` <span style="color: var(--color-text-secondary);">(${this.escapeHtml(song.key)})</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            detailsHTML = `
                <div style="padding: 1rem;">
                    <h2 style="color: var(--color-text); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 2rem;">🎤</span>
                        ${this.escapeHtml(item.title || 'Auftritt')}
                    </h2>
                    
                    <div style="background: linear-gradient(135deg, var(--color-secondary), #db2777); color: white; padding: 0.5rem 1rem; border-radius: var(--radius-md); display: inline-block; margin-bottom: 1rem;">
                        <strong>Auftritt</strong>
                    </div>

                    <div style="color: var(--color-text-secondary); line-height: 1.8;">
                        <p><strong>🎸 Band:</strong> ${this.escapeHtml(bandName)}</p>
                        <p><strong>📅 Datum:</strong> ${dateStr}</p>
                        ${item.time ? `<p><strong>🕐 Uhrzeit:</strong> ${this.escapeHtml(item.time)}</p>` : ''}
                        ${item.location ? `<p><strong>📍 Ort:</strong> ${this.escapeHtml(item.location)}</p>` : ''}
                        ${item.soundcheck ? `<p><strong>🎚️ Soundcheck:</strong> ${this.escapeHtml(item.soundcheck)}</p>` : ''}
                        ${item.notes ? `<p><strong>📝 Notizen:</strong><br>${this.escapeHtml(item.notes)}</p>` : ''}
                    </div>

                    ${membersHTML}
                    ${setlistHTML}
                </div>
            `;
        } else {
            const date = new Date(item.confirmedDate);
            const dateStr = date.toLocaleDateString('de-DE', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            // Get location details
            let locationHTML = '';
            if (item.confirmedLocation) {
                const location = await Storage.getById('locations', item.confirmedLocation);
                if (location) {
                    locationHTML = `
                        <p><strong>📍 Proberaum:</strong> ${this.escapeHtml(location.name)}</p>
                        ${location.address ? `<p style="margin-left: 1.5rem; color: var(--color-text-secondary);">${this.escapeHtml(location.address)}</p>` : ''}
                    `;
                }
            }

            // Get band members for this rehearsal, fetch user names
            let membersHTML = '';
            if (item.bandId) {
                const members = await Storage.getBandMembers(item.bandId);
                let memberUsers = [];
                if (members && members.length > 0) {
                    memberUsers = await Promise.all(members.map(async m => {
                        const user = await Storage.getById('users', m.userId);
                        return {
                            ...m,
                            name: user ? (user.name || user.username || user.email || m.userId) : m.userId
                        };
                    }));
                    membersHTML = `
                        <div style="margin-top: 1rem;">
                            <strong style="color: var(--color-text);">Band-Mitglieder:</strong>
                            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${memberUsers.map(m => `
                                    <span style="background: var(--color-bg); padding: 0.25rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.875rem;">
                                        ${this.escapeHtml(m.name)}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            }

            // Get attendance
            let attendanceHTML = '';
            if (item.responses && Object.keys(item.responses).length > 0) {
                const accepted = Object.values(item.responses).filter(r => r === 'accepted').length;
                const declined = Object.values(item.responses).filter(r => r === 'declined').length;
                const maybe = Object.values(item.responses).filter(r => r === 'maybe').length;

                attendanceHTML = `
                    <div style="margin-top: 1rem;">
                        <strong style="color: var(--color-text);">Zusagen:</strong>
                        <div style="margin-top: 0.5rem; display: flex; gap: 1rem;">
                            <span style="color: var(--color-success);">✓ ${accepted} Zugesagt</span>
                            <span style="color: var(--color-danger);">✗ ${declined} Abgesagt</span>
                            <span style="color: var(--color-warning);">? ${maybe} Vielleicht</span>
                        </div>
                    </div>
                `;
            }

            detailsHTML = `
                <div style="padding: 1rem;">
                    <h2 style="color: var(--color-text); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 2rem;">📅</span>
                        ${this.escapeHtml(item.title || 'Probe')}
                    </h2>
                    <div style="color: var(--color-text-secondary); line-height: 1.8;">
                        <p><strong>🎸 Band:</strong> ${this.escapeHtml(bandName)}</p>
                        <p><strong>📅 Datum:</strong> ${dateStr}</p>
                        ${item.confirmedTime ? `<p><strong>🕐 Uhrzeit:</strong> ${this.escapeHtml(item.confirmedTime)}</p>` : ''}
                        ${locationHTML}
                        ${item.notes ? `<p><strong>📝 Notizen:</strong><br>${this.escapeHtml(item.notes)}</p>` : ''}
                    </div>

                    ${membersHTML}
                    ${attendanceHTML}
                </div>
            `;
        }

        // Create modal
        const modalHTML = `
            <div id="itemDetailsModal" class="modal active" style="z-index: 1000;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>
                            ${itemType === 'event' ? 'Auftrittdetails' : 'Probendetails'}
                        </h2>
                        <button class="modal-close" onclick="PersonalCalendar.closeDetailsModal()">×</button>
                    </div>
                    <div class="modal-body">
                        ${detailsHTML}
                    </div>
                    <div class="modal-actions">
                        <button class="btn" onclick="PersonalCalendar.closeDetailsModal()">Schließen</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('itemDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add click-outside-to-close
        const modal = document.getElementById('itemDetailsModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeDetailsModal();
            }
        });
    },

    closeDetailsModal() {
        const modal = document.getElementById('itemDetailsModal');
        if (modal) {
            modal.remove();
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

console.log('[PersonalCalendar] Module loaded successfully');
console.log('[PersonalCalendar] loadPersonalCalendar function type:', typeof PersonalCalendar.loadPersonalCalendar);

// Make globally accessible
window.PersonalCalendar = PersonalCalendar;
