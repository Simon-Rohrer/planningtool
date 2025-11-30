// EmailJS Integration Module

const EmailService = {
    // EmailJS Configuration
    config: {
        serviceId: '', // Wird vom Benutzer konfiguriert
        templateId: '', // Wird vom Benutzer konfiguriert
        publicKey: '', // Wird vom Benutzer konfiguriert
        isConfigured: false
    },

    // Initialize EmailJS
    init(serviceId, templateId, publicKey) {
        this.config.serviceId = serviceId;
        this.config.templateId = templateId;
        this.config.publicKey = publicKey;
        this.config.isConfigured = !!(serviceId && templateId && publicKey);

        // Load configuration from localStorage if exists
        const savedConfig = localStorage.getItem('emailjsConfig');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            this.config = { ...this.config, ...config, isConfigured: true };
        }
    },

    // Save configuration
    saveConfig(serviceId, templateId, publicKey) {
        this.config.serviceId = serviceId;
        this.config.templateId = templateId;
        this.config.publicKey = publicKey;
        this.config.isConfigured = true;

        localStorage.setItem('emailjsConfig', JSON.stringify({
            serviceId,
            templateId,
            publicKey
        }));
    },

    // Check if EmailJS is configured
    isConfigured() {
        return this.config.isConfigured;
    },

    // Send rehearsal confirmation email to all band members
    async sendRehearsalConfirmation(rehearsal, selectedDate, bandMembers) {
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

            // Send email to each band member
            const promises = bandMembers.map(async (member) => {
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
    },

    // Test email configuration
    async testConfiguration(testEmail) {
        if (!this.isConfigured()) {
            return {
                success: false,
                message: 'EmailJS ist nicht konfiguriert'
            };
        }

        try {
            await this.loadEmailJS();
            emailjs.init(this.config.publicKey);

            const templateParams = {
                to_email: testEmail,
                to_name: 'Test User',
                band_name: 'Test Band',
                rehearsal_title: 'Test Probe',
                rehearsal_description: 'Dies ist eine Test-E-Mail',
                rehearsal_date: new Date().toLocaleDateString('de-DE'),
                from_name: 'Band Planning Tool'
            };

            await emailjs.send(
                this.config.serviceId,
                this.config.templateId,
                templateParams
            );

            return {
                success: true,
                message: 'Test-E-Mail erfolgreich versendet!'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Fehler: ' + error.message
            };
        }
    }
};

// Initialize on load
EmailService.init();
