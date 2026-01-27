// Personal Calendar Module - Shows user's rehearsals and events

const PersonalCalendar = {
    events: [],
    rehearsals: [],
    userBands: [],
    currentMonth: new Date(),
    isLoading: false,

    // Clear all cached data (called during logout)
    clearCache() {
        this.events = [];
        this.rehearsals = [];
        this.userBands = [];
    },

    async loadPersonalCalendar() {
        Logger.time('Personal Calendar Load');
        // Nur laden, wenn noch keine Daten im Speicher
        if (this.events && this.events.length > 0 && this.rehearsals && this.rehearsals.length > 0 && this.userBands && this.userBands.length > 0) {
            this.renderCalendar();
            Logger.timeEnd('Personal Calendar Load');
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;

        const startTime = performance.now();
        const container = document.getElementById('personalCalendarContainer');
        if (!container) {
            console.error('[PersonalCalendar] Container not found!');
            Logger.timeEnd('Personal Calendar Load');
            return;
        }
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Lade Termine...</p></div>';
        let overlay = document.getElementById('globalLoadingOverlay');
        try {
            const user = Auth.getCurrentUser();
            // Load user's bands to filter relevant data
            const userBands = await Storage.getUserBands(user.id);
            if (!Array.isArray(userBands) || userBands.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📅</div>
                        <p>Du bist noch keiner Band beigetreten.</p>
                        <p>Trete einer Band bei, um deine Termine zu sehen.</p>
                    </div>
                `;
                Logger.timeEnd('Personal Calendar Load');
                return;
            }
            const bandIds = userBands.map(b => b.id || b.band_id || b.bandId);
            // Load all events and rehearsals
            const [allEvents, allRehearsals] = await Promise.all([
                this.loadUserEvents(bandIds),
                this.loadUserRehearsals(bandIds)
            ]);
            this.events = allEvents;
            this.rehearsals = allRehearsals;
            this.userBands = userBands;
            this.renderCalendar();

            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            Logger.info(`Personal Calendar Loaded – (${allEvents.length} events, ${allRehearsals.length} rehearsals, ${duration}s)`);
            delete Logger.timers['Personal Calendar Load']; // handled manually
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
            this.isLoading = false;
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
    },

    /**
     * Generate ICS content string
     */
    generateICSContent() {
        if ((!this.events || this.events.length === 0) && (!this.rehearsals || this.rehearsals.length === 0)) {
            return null;
        }

        let icsContent =
            'BEGIN:VCALENDAR\r\n' +
            'VERSION:2.0\r\n' +
            'PRODID:-//BandManager//PersonalCalendar v1.0//DE\r\n' +
            'CALSCALE:GREGORIAN\r\n' +
            'METHOD:PUBLISH\r\n' +
            'X-WR-CALNAME:Mein Band-Kalender\r\n' +
            'X-WR-TIMEZONE:UTC\r\n' + // Changed to UTC to be safe
            'REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n' +
            'X-PUBLISHED-TTL:PT1H\r\n';

        // Use UTC for all dates to avoid timezone issues
        const formatDate = (date) => {
            const d = new Date(date);
            const pad = (n) => n < 10 ? '0' + n : n;
            return d.getUTCFullYear() +
                pad(d.getUTCMonth() + 1) +
                pad(d.getUTCDate()) + 'T' +
                pad(d.getUTCHours()) +
                pad(d.getUTCMinutes()) +
                pad(d.getUTCSeconds()) + 'Z';
        };

        const addEvent = (uid, start, end, summary, description, location) => {
            icsContent += 'BEGIN:VEVENT\r\n';
            icsContent += `UID:${uid}\r\n`;
            icsContent += `DTSTAMP:${formatDate(new Date())}\r\n`;
            icsContent += `DTSTART:${formatDate(start)}\r\n`;
            if (end) {
                icsContent += `DTEND:${formatDate(end)}\r\n`;
            }
            icsContent += `SUMMARY:${summary}\r\n`;
            icsContent += `DESCRIPTION:${description}\r\n`;
            if (location) {
                icsContent += `LOCATION:${location}\r\n`;
            }
            icsContent += 'END:VEVENT\r\n';
        };

        // Process Events
        for (const event of this.events) {
            const startDate = new Date(event.date);
            if (event.time) {
                const [h, m] = event.time.split(':');
                startDate.setHours(h, m);
            }
            const endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 3); // Default 3h duration

            // Band name lookup
            const band = this.userBands.find(b => b.id === (event.bandId || (event.band ? event.band.id : null)));
            const bandName = band ? band.name : (event.band ? event.band.name : 'Band');

            addEvent(
                `event_${event.id}@bandmanager`,
                startDate,
                endDate,
                `🎤 ${event.title} (${bandName})`,
                event.notes || '',
                event.location || ''
            );
        }

        // Process Rehearsals
        for (const rehearsal of this.rehearsals) {
            const startDate = new Date(rehearsal.confirmedDate);
            if (rehearsal.confirmedTime) {
                const [h, m] = rehearsal.confirmedTime.split(':');
                startDate.setHours(h, m);
            }
            const endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 2);

            const band = this.userBands.find(b => b.id === (rehearsal.bandId || (rehearsal.band ? rehearsal.band.id : null)));
            const bandName = band ? band.name : (rehearsal.band ? rehearsal.band.name : 'Unknown');

            let locationName = '';
            // Only try to use location name if we have it or could look it up
            // For now, leave empty to avoid complexity in sync

            addEvent(
                `rehearsal_${rehearsal.id}@bandmanager`,
                startDate,
                endDate,
                `📅 Probe: ${bandName}`,
                rehearsal.notes || '',
                locationName
            );
        }

        icsContent += 'END:VCALENDAR';
        return icsContent;
    },

    /**
     * Start subscription flow: Sync to cloud -> Show link modal
     */
    async startSubscriptionFlow() {
        const loadingToast = UI.showToast('Kalender wird synchronisiert...', 'info');
        try {
            const user = Auth.getCurrentUser();
            if (!user) throw new Error('Nicht eingeloggt');

            const icsContent = this.generateICSContent();
            if (!icsContent) {
                UI.showToast('Keine Termine zum Synchronisieren.', 'warning');
                return;
            }

            // Upload to Supabase Storage
            const client = SupabaseClient.getClient();
            if (!client) throw new Error('Datenbank-Verbindung fehlt');

            const fileName = `user_${user.id}.ics`;
            const { data, error } = await client
                .storage
                .from('calendars')
                .upload(fileName, icsContent, {
                    contentType: 'text/calendar',
                    upsert: true,
                    cacheControl: '3600'
                });

            if (error) {
                if (error.message.includes('Bucket not found')) {
                    throw new Error('Storage Bucket "calendars" fehlt! Bitte erstelle ihn in Supabase.');
                }
                throw error;
            }

            // Get Public URL
            const { data: { publicUrl } } = client
                .storage
                .from('calendars')
                .getPublicUrl(fileName);

            // Verify if bucket is actually public
            try {
                const check = await fetch(publicUrl, { method: 'HEAD' });
                if (!check.ok) {
                    UI.showToast('⚠️ WICHTIG: Dein "calendars" Bucket ist privacy (privat). Bitte stelle ihn in Supabase auf "Public"!', 'warning', 10000);
                    // Don't throw, let them see the link anyway, but warn heavily
                }
            } catch (e) {
                console.warn('Verification of public URL failed', e);
            }

            // Convert to webcal://
            const webcalUrl = publicUrl.replace(/^https?:\/\//, 'webcal://');

            // Show UI
            this.showSubscriptionModal(webcalUrl);
            UI.showToast('Kalender erfolgreich synchronisiert!', 'success');

        } catch (error) {
            console.error('Subscription Error:', error);
            UI.showToast('Fehler: ' + error.message, 'error');
        }
    },

    showSubscriptionModal(webcalUrl) {
        const modalHTML = `
            <div id="calendarSubModal" class="modal active" style="z-index: 2000;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>📅 Kalender abonnieren</h2>
                        <button class="modal-close" onclick="document.getElementById('calendarSubModal').remove()">×</button>
                    </div>
                    <div class="modal-body" style="text-align: center;">
                        <p style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">
                            Klicke unten, um den Kalender direkt zu abonnieren. 
                            Dein Handy wird sich automatisch öffenen.
                        </p>
                        
                        <a href="${webcalUrl}" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1.5rem; width: 100%;">
                            🔗 Jetzt abonnieren
                        </a>

                        <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius-md); text-align: left;">
                            <p style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.5rem;">Manueller Link:</p>
                            <code style="display: block; word-break: break-all; font-size: 0.8rem; padding: 0.5rem; background: rgba(0,0,0,0.1); border-radius: 4px;">${webcalUrl}</code>
                            <button onclick="navigator.clipboard.writeText('${webcalUrl}'); UI.showToast('Kopiert!', 'success')" class="btn btn-sm btn-secondary" style="margin-top: 0.5rem; width: 100%;">
                                📋 Link kopieren
                            </button>
                        </div>

                        <p style="margin-top: 1.5rem; font-size: 0.8rem; color: var(--color-text-secondary);">
                            ℹ️ Der Kalender aktualisiert sich automatisch, wenn du die App öffnest oder Änderungen vornimmst.
                        </p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    /**
     * Silent background sync (called after edits)
     */
    async syncCalendarBackground() {
        try {
            console.log('[PersonalCalendar] Starting background sync...');
            const user = Auth.getCurrentUser();
            if (!user) return;

            // CRITICAL FIX: Reload data if cache is empty!
            if (!this.events || this.events.length === 0 || !this.rehearsals || this.rehearsals.length === 0) {
                const userBands = await Storage.getUserBands(user.id);
                if (userBands && Array.isArray(userBands) && userBands.length > 0) {
                    this.userBands = userBands;
                    const bandIds = userBands.map(b => b.id);
                    const [allEvents, allRehearsals] = await Promise.all([
                        this.loadUserEvents(bandIds),
                        this.loadUserRehearsals(bandIds)
                    ]);
                    this.events = allEvents || [];
                    this.rehearsals = allRehearsals || [];
                    console.log(`[PersonalCalendar] Reloaded ${this.events.length} events and ${this.rehearsals.length} rehearsals for sync`);
                }
            }

            const icsContent = this.generateICSContent();
            if (!icsContent) {
                console.warn('[PersonalCalendar] No content generated for sync');
                return;
            }

            const client = SupabaseClient.getClient();
            if (client) {
                const fileName = `user_${user.id}.ics`;
                const { error } = await client.storage.from('calendars').upload(fileName, icsContent, {
                    contentType: 'text/calendar',
                    upsert: true,
                    cacheControl: '0' // NO CACHE to ensure updates are seen immediately
                });

                if (error) throw error;
                console.log('[PersonalCalendar] Background sync success');
            }
        } catch (e) {
            console.warn('[PersonalCalendar] Background sync failed', e);
        }
    },

    // Legacy Export (File Download) - Kept available via console or fallback if needed
    async exportICS() {
        this.startSubscriptionFlow(); // Redirect to new flow
    }
};

// Make globally accessible
window.PersonalCalendar = PersonalCalendar;
