// Supabase client initialization and helpers
// Reads URL and anon key from localStorage settings

const SupabaseClient = {
    client: null,

    isConfigured() {
        const url = localStorage.getItem('supabase.url');
        const key = localStorage.getItem('supabase.anonKey');
        return !!(url && key);
    },

    init() {
        try {
            // Prefill defaults if missing
            if (!localStorage.getItem('supabase.url')) {
                localStorage.setItem('supabase.url', 'https://brkapsnrdewuualhsmcr.supabase.co');
            }
            if (!localStorage.getItem('supabase.anonKey')) {
                localStorage.setItem('supabase.anonKey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJya2Fwc25yZGV3dXVhbGhzbWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjgyNTEsImV4cCI6MjA4MDI0NDI1MX0.X78zASumSTzTa1n3tk9BdwMuQSvXIWTDLUiBTg--FCs');
            }
            const url = localStorage.getItem('supabase.url');
            const key = localStorage.getItem('supabase.anonKey');
            if (url && key && window.supabase) {
                this.client = window.supabase.createClient(url, key);

            } else {
                this.client = null;
            }
        } catch (e) {
            console.error('Failed to init Supabase', e);
            this.client = null;
        }
    },

    getClient() {
        if (!this.client) this.init();
        return this.client;
    },

    async testConnection() {
        if (!this.isConfigured()) return { success: false, message: 'Supabase ist nicht konfiguriert.' };
        const sb = this.getClient();
        try {
            // Test with a simple query to users table (or just health check if possible)
            const { data, error } = await sb.from('users').select('id').limit(1);
            if (error) {
                if (error.message && error.message.includes('Load failed')) {
                    return { success: false, message: 'Netzwerkfehler: Bitte überprüfe deine Internetverbindung oder ob die URL korrekt ist (CORS-Blockierung?).' };
                }
                return { success: false, message: `Fehler: ${error.message}` };
            }
            return { success: true, message: 'Verbindung zu Supabase erfolgreich hergestellt!' };
        } catch (e) {
            return { success: false, message: `Unerwarteter Fehler: ${e.message}` };
        }
    }
};

// Wire up settings form if present
(function attachSupabaseSettings() {
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('supabaseSettingsForm');
        const urlInput = document.getElementById('supabaseUrl');
        const keyInput = document.getElementById('supabaseAnonKey');
        if (!form || !urlInput || !keyInput) return;

        // Prefill from localStorage
        urlInput.value = localStorage.getItem('supabase.url') || '';
        keyInput.value = localStorage.getItem('supabase.anonKey') || '';

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const url = urlInput.value.trim();
            const key = keyInput.value.trim();
            localStorage.setItem('supabase.url', url);
            localStorage.setItem('supabase.anonKey', key);
            SupabaseClient.init();
            if (typeof UI !== 'undefined') {
                UI.showToast('Supabase Einstellungen gespeichert', 'success');
            } else {
                console.log('Supabase settings saved');
            }
        });

        // Add test connection button
        const testBtn = document.createElement('button');
        testBtn.type = 'button';
        testBtn.className = 'btn btn-secondary';
        testBtn.style.marginTop = '10px';
        testBtn.textContent = 'Verbindung testen';
        testBtn.onclick = async () => {
            testBtn.disabled = true;
            testBtn.textContent = 'Teste...';
            const result = await SupabaseClient.testConnection();
            if (typeof UI !== 'undefined') {
                UI.showToast(result.message, result.success ? 'success' : 'error');
            } else {
                alert(result.message);
            }
            testBtn.disabled = false;
            testBtn.textContent = 'Verbindung testen';
        };
        form.appendChild(testBtn);
    });
})();
