// Gestionnaire de l'interface utilisateur
const UIManager = {
    injectStyles() {
        if (document.querySelector('#claude-review-styles')) return;

        const styles = `
        #claude-review-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-left: 8px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-width: 160px;
            justify-content: center;
        }

        #claude-review-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        #claude-review-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .claude-review-panel {
            background: #ffffff;
            border: 1px solid #d1d9e0;
            border-radius: 12px;
            margin: 20px 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            animation: fadeIn 0.5s ease;
            width: 100%;
            max-width: none;
            position: static;
            z-index: auto;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .claude-review-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .claude-review-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }

        .claude-close-btn {
            background: rgba(255,255,255,0.15);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .claude-close-btn:hover {
            background: rgba(255,255,255,0.25);
        }

        .claude-review-content {
            padding: 24px;
            line-height: 1.7;
            color: #24292f;
            max-height: 70vh;
            overflow-y: auto;
        }

        .claude-review-content::-webkit-scrollbar {
            width: 8px;
        }

        .claude-review-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }

        .claude-review-content::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
        }

        .claude-error {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            color: #c53030;
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
            animation: fadeIn 0.3s ease;
        }

        .claude-progress {
            background: #f8f9fa;
            border-radius: 4px;
            padding: 8px 12px;
            margin: 8px 0;
            font-size: 14px;
            border-left: 4px solid #667eea;
        }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = 'claude-review-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    },

    createReviewButton(clickHandler) {
        if (document.querySelector('#claude-review-btn')) return;

        const selectors = [
            '.gh-header-actions',
            '.js-issue-header-actions',
            '[data-testid="pull-request-header-actions"]',
            '.TableObject-item--primary .d-flex',
            '.pr-toolbar .d-flex',
            '.Box-header .d-flex'
        ];

        let buttonContainer = null;
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                buttonContainer = element;
                break;
            }
        }

        if (!buttonContainer) {
            const fallbackSelectors = ['.js-issue-header', '[data-hpc]', '.gh-header'];
            for (const selector of fallbackSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    buttonContainer = document.createElement('div');
                    buttonContainer.style.cssText = 'margin: 16px 0; text-align: right; padding: 0 16px;';
                    element.insertBefore(buttonContainer, element.firstChild);
                    break;
                }
            }
        }

        if (!buttonContainer) {
            setTimeout(() => this.createReviewButton(clickHandler), 2000);
            return;
        }

        const reviewButton = document.createElement('button');
        reviewButton.id = 'claude-review-btn';
        reviewButton.innerHTML = '🤖 Review with Claude';
        reviewButton.addEventListener('click', clickHandler);

        buttonContainer.appendChild(reviewButton);
        console.log('✅ Bouton créé');
    },

    setupObserver() {
        const observer = new MutationObserver(() => {
            const isPRPage = /\/pull\/\d+/.test(window.location.pathname);
            if (isPRPage && !document.querySelector('#claude-review-btn')) {
                setTimeout(() => this.createReviewButton(), 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    showError(message) {
        const existingErrors = document.querySelectorAll('.claude-error');
        existingErrors.forEach(error => error.remove());

        const errorDiv = document.createElement('div');
        errorDiv.className = 'claude-error';
        errorDiv.innerHTML = `
            <div>
                <strong>Claude PR Reviewer:</strong><br>
                ${message}
            </div>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; float: right;">×</button>
        `;

        document.body.insertBefore(errorDiv, document.body.firstChild);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }
};