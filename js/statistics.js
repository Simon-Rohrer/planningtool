// Statistics Module

const Statistics = {
    // Render statistics for a rehearsal
    renderStatistics(rehearsalId) {
        const container = document.getElementById('statisticsContent');

        if (!rehearsalId) {
            UI.showEmptyState(container, '📊', 'Wähle einen Probetermin aus, um die Statistiken zu sehen');
            return;
        }

        const rehearsal = Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return;

        const band = Storage.getBand(rehearsal.bandId);
        const members = Storage.getBandMembers(rehearsal.bandId);
        const votes = Storage.getRehearsalVotes(rehearsalId);

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
    },

    // Render statistics for a band (overview)
    renderBandStatistics(bandId) {
        const container = document.getElementById('statisticsContent');
        if (!bandId) {
            UI.showEmptyState(container, '📊', 'Wähle eine Band aus, um die Statistiken zu sehen');
            return;
        }

        const band = Storage.getBand(bandId);
        if (!band) return;

        const members = Storage.getBandMembers(bandId);
        const events = Storage.getBandEvents(bandId);
        const rehearsals = Storage.getBandRehearsals(bandId);

        container.innerHTML = `
            <div class="stats-header">
                <h3>${Bands.escapeHtml(band.name)} • Band-Übersicht</h3>
                <p class="stats-subtitle">👥 ${members.length} Mitglieder</p>
            </div>

            <div class="band-stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${events.length}</div>
                    <div class="stat-label">Alle Auftritte</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${rehearsals.length}</div>
                    <div class="stat-label">Alle Proben</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${rehearsals.filter(r=>r.status==='confirmed').length}</div>
                    <div class="stat-label">Bestätigte Proben</div>
                </div>
            </div>

            <div style="margin-top: var(--spacing-md);">
                <h4>Letzte 5 Auftritte</h4>
                <ul>
                    ${events.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5).map(e => `<li>${UI.formatDateShort(e.date)} — ${Bands.escapeHtml(e.title)}</li>`).join('')}
                </ul>
            </div>
        `;
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
    getBestDates(rehearsalId, limit = 3) {
        const rehearsal = Storage.getRehearsal(rehearsalId);
        if (!rehearsal) return [];

        const members = Storage.getBandMembers(rehearsal.bandId);
        const votes = Storage.getRehearsalVotes(rehearsalId);

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
