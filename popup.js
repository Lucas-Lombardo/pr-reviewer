document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Popup Claude PR Reviewer chargé');

    // Configuration par défaut
    const DEFAULT_CONFIG = {
        selectedModel: 'claude-3-haiku-20240307',
        maxFiles: 20
    };

    // Éléments DOM
    const elements = {
        form: document.getElementById('settingsForm'),
        claudeApiKey: document.getElementById('claudeApiKey'),
        githubToken: document.getElementById('githubToken'),
        selectedModel: document.getElementById('selectedModel'),
        maxFiles: document.getElementById('maxFiles'),
        saveBtn: document.getElementById('saveBtn'),
        status: document.getElementById('status'),
        configStatus: document.getElementById('configStatus'),
        advancedToggle: document.getElementById('advancedToggle'),
        advancedContent: document.getElementById('advancedContent'),
        advancedArrow: document.getElementById('advancedArrow'),
        toggleClaudeKey: document.getElementById('toggleClaudeKey'),
        toggleGithubToken: document.getElementById('toggleGithubToken'),
        claudeKeyValidation: document.getElementById('claudeKeyValidation'),
        githubTokenValidation: document.getElementById('githubTokenValidation')
    };

    // État de l'application
    let state = {
        isLoading: false,
        config: DEFAULT_CONFIG,
        showAdvanced: false
    };

    // Initialisation
    await init();

    async function init() {
        try {
            await loadConfiguration();
            setupEventListeners();
            updateConfigStatus();
            updateUI();
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            showStatus('Erreur lors du chargement de la configuration', 'error');
        }
    }

    async function loadConfiguration() {
        try {
            const result = await chrome.storage.local.get([
                'claudeApiKey',
                'githubToken',
                'selectedModel',
                'maxFiles',
                'showAdvanced'
            ]);

            state.config = {
                ...DEFAULT_CONFIG,
                ...result
            };

            state.showAdvanced = result.showAdvanced || false;

            // Remplir les champs
            if (result.claudeApiKey) {
                elements.claudeApiKey.value = result.claudeApiKey;
                validateClaudeKey(result.claudeApiKey, false);
            }

            if (result.githubToken) {
                elements.githubToken.value = result.githubToken;
                validateGithubToken(result.githubToken, false);
            }

            elements.selectedModel.value = state.config.selectedModel;
            elements.maxFiles.value = state.config.maxFiles;

            console.log('✅ Configuration chargée:', state.config);
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            throw error;
        }
    }

    function setupEventListeners() {
        // Formulaire
        elements.form.addEventListener('submit', handleFormSubmit);

        // Validation en temps réel
        elements.claudeApiKey.addEventListener('input', debounce(() => {
            validateClaudeKey(elements.claudeApiKey.value);
        }, 500));

        elements.githubToken.addEventListener('input', debounce(() => {
            validateGithubToken(elements.githubToken.value);
        }, 500));

        // Toggle password visibility
        elements.toggleClaudeKey.addEventListener('click', () => {
            togglePasswordVisibility(elements.claudeApiKey, elements.toggleClaudeKey);
        });

        elements.toggleGithubToken.addEventListener('click', () => {
            togglePasswordVisibility(elements.githubToken, elements.toggleGithubToken);
        });

        // Section avancée
        elements.advancedToggle.addEventListener('click', toggleAdvancedSection);

        // Validation des nombres
        elements.maxFiles.addEventListener('input', () => {
            const value = parseInt(elements.maxFiles.value);
            if (value < 5) elements.maxFiles.value = 5;
            if (value > 50) elements.maxFiles.value = 50;
        });

        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (!state.isLoading) {
                    handleFormSubmit(e);
                }
            }
        });
    }

    function updateConfigStatus() {
        const hasClaudeKey = !!elements.claudeApiKey.value && validateClaudeKey(elements.claudeApiKey.value, false);
        const hasGithubToken = !!elements.githubToken.value;

        if (hasClaudeKey) {
            elements.configStatus.className = 'config-status configured';
            elements.configStatus.innerHTML = `
                <span class="config-icon">✅</span>
                <span>Configuration complète - Prêt à utiliser!</span>
            `;
        } else {
            elements.configStatus.className = 'config-status not-configured';
            elements.configStatus.innerHTML = `
                <span class="config-icon">⚠️</span>
                <span>Configuration incomplète - Clé Claude requise</span>
            `;
        }
    }

    function updateUI() {
        // Afficher/masquer la section avancée
        if (state.showAdvanced) {
            elements.advancedContent.classList.add('show');
            elements.advancedArrow.textContent = '▲';
        } else {
            elements.advancedContent.classList.remove('show');
            elements.advancedArrow.textContent = '▼';
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        if (state.isLoading) return;

        const claudeApiKey = elements.claudeApiKey.value.trim();
        const githubToken = elements.githubToken.value.trim();
        const selectedModel = elements.selectedModel.value;
        const maxFiles = parseInt(elements.maxFiles.value);

        // Validation
        if (!validateForm(claudeApiKey, githubToken, maxFiles)) {
            return;
        }

        try {
            setLoading(true);
            showStatus('Sauvegarde en cours...', 'info');

            // Tester la clé Claude avant de sauvegarder
            await testClaudeConnection(claudeApiKey);

            // Sauvegarder
            await chrome.storage.local.set({
                claudeApiKey,
                githubToken,
                selectedModel,
                maxFiles,
                showAdvanced: state.showAdvanced
            });

            state.config = {
                claudeApiKey,
                githubToken,
                selectedModel,
                maxFiles
            };

            showStatus('✅ Configuration sauvegardée avec succès!', 'success');
            updateConfigStatus();

            // Fermer la popup après 1.5 secondes
            setTimeout(() => {
                window.close();
            }, 1500);

        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            showStatus('❌ Erreur: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    function validateForm(claudeApiKey, githubToken, maxFiles) {
        let isValid = true;

        // Validation Claude API Key
        if (!validateClaudeKey(claudeApiKey)) {
            isValid = false;
        }

        // Validation GitHub Token (optionnel)
        if (githubToken && !validateGithubToken(githubToken)) {
            isValid = false;
        }

        // Validation max files
        if (isNaN(maxFiles) || maxFiles < 5 || maxFiles > 50) {
            showStatus('Le nombre de fichiers doit être entre 5 et 50', 'error');
            isValid = false;
        }

        return isValid;
    }

    function validateClaudeKey(key, showMessage = true) {
        if (!key) {
            if (showMessage) {
                showValidationMessage(elements.claudeKeyValidation, 'Clé API Claude requise', 'error');
            }
            return false;
        }

        if (!key.startsWith('sk-ant-')) {
            if (showMessage) {
                showValidationMessage(elements.claudeKeyValidation, 'Format invalide (doit commencer par sk-ant-)', 'error');
            }
            return false;
        }

        if (key.length < 20) {
            if (showMessage) {
                showValidationMessage(elements.claudeKeyValidation, 'Clé trop courte', 'error');
            }
            return false;
        }

        if (showMessage) {
            showValidationMessage(elements.claudeKeyValidation, 'Format valide ✓', 'success');
        }
        return true;
    }

    function validateGithubToken(token, showMessage = true) {
        if (!token) {
            if (showMessage) {
                showValidationMessage(elements.githubTokenValidation, '', '');
            }
            return true; // Optionnel
        }

        if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
            if (showMessage) {
                showValidationMessage(elements.githubTokenValidation, 'Format invalide (doit commencer par ghp_ ou github_pat_)', 'error');
            }
            return false;
        }

        if (showMessage) {
            showValidationMessage(elements.githubTokenValidation, 'Format valide ✓', 'success');
        }
        return true;
    }

    function showValidationMessage(element, message, type) {
        if (!message) {
            element.style.display = 'none';
            return;
        }

        element.textContent = message;
        element.className = `validation-message ${type}`;
        element.style.display = 'block';
    }

    async function testClaudeConnection(apiKey) {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 10,
                    messages: [{
                        role: 'user',
                        content: 'Test'
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                if (response.status === 401) {
                    throw new Error('Clé API Claude invalide');
                } else if (response.status === 403) {
                    throw new Error('Accès interdit - vérifiez vos permissions');
                } else if (response.status === 429) {
                    throw new Error('Trop de requêtes - votre clé fonctionne mais vous êtes limité');
                } else {
                    throw new Error(errorData.error?.message || `Erreur ${response.status}`);
                }
            }

            console.log('✅ Test de connexion Claude réussi');
        } catch (error) {
            if (error.message.includes('CORS') || error.message.includes('network')) {
                // Ignorer les erreurs CORS/réseau pour les tests
                console.warn('Test Claude ignoré (CORS/réseau):', error.message);
                return;
            }
            throw error;
        }
    }

    function toggleAdvancedSection() {
        state.showAdvanced = !state.showAdvanced;
        updateUI();
    }

    function togglePasswordVisibility(input, button) {
        if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈';
            button.title = 'Masquer';
        } else {
            input.type = 'password';
            button.textContent = '👁️';
            button.title = 'Afficher';
        }
    }

    function setLoading(loading) {
        state.isLoading = loading;
        elements.saveBtn.disabled = loading;

        if (loading) {
            elements.saveBtn.classList.add('loading');
            elements.saveBtn.textContent = '💾 Sauvegarde...';
        } else {
            elements.saveBtn.classList.remove('loading');
            elements.saveBtn.textContent = '💾 Sauvegarder la configuration';
        }
    }

    function showStatus(message, type) {
        elements.status.textContent = message;
        elements.status.className = `status ${type}`;
        elements.status.style.display = 'block';

        // Auto-masquer après 5 secondes pour les messages de succès
        if (type === 'success') {
            setTimeout(() => {
                elements.status.style.display = 'none';
            }, 5000);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Mise à jour du statut de configuration lors des changements
    elements.claudeApiKey.addEventListener('input', debounce(updateConfigStatus, 500));
    elements.githubToken.addEventListener('input', debounce(updateConfigStatus, 500));

    // Gestion des erreurs globales
    window.addEventListener('error', (e) => {
        console.error('Erreur popup:', e.error);
        showStatus('Une erreur inattendue s\'est produite', 'error');
    });

    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promesse rejetée popup:', e.reason);
        showStatus('Une erreur inattendue s\'est produite', 'error');
    });
});