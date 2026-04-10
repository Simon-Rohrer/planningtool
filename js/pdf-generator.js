/**
 * PDF Generator Module
 * Handles the generation of PDFs using html2canvas and jsPDF
 */
const PDFGenerator = {

    // Helper to escape HTML to prevent XSS in the generated PDF
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Generate and download a Setlist PDF
     * @param {Object} data - Configuration object
     * @param {string} data.title - Main title (e.g., Event Name or "Gesamtsetlist")
     * @param {string} data.subtitle - Subtitle (optional)
     * @param {Array} data.metaInfo - Array of strings/objects for header info (e.g. ["Band XYZ", "Date", "Location"])
     * @param {Array} data.songs - Array of song objects
     * @param {boolean} data.showNotes - Whether to show CCLI/Notes section at bottom
     * @param {string} data.filename - Desired filename
     */
    async generateSetlistPDF({ title, subtitle, metaInfo = [], songs = [], showNotes = false, filename = 'setlist.pdf', previewOnly = false }) {
        try {
            // Build HTML content
            const element = document.createElement('div');

            // Layout Configuration
            // box-sizing: border-box ensures padding is included in width
            const styles = {
                container: "font-family: 'Inter', Arial, sans-serif; padding: 20px; background: white; color: #111827; width: 1100px; margin: 0 auto; box-sizing: border-box;",
                headerAccent: "height: 6px; background: #8B5CF6; border-radius: 3px; margin-bottom: 25px;",
                header: "display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #E5E7EB; padding-bottom: 15px;", // Reduced margin/padding
                h1: "margin: 0; font-size: 28px; font-weight: 700; color: #111827; letter-spacing: -0.025em; text-align: center;",
                metaRow: "display: flex; gap: 20px; margin-top: 12px; color: #6B7280; font-size: 14px; flex-wrap: wrap; justify-content: center;",
                subHeader: "margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end;",
                h2: "margin: 0; font-size: 16px; font-weight: 600; color: #111827; text-transform: uppercase; letter-spacing: 0.05em;",
                table: "width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 13px; table-layout: fixed;",
                th: "padding: 12px 10px; text-align: left; font-weight: 600; color: #4B5563; border-bottom: 2px solid #E5E7EB; background-color: #F9FAFB;",
                td: "padding: 10px; color: #111827; border-bottom: 1px solid #F3F4F6;",
                footer: "margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px; display: flex; justify-content: space-between; align-items: center;"
            };

            // Generate Meta/Subtitle HTML
            let metaHtml = '';
            if (subtitle) {
                metaHtml += `<div style="margin-top: 8px; color: #6B7280; font-size: 14px; font-weight: 500;">${this.escapeHtml(subtitle)}</div>`;
            }
            if (metaInfo && metaInfo.length > 0) {
                metaHtml += `<div style="${styles.metaRow}">`;
                metaInfo.forEach(info => {
                    metaHtml += `<span>${info}</span>`; // info is assumed to be safe or pre-formatted HTML (like 🎸 <b>Name</b>) OR plain text. 
                    // For safety, caller should escape if raw user input, but usually we pass formatted HTML icons here.
                    // We'll trust the caller to pass HTML for icons/bolding, or layout might break if we escape everything.
                });
                metaHtml += `</div>`;
            }

            // Generate Songs Rows
            const songsRows = songs.map((song, idx) => `
                <tr style="border-bottom: 1px solid #F3F4F6; ${idx % 2 === 0 ? '' : 'background-color: #FAFAFA;'}">
                    <td style="padding: 10px; color: #9CA3AF; font-weight: 500; width: 35px;">${idx + 1}</td>
                    <td style="padding: 10px; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(song.title)}</td>
                    <td style="padding: 10px; color: #4B5563; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(song.artist || '-')}</td>
                    <td style="padding: 10px; text-align: center; font-weight: 500; width: 50px;">${song.bpm || '-'}</td>
                    <td style="padding: 10px; text-align: center; font-weight: 500; color: #8B5CF6; width: 50px;">${song.key || '-'}</td>
                    <td style="padding: 10px; color: #4B5563; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100px;">${this.escapeHtml(song.leadVocal || '-')}</td>
                </tr>
            `).join('');

            // Additional Info Section (Notes only, CCLI is in table)
            let additionalInfoHTML = '';
            if (showNotes && songs.some(s => s.notes)) {
                additionalInfoHTML = `
                    <div style="margin-top: 40px; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden;">
                        <div style="background: #F9FAFB; padding: 12px 20px; border-bottom: 1px solid #E5E7EB;">
                            <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">Zusätzliche Informationen</h3>
                        </div>
                        <div style="padding: 10px 20px;">
                            ${songs.filter(s => s.notes).map((song, idx) => `
                                <div style="padding: 12px 0; ${idx !== 0 ? 'border-top: 1px dashed #E5E7EB;' : ''}">
                                    <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #111827;">${this.escapeHtml(song.title)}</div>
                                    <div style="font-size: 12px; color: #6B7280;">
                                        <span><b>Notiz:</b> ${this.escapeHtml(song.notes)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Construct Full HTML
            element.innerHTML = `
                <div style="${styles.container}">
                    <!-- Header Accent -->
                    <div style="${styles.headerAccent}"></div>

                    <div style="${styles.header}">
                        <h1 style="${styles.h1}">${this.escapeHtml(title)}</h1>
                        ${metaHtml}
                    </div>

                    <div style="${styles.subHeader}">
                        <h2 style="${styles.h2}">Songliste</h2>
                        <span style="color: #9CA3AF; font-size: 13px;">${songs.length} Songs</span>
                    </div>

                    <table style="${styles.table}">
                        <thead>
                            <tr style="${styles.th}">
                                <th style="padding: 12px 5px; text-align: left; font-weight: 600; width: 40px; color: #4B5563;">#</th>
                                <th style="padding: 12px 5px; text-align: left; font-weight: 600; width: 300px; color: #4B5563;">Titel</th>
                                <th style="padding: 12px 5px; text-align: left; font-weight: 600; width: 200px; color: #4B5563;">Interpret</th>
                                <th style="padding: 12px 5px; text-align: left; font-weight: 600; width: 180px; color: #4B5563;">Genre</th>
                                <th style="padding: 12px 5px; text-align: center; font-weight: 600; width: 60px; color: #4B5563;">BPM</th>
                                <th style="padding: 12px 5px; text-align: center; font-weight: 600; width: 60px; color: #4B5563;">Time</th>
                                <th style="padding: 12px 5px; text-align: center; font-weight: 600; width: 60px; color: #4B5563;">Key</th>
                                <th style="padding: 12px 5px; text-align: left; font-weight: 600; width: 100px; color: #4B5563;">Sprache</th>
                                <th style="padding: 12px 5px; text-align: left; font-weight: 600; width: 100px; color: #4B5563;">CCLI</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${songs.map((song, idx) => `
                <tr style="border-bottom: 1px solid #F3F4F6; ${idx % 2 === 0 ? '' : 'background-color: #FAFAFA;'}">
                    <td style="padding: 8px 5px; color: #9CA3AF; font-weight: 500; vertical-align: top;">${idx + 1}</td>
                    <td style="padding: 8px 5px; font-weight: 600; color: #111827; vertical-align: top;">${this.escapeHtml(song.title)}</td>
                    <td style="padding: 8px 5px; color: #4B5563; vertical-align: top;">${this.escapeHtml(song.artist || '-')}</td>
                    <td style="padding: 8px 5px; color: #4B5563; vertical-align: top;">${this.escapeHtml(song.genre || '-')}</td>
                    <td style="padding: 8px 5px; text-align: center; font-weight: 500; vertical-align: top;">${song.bpm || '-'}</td>
                    <td style="padding: 8px 5px; text-align: center; font-weight: 500; vertical-align: top;">${song.timeSignature || '-'}</td>
                    <td style="padding: 8px 5px; text-align: center; font-weight: 500; color: #8B5CF6; vertical-align: top;">${song.key || '-'}</td>
                    <td style="padding: 8px 5px; color: #4B5563; vertical-align: top;">${this.escapeHtml(song.language || '-')}</td>
                    <td style="padding: 8px 5px; color: #4B5563; vertical-align: top; font-family: monospace;">${this.escapeHtml(song.ccli || '-')}</td>
                </tr>
            `).join('')}
                        </tbody>
                    </table>

                    ${additionalInfoHTML}

                    <div style="${styles.footer}">
                        <div>Erstellt mit <b>Bandmate</b></div>
                        <div>Stand: ${new Date().toLocaleString('de-DE')}</div>
                    </div>
                </div>
            `;

            // Style Element for Rendering
            element.style.backgroundColor = 'white';
            element.style.padding = '0';
            element.style.margin = '0';
            element.style.color = 'black';
            element.style.position = 'absolute'; // Prevent it from messing with layout while rendering
            element.style.left = '-9999px';
            element.style.top = '0';
            element.style.width = '1100px'; // Wider for Landscape

            // Append to body temporarily
            document.body.appendChild(element);

            // Wait for rendering (ensure fonts load etc)
            await new Promise(resolve => setTimeout(resolve, 200));

            // Generate canvas
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: 1100, // Matching width
                windowWidth: 1100
            });

            // Create PDF
            // l = landscape, mm = millimeters, a4 = format
            const pdf = new window.jsPDF('l', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 297; // A4 width in mm (landscape)
            const pageHeight = 210; // A4 height in mm (landscape)
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Cleanup
            document.body.removeChild(element);

            if (previewOnly) {
                const blob = pdf.output('blob');
                const blobUrl = URL.createObjectURL(blob);
                return { pdf, blobUrl, filename };
            }

            pdf.save(filename);
            return true;

        } catch (error) {
            console.error('PDFGenerator Error:', error);
            throw error;
        }
    },

    sanitizeFilename(name = '', fallback = 'export.pdf') {
        const cleanBase = String(name || '')
            .trim()
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
        const baseName = cleanBase || fallback.replace(/\.pdf$/i, '') || 'export';
        return /\.pdf$/i.test(baseName) ? baseName : `${baseName}.pdf`;
    },

    getRundownModeLabel(mode = 'full-details') {
        const labels = {
            'full-details': 'Ganzer Ablauf mit Details',
            'full-compact': 'Ganzer Ablauf kompakt',
            'songs-full': 'Nur Songs mit allen Infos',
            'songs-language': 'Nur Songs mit Sprache',
            'songs-large': 'Große nummerierte Songtitel'
        };
        return labels[mode] || labels['full-details'];
    },

    renderRundownSongMetaChips(song = {}, chipStyle = '') {
        const entries = [
            song.artist ? `Interpret: ${song.artist}` : '',
            song.bpm ? `BPM: ${song.bpm}` : '',
            song.timeSignature ? `Time: ${song.timeSignature}` : '',
            song.key ? `Tonart: ${song.key}` : '',
            song.originalKey ? `Orig.: ${song.originalKey}` : '',
            song.leadVocal ? `Lead: ${song.leadVocal}` : '',
            song.language ? `Sprache: ${song.language}` : '',
            song.tracks === 'yes' ? 'Tracks: Ja' : (song.tracks === 'no' ? 'Tracks: Nein' : ''),
            song.ccli ? `CCLI: ${song.ccli}` : ''
        ].filter(Boolean);

        if (entries.length === 0) return '';

        return `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
                ${entries.map((entry) => `<span style="${chipStyle}">${this.escapeHtml(entry)}</span>`).join('')}
            </div>
        `;
    },

    renderRundownSongCards(songs = [], options = {}) {
        const {
            cardStyle = '',
            orderStyle = '',
            titleStyle = '',
            metaStyle = '',
            noteStyle = '',
            chipStyle = '',
            languageOnly = false,
            largeTitles = false
        } = options;

        if (!Array.isArray(songs) || songs.length === 0) {
            return `
                <div style="${cardStyle}">
                    <div style="font-size:14px; color:#64748b;">Keine Songs für diese Ansicht vorhanden.</div>
                </div>
            `;
        }

        if (largeTitles) {
            return songs.map((song, index) => `
                <div style="${cardStyle}; display:flex; gap:18px; align-items:flex-start;">
                    <div style="${orderStyle}; min-width:56px;">${index + 1}.</div>
                    <div style="min-width:0; flex:1;">
                        <div style="${titleStyle}; font-size:24px; line-height:1.18;">${this.escapeHtml(song.title || 'Ohne Titel')}</div>
                        ${song.language ? `<div style="${metaStyle}; margin-top:8px;">${this.escapeHtml(song.language)}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        if (languageOnly) {
            return songs.map((song, index) => `
                <div style="${cardStyle}; display:flex; gap:16px; align-items:flex-start;">
                    <div style="${orderStyle}">${index + 1}</div>
                    <div style="min-width:0; flex:1;">
                        <div style="${titleStyle}">${this.escapeHtml(song.title || 'Ohne Titel')}</div>
                        <div style="${metaStyle}; margin-top:6px;">
                            ${this.escapeHtml(song.language || 'Sprache nicht angegeben')}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        return songs.map((song, index) => `
            <div style="${cardStyle}">
                <div style="display:flex; gap:16px; align-items:flex-start;">
                    <div style="${orderStyle}">${index + 1}</div>
                    <div style="min-width:0; flex:1;">
                        <div style="${titleStyle}">${this.escapeHtml(song.title || 'Ohne Titel')}</div>
                        <div style="${metaStyle}; margin-top:6px;">
                            ${this.escapeHtml(song.artist || 'Interpret nicht angegeben')}
                        </div>
                        ${this.renderRundownSongMetaChips(song, chipStyle)}
                        ${song.infoDisplay && song.infoDisplay !== '-' ? `<div style="${noteStyle}; margin-top:10px;">${this.escapeHtml(song.infoDisplay)}</div>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderRundownTimelineItems(items = [], options = {}) {
        const {
            detailed = true,
            itemStyle = '',
            chipStyle = '',
            songCardStyle = '',
            orderStyle = '',
            titleStyle = '',
            metaStyle = '',
            noteStyle = ''
        } = options;

        if (!Array.isArray(items) || items.length === 0) {
            return `
                <div style="${itemStyle}">
                    <div style="font-size:14px; color:#64748b;">Kein Ablauf vorhanden.</div>
                </div>
            `;
        }

        return items.map((item, index) => {
            const songList = Array.isArray(item.selectedSongs) ? item.selectedSongs : [];
            const timeLabel = item.startLabel === '—' && item.endLabel === '—'
                ? 'Zeit offen'
                : `${item.startLabel} - ${item.endLabel}`;
            const nestedSongs = detailed
                ? this.renderRundownSongCards(songList, {
                    cardStyle: songCardStyle,
                    orderStyle,
                    titleStyle: `${titleStyle}; font-size:15px;`,
                    metaStyle,
                    noteStyle,
                    chipStyle
                })
                : (songList.length > 0
                    ? `
                        <div style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
                            ${songList.map((song) => `
                                <div style="font-size:14px; color:#334155; line-height:1.45;">
                                    - ${this.escapeHtml(song.title || 'Ohne Titel')}
                                </div>
                            `).join('')}
                        </div>
                    `
                    : '');

            return `
                <section style="${itemStyle}">
                    <div style="display:flex; gap:18px; align-items:flex-start; justify-content:space-between;">
                        <div style="min-width:0; flex:1;">
                            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:10px;">
                                <span style="${chipStyle}; background:#e8f0ff; color:#274690;">${index + 1}.</span>
                                <span style="${chipStyle}">${this.escapeHtml(item.typeLabel || item.type || 'Programmpunkt')}</span>
                                ${item.durationLabel ? `<span style="${chipStyle}">${this.escapeHtml(item.durationLabel)}</span>` : ''}
                                ${item.selectedSongs?.length ? `<span style="${chipStyle}">${item.selectedSongs.length} Song${item.selectedSongs.length === 1 ? '' : 's'}</span>` : ''}
                            </div>
                            <div style="${titleStyle}; font-size:${detailed ? '22px' : '19px'};">${this.escapeHtml(item.title || 'Programmpunkt')}</div>
                            ${item.notes && detailed ? `<div style="${noteStyle}; margin-top:10px;">${this.escapeHtml(item.notes)}</div>` : ''}
                        </div>
                        <div style="min-width:150px; text-align:right;">
                            <div style="font-size:16px; font-weight:700; color:#0f172a;">${this.escapeHtml(timeLabel)}</div>
                            ${item.durationLabel ? `<div style="${metaStyle}; margin-top:6px;">${this.escapeHtml(item.durationLabel)}</div>` : ''}
                        </div>
                    </div>
                    ${nestedSongs}
                </section>
            `;
        }).join('');
    },

    buildRundownPDFMarkup({
        title = 'Ablauf',
        subtitle = '',
        mode = 'full-details',
        eventMeta = {},
        items = [],
        songs = []
    } = {}) {
        const safeItems = Array.isArray(items) ? items : [];
        const safeSongs = Array.isArray(songs) ? songs : [];
        const modeLabel = this.getRundownModeLabel(mode);
        const generatedAt = new Date().toLocaleString('de-DE');

        const styles = {
            page: "font-family:'Inter', Arial, sans-serif; width:860px; box-sizing:border-box; margin:0 auto; padding:32px 34px 36px; background:#ffffff; color:#0f172a;",
            accent: "height:8px; border-radius:999px; background:linear-gradient(90deg, #4f7df3 0%, #22c55e 100%); margin-bottom:22px;",
            header: "display:flex; flex-direction:column; gap:12px; margin-bottom:24px;",
            title: "margin:0; font-size:32px; line-height:1.08; font-weight:800; letter-spacing:-0.03em; color:#0f172a;",
            subtitle: "margin:0; color:#475569; font-size:14px; font-weight:500;",
            chipRow: "display:flex; flex-wrap:wrap; gap:8px;",
            chip: "display:inline-flex; align-items:center; min-height:28px; padding:4px 11px; border-radius:999px; background:#f1f5f9; color:#334155; font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;",
            summaryGrid: "display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; margin:24px 0 20px;",
            summaryCard: "border:1px solid #dbe3ef; border-radius:18px; background:#f8fafc; padding:14px 16px;",
            summaryLabel: "font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;",
            summaryValue: "margin-top:8px; font-size:17px; font-weight:700; color:#0f172a; line-height:1.3;",
            sectionTitle: "margin:28px 0 14px; font-size:13px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;",
            detailGrid: "display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px;",
            detailCard: "border:1px solid #dbe3ef; border-radius:18px; background:#ffffff; padding:14px 16px;",
            detailCardWide: "grid-column:1 / -1;",
            detailLabel: "font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;",
            detailValue: "margin-top:8px; font-size:15px; line-height:1.55; color:#0f172a;",
            itemCard: "border:1px solid #dbe3ef; border-radius:22px; background:#ffffff; padding:18px 20px; margin-bottom:14px;",
            nestedSongCard: "margin-top:12px; border:1px solid #e2e8f0; border-radius:18px; background:#f8fafc; padding:12px 14px;",
            orderBadge: "display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:12px; background:#e8f0ff; color:#274690; font-size:14px; font-weight:800; flex-shrink:0;",
            songTitle: "font-size:18px; line-height:1.25; font-weight:800; color:#0f172a;",
            metaText: "font-size:13px; line-height:1.5; color:#475569;",
            note: "font-size:13px; line-height:1.55; color:#334155;",
            footer: "margin-top:32px; padding-top:18px; border-top:1px solid #dbe3ef; display:flex; justify-content:space-between; gap:16px; font-size:11px; color:#64748b;"
        };

        const headerChips = [
            modeLabel,
            eventMeta.bandName || '',
            eventMeta.dateLabel || '',
            eventMeta.location || ''
        ].filter(Boolean).map((value) => `<span style="${styles.chip}">${this.escapeHtml(value)}</span>`).join('');

        const summaryCards = [
            { label: 'Ansicht', value: modeLabel },
            { label: 'Punkte', value: `${safeItems.length}` },
            { label: 'Songs', value: `${safeSongs.length}` }
        ].map((entry) => `
            <div style="${styles.summaryCard}">
                <div style="${styles.summaryLabel}">${this.escapeHtml(entry.label)}</div>
                <div style="${styles.summaryValue}">${this.escapeHtml(entry.value)}</div>
            </div>
        `).join('');

        const detailCards = [];
        const pushDetail = (label, value, wide = false) => {
            if (!value || (Array.isArray(value) && value.length === 0)) return;
            const displayValue = Array.isArray(value)
                ? value.map((entry) => `<span style="${styles.chip}; text-transform:none; letter-spacing:0; font-size:12px; font-weight:600;">${this.escapeHtml(entry)}</span>`).join('')
                : this.escapeHtml(value);
            detailCards.push(`
                <div style="${styles.detailCard}; ${wide ? styles.detailCardWide : ''}">
                    <div style="${styles.detailLabel}">${this.escapeHtml(label)}</div>
                    <div style="${styles.detailValue}; ${Array.isArray(value) ? 'display:flex; flex-wrap:wrap; gap:8px;' : ''}">${displayValue}</div>
                </div>
            `);
        };

        pushDetail('Band', eventMeta.bandName);
        pushDetail('Erstellt von', eventMeta.createdByName);
        pushDetail('Datum & Zeit', eventMeta.dateLabel);
        pushDetail('Ort', eventMeta.location);
        pushDetail('Soundcheck', eventMeta.soundcheckLocation);
        pushDetail('Besetzung', eventMeta.lineup, true);
        pushDetail('Event-Infos', eventMeta.info, true);
        pushDetail('Technik / PA', eventMeta.techInfo, true);

        let mainContent = '';

        if (mode === 'full-details') {
            mainContent = `
                ${detailCards.length > 0 ? `
                    <div style="${styles.sectionTitle}">Event Details</div>
                    <div style="${styles.detailGrid}">
                        ${detailCards.join('')}
                    </div>
                ` : ''}
                <div style="${styles.sectionTitle}">Ablauf</div>
                ${this.renderRundownTimelineItems(safeItems, {
                    detailed: true,
                    itemStyle: styles.itemCard,
                    chipStyle: styles.chip,
                    songCardStyle: styles.nestedSongCard,
                    orderStyle: styles.orderBadge,
                    titleStyle: styles.songTitle,
                    metaStyle: styles.metaText,
                    noteStyle: styles.note
                })}
            `;
        } else if (mode === 'full-compact') {
            mainContent = `
                <div style="${styles.sectionTitle}">Ablauf</div>
                ${this.renderRundownTimelineItems(safeItems, {
                    detailed: false,
                    itemStyle: styles.itemCard,
                    chipStyle: styles.chip,
                    songCardStyle: styles.nestedSongCard,
                    orderStyle: styles.orderBadge,
                    titleStyle: styles.songTitle,
                    metaStyle: styles.metaText,
                    noteStyle: styles.note
                })}
            `;
        } else if (mode === 'songs-full') {
            mainContent = `
                <div style="${styles.sectionTitle}">Songs aus dem Ablauf</div>
                ${this.renderRundownSongCards(safeSongs, {
                    cardStyle: styles.itemCard,
                    orderStyle: styles.orderBadge,
                    titleStyle: styles.songTitle,
                    metaStyle: styles.metaText,
                    noteStyle: styles.note,
                    chipStyle: styles.chip
                })}
            `;
        } else if (mode === 'songs-language') {
            mainContent = `
                <div style="${styles.sectionTitle}">Songliste mit Sprache</div>
                ${this.renderRundownSongCards(safeSongs, {
                    cardStyle: styles.itemCard,
                    orderStyle: styles.orderBadge,
                    titleStyle: styles.songTitle,
                    metaStyle: styles.metaText,
                    noteStyle: styles.note,
                    chipStyle: styles.chip,
                    languageOnly: true
                })}
            `;
        } else {
            mainContent = `
                <div style="${styles.sectionTitle}">Große Songtitel</div>
                ${this.renderRundownSongCards(safeSongs, {
                    cardStyle: styles.itemCard,
                    orderStyle: "display:inline-flex; align-items:flex-start; justify-content:flex-start; color:#2563eb; font-size:28px; font-weight:800; line-height:1;",
                    titleStyle: styles.songTitle,
                    metaStyle: styles.metaText,
                    noteStyle: styles.note,
                    chipStyle: styles.chip,
                    largeTitles: true
                })}
            `;
        }

        return `
            <div style="${styles.page}">
                <div style="${styles.accent}"></div>
                <header style="${styles.header}">
                    <h1 style="${styles.title}">${this.escapeHtml(title || 'Ablauf')}</h1>
                    ${subtitle ? `<p style="${styles.subtitle}">${this.escapeHtml(subtitle)}</p>` : ''}
                    <div style="${styles.chipRow}">
                        ${headerChips}
                    </div>
                </header>
                <div style="${styles.summaryGrid}">
                    ${summaryCards}
                </div>
                ${mainContent}
                <footer style="${styles.footer}">
                    <div>Erstellt mit <strong>Bandmate</strong></div>
                    <div>Stand: ${this.escapeHtml(generatedAt)}</div>
                </footer>
            </div>
        `;
    },

    async renderMarkupToPDF({ markup, filename = 'export.pdf', previewOnly = false, orientation = 'p', canvasWidth = 860 }) {
        let element = null;

        try {
            element = document.createElement('div');
            element.innerHTML = markup;
            element.style.backgroundColor = '#ffffff';
            element.style.padding = '0';
            element.style.margin = '0';
            element.style.color = '#000000';
            element.style.position = 'absolute';
            element.style.left = '-9999px';
            element.style.top = '0';
            element.style.width = `${canvasWidth}px`;

            document.body.appendChild(element);
            await new Promise((resolve) => setTimeout(resolve, 180));

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: canvasWidth,
                windowWidth: canvasWidth
            });

            const pdf = new window.jsPDF(orientation, 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const pageWidth = orientation === 'l' ? 297 : 210;
            const pageHeight = orientation === 'l' ? 210 : 297;
            const imgHeight = canvas.height * pageWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            if (previewOnly) {
                const blob = pdf.output('blob');
                const blobUrl = URL.createObjectURL(blob);
                return { pdf, blobUrl, filename };
            }

            pdf.save(filename);
            return true;
        } catch (error) {
            console.error('PDFGenerator renderMarkupToPDF Error:', error);
            throw error;
        } finally {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
    },

    async generateRundownPDF({
        title = 'Ablauf',
        subtitle = '',
        mode = 'full-details',
        eventMeta = {},
        items = [],
        songs = [],
        filename = '',
        previewOnly = false
    } = {}) {
        const resolvedFilename = this.sanitizeFilename(filename || title || 'ablauf.pdf', 'ablauf.pdf');
        const markup = this.buildRundownPDFMarkup({
            title,
            subtitle,
            mode,
            eventMeta,
            items,
            songs
        });

        return this.renderMarkupToPDF({
            markup,
            filename: resolvedFilename,
            previewOnly,
            orientation: 'p',
            canvasWidth: 860
        });
    }
};

window.PDFGenerator = PDFGenerator;
