// Utilitaires communs
const Utils = {
    async sendMessage(action, data = {}) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout: pas de réponse du background script'));
            }, 30000);

            chrome.runtime.sendMessage(
                { action, ...data },
                (response) => {
                    clearTimeout(timeout);

                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response || {});
                    }
                }
            );
        });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    formatDate(dateString, locale = 'fr-FR') {
        return new Date(dateString).toLocaleDateString(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    formatTime(locale = 'fr-FR') {
        return new Date().toLocaleTimeString(locale);
    },

    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    createLogger(prefix) {
        return {
            log: (...args) => console.log(`${prefix}:`, ...args),
            warn: (...args) => console.warn(`${prefix}:`, ...args),
            error: (...args) => console.error(`${prefix}:`, ...args),
            info: (...args) => console.info(`${prefix}:`, ...args)
        };
    }
};