// Calendar Module - Fetch and display iCal events for multiple locations

const Calendar = {
    calendars: {
        tonstudio: {
            url: 'https://jms-altensteig.church.tools/?q=public/cr_ical&security=NfxmtRVaX40wkMxvfbpH9PRMKdJu9VDI&id=19',
            events: [],
            currentMonth: new Date(),
            containerId: 'tonstudioEventsContainer'
        },
        festhalle: {
            url: 'https://jms-altensteig.church.tools/?q=public/cr_ical&security=bOv5OpXv4gXaRK4K9An9&id=3',
            events: [],
            currentMonth: new Date(),
            containerId: 'festhalleEventsContainer'
        },
        ankersaal: {
            url: 'https://jms-altensteig.church.tools/?q=public/cr_ical&security=x135fXCcu1pJAo1xQfwfmeLuemeBfqUV&id=9',
            events: [],
            currentMonth: new Date(),
            containerId: 'ankersaalEventsContainer'
        }
    },
    currentCalendar: 'tonstudio',

    // Getter for backwards compatibility
    get calendarUrl() {
        return this.calendars[this.currentCalendar].url;
    },
    get events() {
        return this.calendars[this.currentCalendar].events;
    },
    set events(value) {
        this.calendars[this.currentCalendar].events = value;
    },
    get currentMonth() {
        return this.calendars[this.currentCalendar].currentMonth;
    },
    set currentMonth(value) {
        this.calendars[this.currentCalendar].currentMonth = value;
    },

    // Initialize calendars from database
    async initCalendars() {
        // Keep hardcoded system calendars as fallback
        const systemCalendars = {
            tonstudio: {
                url: 'https://jms-altensteig.church.tools/?q=public/cr_ical&security=NfxmtRVaX40wkMxvfbpH9PRMKdJu9VDI&id=19',
                name: 'Tonstudio',
                icon: '🎙️',
                events: [],
                currentMonth: new Date(),
                containerId: 'tonstudioEventsContainer',
                isSystem: true
            },
            festhalle: {
                url: 'https://jms-altensteig.church.tools/?q=public/cr_ical&security=bOv5OpXv4gXaRK4K9An9&id=3',
                name: 'JMS Festhalle',
                icon: '🏛️',
                events: [],
                currentMonth: new Date(),
                containerId: 'festhalleEventsContainer',
                isSystem: true
            },
            ankersaal: {
                url: 'https://jms-altensteig.church.tools/?q=public/cr_ical&security=x135fXCcu1pJAo1xQfwfmeLuemeBfqUV&id=9',
                name: 'Ankersaal',
                icon: '⚓',
                events: [],
                currentMonth: new Date(),
                containerId: 'ankersaalEventsContainer',
                isSystem: true
            }
        };

        // Load calendars from database
        try {
            if (typeof Storage !== 'undefined' && Storage.getAllCalendars) {
                const dbCalendars = await Storage.getAllCalendars();

                // Update calendars object with DB data
                this.calendars = { ...systemCalendars };

                if (dbCalendars && dbCalendars.length > 0) {
                    dbCalendars.forEach(cal => {
                        const calId = cal.id;
                        this.calendars[calId] = {
                            url: cal.ical_url,
                            name: cal.name,
                            icon: cal.icon || '📅',
                            events: [],
                            currentMonth: new Date(),
                            containerId: `${calId}EventsContainer`,
                            isSystem: cal.is_system || false
                        };
                    });
                }

                Logger.info(`Calendars Initialized – ${Object.keys(this.calendars).length} locations found`);
            }
        } catch (error) {
            Logger.error('Error loading calendars from database', error);
            // Fallback to system calendars
            this.calendars = systemCalendars;
        }
    },

    async loadCalendar(calendarType = 'tonstudio') {
        const timerLabel = 'Location Calendar Load: ' + calendarType;
        Logger.time(timerLabel);
        const calendar = this.calendars[calendarType];
        if (!calendar) {
            console.error(`Calendar type "${calendarType}" not found`);
            Logger.timeEnd(timerLabel);
            return;
        }

        if (calendar.isLoading) {
            Logger.timeEnd(timerLabel);
            return;
        }

        // Prevent reload if already loaded
        if (calendar.events && calendar.events.length > 0) {
            this.currentCalendar = calendarType; // CRITICAL: Set current calendar before rendering
            this.renderMonthView(); // Just re-render
            Logger.timeEnd(timerLabel);
            return;
        }

        calendar.isLoading = true;

        const container = document.getElementById(calendar.containerId);
        if (!container) {
            console.error(`Container "${calendar.containerId}" not found`);
            Logger.timeEnd(timerLabel);
            return;
        }

        // Check if URL is configured
        if (!calendar.url) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <p>Kalender noch nicht konfiguriert</p>
                    <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                        Die iCal-URL für diesen Kalender wurde noch nicht hinzugefügt.
                    </p>
                </div>
            `;
            Logger.timeEnd(timerLabel);
            return;
        }

        this.currentCalendar = calendarType;

        try {
            if (typeof UI !== 'undefined' && UI.showLoading) {
                UI.showLoading('Kalender wird geladen…');
            }
            container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Lade Kalender-Termine...</p></div>';

            // Use central ProxyService for robust fetching
            const icalData = await ProxyService.fetch(calendar.url);

            // PREVENT CRASH: Validate if we actually got iCal data
            if (!icalData || typeof icalData !== 'string' || !icalData.includes('BEGIN:VCALENDAR')) {
                console.error('Invalid iCal data received:', icalData?.substring(0, 100));
                throw new Error('Ungültiges Kalender-Format empfangen.');
            }

            // PREVENT CRASH: Validate if we actually got iCal data
            if (!icalData || typeof icalData !== 'string' || !icalData.includes('BEGIN:VCALENDAR')) {
                console.error('Invalid iCal data received from proxy:', icalData?.substring(0, 100));
                throw new Error('Ungültiges Kalender-Format empfangen.');
            }

            // Parse iCal data using ical.js
            const jcalData = ICAL.parse(icalData);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            // Extract events
            calendar.events = vevents.map(vevent => {
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
            calendar.events.sort((a, b) => a.startDate - b.startDate);

            this.renderMonthView();
            const duration = ((performance.now() - Logger.timers[timerLabel]) / 1000).toFixed(2);
            Logger.info(`Calendar Loaded – "${calendarType}" (${calendar.events.length} events, ${duration}s)`);
            delete Logger.timers[timerLabel];
        } catch (error) {
            console.error(`Fehler beim Laden des ${calendarType} Kalenders:`, error);
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
                    <a href="${calendar.url}" target="_blank" class="btn btn-secondary" style="margin-top: 1rem;">
                        📅 Kalender direkt öffnen
                    </a>
                </div>
            `;
        } finally {
            calendar.isLoading = false;
            if (typeof UI !== 'undefined' && UI.hideLoading) {
                UI.hideLoading();
            }
        }
    },

    renderMonthView() {
        const calendar = this.calendars[this.currentCalendar];
        const container = document.getElementById(calendar.containerId);

        if (!container) {
            Logger.error(`Container "${calendar.containerId}" not found in DOM!`);
            return;
        }

        const year = calendar.currentMonth.getFullYear();
        const month = calendar.currentMonth.getMonth();

        const monthName = calendar.currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

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
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <h3 style="color: var(--color-text); margin: 0; font-size: 1.5rem; font-weight: 700;">${monthName}</h3>
                    <button onclick="Calendar.goToToday()" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.75rem;">📅 Heute</button>
                </div>
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

        // Add click listeners to all calendar events
        container.querySelectorAll('.calendar-event').forEach(eventElement => {
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEventDetails(eventElement);
            });
        });
    },

    getEventsForDate(date) {
        const calendar = this.calendars[this.currentCalendar];
        return calendar.events.filter(event => {
            const eventDate = new Date(event.startDate);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === date.getTime();
        });
    },

    renderCalendarEvent(event) {
        const startTime = event.startDate.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const endTime = event.endDate ? event.endDate.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        }) : null;

        const timeDisplay = endTime ? `${startTime} - ${endTime}` : startTime;

        // Truncate title at 15 characters
        const truncateTitle = (text, maxLength = 15) => {
            const escaped = this.escapeHtml(text);
            if (text.length <= maxLength) return escaped;
            return escaped.substring(0, maxLength) + '...';
        };

        // Create unique event ID for click handler
        const eventId = `event_${event.uid}_${event.startDate.getTime()}`;

        return `
            <div class="calendar-event" 
                 id="${eventId}"
                 data-event-summary="${this.escapeHtml(event.summary)}"
                 data-event-time="${timeDisplay}"
                 data-event-location="${this.escapeHtml(event.location || '')}"
                 data-event-description="${this.escapeHtml(event.description || '')}"
                 title="Klicken für Details">
                <span class="event-time">${timeDisplay}</span>
                <span class="event-title">${truncateTitle(event.summary)}</span>
            </div>
        `;
    },

    // Show event details in modal
    showEventDetails(eventElement) {
        const summary = eventElement.dataset.eventSummary;
        const time = eventElement.dataset.eventTime;
        const location = eventElement.dataset.eventLocation;
        const description = eventElement.dataset.eventDescription;

        document.getElementById('eventModalTitle').textContent = 'Event Details';
        document.getElementById('eventModalSummary').textContent = summary;
        document.getElementById('eventModalTime').textContent = time;

        // Show/hide location
        const locationContainer = document.getElementById('eventModalLocationContainer');
        if (location) {
            document.getElementById('eventModalLocation').textContent = location;
            locationContainer.style.display = 'block';
        } else {
            locationContainer.style.display = 'none';
        }

        // Show/hide description
        const descriptionContainer = document.getElementById('eventModalDescriptionContainer');
        if (description) {
            document.getElementById('eventModalDescription').textContent = description;
            descriptionContainer.style.display = 'block';
        } else {
            descriptionContainer.style.display = 'none';
        }

        // Open modal using UI helper
        if (typeof UI !== 'undefined' && UI.openModal) {
            UI.openModal('calendarEventModal');
        }
    },

    previousMonth() {
        const calendar = this.calendars[this.currentCalendar];
        calendar.currentMonth = new Date(calendar.currentMonth.getFullYear(), calendar.currentMonth.getMonth() - 1, 1);
        this.renderMonthView();
    },

    nextMonth() {
        const calendar = this.calendars[this.currentCalendar];
        calendar.currentMonth = new Date(calendar.currentMonth.getFullYear(), calendar.currentMonth.getMonth() + 1, 1);
        this.renderMonthView();
    },

    goToToday() {
        const calendar = this.calendars[this.currentCalendar];
        calendar.currentMonth = new Date();
        this.renderMonthView();
    },

    // Ensure a calendar is loaded (for availability checking)
    async ensureLocationCalendar(calendarId, locationName) {
        const startTime = performance.now();

        // Map calendar IDs to internal calendar types
        const calendarMap = {
            'tonstudio': 'tonstudio',
            'jms-festhalle': 'festhalle',
            'festhalle': 'festhalle',
            'ankersaal': 'ankersaal'
        };

        const calendarType = calendarMap[calendarId] || calendarId;
        const calendar = this.calendars[calendarType];

        if (!calendar) return;

        // Check if calendar already has events loaded
        if (calendar.events && calendar.events.length > 0) {
            // If already loaded, just render it
            const previousCalendar = this.currentCalendar;
            this.currentCalendar = calendarType;
            this.renderMonthView();
            this.currentCalendar = previousCalendar;
            return;
        }

        // Load the calendar via ProxyService
        try {
            const icalData = await ProxyService.fetch(calendar.url);

            // Validierung
            if (!icalData || typeof icalData !== 'string' || !icalData.includes('BEGIN:VCALENDAR')) {
                throw new Error('Gültige Kalenderdaten konnten nicht geladen werden.');
            }

            const jcalData = ICAL.parse(icalData);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            calendar.events = vevents.map(vevent => {
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

            calendar.events.sort((a, b) => a.startDate - b.startDate);
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            Logger.info(`Calendar Loaded – "${locationName}" (${calendar.events.length} events, ${duration}s)`);

            // Render the calendar after loading
            const previousCalendar = this.currentCalendar;
            this.currentCalendar = calendarType;
            this.renderMonthView();
            this.currentCalendar = previousCalendar;
        } catch (error) {
            Logger.error(`Failed to load ${calendarType}`, error);
            throw error;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
