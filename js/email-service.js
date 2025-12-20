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

            const templateParams = {
                to_email: toEmail,
                to_name: toName,
                subject: subject,
                message: message,
                from_name: 'Band Planning Tool',
                reply_to: 'noreply@bandplanning.local'
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

            const band = Storage.getBand(rehearsal.bandId);
            const dateFormatted = UI.formatDate(selectedDate);

            let locationName = 'Kein Ort angegeben';
            if (rehearsal.locationId) {
                const location = Storage.getLocation(rehearsal.locationId);
                if (location) {
                    locationName = location.name;
                    if (location.address) {
                        locationName += ` (${location.address})`;
                    }
                }
            }

            const promises = selectedMembers.map(async (member) => {
                const user = Storage.getById('users', member.userId);
                if (!user || !user.email) return null;

                const details = [
                    { label: '🎸 Band', value: band.name },
                    { label: '📅 Datum', value: dateFormatted },
                    { label: '📍 Ort', value: locationName }
                ];

                if (rehearsal.description) {
                    details.push({ label: '📝 Beschreibung', value: rehearsal.description });
                }

                const result = await this.sendEmail(
                    user.email,
                    user.name,
                    `Probe bestätigt: ${rehearsal.title}`,
                    `Die Probe "${rehearsal.title}" wurde bestätigt!`,
                    {
                        details: details,
                        detailsTitle: 'Proben-Details'
                    }
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
            const totalCount = results.filter(r => r !== null).length;

            return {
                success: successCount > 0,
                message: `${successCount} von ${totalCount} E-Mails erfolgreich versendet`,
                results
            };

        } catch (error) {
            console.error('EmailJS error:', error);
            return {
                success: false,
                message: 'Fehler beim Versenden der E-Mails: ' + error.message
            };
        }
    },

    async sendEventNotification(toEmail, toName, event, band) {
        const details = [
            { label: '🎸 Band', value: band.name },
            { label: '📅 Datum', value: UI.formatDate(event.date) }
        ];

        if (event.time) {
            details.push({ label: '🕐 Uhrzeit', value: event.time });
        }

        if (event.location) {
            details.push({ label: '📍 Ort', value: event.location });
        }

        if (event.soundcheck) {
            details.push({ label: '🎚️ Soundcheck', value: event.soundcheck });
        }

        return await this.sendEmail(
            toEmail,
            toName,
            `Auftritt: ${event.title}`,
            `Du wurdest für den Auftritt "${event.title}" eingeladen!`,
            {
                details: details,
                detailsTitle: 'Auftritts-Details'
            }
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