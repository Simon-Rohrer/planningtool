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
    });
})();
