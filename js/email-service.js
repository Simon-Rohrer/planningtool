// EmailJS Integration Module

const EmailService = {
    // EmailJS Configuration - Set your credentials here
    config: {
        serviceId: 'service_cadjeiq',
        templateId: 'template_l9a8mdf',
        publicKey: '5upXiXp5loj1iOMv7',
        isConfigured: true
    },

    // Initialize EmailJS
    init(serviceId, templateId, publicKey) {
        if (serviceId && templateId && publicKey) {
            this.config.serviceId = serviceId;
            this.config.templateId = templateId;
            this.config.publicKey = publicKey;
            this.config.isConfigured = true;
        } else {
            // Use hardcoded config if no parameters provided
            this.config.isConfigured = !!(this.config.serviceId && this.config.templateId && this.config.publicKey);
        }
    },

    // Check if EmailJS is configured
    isConfigured() {
        return this.config.isConfigured;
    },

    // Send rehearsal confirmation email to all band members
    async sendRehearsalConfirmation(rehearsal, selectedDate, selectedMembers) {
        if (!this.isConfigured()) {
            console.warn('EmailJS not configured. Skipping email send.');
            return {
                success: false,
                message: 'EmailJS ist nicht konfiguriert'
            };
        }

        try {
            // Load EmailJS library if not already loaded
            if (typeof emailjs === 'undefined') {
                await this.loadEmailJS();
            }

            // Initialize EmailJS with public key
            emailjs.init(this.config.publicKey);

            const band = Storage.getBand(rehearsal.bandId);
            const dateFormatted = UI.formatDate(selectedDate);

            // Send email to each selected band member
            const promises = selectedMembers.map(async (member) => {
                const user = Storage.getById('users', member.userId);
                if (!user || !user.email) return null;

                // Get location name
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

                // Prepare template parameters
                const templateParams = {
                    to_email: user.email,
                    to_name: user.name,
                    band_name: band.name,
                    rehearsal_title: rehearsal.title,
                    rehearsal_description: rehearsal.description || 'Keine Beschreibung',
                    rehearsal_date: dateFormatted,
                    rehearsal_location: locationName,
                    from_name: 'Band Planning Tool',
                    reply_to: 'noreply@bandplanning.local'
                };

                try {
                    const response = await emailjs.send(
                        this.config.serviceId,
                        this.config.templateId,
                        templateParams
                    );
                    return { success: true, email: user.email, response };
                } catch (error) {
                    console.error(`Failed to send email to ${user.email}:`, error);
                    return { success: false, email: user.email, error };
                }
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

    // Send rehearsal update email to all band members
    async sendRehearsalUpdate(rehearsal) {
        if (!this.isConfigured()) {
            return { success: false, message: 'EmailJS ist nicht konfiguriert' };
        }

        try {
            if (typeof emailjs === 'undefined') {
                await this.loadEmailJS();
            }
            emailjs.init(this.config.publicKey);

            const band = Storage.getBand(rehearsal.bandId);
            const members = Storage.getBandMembers(band.id);

            // Format dates
            let dateString = '';
            if (rehearsal.finalDate) {
                dateString = UI.formatDate(rehearsal.finalDate);
            } else {
                dateString = rehearsal.proposedDates.map(d => UI.formatDate(d)).join(', ');
            }

            // Get location name
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

            const promises = members.map(async (member) => {
                const user = Storage.getById('users', member.userId);
                if (!user || !user.email) return null;

                const templateParams = {
                    to_email: user.email,
                    to_name: user.name,
                    band_name: band.name,
                    rehearsal_title: `UPDATE: ${rehearsal.title}`,
                    rehearsal_description: rehearsal.description || 'Keine Beschreibung',
                    rehearsal_date: dateString,
                    rehearsal_location: locationName,
                    from_name: 'Band Planning Tool',
                    reply_to: 'noreply@bandplanning.local'
                };

                try {
                    await emailjs.send(
                        this.config.serviceId,
                        this.config.templateId,
                        templateParams
                    );
                    return { success: true };
                } catch (error) {
                    console.error(`Failed to send email to ${user.email}:`, error);
                    return { success: false };
                }
            });

            await Promise.all(promises);
            return { success: true, message: 'Update-E-Mails wurden versendet' };

        } catch (error) {
            console.error('EmailJS error:', error);
            return { success: false, message: error.message };
        }
    },

    // Load EmailJS library dynamically
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

// Initialize on load with hardcoded config
EmailService.init();