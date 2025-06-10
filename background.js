// Background script simple pour Claude PR Reviewer avec support Jira
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Claude PR Reviewer extension installée/mise à jour');

    if (details.reason === 'install') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    }
});

// Gérer les messages du content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Validation de sécurité
    if (!sender.tab || !sender.tab.url.includes('github.com')) {
        sendResponse({ success: false, error: 'Accès non autorisé' });
        return;
    }

    try {
        switch (request.action) {
            case 'getJiraConfig':
                handleGetJiraConfig(sendResponse);
                return true; // Async response
            case 'callJiraAPI':
                handleCallJiraAPI(request, sendResponse);
                return true; // Async response
            default:
                sendResponse({ success: false, error: 'Action non reconnue' });
        }
    } catch (error) {
        console.error('Erreur dans le message handler:', error);
        sendResponse({ success: false, error: error.message });
    }
});

async function handleGetJiraConfig(sendResponse) {
    try {
        const config = await chrome.storage.local.get(['jiraUrl', 'jiraEmail', 'jiraApiToken']);

        const hasJiraConfig = !!(config.jiraUrl && config.jiraEmail && config.jiraApiToken);

        sendResponse({
            success: true,
            config: {
                hasJiraConfig,
                jiraUrl: config.jiraUrl
            }
        });
    } catch (error) {
        sendResponse({ success: false, error: 'Erreur lors de la récupération de la config Jira' });
    }
}

async function handleCallJiraAPI(request, sendResponse) {
    try {
        const { ticketKey } = request;

        if (!ticketKey) {
            sendResponse({ success: false, error: 'Ticket key manquant' });
            return;
        }

        // Récupérer la configuration Jira
        const config = await chrome.storage.local.get(['jiraUrl', 'jiraEmail', 'jiraApiToken']);

        if (!config.jiraUrl || !config.jiraEmail || !config.jiraApiToken) {
            sendResponse({ success: false, error: 'Configuration Jira incomplète' });
            return;
        }

        console.log('🎫 Appel API Jira pour:', ticketKey);

        // Construire l'URL
        const url = `${config.jiraUrl}/rest/api/3/issue/${ticketKey}?fields=summary,description,status,priority,assignee,created,updated`;

        // Créer les credentials pour l'authentification Basic
        const credentials = btoa(`${config.jiraEmail}:${config.jiraApiToken}`);

        // Faire l'appel API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 Jira API Response Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Jira API Error:', response.status, errorText);

            let errorMessage = `Erreur ${response.status}`;
            if (response.status === 401) {
                errorMessage = 'Authentification Jira échouée - vérifiez votre email et token';
            } else if (response.status === 403) {
                errorMessage = 'Accès interdit au ticket - vérifiez vos permissions';
            } else if (response.status === 404) {
                errorMessage = 'Ticket non trouvé';
            }

            sendResponse({ success: false, error: errorMessage });
            return;
        }

        const data = await response.json();
        console.log('✅ Données Jira récupérées pour:', data.key);

        sendResponse({ success: true, data: data });

    } catch (error) {
        console.error('❌ Erreur appel Jira API:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Gestion des erreurs globales
self.addEventListener('error', (event) => {
    console.error('Erreur service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Promesse rejetée non gérée:', event.reason);
});