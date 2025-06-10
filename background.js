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

// Fonction pour récupérer les données GitHub avec analyse contextuelle
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

        console.log('🔍 Récupération des données contextuelles...');

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

        // Récupérer l'historique des commits de la PR
        console.log('📝 Récupération de l\'historique des commits...');
        const commitsResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/commits`, {
            headers
        });

        let commits = [];
        if (commitsResponse.ok) {
            commits = await commitsResponse.json();
        }

        // Analyser les issues Jira liées
        console.log('🎫 Analyse des références Jira...');
        const jiraInfo = await extractJiraInfo(pr.title, pr.body, commits, request.jiraConfig);

        // Détecter les breaking changes
        console.log('⚠️ Détection des breaking changes...');
        const breakingChanges = detectBreakingChanges(files, commits, pr);

        // Analyser les patterns de modification
        console.log('📊 Analyse des patterns...');
        const codeAnalysis = analyzeCodePatterns(files);

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
                    language: detectLanguage(file.filename),
                    changes: file.changes || 0
                });
            }
        }

        const result = {
            title: pr.title,
            description: pr.body || '',
            files: fileContents,
            totalFiles: files.length,
            url: pr.html_url,
            // Nouvelles données contextuelles
            contextualData: {
                commits: commits.map(commit => ({
                    message: commit.commit.message,
                    author: commit.commit.author.name,
                    date: commit.commit.author.date,
                    sha: commit.sha.substring(0, 7)
                })),
                jiraInfo,
                breakingChanges,
                codeAnalysis,
                prMetadata: {
                    baseBranch: pr.base.ref,
                    headBranch: pr.head.ref,
                    isDraft: pr.draft,
                    additions: pr.additions,
                    deletions: pr.deletions,
                    changedFiles: pr.changed_files
                }
            }
        };

        console.log('✅ Données contextuelles récupérées');
        sendResponse({ result: result });
    } catch (error) {
        console.error('Erreur GitHub API:', error);
        sendResponse({ error: error.message });
    }
}

// Extraction des informations Jira optimisée
async function extractJiraInfo(title, description, commits, jiraConfig) {
    const jiraPattern = /[A-Z]+-\d+/g;
    const jiraTickets = new Set();

    // Recherche dans le titre
    const titleMatches = title.match(jiraPattern) || [];
    titleMatches.forEach(ticket => jiraTickets.add(ticket));

    // Recherche dans la description
    if (description) {
        const descMatches = description.match(jiraPattern) || [];
        descMatches.forEach(ticket => jiraTickets.add(ticket));
    }

    // Recherche dans les messages de commit
    commits.forEach(commit => {
        const commitMatches = commit.commit.message.match(jiraPattern) || [];
        commitMatches.forEach(ticket => jiraTickets.add(ticket));
    });

    // Détection des liens Jira dans la description
    const jiraUrlPattern = /https?:\/\/([^\/\s]+)\/browse\/([A-Z]+-\d+)/g;
    const jiraLinks = [];
    let jiraBaseUrl = null;

    if (description) {
        let match;
        while ((match = jiraUrlPattern.exec(description)) !== null) {
            jiraLinks.push({
                ticket: match[2],
                url: match[0]
            });
            if (!jiraBaseUrl) {
                jiraBaseUrl = `https://${match[1]}`;
            }
            jiraTickets.add(match[2]);
        }
    }

    // Récupérer les détails des tickets Jira SEULEMENT si la config est fournie
    const ticketDetails = [];
    if (jiraTickets.size > 0 && jiraConfig && jiraConfig.enabled) {
        console.log('🔍 Récupération rapide des détails Jira...');

        // Traitement en parallèle pour accélérer
        const ticketPromises = Array.from(jiraTickets)
            .slice(0, 3) // Limiter à 3 tickets max pour la performance
            .map(ticket => fetchJiraTicketInfoFast(ticket, jiraConfig));

        const results = await Promise.allSettled(ticketPromises);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                ticketDetails.push(result.value);
            } else {
                const ticket = Array.from(jiraTickets)[index];
                ticketDetails.push({
                    key: ticket,
                    summary: 'Détails non disponibles',
                    description: '',
                    status: 'API indisponible',
                    error: true
                });
            }
        });
    }

    return {
        tickets: Array.from(jiraTickets),
        links: jiraLinks,
        ticketDetails: ticketDetails,
        jiraBaseUrl: jiraBaseUrl || (jiraConfig ? jiraConfig.baseUrl : null),
        hasJiraReference: jiraTickets.size > 0 || jiraLinks.length > 0,
        configurationNeeded: jiraTickets.size > 0 && (!jiraConfig || !jiraConfig.enabled)
    };
}

// Fonction optimisée pour récupérer les informations Jira rapidement
async function fetchJiraTicketInfoFast(ticketKey, jiraConfig) {
    if (!jiraConfig || !jiraConfig.baseUrl || !jiraConfig.enabled) {
        throw new Error('Configuration Jira manquante');
    }

    const apiUrl = `${jiraConfig.baseUrl}/rest/api/2/issue/${ticketKey}?fields=summary,description,status,assignee,priority`;

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };

    // Ajouter l'authentification si fournie
    if (jiraConfig.email && jiraConfig.apiToken) {
        const auth = btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`);
        headers['Authorization'] = `Basic ${auth}`;
    } else if (jiraConfig.token) {
        headers['Authorization'] = `Bearer ${jiraConfig.token}`;
    }

    try {
        const response = await fetch(apiUrl, {
            headers,
            signal: AbortSignal.timeout(3000) // Timeout de 3 secondes max
        });

        if (response.ok) {
            const data = await response.json();
            return {
                key: data.key,
                summary: data.fields.summary || 'Titre non disponible',
                description: data.fields.description ?
                    (typeof data.fields.description === 'string' ?
                        data.fields.description :
                        data.fields.description.content?.[0]?.content?.[0]?.text || '') : '',
                status: data.fields.status?.name || 'Statut inconnu',
                assignee: data.fields.assignee?.displayName || null,
                priority: data.fields.priority?.name || null,
                url: `${jiraConfig.baseUrl}/browse/${ticketKey}`,
                error: false
            };
        } else if (response.status === 401 || response.status === 403) {
            return {
                key: ticketKey,
                summary: 'Accès restreint',
                description: 'Vérifiez vos identifiants Jira',
                status: 'Authentification requise',
                url: `${jiraConfig.baseUrl}/browse/${ticketKey}`,
                error: true,
                errorType: 'auth_required'
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new Error('Timeout - API Jira trop lente');
        }
        throw new Error(`Erreur réseau: ${error.message}`);
    }
}

// Supprimer les anciennes fonctions Jira lentes
// attemptJiraFetch function removed

// Détection des breaking changes
function detectBreakingChanges(files, commits, pr) {
    const breakingIndicators = [];

    // Analyse des messages de commit
    commits.forEach(commit => {
        const message = commit.commit.message.toLowerCase();
        if (message.includes('breaking') ||
            message.includes('breaking change') ||
            message.includes('break:') ||
            message.includes('!:')) {
            breakingIndicators.push({
                type: 'commit_message',
                source: `Commit ${commit.sha.substring(0, 7)}`,
                detail: commit.commit.message
            });
        }
    });

    // Analyse des fichiers modifiés
    files.forEach(file => {
        // Détection de suppressions importantes
        if (file.deletions > file.additions * 2 && file.deletions > 10) {
            breakingIndicators.push({
                type: 'major_deletions',
                source: file.filename,
                detail: `${file.deletions} lignes supprimées vs ${file.additions} ajoutées`
            });
        }

        // Fichiers de configuration critiques
        const criticalFiles = [
            'package.json', 'composer.json', 'requirements.txt',
            'Dockerfile', 'docker-compose.yml', '.env.example',
            'schema.sql', 'migration', 'upgrade'
        ];

        if (criticalFiles.some(pattern => file.filename.toLowerCase().includes(pattern))) {
            breakingIndicators.push({
                type: 'critical_file',
                source: file.filename,
                detail: 'Modification d\'un fichier critique'
            });
        }

        // Analyse du patch pour des changements d'API
        if (file.patch) {
            const patch = file.patch.toLowerCase();
            const apiPatterns = [
                'function.*public.*\\(',
                'class.*public',
                'interface.*\\{',
                'export.*function',
                'export.*class',
                'public.*function',
                'route.*[\'"`]'
            ];

            apiPatterns.forEach(pattern => {
                try {
                    const regex = new RegExp(pattern, 'g');
                    if (regex.test(patch)) {
                        breakingIndicators.push({
                            type: 'api_change',
                            source: file.filename,
                            detail: 'Modification potentielle d\'API publique'
                        });
                    }
                } catch (regexError) {
                    console.warn('Erreur regex:', pattern, regexError);
                }
            });
        }
    });

    // Analyse du titre/description pour des mots-clés
    const text = `${pr.title} ${pr.body || ''}`.toLowerCase();
    const breakingKeywords = [
        'breaking change', 'breaking', 'incompatible',
        'migration required', 'deprecated', 'removed'
    ];

    breakingKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
            breakingIndicators.push({
                type: 'keyword',
                source: 'PR description',
                detail: `Mot-clé détecté: "${keyword}"`
            });
        }
    });

    return {
        hasBreakingChanges: breakingIndicators.length > 0,
        indicators: breakingIndicators,
        riskLevel: breakingIndicators.length === 0 ? 'low' :
            breakingIndicators.length <= 2 ? 'medium' : 'high'
    };
}

// Analyse des patterns de code
function analyzeCodePatterns(files) {
    const analysis = {
        languages: {},
        fileTypes: {},
        totalChanges: 0,
        largestFile: null,
        testFiles: [],
        configFiles: [],
        hasNewFiles: false,
        hasRemovedFiles: false
    };

    let maxChanges = 0;

    files.forEach(file => {
        const ext = file.filename.split('.').pop().toLowerCase();
        const language = detectLanguage(file.filename);

        // Comptage par langage
        if (!analysis.languages[language]) {
            analysis.languages[language] = { files: 0, changes: 0 };
        }
        analysis.languages[language].files++;
        analysis.languages[language].changes += (file.additions + file.deletions);

        // Comptage par type de fichier
        if (!analysis.fileTypes[ext]) {
            analysis.fileTypes[ext] = 0;
        }
        analysis.fileTypes[ext]++;

        // Tracking du total
        analysis.totalChanges += (file.additions + file.deletions);

        // Fichier le plus modifié
        const fileChanges = file.additions + file.deletions;
        if (fileChanges > maxChanges) {
            maxChanges = fileChanges;
            analysis.largestFile = {
                name: file.filename,
                changes: fileChanges,
                additions: file.additions,
                deletions: file.deletions
            };
        }

        // Classification des fichiers
        if (file.filename.toLowerCase().includes('test') ||
            file.filename.toLowerCase().includes('spec')) {
            analysis.testFiles.push(file.filename);
        }

        const configExtensions = ['json', 'yml', 'yaml', 'xml', 'ini', 'conf'];
        if (configExtensions.includes(ext) ||
            file.filename.includes('config') ||
            file.filename.startsWith('.')) {
            analysis.configFiles.push(file.filename);
        }

        // Status tracking
        if (file.status === 'added') analysis.hasNewFiles = true;
        if (file.status === 'removed') analysis.hasRemovedFiles = true;
    });

    return analysis;
}

// Fonction pour appeler l'API Claude (inchangée)
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
                model: 'claude-3-haiku-20240307',
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