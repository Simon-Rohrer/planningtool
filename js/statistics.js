// Statistics Module

const Statistics = {
    loadingStates: {},

    // NEW: Render General Statistics Dashboard
    async renderGeneralStatistics() {
        Logger.time('Statistics Load (General)');
        const container = document.getElementById('statsDashboardContainer');
        if (!container) return; // Should exist if HTML is updated

        // Show loading state
        container.innerHTML = '<div class="loader-spinner" style="margin:50px auto;"></div>';

        try {
            const user = Auth.getCurrentUser();
            if (!user) return;

            // 1. Fetch Data
            const [bands, events, rehearsals, locations] = await Promise.all([
                Storage.getUserBands(user.id),
                Storage.getUserEvents(user.id),     // Gets all events accessible to user
                Storage.getUserRehearsals(user.id), // Gets all rehearsals
                Storage.getLocations()
            ]);

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

            // 4. Render Dashboard
            container.innerHTML = `
                <!-- Key Metrics Grid -->
                <div class="stats-grid">
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🎤</span>
                        <div class="stats-metric-label">Auftritte Gesamt</div>
                        <div class="stats-metric-value">${totalEvents}</div>
                        <div class="stats-metric-trend positive">
                            <span>📅 Dieses Jahr: ${events.filter(e => new Date(e.date).getFullYear() === new Date().getFullYear()).length}</span>
                        </div>
                    </div>
                    
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🎸</span>
                        <div class="stats-metric-label">Proben Gesamt</div>
                        <div class="stats-metric-value">${totalRehearsals}</div>
                        <div class="stats-metric-trend neutral">
                            <span>💪 Fleißig!</span>
                        </div>
                    </div>

                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🎵</span>
                        <div class="stats-metric-label">Repertoire Größe</div>
                        <div class="stats-metric-value">${repertoireSize}</div>
                        <div class="stats-metric-trend positive">
                            <span>Songs in allen Bands</span>
                        </div>
                    </div>

                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">🏘️</span>
                        <div class="stats-metric-label">Aktive Bands</div>
                        <div class="stats-metric-value">${totalBands}</div>
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
                            ${topSong.count > 0 ? topSong.name : 'Noch keine Daten'}
                        </div>
                        <div class="stats-metric-trend">
                            ${topSong.count > 0 ? `Gespielt ${topSong.count} mal` : ''}
                        </div>
                    </div>

                    <!-- Favorite Location Card -->
                    <div class="stats-card-modern">
                        <span class="stats-card-icon-bg">📍</span>
                        <div class="stats-metric-label">Lieblings-Location</div>
                        <div class="stats-metric-value" style="font-size: 1.8rem;">
                            ${favLocation.count > 0 ? favLocation.name : '-'}
                        </div>
                        <div class="stats-metric-trend neutral">
                            ${favLocation.count > 0 ? `${favLocation.count} Besuche` : ''}
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

        } catch (error) {
            console.error('[Statistics] Error rendering general stats:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>Fehler beim Laden der Statistiken.</p>
                </div>
            `;
        }
        Logger.timeEnd('Statistics Load (General)');
    },
    // Render statistics for a rehearsal
    async renderStatistics(rehearsalId) {
        if (this.loadingStates[rehearsalId]) {
            console.log(`[Statistics] Already loading stats for ${rehearsalId}, skipping.`);
            return;
        }
        this.loadingStates[rehearsalId] = true;

        try {
            Logger.time('Statistics Load (Rehearsal)');
            const container = document.getElementById('statisticsContent');

            if (!rehearsalId) {
                UI.showEmptyState(container, '📊', 'Wähle einen Probetermin aus, um die Statistiken zu sehen');
                return;
            }

            const rehearsal = await Storage.getRehearsal(rehearsalId);
            if (!rehearsal) return;

            const band = await Storage.getBand(rehearsal.bandId);
            const members = await Storage.getBandMembers(rehearsal.bandId);
            const votes = (await Storage.getRehearsalVotes(rehearsalId)) || [];

            // Calculate statistics for each date
            const dateStats = rehearsal.proposedDates.map((date, index) => {
                const dateVotes = votes.filter(v => v.dateIndex === index);
                const yesCount = dateVotes.filter(v => v.availability === 'yes').length;
                const maybeCount = dateVotes.filter(v => v.availability === 'maybe').length;
                const noCount = dateVotes.filter(v => v.availability === 'no').length;
                const totalVotes = dateVotes.length;
                const memberCount = members.length;

                return {
                    date,
                    index,
                    yesCount,
                    maybeCount,
                    noCount,
                    totalVotes,
                    memberCount,
                    score: yesCount + (maybeCount * 0.5) // Score for ranking
                };
            });

            // Sort by score (best dates first)
            const sortedDates = [...dateStats].sort((a, b) => b.score - a.score);
            const bestDates = sortedDates.filter(d => d.score > 0).slice(0, 3);

            container.innerHTML = `
            <div class="stats-header">
                <h3>${Bands.escapeHtml(rehearsal.title)}</h3>
                <p class="stats-subtitle">🎸 ${Bands.escapeHtml(band?.name || '')} • ${members.length} Mitglieder</p>
            </div>

            ${bestDates.length > 0 ? `
                <div class="best-dates">
                    <h4>🏆 Beste Termine</h4>
                    ${bestDates.map((stat, index) => `
                        <div class="best-date-card">
                            <div class="date-time">
                                ${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} 
                                ${UI.formatDate(stat.date)}
                            </div>
                            <div class="availability-score">
                                ✅ ${stat.yesCount} können • 
                                ❓ ${stat.maybeCount} vielleicht • 
                                ❌ ${stat.noCount} können nicht
                                ${stat.totalVotes < stat.memberCount ? ` • ${stat.memberCount - stat.totalVotes} noch nicht abgestimmt` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="empty-state">
                    <div class="empty-icon">🗳️</div>
                    <p>Noch keine Abstimmungen vorhanden</p>
                </div>
            `}

            <div class="availability-chart">
                <h4>📊 Verfügbarkeit pro Termin</h4>
                <div class="chart-bars">
                    ${dateStats.map(stat => this.renderChartBar(stat)).join('')}
                </div>
            </div>

            <div class="member-availability">
                <h4>👥 Verfügbarkeit pro Mitglied</h4>
                ${this.renderMemberAvailability(rehearsal, members, votes)}
            </div>
        `;
            Logger.timeEnd('Statistics Load (Rehearsal)');
        } finally {
            this.loadingStates[rehearsalId] = false;
        }
    },

    // Render statistics for a band (overview)
    async renderBandStatistics(bandId) {
        Logger.time('Statistics Load (Band)');
        const container = document.getElementById('statisticsContent');
        if (!bandId) {
            UI.showEmptyState(container, '📊', 'Wähle eine Band aus, um die Statistiken zu sehen');
            return;
        }

        const band = await Storage.getBand(bandId);
        if (!band) return;

        const members = await Storage.getBandMembers(bandId);
        const events = await Storage.getBandEvents(bandId);
        const rehearsals = await Storage.getBandRehearsals(bandId);

        container.innerHTML = `
            <div class="stats-header">
                <h3>${Bands.escapeHtml(band.name)} • Band-Übersicht</h3>
                <p class="stats-subtitle">👥 ${members.length} Mitglieder</p>
            </div>

            ${events.length === 0 && rehearsals.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <p>Für diese Band sind noch keine Statistiken verfügbar.</p>
                </div>
            ` : `
                <div class="band-stats-grid">
                    <div class="stat-card">
                        <div class="stat-label"><b>Anzahl der Auftritte: </b>${events.length}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label"><b>Anzahl der Proben: </b>${rehearsals.length}</div>
                    </div>
                    <div class="stat-card">
                    <div class="stat-label"><b>Bestätigte Proben: </b>${rehearsals.filter(r => r.status === 'confirmed').length}</div>
                        <div class="stat-value"></div>
                    </div>
                </div>

                <div style="margin-top: var(--spacing-md);">
                    <h4>Letzte 5 Auftritte:</h4>
                    ${events.length > 0 ? `
                        <ul>
                            ${events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(e => `<li>${UI.formatDateShort(e.date)} — ${Bands.escapeHtml(e.title)}</li>`).join('')}
                        </ul>
                    ` : '<p style="color:var(--color-text-secondary); font-style:italic;">Keine Auftritte vorhanden</p>'}
                </div>
            `}
        `;
        Logger.timeEnd('Statistics Load (Band)');
    },

    // Render chart bar for a date
    renderChartBar(stat) {
        const total = stat.memberCount;
        const yesPercent = total > 0 ? (stat.yesCount / total) * 100 : 0;
        const maybePercent = total > 0 ? (stat.maybeCount / total) * 100 : 0;
        const noPercent = total > 0 ? (stat.noCount / total) * 100 : 0;

        return `
            <div class="chart-bar-item">
                <div class="chart-bar-label">
                    ${UI.formatDateShort(stat.date)}
                </div>
                <div class="chart-bar-container">
                    ${yesPercent > 0 ? `
                        <div class="chart-bar bar-yes" style="width: ${yesPercent}%">
                            ${stat.yesCount > 0 ? `✅ ${stat.yesCount}` : ''}
                        </div>
                    ` : ''}
                    ${maybePercent > 0 ? `
                        <div class="chart-bar bar-maybe" style="width: ${maybePercent}%">
                            ${stat.maybeCount > 0 ? `❓ ${stat.maybeCount}` : ''}
                        </div>
                    ` : ''}
                    ${noPercent > 0 ? `
                        <div class="chart-bar bar-no" style="width: ${noPercent}%">
                            ${stat.noCount > 0 ? `❌ ${stat.noCount}` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Render member availability grid
    renderMemberAvailability(rehearsal, members, votes) {
        if (members.length === 0) {
            return '<p class="empty-state">Keine Mitglieder</p>';
        }

        return `
            <div class="availability-grid">
                ${members.map(member => {
            const user = Storage.getById('users', member.userId);
            if (!user) return '';

            return `
                        <div class="availability-row">
                            <div class="member-name">
                                ${Bands.escapeHtml(user.name)}
                            </div>
                            <div class="availability-cells">
                                ${rehearsal.proposedDates.map((date, index) => {
                const vote = votes.find(v =>
                    v.userId === user.id && v.dateIndex === index
                );

                let cellClass = 'availability-cell cell-pending';
                let icon = '⏳';

                if (vote) {
                    if (vote.availability === 'yes') {
                        cellClass = 'availability-cell cell-yes';
                        icon = '✅';
                    } else if (vote.availability === 'maybe') {
                        cellClass = 'availability-cell cell-maybe';
                        icon = '❓';
                    } else if (vote.availability === 'no') {
                        cellClass = 'availability-cell cell-no';
                        icon = '❌';
                    }
                }

                return `<div class="${cellClass}" title="${UI.formatDateShort(date)}">${icon}</div>`;
            }).join('')}
                            </div>
                        </div>
                    `;
        }).join('')}
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
