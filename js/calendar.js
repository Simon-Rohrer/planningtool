// Calendar Module - Fetch and display iCal events

const Calendar = {
    calendarUrl: 'https://jms-altensteig.church.tools/?q=public/cr_ical&security=NfxmtRVaX40wkMxvfbpH9PRMKdJu9VDI&id=19',
    events: [],
    currentMonth: new Date(),

    async loadCalendar() {
        const container = document.getElementById('calendarEventsContainer');
        if (!container) return;

        try {
            container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Lade Kalender-Termine...</p></div>';

            // Use CORS proxy to fetch iCal data
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(this.calendarUrl)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const icalData = await response.text();

            // Parse iCal data using ical.js
            const jcalData = ICAL.parse(icalData);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            // Extract events
            this.events = vevents.map(vevent => {
                const event = new ICAL.Event(vevent);
                return {
                    summary: event.summary || 'Kein Titel',
                    description: event.description || '',
                    location: event.location || '',
                    startDate: event.startDate ? event.startDate.toJSDate() : null,
                    endDate: event.endDate ? event.endDate.toJSDate() : null,
                    uid: event.uid
                };
            }).filter(event => event.startDate);

            // Sort by start date
            this.events.sort((a, b) => a.startDate - b.startDate);

            this.renderMonthView();
        } catch (error) {
            console.error('Fehler beim Laden des Kalenders:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>Kalender konnte nicht geladen werden.</p>
                    <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                        Fehler: ${error.message}
                    </p>
                    <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-top: 1rem;">
                        Dies liegt möglicherweise an Sicherheitseinstellungen des Kalender-Servers.
                    </p>
                    <a href="${this.calendarUrl}" target="_blank" class="btn btn-secondary" style="margin-top: 1rem;">
                        📅 Kalender direkt öffnen
                    </a>
                </div>
            `;
        }
    },

    renderMonthView() {
        const container = document.getElementById('calendarEventsContainer');
        if (!container) return;

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        const monthName = this.currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

        // Get first day of month and last day
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Get day of week for first day (0 = Sunday, we want Monday = 0)
        let startDay = firstDay.getDay() - 1;
        if (startDay === -1) startDay = 6; // Sunday becomes 6

        const daysInMonth = lastDay.getDate();

        // Build calendar HTML
        let html = `
            <div class="calendar-header">
                <button onclick="Calendar.previousMonth()" class="btn btn-icon" style="font-size: 1.5rem;">‹</button>
                <h3 style="color: var(--color-text); margin: 0; font-size: 1.5rem; font-weight: 700;">${monthName}</h3>
                <button onclick="Calendar.nextMonth()" class="btn btn-icon" style="font-size: 1.5rem;">›</button>
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

        // Add empty cells for days before month starts
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
            const dayEvents = this.getEventsForDate(currentDate);

            let dayClass = 'calendar-day';
            if (isToday) dayClass += ' today';
            if (dayEvents.length > 0) dayClass += ' has-events';

            html += `
                <div class="${dayClass}">
                    <div class="calendar-day-number">${day}</div>
                    <div class="calendar-day-events">
                        ${dayEvents.map(event => this.renderCalendarEvent(event)).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';

        container.innerHTML = html;
    },

    getEventsForDate(date) {
        return this.events.filter(event => {
            const eventDate = new Date(event.startDate);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === date.getTime();
        });
    },

    renderCalendarEvent(event) {
        const time = event.startDate.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="calendar-event" title="${this.escapeHtml(event.summary)}${event.location ? ' - ' + this.escapeHtml(event.location) : ''}">
                <span class="event-time">${time}</span>
                <span class="event-title">${this.escapeHtml(event.summary)}</span>
            </div>
        `;
    },

    previousMonth() {
        this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
        this.renderMonthView();
    },

    nextMonth() {
        this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
        this.renderMonthView();
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
