// Service worker pour l'extension Claude PR Reviewer
const CONFIG = {
    CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
    GITHUB_API_URL: 'https://api.github.com',
    MAX_FILES_PER_PR: 20,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    SUPPORTED_MODELS: [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229'
    ]
};

class APIError extends Error {
    constructor(message, status, type = 'unknown') {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.type = type;
    }
}

class RateLimitManager {
    constructor() {
        this.requests = new Map();
    }

    canMakeRequest(key, limit = 10, windowMs = 60000) {
        const now = Date.now();
        const requests = this.requests.get(key) || [];

        // Nettoyer les anciennes requêtes
        const recentRequests = requests.filter(time => now - time < windowMs);

        if (recentRequests.length >= limit) {
            return false;
        }

        recentRequests.push(now);
        this.requests.set(key, recentRequests);
        return true;
    }
}

const rateLimiter = new RateLimitManager();

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Claude PR Reviewer extension installed/updated');

    if (details.reason === 'install') {
        // Ouvrir la page de configuration au premier lancement
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });

        // Afficher une notification de bienvenue
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Claude PR Reviewer installé!',
            message: 'Configurez vos clés API pour commencer à reviewer vos PRs.'
        });
    }

    // Nettoyer le cache au démarrage
    chrome.storage.local.remove(['cache_github', 'cache_claude']);
});

// Gérer les messages du content script avec validation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Validation de sécurité basique
    if (!sender.tab || !sender.tab.url.includes('github.com')) {
        sendResponse({ error: 'Accès non autorisé' });
        return;
    }

    try {
        switch (request.action) {
            case 'openOptions':
                handleOpenOptions(sendResponse);
                break;
            case 'fetchGitHub':
                handleFetchGitHub(request, sendResponse);
                return true; // Async response
            case 'callClaude':
                handleCallClaude(request, sendResponse);
                return true; // Async response
            case 'getConfig':
                handleGetConfig(sendResponse);
                return true; // Async response
            default:
                sendResponse({ error: 'Action non reconnue' });
        }
    } catch (error) {
        console.error('Erreur dans le message handler:', error);
        sendResponse({ error: error.message });
    }
});

async function handleOpenOptions(sendResponse) {
    try {
        await chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ error: 'Impossible d\'ouvrir les options' });
    }
}

async function handleGetConfig(sendResponse) {
    try {
        const config = await chrome.storage.local.get(['claudeApiKey', 'githubToken', 'selectedModel']);
        sendResponse({
            success: true,
            config: {
                hasClaudeKey: !!config.claudeApiKey,
                hasGithubToken: !!config.githubToken,
                selectedModel: config.selectedModel || CONFIG.SUPPORTED_MODELS[0]
            }
        });
    } catch (error) {
        sendResponse({ error: 'Erreur lors de la récupération de la configuration' });
    }
}

async function handleFetchGitHub(request, sendResponse) {
    try {
        await validateGitHubRequest(request);

        // Rate limiting
        if (!rateLimiter.canMakeRequest('github', 30, 60000)) {
            throw new APIError('Trop de requêtes GitHub. Attendez une minute.', 429, 'rate_limit');
        }

        const result = await fetchGitHubDataWithCache(request);
        sendResponse({ success: true, result });
    } catch (error) {
        console.error('Erreur GitHub API:', error);
        sendResponse({
            error: error.message,
            type: error.type || 'unknown',
            status: error.status
        });
    }
}

async function handleCallClaude(request, sendResponse) {
    try {
        await validateClaudeRequest(request);

        // Rate limiting pour Claude
        if (!rateLimiter.canMakeRequest('claude', 10, 60000)) {
            throw new APIError('Trop de requêtes Claude. Attendez une minute.', 429, 'rate_limit');
        }

        const result = await callClaudeAPIWithRetry(request);
        sendResponse({ success: true, result });
    } catch (error) {
        console.error('Erreur Claude API:', error);
        sendResponse({
            error: getUserFriendlyError(error),
            type: error.type || 'unknown',
            status: error.status
        });
    }
}

async function validateGitHubRequest(request) {
    const { owner, repo, prNumber } = request;

    if (!owner || !repo || !prNumber) {
        throw new APIError('Paramètres GitHub manquants', 400, 'validation');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
        throw new APIError('Format owner/repo invalide', 400, 'validation');
    }

    if (!/^\d+$/.test(prNumber.toString())) {
        throw new APIError('Numéro de PR invalide', 400, 'validation');
    }
}

async function validateClaudeRequest(request) {
    const { prompt, apiKey, model } = request;

    if (!prompt || !apiKey) {
        throw new APIError('Paramètres Claude manquants', 400, 'validation');
    }

    if (!apiKey.startsWith('sk-ant-')) {
        throw new APIError('Format de clé API Claude invalide', 400, 'validation');
    }

    if (model && !CONFIG.SUPPORTED_MODELS.includes(model)) {
        throw new APIError('Modèle Claude non supporté', 400, 'validation');
    }

    if (prompt.length > 100000) {
        throw new APIError('Prompt trop long (max 100k caractères)', 400, 'validation');
    }
}

async function fetchGitHubDataWithCache(request) {
    const { owner, repo, prNumber, githubToken } = request;
    const cacheKey = `${owner}/${repo}/pull/${prNumber}`;

    // Vérifier le cache (valide 5 minutes)
    const cached = await getCachedData('github', cacheKey, 5 * 60 * 1000);
    if (cached) {
        console.log('📦 Données GitHub trouvées en cache');
        return cached;
    }

    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Claude-PR-Reviewer/1.1.0'
    };

    if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`;
    }

    // Récupérer les infos de base de la PR
    const prResponse = await fetchWithRetry(`${CONFIG.GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers
    });

    if (!prResponse.ok) {
        throw new APIError(
            await getGitHubErrorMessage(prResponse),
            prResponse.status,
            'github_api'
        );
    }

    const pr = await prResponse.json();

    // Récupérer les fichiers modifiés
    const filesResponse = await fetchWithRetry(`${CONFIG.GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}/files`, {
        headers
    });

    if (!filesResponse.ok) {
        throw new APIError(
            `Erreur lors de la récupération des fichiers: ${filesResponse.status}`,
            filesResponse.status,
            'github_api'
        );
    }

    const files = await filesResponse.json();

    // Filtrer et limiter les fichiers
    const relevantFiles = files
        .filter(file => file.status !== 'removed' && file.patch && isRelevantFile(file.filename))
        .slice(0, CONFIG.MAX_FILES_PER_PR);

    const processedFiles = relevantFiles.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        language: detectLanguage(file.filename),
        size: file.patch.length
    }));

    const result = {
        title: pr.title,
        description: pr.body || '',
        files: processedFiles,
        totalFiles: files.length,
        relevantFiles: relevantFiles.length,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at
    };

    // Mettre en cache
    await setCachedData('github', cacheKey, result);

    return result;
}

async function callClaudeAPIWithRetry(request) {
    const { prompt, apiKey, model = CONFIG.SUPPORTED_MODELS[0] } = request;

    console.log('🤖 Appel à l\'API Claude...');

    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(CONFIG.CLAUDE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: determineMaxTokens(model),
                    temperature: 0.1,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(
                    errorData.error?.message || `Erreur HTTP ${response.status}`,
                    response.status,
                    getClaudeErrorType(response.status, errorData)
                );
            }

            const data = await response.json();
            console.log('✅ Réponse Claude reçue');
            return data.content[0].text;

        } catch (error) {
            if (attempt === CONFIG.MAX_RETRIES || error.status === 401 || error.status === 403) {
                throw error;
            }

            console.log(`Tentative ${attempt} échouée, retry dans ${CONFIG.RETRY_DELAY}ms`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
    }
}

// Fonctions utilitaires
async function fetchWithRetry(url, options, retries = CONFIG.MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetch(url, options);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
        }
    }
}

async function getCachedData(namespace, key, maxAge) {
    try {
        const cacheData = await chrome.storage.local.get([`cache_${namespace}`]);
        const cache = cacheData[`cache_${namespace}`] || {};
        const entry = cache[key];

        if (entry && Date.now() - entry.timestamp < maxAge) {
            return entry.data;
        }
    } catch (error) {
        console.warn('Erreur cache lecture:', error);
    }
    return null;
}

async function setCachedData(namespace, key, data) {
    try {
        const cacheKey = `cache_${namespace}`;
        const cacheData = await chrome.storage.local.get([cacheKey]);
        const cache = cacheData[cacheKey] || {};

        cache[key] = {
            data,
            timestamp: Date.now()
        };

        // Limiter la taille du cache
        const entries = Object.entries(cache);
        if (entries.length > 50) {
            const sortedEntries = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
            const limitedCache = Object.fromEntries(sortedEntries.slice(0, 30));
            await chrome.storage.local.set({ [cacheKey]: limitedCache });
        } else {
            await chrome.storage.local.set({ [cacheKey]: cache });
        }
    } catch (error) {
        console.warn('Erreur cache écriture:', error);
    }
}

function isRelevantFile(filename) {
    const ignoredPatterns = [
        /\.lock$/,
        /package-lock\.json$/,
        /yarn\.lock$/,
        /\.min\.(js|css)$/,
        /\.map$/,
        /node_modules\//,
        /vendor\//,
        /\.git/,
        /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i
    ];

    return !ignoredPatterns.some(pattern => pattern.test(filename));
}

function detectLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap = {
        'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
        'ts': 'typescript', 'tsx': 'typescript',
        'py': 'python', 'pyw': 'python',
        'java': 'java', 'kt': 'kotlin', 'scala': 'scala',
        'cpp': 'cpp', 'cxx': 'cpp', 'cc': 'cpp',
        'c': 'c', 'h': 'c',
        'cs': 'csharp', 'fs': 'fsharp', 'vb': 'vb',
        'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust',
        'swift': 'swift', 'dart': 'dart', 'r': 'r',
        'html': 'html', 'htm': 'html', 'xhtml': 'html',
        'css': 'css', 'scss': 'scss', 'sass': 'sass', 'less': 'less',
        'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
        'md': 'markdown', 'rst': 'rst', 'txt': 'text',
        'sh': 'bash', 'bash': 'bash', 'zsh': 'bash',
        'sql': 'sql', 'dockerfile': 'dockerfile'
    };
    return langMap[ext] || 'text';
}

function determineMaxTokens(model) {
    const tokenLimits = {
        'claude-3-haiku-20240307': 4000,
        'claude-3-sonnet-20240229': 4000,
        'claude-3-opus-20240229': 4000
    };
    return tokenLimits[model] || 4000;
}

function getClaudeErrorType(status, errorData) {
    if (status === 401) return 'auth';
    if (status === 403) return 'forbidden';
    if (status === 429) return 'rate_limit';
    if (status === 400 && errorData.error?.type === 'invalid_request_error') return 'invalid_request';
    if (errorData.error?.type === 'insufficient_quota') return 'quota_exceeded';
    return 'api_error';
}

async function getGitHubErrorMessage(response) {
    try {
        const errorData = await response.json();
        return errorData.message || `Erreur GitHub ${response.status}`;
    } catch {
        return `Erreur GitHub ${response.status}: ${response.statusText}`;
    }
}

function getUserFriendlyError(error) {
    const errorMap = {
        'auth': 'Clé API Claude invalide. Vérifiez votre clé dans les paramètres.',
        'forbidden': 'Accès interdit. Vérifiez vos permissions API.',
        'rate_limit': 'Trop de requêtes. Attendez quelques minutes avant de réessayer.',
        'quota_exceeded': 'Quota API épuisé. Vérifiez votre compte Anthropic.',
        'invalid_request': 'Requête invalide. Le contenu est peut-être trop long.',
        'validation': error.message,
        'github_api': error.message
    };

    return errorMap[error.type] || error.message || 'Une erreur inattendue s\'est produite.';
}

// Nettoyage périodique du cache
chrome.alarms.create('cleanCache', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanCache') {
        chrome.storage.local.remove(['cache_github', 'cache_claude']);
    }
});

// Gestion des erreurs globales
self.addEventListener('error', (event) => {
    console.error('Erreur service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Promesse rejetée non gérée:', event.reason);
});