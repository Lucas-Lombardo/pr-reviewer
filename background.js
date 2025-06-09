// Service worker pour l'extension Claude PR Reviewer
chrome.runtime.onInstalled.addListener((reason) => {
    if (reason === 'install') {
        console.log('Claude PR Reviewer extension installed');

        // Ouvrir la page de configuration au premier lancement
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    }
});

// Gérer les messages du content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
        sendResponse({success: true});
    } else if (request.action === 'fetchGitHub') {
        fetchGitHubData(request, sendResponse);
        return true; // Keep the message channel open for async response
    } else if (request.action === 'callClaude') {
        callClaudeAPI(request, sendResponse);
        return true; // Keep the message channel open for async response
    }

    return true;
});

// Fonction pour récupérer les données GitHub
async function fetchGitHubData(request, sendResponse) {
    try {
        const { owner, repo, prNumber, githubToken } = request;
        const baseUrl = 'https://api.github.com';

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Claude-PR-Reviewer'
        };

        if (githubToken) {
            headers['Authorization'] = `token ${githubToken}`;
        }

        // Récupérer les infos de base de la PR
        const prResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
            headers
        });

        if (!prResponse.ok) {
            throw new Error(`Erreur GitHub API: ${prResponse.status} ${prResponse.statusText}`);
        }

        const pr = await prResponse.json();

        // Récupérer les fichiers modifiés
        const filesResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/files`, {
            headers
        });

        if (!filesResponse.ok) {
            throw new Error(`Erreur lors de la récupération des fichiers: ${filesResponse.status}`);
        }

        const files = await filesResponse.json();

        // Récupérer le contenu des fichiers modifiés
        const fileContents = [];
        for (const file of files.slice(0, 10)) { // Limiter à 10 fichiers max
            if (file.status !== 'removed' && file.patch) {
                fileContents.push({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch,
                    language: detectLanguage(file.filename)
                });
            }
        }

        const result = {
            title: pr.title,
            description: pr.body || '',
            files: fileContents,
            totalFiles: files.length,
            url: pr.html_url
        };

        sendResponse({ result: result });
    } catch (error) {
        console.error('Erreur GitHub API:', error);
        sendResponse({ error: error.message });
    }
}

// Fonction pour appeler l'API Claude
async function callClaudeAPI(request, sendResponse) {
    try {
        const { prompt, apiKey } = request;

        console.log('🤖 Appel à l\'API Claude...');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307', // Utiliser Haiku pour plus de rapidité et moins de coût
                max_tokens: 3000,
                temperature: 0.1,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Claude API error:', errorText);

            let errorMessage;
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || `Erreur ${response.status}`;
            } catch {
                errorMessage = `Erreur HTTP ${response.status}: ${response.statusText}`;
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('✅ Réponse Claude reçue');
        sendResponse({ result: data.content[0].text });
    } catch (error) {
        console.error('Erreur Claude API:', error);

        // Messages d'erreur plus explicites
        let userFriendlyError = error.message;

        if (error.message.includes('CORS')) {
            userFriendlyError = 'Erreur de sécurité CORS. Veuillez recharger l\'extension et réessayer.';
        } else if (error.message.includes('401')) {
            userFriendlyError = 'Clé API Claude invalide. Vérifiez votre clé dans les paramètres de l\'extension.';
        } else if (error.message.includes('429')) {
            userFriendlyError = 'Trop de requêtes. Attendez quelques minutes avant de réessayer.';
        } else if (error.message.includes('insufficient_quota')) {
            userFriendlyError = 'Quota API épuisé. Vérifiez votre compte Anthropic.';
        }

        sendResponse({ error: userFriendlyError });
    }
}

// Fonction utilitaire pour détecter le langage
function detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'kt': 'kotlin',
        'swift': 'swift',
        'scala': 'scala',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'less': 'less',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown'
    };
    return langMap[ext] || 'text';
}

// Gérer les erreurs de l'extension
chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
            console.error('Extension error:', chrome.runtime.lastError);
        }
    });
});

// Nettoyer le storage si nécessaire
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let key in changes) {
        const storageChange = changes[key];
        console.log(`Storage key "${key}" in namespace "${namespace}" changed. Old value: ${storageChange.oldValue}, New value: ${storageChange.newValue}`);
    }
});