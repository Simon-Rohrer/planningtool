// UI Utilities Module

const UI = {
    // Modal management
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');

            // Add click outside to close (only if not already added)
            if (!modal.dataset.hasClickOutside) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModal(modalId);
                    }
                });
                modal.dataset.hasClickOutside = 'true';
            }

            // Add ESC key listener
            if (!modal.dataset.hasEscListener) {
                const escHandler = (e) => {
                    if (e.key === 'Escape' && modal.classList.contains('active')) {
                        this.closeModal(modalId);
                    }
                };
                document.addEventListener('keydown', escHandler);
                // Store handler to remove later
                modal._escHandler = escHandler;
                modal.dataset.hasEscListener = 'true';
            }
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');

            // Remove ESC listener if exists
            if (modal._escHandler) {
                document.removeEventListener('keydown', modal._escHandler);
                delete modal._escHandler;
                delete modal.dataset.hasEscListener;
            }
        }
    },

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.id !== 'authModal') {
                modal.classList.remove('active');
            }
        });
    },

    // Confirm delete dialog
    confirmDelete(message = 'Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.') {
        return this.confirmAction(message, 'Wirklich löschen?', 'Löschen', 'btn-danger');
    },

    // Generic confirm action dialog
    confirmAction(message, title = 'Bestätigung', confirmText = 'OK', confirmClass = 'btn-primary') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmDeleteModal');
            const titleEl = document.getElementById('confirmDeleteTitle');
            const messageEl = document.getElementById('confirmDeleteMessage');
            const confirmBtn = document.getElementById('confirmDeleteConfirm');
            const cancelBtn = document.getElementById('confirmDeleteCancel');
            const closeBtn = modal.querySelector('.modal-close');

            if (!modal || !confirmBtn || !cancelBtn || !closeBtn) {
                console.error('confirmAction: Required modal elements not found');
                resolve(false);
                return;
            }

            if (titleEl) {
                titleEl.textContent = title;
            }

            if (messageEl) {
                messageEl.textContent = message;
            }

            // Remove old event listeners by cloning
            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            const newCloseBtn = closeBtn.cloneNode(true);

            // Update button text and class
            newConfirmBtn.textContent = confirmText;
            newConfirmBtn.className = 'btn ' + confirmClass;

            confirmBtn.replaceWith(newConfirmBtn);
            cancelBtn.replaceWith(newCancelBtn);
            closeBtn.replaceWith(newCloseBtn);

            const cleanup = () => {
                this.closeModal('confirmDeleteModal');
            };

            // Add event listeners to the new buttons
            newConfirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            newCancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            newCloseBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            this.openModal('confirmDeleteModal');
        });
    },

    // Toast notifications
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');

        if (!toast) {
            console.error('[UI.showToast] Toast element not found!');
            return;
        }

        toast.textContent = message;
        toast.className = 'toast show';

        if (type === 'success') {
            toast.classList.add('success');
        } else if (type === 'error') {
            toast.classList.add('error');
        }

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // View navigation
    showView(viewId) {
        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.classList.remove('active'));

        // Show selected view
        const selectedView = document.getElementById(viewId);
        if (selectedView) {
            selectedView.classList.add('active');
        }

        // Update nav items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.dataset.view === viewId.replace('View', '')) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },

    // Date formatting
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('de-DE', options);
    },

    formatDateShort(dateString) {
        const date = new Date(dateString);
        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('de-DE', options);
    },

    // Date only (no time)
    formatDateOnly(dateString) {
        const date = new Date(dateString);
        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        return date.toLocaleDateString('de-DE', options);
    },

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Gerade eben';
        if (diffMins < 60) return `vor ${diffMins} Minute${diffMins > 1 ? 'n' : ''}`;
        if (diffHours < 24) return `vor ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
        if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;

        return this.formatDateShort(dateString);
    },

    // Get user initials for avatar
    getUserInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },

    // Role display
    getRoleDisplayName(role) {
        const roleNames = {
            'leader': 'Leiter',
            'co-leader': 'Co-Leiter',
            'member': 'Mitglied'
        };
        return roleNames[role] || role;
    },

    getRoleClass(role) {
        return `role-${role}`;
    },

    // Empty state
    showEmptyState(container, icon, message) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <p>${message}</p>
            </div>
        `;
    },

    // Confirmation dialog
    confirm(message) {
        // legacy synchronous confirm (keeps backward compatibility)
        return window.confirm(message);
    },

    // Show a custom confirmation modal with callbacks
    // onConfirm: function called when user confirms
    // onCancel: optional function called when user cancels
    showConfirm(message, onConfirm, onCancel) {
        // Create modal markup
        let existing = document.getElementById('customConfirmModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'customConfirmModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Bestätigung</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-actions" style="display:flex; gap:8px; justify-content:flex-end; padding:12px;">
                    <button id="confirmCancelBtn" class="btn">Abbrechen</button>
                    <button id="confirmOkBtn" class="btn btn-primary">Bestätigen</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Wire events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
            if (typeof onCancel === 'function') onCancel();
        });

        modal.querySelector('#confirmCancelBtn').addEventListener('click', () => {
            modal.remove();
            if (typeof onCancel === 'function') onCancel();
        });

        modal.querySelector('#confirmOkBtn').addEventListener('click', () => {
            modal.remove();
            if (typeof onConfirm === 'function') onConfirm();
        });
    },

    // Loading spinner: delayed appearance if operation exceeds delayMs (default 1s)
    _loaderTimer: null,
    showLoading(message = 'Lädt...', delayMs = 1000) {
        // Clear previous timer
        if (this._loaderTimer) {
            clearTimeout(this._loaderTimer);
            this._loaderTimer = null;
        }
        let loader = document.getElementById('globalLoader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.style.display = 'none';
            loader.style.position = 'fixed';
            loader.style.inset = '0';
            loader.style.zIndex = '9999';
            loader.innerHTML = `
                <div class="loader-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
                    <div class="loader-content" style="background:#fff;padding:16px 20px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.15);display:flex;align-items:center;gap:12px;">
                        <div class="spinner" style="width:22px;height:22px;border:3px solid #ddd;border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                        <p class="loader-message" style="margin:0;font-weight:600;color:#111;">${message}</p>
                    </div>
                </div>
            `;
            document.body.appendChild(loader);
            // Spinner keyframes
            const style = document.createElement('style');
            style.textContent = '@keyframes spin {from{transform:rotate(0)} to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        } else {
            loader.querySelector('.loader-message').textContent = message;
        }
        // Show after delay
        this._loaderTimer = setTimeout(() => {
            loader.style.display = 'block';
        }, delayMs);
    },

    hideLoading() {
        if (this._loaderTimer) {
            clearTimeout(this._loaderTimer);
            this._loaderTimer = null;
        }
        const loader = document.getElementById('globalLoader');
        if (loader) {
            loader.style.display = 'none';
        }
    },

    // Clear form
    clearForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
        }
    }
};
