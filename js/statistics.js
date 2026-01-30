// Statistics Module

const Statistics = {
    loadingStates: {},
    statsCache: {}, // { [bandId || 'all']: { data, timestamp } }

    invalidateCache() {
        Logger.info('[Statistics] Cache invalidated.');
        this.statsCache = {};
    },

    clearCache() {
        this.invalidateCache();
    },

    // Initialize statistics filters (dropdowns)
    async initStatisticsFilters() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const bandSelect = document.getElementById('statsBandSelect');
        if (!bandSelect) return;

        // Prevent double initialization
        if (this._filtersInitialized) return;
        this._filtersInitialized = true;

        // Populate band dropdown
        const bands = await Storage.getUserBands(user.id);
        bandSelect.innerHTML = '<option value="">Band auswählen</option>' +
            bands.map(b => `<option value="${b.id}">${Bands.escapeHtml(b.name)}</option>`).join('');

        // Band filter change
        bandSelect.addEventListener('change', async (e) => {
            const bandId = e.target.value;
            Logger.userAction('Select', 'statsBandSelect', 'Change', { bandId, action: 'Filter Statistics by Band' });

            if (bandId) {
                // Show band statistics (Bento Grid numbers)
                await this.renderGeneralStatistics(bandId);
            } else {
                // Show general stats
                await this.renderGeneralStatistics();
            }
        });
    },

    // NEW: Render General Statistics Dashboard
    async renderGeneralStatistics(bandId = null) {
        const cacheKey = bandId || 'all';

        // Check Cache
        if (this.statsCache[cacheKey]) {
            Logger.info(`[Statistics] Using cached data for ${cacheKey}.`);
            this._renderDashboard(this.statsCache[cacheKey].data);
            return;
        }

        Logger.info('Statistics: renderGeneralStatistics called', { bandId });
        Logger.time('Statistics Load (General)');
        const container = document.getElementById('statsDashboardContainer');
        if (!container) return; // Should exist if HTML is updated

        // Show loading state
        container.innerHTML = '<div class="loader-spinner" style="margin:50px auto;"></div>';

        try {
            const user = Auth.getCurrentUser();
            if (!user) return;

            // 1. Fetch Data
            let [bands, events, rehearsals, locations] = await Promise.all([
                Storage.getUserBands(user.id),
                Storage.getUserEvents(user.id),     // Gets all events accessible to user
                Storage.getUserRehearsals(user.id), // Gets all rehearsals
                Storage.getLocations()
            ]);

            // Filter by band if selected
            if (bandId) {
                const targetBandId = String(bandId); events = events.filter(e => String(e.bandId) === targetBandId);
                rehearsals = rehearsals.filter(r => String(r.bandId) === targetBandId);
                bands = bands.filter(b => String(b.id) === targetBandId);
            }

            // 2. Calculate Key Metrics
            const totalEvents = events.length;
            const totalRehearsals = rehearsals.length;
            const totalBands = bands.length;

            // Calculate "Songs Repertoire Size" (Unique songs in all bands)
            // Note: This relies on songs being fetched per band or globally. 
            // For now, let's estimate or fetch if possible.
            // Let's iterate all bands and fetch songs to get a true unique count.
            const allSongs = new Set();
            for (const band of bands) {
                const bandSongs = await Storage.getBandSongs(band.id);
                bandSongs.forEach(s => allSongs.add(s.title.toLowerCase().trim()));
            }
            const repertoireSize = allSongs.size;

            // 3. Fun Stats: Top Song & Favorite Location
            const songCounts = {};
            const locationCounts = {};

            // Analyze Events
            events.forEach(e => {
                if (e.setlist) {
                    e.setlist.forEach(s => {
                        const title = s.title || s.name || 'Unknown';
                        songCounts[title] = (songCounts[title] || 0) + 1;
                    });
                }
                if (e.locationId) {
                    locationCounts[e.locationId] = (locationCounts[e.locationId] || 0) + 1;
                }
            });

            // Analyze Rehearsals (for location only, typically no setlist stored directly as simple array yet? 
            // Actually rehearsal might have song list. Let's assume yes if available)
            rehearsals.forEach(r => {
                if (r.locationId) {
                    locationCounts[r.locationId] = (locationCounts[r.locationId] || 0) + 1;
                }
            });

            // Find Top Song
            let topSong = { name: '-', count: 0 };
            Object.entries(songCounts).forEach(([name, count]) => {
                if (count > topSong.count) topSong = { name, count };
            });

            // Find Favorite Location
            let favLocation = { name: '-', count: 0 };
            Object.entries(locationCounts).forEach(([id, count]) => {
                if (count > favLocation.count) {
                    // Try to find name in locations list
                    const locObj = locations.find(l => l.id === id);
                    const name = locObj ? locObj.name : 'Unbekannter Ort';
                    favLocation = { name, count };
                }
            });

            const dashboardData = {
                totalEvents,
                totalRehearsals,
                totalBands,
                repertoireSize,
                topSong,
                favLocation,
                eventsYear: events.filter(e => new Date(e.date).getFullYear() === new Date().getFullYear()).length
            };

            // Set Cache
            this.statsCache[cacheKey] = { data: dashboardData, timestamp: Date.now() };

            this._renderDashboard(dashboardData);
        } catch (error) {
            console.error('[Statistics] Error rendering general stats:', error);
            const container = document.getElementById('statsDashboardContainer');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <p>Fehler beim Laden der Statistiken.</p>
                    </div>
                `;
            }
        } finally {
            Logger.timeEnd('Statistics Load (General)');
        }
    },

    // Helper: Render the dashboard from data
    _renderDashboard(data) {
        const container = document.getElementById('statsDashboardContainer');
        if (!container) return;

        container.innerHTML = `
                <!-- Key Metrics Grid -->
                <div class="stats-grid">
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🎤</span>
                        <div class="stats-metric-label">Auftritte Gesamt</div>
                        <div class="stats-metric-value">${data.totalEvents}</div>
                        <div class="stats-metric-trend positive">
                            <span>📅 Dieses Jahr: ${data.eventsYear}</span>
                        </div>
                    </div>
                    
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🎸</span>
                        <div class="stats-metric-label">Proben Gesamt</div>
                        <div class="stats-metric-value">${data.totalRehearsals}</div>
                        <div class="stats-metric-trend neutral">
                            <span>💪 Fleißig!</span>
                        </div>
                    </div>
    
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🎵</span>
                        <div class="stats-metric-label">Repertoire Größe</div>
                        <div class="stats-metric-value">${data.repertoireSize}</div>
                        <div class="stats-metric-trend positive">
                            <span>Songs in allen Bands</span>
                        </div>
                    </div>
    
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🏘️</span>
                        <div class="stats-metric-label">Aktive Bands</div>
                        <div class="stats-metric-value">${data.totalBands}</div>
                    </div>
                </div>
    
                <!-- Fun Stats Section -->
                <h3 style="margin-bottom: var(--spacing-md); color: var(--color-text);">🏆 Fun Facts</h3>
                <div class="stats-fun-section">
                    
                    <!-- Top Song Card -->
                    <div class="stats-card-modern stats-highlight-card">
                        <span class="stats-card-icon-bg">⭐</span>
                        <div class="stats-metric-label">Meistgespielter Song</div>
                        <div class="stats-metric-value" style="font-size: 1.8rem; word-break: break-word;">
                            ${data.topSong.count > 0 ? data.topSong.name : 'Noch keine Daten'}
                        </div>
                        <div class="stats-metric-trend">
                            ${data.topSong.count > 0 ? `Gespielt ${data.topSong.count} mal` : ''}
                        </div>
                    </div>
    
                    <!-- Favorite Location Card -->
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">📍</span>
                        <div class="stats-metric-label">Lieblings-Location</div>
                        <div class="stats-metric-value" style="font-size: 1.8rem;">
                            ${data.favLocation.count > 0 ? data.favLocation.name : '-'}
                        </div>
                        <div class="stats-metric-trend neutral">
                            ${data.favLocation.count > 0 ? `${data.favLocation.count} Besuche` : ''}
                        </div>
                    </div>
    
                </div>
    
                <!-- Recent Activity Helper -->
                <div style="margin-top: var(--spacing-xl);">
                    <h4 style="margin-bottom: var(--spacing-sm); color: var(--color-text-secondary);">💡 Tipp</h4>
                    <p style="color: var(--color-text-secondary); font-size: 0.9rem;">
                        Wusstest du? Deine Statistiken werden automatisch aktualisiert, sobald du neue Auftritte oder Proben anlegst.
                    </p>
                </div>
            `;
    },
    // Calculate best dates (used by other modules)
    async getBestDates(rehearsalId, limit = 3) {
        const rehearsal = await Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return [];

        const members = await Storage.getBandMembers(rehearsal.bandId);
        const votes = (await Storage.getRehearsalVotes(rehearsalId)) || [];

        const dateStats = rehearsal.proposedDates.map((date, index) => {
            const dateVotes = votes.filter(v => v.dateIndex === index);
            const yesCount = dateVotes.filter(v => v.availability === 'yes').length;
            const maybeCount = dateVotes.filter(v => v.availability === 'maybe').length;
            const score = yesCount + (maybeCount * 0.5);

            return {
                date,
                index,
                yesCount,
                maybeCount,
                score
            };
        });

        return dateStats
            .sort((a, b) => b.score - a.score)
            .filter(d => d.score > 0)
            .slice(0, limit);
    }
};
