// EmailJS Integration Module

const EmailService = {
    config: {
        serviceId: 'service_cadjeiq',
        templateId: 'template_l9a8mdf',
        publicKey: '5upXiXp5loj1iOMv7',
        isConfigured: true
    },

    init(serviceId, templateId, publicKey) {
        if (serviceId && templateId && publicKey) {
            this.config.serviceId = serviceId;
            this.config.templateId = templateId;
            this.config.publicKey = publicKey;
            this.config.isConfigured = true;
        } else {
            this.config.isConfigured = !!(this.config.serviceId && this.config.templateId && this.config.publicKey);
        }
    },

    isConfigured() {
        return this.config.isConfigured;
    },

    /**
     * Universal email function - works for any purpose
     * @param {string} toEmail - Recipient email
     * @param {string} toName - Recipient name
     * @param {string} subject - Email subject
     * @param {string} message - Main message text
     * @param {object} options - Optional parameters
     *   @param {array} options.details - Array of {label, value} objects
     *   @param {string} options.detailsTitle - Title for details section
     *   @param {string} options.buttonText - Button text
     *   @param {string} options.buttonLink - Button URL
     */
    async sendEmail(toEmail, toName, subject, message, options = {}) {
        if (!this.isConfigured()) {
            console.warn('EmailJS not configured. Skipping email send.');
            return {
                success: false,
                message: 'EmailJS ist nicht konfiguriert'
            };
        }

        try {
            if (typeof emailjs === 'undefined') {
                await this.loadEmailJS();
            }
            emailjs.init(this.config.publicKey);

            // Map to User's specific EmailJS template variables from screenshot
            const templateParams = {
                // {{user}} -> Recipient Email
                user: toEmail,

                // {{title}} -> Email Subject
                title: subject,

                // {{content}} -> Main message body
                content: message,

                // {{name}} -> Sender Name (Fixed as System Name)
                name: 'Band Planning Tool',

                // {{email}} -> Reply-To / Sender Email (Fixed)
                email: 'noreply@bandplanning.local',

                // Keep original params just in case functionality changes
                to_name: toName
            };

            // Add optional details
            if (options.details && options.details.length > 0) {
                templateParams.has_details = true;
                templateParams.details_title = options.detailsTitle || 'Details';
                templateParams.details_count = options.details.length;

                options.details.forEach((detail, index) => {
                    templateParams[`detail_${index}_label`] = detail.label;
                    templateParams[`detail_${index}_value`] = detail.value;
                });
            }

            // Add optional button
            if (options.buttonText && options.buttonLink) {
                templateParams.button_text = options.buttonText;
                templateParams.button_link = options.buttonLink;
            }

            const response = await emailjs.send(
                this.config.serviceId,
                this.config.templateId,
                templateParams
            );

            return {
                success: true,
                message: 'E-Mail erfolgreich versendet',
                response
            };

        } catch (error) {
            console.error('EmailJS error:', error);
            return {
                success: false,
                message: 'Fehler beim Versenden der E-Mail: ' + error.message
            };
        }
    },

    async sendPasswordReset(toEmail, toName, resetLink) {
        return await this.sendEmail(
            toEmail,
            toName,
            'Passwort zurücksetzen',
            'Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.\n\nKlicke auf den Button unten, um ein neues Passwort festzulegen.\n\nWenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail einfach.',
            {
                buttonText: 'Passwort zurücksetzen',
                buttonLink: resetLink
            }
        );
    },

    async sendRehearsalConfirmation(rehearsal, selectedDate, selectedMembers) {
        if (!this.isConfigured()) return { success: false, message: 'EmailJS nicht konfiguriert' };

        try {
            if (typeof emailjs === 'undefined') await this.loadEmailJS();
            emailjs.init(this.config.publicKey);

            const band = await Storage.getBand(rehearsal.bandId);
            const dateFormatted = UI.formatDate(selectedDate);

            // Get Location Name
            let locationName = 'Kein Ort angegeben';
            let locationAddress = '';
            if (rehearsal.locationId) {
                const location = await Storage.getLocation(rehearsal.locationId);
                if (location) {
                    locationName = location.name;
                    locationAddress = location.address ? `\nAdresse: ${location.address}` : '';
                }
            }

            const promises = selectedMembers.map(async (member) => {
                const user = await Storage.getById('users', member.userId);
                if (!user || !user.email) return null;

                // Create beautiful plain-text content
                const message = `Hallo ${user.first_name || user.name || user.username},

Deine Probe wurde bestätigt! 🎸

Hier sind die Details:

Titel: ${rehearsal.title}
Band: ${band.name}
Datum: ${dateFormatted}
Ort: ${locationName}${locationAddress}${rehearsal.description ? `\n\nBeschreibung:\n${rehearsal.description}` : ''}

Bitte sei pünktlich. Wir freuen uns auf dich!

Dein Band Planning Tool`;

                const result = await this.sendEmail(
                    user.email,
                    user.name,
                    `Probe bestätigt: ${rehearsal.title}`,
                    message
                );

                return {
                    success: result.success,
                    email: user.email,
                    response: result.response,
                    error: result.success ? null : result.message
                };
            });

            const results = await Promise.all(promises);
            const successCount = results.filter(r => r && r.success).length;

            return {
                success: successCount > 0,
                message: `${successCount} E-Mails versendet`,
                results
            };

        } catch (error) {
            console.error('EmailJS error:', error);
            return { success: false, message: error.message };
        }
    },

    async sendRehearsalUpdate(oldRehearsal, newRehearsal, selectedMembers) {
        if (!this.isConfigured()) return { success: false, message: 'EmailJS nicht konfiguriert' };

        try {
            if (typeof emailjs === 'undefined') await this.loadEmailJS();
            emailjs.init(this.config.publicKey);

            const band = await Storage.getBand(newRehearsal.bandId);

            // Get old and new location names
            let oldLocationName = 'Kein Ort';
            let newLocationName = 'Kein Ort';

            if (oldRehearsal.locationId) {
                const oldLoc = await Storage.getLocation(oldRehearsal.locationId);
                if (oldLoc) oldLocationName = oldLoc.name;
            }

            if (newRehearsal.locationId) {
                const newLoc = await Storage.getLocation(newRehearsal.locationId);
                if (newLoc) newLocationName = newLoc.name;
            }

            // Detect changes
            const changes = [];

            if (oldRehearsal.title !== newRehearsal.title) {
                changes.push(`Titel: "${oldRehearsal.title}" → "${newRehearsal.title}"`);
            }

            if (oldRehearsal.confirmedDate !== newRehearsal.confirmedDate) {
                const oldDate = UI.formatDate(oldRehearsal.confirmedDate);
                const newDate = UI.formatDate(newRehearsal.confirmedDate);
                changes.push(`Datum: ${oldDate} → ${newDate}`);
            }

            if (oldRehearsal.locationId !== newRehearsal.locationId) {
                changes.push(`Ort: "${oldLocationName}" → "${newLocationName}"`);
            }

            if ((oldRehearsal.description || '') !== (newRehearsal.description || '')) {
                const oldDesc = oldRehearsal.description || '(keine)';
                const newDesc = newRehearsal.description || '(keine)';
                changes.push(`Beschreibung: "${oldDesc}" → "${newDesc}"`);
            }

            if (changes.length === 0) {
                return { success: false, message: 'Keine Änderungen erkannt' };
            }

            const promises = selectedMembers.map(async (member) => {
                const user = await Storage.getById('users', member.userId);
                if (!user || !user.email) return null;

                const changesText = changes.map(c => `• ${c}`).join('\n');
                const dateFormatted = UI.formatDate(newRehearsal.confirmedDate);

                const message = `Hallo ${user.first_name || user.name || user.username},

die Probe wurde aktualisiert! ⚠️

ÄNDERUNGEN:
${changesText}

AKTUELLE DETAILS:
Titel: ${newRehearsal.title}
Band: ${band.name}
Datum: ${dateFormatted}
Ort: ${newLocationName}${newRehearsal.description ? `\n\nBeschreibung:\n${newRehearsal.description}` : ''}

Bitte beachte die Änderungen!

Dein Band Planning Tool`;

                const result = await this.sendEmail(
                    user.email,
                    user.name,
                    `Probe aktualisiert: ${newRehearsal.title}`,
                    message
                );

                return {
                    success: result.success,
                    email: user.email,
                    response: result.response,
                    error: result.success ? null : result.message
                };
            });

            const results = await Promise.all(promises);
            const successCount = results.filter(r => r && r.success).length;

            return {
                success: successCount > 0,
                message: `${successCount} Update-E-Mails versendet`,
                results
            };

        } catch (error) {
            console.error('EmailJS error:', error);
            return { success: false, message: error.message };
        }
    },

    async sendEventNotification(toEmail, toName, event, band) {
        const dateFormatted = UI.formatDate(event.date);

        const message = `Hallo ${toName},

Du wurdest zu einem neuen Auftritt eingeladen! 🎤

Hier sind die Details:

Titel: ${event.title}
Band: ${band.name}
Datum: ${dateFormatted}
${event.time ? `Priorität/Zeit: ${event.time}` : ''}
${event.location ? `Ort: ${event.location}` : ''}
${event.soundcheck ? `Soundcheck: ${event.soundcheck}` : ''}

${event.info ? `Infos:\n${event.info}` : ''}

Bitte checke die App für weitere Details.

Rock on! 🤘
Dein Band Planning Tool`;

        return await this.sendEmail(
            toEmail,
            toName,
            `Neuer Auftritt: ${event.title}`,
            message
        );
    },

    loadEmailJS() {
        return new Promise((resolve, reject) => {
            if (typeof emailjs !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load EmailJS library'));
            document.head.appendChild(script);
        });
    }
};

EmailService.init();