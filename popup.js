document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    const claudeApiKeyInput = document.getElementById('claudeApiKey');
    const githubTokenInput = document.getElementById('githubToken');
    const statusDiv = document.getElementById('status');

    // Charger les paramètres sauvegardés
    try {
        const result = await chrome.storage.secure.get(['claudeApiKey', 'githubToken']);
        if (result.claudeApiKey) {
            claudeApiKeyInput.value = result.claudeApiKey;
        }
        if (result.githubToken) {
            githubTokenInput.value = result.githubToken;
        }
    } catch (error) {
        // Fallback vers storage.local si secure n'est pas disponible
        const result = await chrome.storage.local.get(['claudeApiKey', 'githubToken']);
        if (result.claudeApiKey) {
            claudeApiKeyInput.value = result.claudeApiKey;
        }
        if (result.githubToken) {
            githubTokenInput.value = result.githubToken;
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const claudeApiKey = claudeApiKeyInput.value.trim();
        const githubToken = githubTokenInput.value.trim();

        if (!claudeApiKey) {
            showStatus('Veuillez entrer votre clé API Claude', 'error');
            return;
        }

        if (!claudeApiKey.startsWith('sk-ant-')) {
            showStatus('Format de clé API Claude invalide', 'error');
            return;
        }

        try {
            // Sauvegarder les paramètres
            await chrome.storage.local.set({
                claudeApiKey: claudeApiKey,
                githubToken: githubToken
            });

            showStatus('Paramètres sauvegardés avec succès!', 'success');

            // Fermer la popup après 1 seconde
            setTimeout(() => {
                window.close();
            }, 1000);
        } catch (error) {
            showStatus('Erreur lors de la sauvegarde: ' + error.message, 'error');
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
    }
});