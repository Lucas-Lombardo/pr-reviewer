// Content script avec appels API directs pour debug
(function() {
    'use strict';

    console.log('🚀 Claude PR Reviewer - Debug direct API');

    let reviewButton = null;
    let isReviewing = false;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }

    function init() {
        const isPRPage = /\/pull\/\d+/.test(window.location.pathname);
        if (!isPRPage) return;

        injectStyles();
        createReviewButton();
        setupObserver();
    }

    function injectStyles() {
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
    }

    function createReviewButton() {
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
            setTimeout(createReviewButton, 2000);
            return;
        }

        reviewButton = document.createElement('button');
        reviewButton.id = 'claude-review-btn';
        reviewButton.innerHTML = '🤖 Review with Claude';
        reviewButton.addEventListener('click', handleReviewClick);

        buttonContainer.appendChild(reviewButton);
        console.log('✅ Bouton créé');
    }

    function setupObserver() {
        const observer = new MutationObserver(() => {
            const isPRPage = /\/pull\/\d+/.test(window.location.pathname);
            if (isPRPage && !document.querySelector('#claude-review-btn')) {
                setTimeout(createReviewButton, 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function handleReviewClick() {
        if (isReviewing) return;

        console.log('🤖 Début de la review...');
        isReviewing = true;
        reviewButton.disabled = true;

        try {
            // Étape 1: Configuration
            updateProgress('🔑 Vérification de la configuration...');
            const config = await chrome.storage.local.get(['claudeApiKey', 'githubToken']);
            if (!config.claudeApiKey) {
                throw new Error('Clé API Claude non configurée. Cliquez sur l\'icône de l\'extension pour la configurer.');
            }
            console.log('✅ Configuration OK');

            // Étape 2: Extraction PR info
            updateProgress('📍 Extraction des informations de la PR...');
            const prInfo = extractPRInfo();
            console.log('✅ PR Info:', prInfo);

            // Étape 3: Récupération GitHub
            updateProgress('📥 Récupération des données GitHub...');
            const prData = await fetchGitHubData(prInfo, config.githubToken);
            console.log('✅ GitHub Data:', prData);

            // Étape 4: Appel Claude
            updateProgress('🤖 Analyse par Claude AI...');
            const review = await callClaudeAPI(prData, config.claudeApiKey);
            console.log('✅ Claude Review:', review);

            // Étape 5: Affichage
            updateProgress('✨ Finalisation...');
            displayReview(review, prData);

            updateProgress('🎉 Terminé!');

        } catch (error) {
            console.error('❌ Erreur:', error);
            showError(`Erreur: ${error.message}`);
        } finally {
            isReviewing = false;
            reviewButton.disabled = false;
            reviewButton.innerHTML = '🤖 Review with Claude';
        }
    }

    function updateProgress(message) {
        reviewButton.innerHTML = message;
        console.log(message);
    }

    function extractPRInfo() {
        const pathParts = window.location.pathname.split('/');
        const owner = pathParts[1];
        const repo = pathParts[2];
        const prNumber = pathParts[4];

        if (!owner || !repo || !prNumber) {
            throw new Error('Impossible d\'extraire les informations de la PR');
        }

        return { owner, repo, prNumber };
    }

    async function fetchGitHubData(prInfo, githubToken) {
        const { owner, repo, prNumber } = prInfo;
        const baseUrl = 'https://api.github.com';

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Claude-PR-Reviewer/1.1.0'
        };

        if (githubToken) {
            headers['Authorization'] = `token ${githubToken}`;
        }

        try {
            console.log(`🔍 Fetching PR: ${owner}/${repo}#${prNumber}`);

            // Récupérer les infos de base de la PR
            const prResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
                headers,
                method: 'GET'
            });

            if (!prResponse.ok) {
                const errorText = await prResponse.text();
                console.error('❌ GitHub PR Error:', prResponse.status, errorText);
                throw new Error(`Erreur GitHub API (PR): ${prResponse.status} - ${errorText}`);
            }

            const pr = await prResponse.json();
            console.log('✅ PR Data fetched');

            // Récupérer les fichiers modifiés
            const filesResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/files`, {
                headers,
                method: 'GET'
            });

            if (!filesResponse.ok) {
                const errorText = await filesResponse.text();
                console.error('❌ GitHub Files Error:', filesResponse.status, errorText);
                throw new Error(`Erreur GitHub API (fichiers): ${filesResponse.status} - ${errorText}`);
            }

            const files = await filesResponse.json();
            console.log('✅ Files Data fetched:', files.length, 'files');

            // Filtrer et traiter les fichiers
            const relevantFiles = files
                .filter(file => file.status !== 'removed' && file.patch)
                .slice(0, 10) // Limiter à 10 fichiers pour le test
                .map(file => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch,
                    language: detectLanguage(file.filename)
                }));

            return {
                title: pr.title,
                description: pr.body || '',
                files: relevantFiles,
                totalFiles: files.length,
                url: pr.html_url,
                author: pr.user.login
            };

        } catch (error) {
            console.error('❌ GitHub Fetch Error:', error);
            throw error;
        }
    }

    async function callClaudeAPI(prData, apiKey) {
        const prompt = `Tu es un expert en review de code. Analyse cette pull request GitHub et signale UNIQUEMENT les problèmes concrets que tu identifies dans le code fourni.

**Pull Request: ${prData.title}**
${prData.description ? `**Description:** ${prData.description}` : '**Description:** Aucune description fournie'}

**Fichiers modifiés (${prData.files.length}/${prData.totalFiles}):**

${prData.files.map(file => `
### ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})
\`\`\`${file.language}
${file.patch}
\`\`\`
`).join('\n')}

**INSTRUCTIONS IMPORTANTES:**
- Analyse UNIQUEMENT le code fourni ci-dessus
- Ne signale QUE les problèmes que tu peux VOIR concrètement dans le code
- N'invente AUCUN problème, ne fais AUCUNE supposition
- Si tu ne vois pas de problème dans une catégorie, écris "Rien à signaler"
- Sois très précis sur les numéros de ligne et noms de fichiers

**Checklist à vérifier:**

**Pull Request:**
- Titre respecte le format : <gitmoji><espace>[INTL-1234]<espace>Titre en français
- Description contient un lien Jira si applicable
- Description contient des instructions de déploiement si nécessaire

**Ménage:**
- Debug oublié : console.log, dd, dump, var_dump, print_r
- Commentaires TODO, FIXME oubliés
- Paramètres de méthodes non utilisés (PHP, JS, Twig)
- Imports/require non utilisés

**Typage:**
- Types PHP manquants sur méthodes, paramètres, retours
- Annotations manquantes pour array PHP et Collection<T>
- Types TypeScript manquants ou 'any'
- Propriétés PHP sans readonly quand approprié
- Contrôleurs Catalyst sans suffixe "Element"
- Visibilité manquante (private/protected/public)
- Variables nullable non testées avant utilisation

**Cohérence:**
- Noms de variables incohérents
- Noms de classes/méthodes/fichiers non conformes
- Textes non traduits (strings hardcodées)
- Emplacements de fichiers inappropriés

**Qualité:**
- Indentation incorrecte
- Fautes d'orthographe dans commentaires/noms
- Valeurs magiques sans constantes
- Variables intermédiaires manquantes (calculs redondants)

**Tests:**
- Cas d'erreur non testés
- Fixtures manquantes ou incorrectes
- Tests unitaires manquants pour nouvelle logique
- Tests fonctionnels manquants

**Refactoring:**
- Code dupliqué identique
- Méthodes trop longues (>20 lignes)
- Classes avec trop de responsabilités

**FORMAT DE RÉPONSE OBLIGATOIRE:**

Pull Request:
[Problèmes du titre/description de la PR ou "Rien à signaler"]

Ménage:
[Problèmes de debug/TODO dans fichier:ligne ou "Rien à signaler"]

Typage:
[Problèmes de types dans fichier:ligne ou "Rien à signaler"]

Cohérence:
[Problèmes de nommage/traduction dans fichier:ligne ou "Rien à signaler"]

Qualité:
[Problèmes de qualité dans fichier:ligne ou "Rien à signaler"]

Tests:
[Problèmes de tests ou "Rien à signaler"]

Refacto:
[Améliorations possibles dans fichier:ligne ou "Rien à signaler"]

**RAPPEL:** Ne signale QUE ce que tu vois réellement dans le code fourni. Pas de suppositions, pas d'inventions.`;

        try {
            console.log('🔑 Calling Claude API...');

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
                    max_tokens: 2000,
                    temperature: 0.1,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            console.log('📡 Claude Response Status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Claude API Error:', response.status, errorText);

                if (response.status === 401) {
                    throw new Error('Clé API Claude invalide. Vérifiez votre configuration.');
                } else if (response.status === 429) {
                    throw new Error('Trop de requêtes. Attendez quelques minutes.');
                } else {
                    throw new Error(`Erreur Claude API: ${response.status} - ${errorText}`);
                }
            }

            const data = await response.json();
            console.log('✅ Claude Response received');

            return data.content[0].text;

        } catch (error) {
            console.error('❌ Claude API Error:', error);
            throw error;
        }
    }

    function detectLanguage(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap = {
            'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python', 'java': 'java', 'php': 'php', 'rb': 'ruby', 'go': 'go',
            'rs': 'rust', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp', 'swift': 'swift',
            'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json', 'yaml': 'yaml',
            'md': 'markdown', 'sh': 'bash', 'sql': 'sql'
        };
        return langMap[ext] || 'text';
    }

    function displayReview(review, prData) {
        // Supprimer l'ancien panneau s'il existe
        const existingPanel = document.querySelector('#claude-review-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'claude-review-panel';
        panel.className = 'claude-review-panel';

        // Trouver l'endroit idéal : après le header de la PR mais avant le contenu
        const insertionPoints = [
            '.gh-header-meta',           // Infos de la PR (branches, etc.)
            '.TimelineItem-body',        // Body principal de la PR
            '.js-issue-header',          // Header complet de l'issue/PR
            '.gh-header',                // Header général
            '.Box-header',               // Header de box GitHub
            '.discussion-timeline-actions' // Actions de discussion
        ];

        let insertionPoint = null;
        for (const selector of insertionPoints) {
            const element = document.querySelector(selector);
            if (element) {
                insertionPoint = element;
                console.log(`📍 Point d'insertion trouvé: ${selector}`);
                break;
            }
        }

        if (insertionPoint) {
            // Insérer APRÈS l'élément trouvé
            insertionPoint.parentNode.insertBefore(panel, insertionPoint.nextSibling);
        } else {
            // Fallback: chercher le container principal et insérer au début
            const mainContent = document.querySelector('.repository-content, main .container-xl, main');
            if (mainContent) {
                mainContent.insertBefore(panel, mainContent.firstChild);
            } else {
                document.body.appendChild(panel);
            }
        }

        // Parser le format structuré de la réponse
        const sections = parseReviewSections(review);
        const formattedContent = formatReviewSections(sections);

        panel.innerHTML = `
            <div class="claude-review-header">
                <h3>🤖 Claude Code Review - ${prData.author}</h3>
                <button class="claude-close-btn" onclick="this.closest('#claude-review-panel').remove()">×</button>
            </div>
            <div class="claude-review-content">
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #666;">
                    📊 Analysé: ${prData.files.length} fichiers • ${new Date().toLocaleTimeString('fr-FR')}
                </div>
                <div id="jira-info-container">
                    <div style="background: #f0f8ff; border: 1px solid #cce7ff; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; color: #666;">
                        🔄 Récupération des informations Jira...
                    </div>
                </div>
                ${formattedContent}
            </div>
        `;

        // Récupérer les infos Jira de manière asynchrone
        fetchJiraInfo(prData).then(jiraHtml => {
            const container = panel.querySelector('#jira-info-container');
            if (container && jiraHtml) {
                container.innerHTML = jiraHtml;
            } else if (container) {
                container.innerHTML = ''; // Pas d'infos Jira
            }
        }).catch(error => {
            console.warn('Erreur lors de la récupération Jira:', error);
            const container = panel.querySelector('#jira-info-container');
            if (container) {
                container.innerHTML = ''; // Masquer en cas d'erreur
            }
        });

        panel.style.display = 'block';

        // Scroll vers le panneau avec un petit délai
        setTimeout(() => {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function parseReviewSections(review) {
        const sections = {
            'Pull Request': [],
            'Ménage': [],
            'Typage': [],
            'Cohérence': [],
            'Qualité': [],
            'Tests': [],
            'Refacto': []
        };

        const lines = review.split('\n');
        let currentSection = null;

        for (const line of lines) {
            const trimmed = line.trim();

            // Détecter les en-têtes de section
            const sectionMatch = Object.keys(sections).find(section =>
                trimmed.toLowerCase().includes(section.toLowerCase() + ':') ||
                trimmed.toLowerCase().startsWith(section.toLowerCase())
            );

            if (sectionMatch) {
                currentSection = sectionMatch;
                continue;
            }

            // Ajouter le contenu à la section courante
            if (currentSection && trimmed && !trimmed.toLowerCase().includes('rien à signaler')) {
                sections[currentSection].push(trimmed);
            }
        }

        return sections;
    }

    function formatReviewSections(sections) {
        let html = '';

        Object.entries(sections).forEach(([sectionName, issues]) => {
            const hasIssues = issues.length > 0;
            const icon = hasIssues ? '⚠️' : '✅';
            const statusColor = hasIssues ? '#dc3545' : '#28a745';

            html += `
                <div style="margin-bottom: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${statusColor};">
                    <h4 style="margin: 0 0 12px 0; color: ${statusColor}; font-size: 16px; font-weight: 600;">
                        ${icon} ${sectionName}
                    </h4>
            `;

            if (!hasIssues) {
                html += '<p style="color: #28a745; margin: 0;">Rien à signaler</p>';
            } else {
                issues.forEach(issue => {
                    html += `
                        <div style="background: white; border: 1px solid #e1e4e8; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                            ${issue.replace(/^[*-]\s*/, '')}
                        </div>
                    `;
                });
            }

            html += '</div>';
        });

        return html;
    }

    async function fetchJiraInfo(prData) {
        try {
            // Extraire le ticket principal du titre
            const jiraTicket = extractJiraTicket(prData.title);

            if (!jiraTicket) {
                return null; // Pas de ticket trouvé
            }

            // Récupérer la configuration Jira via le background script
            const configResponse = await sendMessage('getJiraConfig');

            if (!configResponse.success || !configResponse.config.hasJiraConfig) {
                console.warn('Configuration Jira incomplète');
                return generateBasicJiraInfo(jiraTicket);
            }

            // Appeler l'API Jira via le background script
            const jiraResponse = await sendMessage('callJiraAPI', {
                ticketKey: jiraTicket
            });

            if (jiraResponse.success && jiraResponse.data) {
                return generateEnhancedJiraInfo(jiraTicket, jiraResponse.data, configResponse.config.jiraUrl);
            } else {
                console.warn('Erreur API Jira:', jiraResponse.error);
                return generateBasicJiraInfo(jiraTicket);
            }

        } catch (error) {
            console.error('Erreur Jira:', error);
            const jiraTicket = extractJiraTicket(prData.title);
            return jiraTicket ? generateBasicJiraInfo(jiraTicket) : null;
        }
    }

    // Fonction utilitaire pour envoyer des messages au background script
    async function sendMessage(action, data = {}) {
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
    }

    async function callJiraAPI(ticketKey, config) {
        try {
            console.log('🎫 Appel API Jira pour:', ticketKey);
            console.log('🔧 Config Jira:', {
                url: config.jiraUrl,
                email: config.jiraEmail,
                hasToken: !!config.jiraApiToken
            });

            const url = `${config.jiraUrl}/rest/api/3/issue/${ticketKey}?fields=summary,description,status,priority,assignee,created,updated`;

            const credentials = btoa(`${config.jiraEmail}:${config.jiraApiToken}`);

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

                if (response.status === 401) {
                    console.error('🔑 Erreur d\'authentification Jira');
                } else if (response.status === 403) {
                    console.error('🚫 Accès interdit au ticket Jira');
                } else if (response.status === 404) {
                    console.error('🔍 Ticket Jira non trouvé');
                }

                return null;
            }

            const data = await response.json();
            console.log('✅ Données Jira récupérées:', data.key);
            return data;

        } catch (error) {
            console.error('❌ Erreur appel Jira API:', error);
            return null;
        }
    }

    function generateBasicJiraInfo(ticketKey) {
        return `
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border: 1px solid #bbdefb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; color: #1976d2; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    🎫 Ticket Jira
                </h4>
                <div style="margin-bottom: 8px;">
                    <strong>Ticket:</strong> 
                    <span style="color: #1976d2; font-weight: 600;">${ticketKey}</span>
                    <span style="font-size: 12px; color: #666; margin-left: 8px;">⚠️ Configurez l'API Jira pour plus d'infos</span>
                </div>
            </div>
        `;
    }

    function generateEnhancedJiraInfo(ticketKey, jiraData, jiraUrl) {
        const fields = jiraData.fields;
        const ticketUrl = `${jiraUrl}/browse/${ticketKey}`;

        // Traiter la description (peut être en format ADF - Atlassian Document Format)
        let description = 'Pas de description';
        if (fields.description) {
            if (typeof fields.description === 'string') {
                description = fields.description.substring(0, 300);
            } else if (fields.description.content) {
                // Format ADF - extraire le texte simple
                description = extractTextFromADF(fields.description).substring(0, 300);
            }
        }

        // Formatage des dates
        const createdDate = new Date(fields.created).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const updatedDate = new Date(fields.updated).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Icône et couleur du statut
        const statusInfo = getStatusInfo(fields.status?.name);

        // Icône de priorité
        const priorityIcon = getPriorityIcon(fields.priority?.name);

        return `
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border: 1px solid #bbdefb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; color: #1976d2; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    🎫 Ticket Jira - ${ticketKey}
                </h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px;">
                    <div>
                        <div style="margin-bottom: 8px;">
                            <strong>Titre:</strong> 
                            <a href="${ticketUrl}" target="_blank" style="color: #1976d2; text-decoration: none;">${fields.summary || 'Sans titre'}</a>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>Statut:</strong> 
                            <span style="background: ${statusInfo.color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                                ${statusInfo.icon} ${fields.status?.name || 'Inconnu'}
                            </span>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>Priorité:</strong> 
                            <span style="font-weight: 600;">${priorityIcon} ${fields.priority?.name || 'Non définie'}</span>
                        </div>
                    </div>
                    <div>
                        <div style="margin-bottom: 8px;">
                            <strong>Assigné à:</strong> ${fields.assignee?.displayName || 'Non assigné'}
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>Créé le:</strong> ${createdDate}
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>Modifié le:</strong> ${updatedDate}
                        </div>
                    </div>
                </div>
                
                <div style="border-top: 1px solid #bbdefb; padding-top: 12px;">
                    <strong>Description:</strong>
                    <div style="background: white; border: 1px solid #e1e4e8; border-radius: 6px; padding: 12px; margin-top: 8px; font-size: 14px; line-height: 1.5; max-height: 120px; overflow-y: auto;">
                        ${description.length > 295 ? description + '...' : description}
                    </div>
                </div>
            </div>
        `;
    }

    function extractTextFromADF(adfContent) {
        // Fonction récursive pour extraire le texte d'un document ADF
        function extractText(node) {
            let text = '';

            if (node.type === 'text') {
                return node.text || '';
            }

            if (node.content && Array.isArray(node.content)) {
                for (const child of node.content) {
                    text += extractText(child);
                }
            }

            // Ajouter des espaces pour certains types de nœuds
            if (node.type === 'paragraph' || node.type === 'heading') {
                text += ' ';
            }

            return text;
        }

        return extractText(adfContent).trim();
    }

    function getStatusInfo(status) {
        const statusMap = {
            'To Do': { icon: '📋', color: '#6c757d' },
            'À faire': { icon: '📋', color: '#6c757d' },
            'In Progress': { icon: '🔄', color: '#007bff' },
            'En cours': { icon: '🔄', color: '#007bff' },
            'In Review': { icon: '👁️', color: '#ffc107' },
            'En révision': { icon: '👁️', color: '#ffc107' },
            'Done': { icon: '✅', color: '#28a745' },
            'Terminé': { icon: '✅', color: '#28a745' },
            'Closed': { icon: '🔒', color: '#6c757d' },
            'Fermé': { icon: '🔒', color: '#6c757d' }
        };

        return statusMap[status] || { icon: '❓', color: '#6c757d' };
    }

    function getPriorityIcon(priority) {
        const priorityMap = {
            'Highest': '🔴🔴',
            'High': '🔴',
            'Medium': '🟡',
            'Low': '🟢',
            'Lowest': '🟢🟢',
            'Très élevée': '🔴🔴',
            'Élevée': '🔴',
            'Moyenne': '🟡',
            'Faible': '🟢',
            'Très faible': '🟢🟢'
        };

        return priorityMap[priority] || '⚪';
    }

    async function sendMessageToBackground(action, data = {}) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout: pas de réponse du background script'));
            }, 30000); // 30 secondes pour Jira

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
    }

    function extractJiraTicket(title) {
        // Extraire le ticket Jira du format [INTL-1234] ou similaire
        const match = title.match(/\[([A-Z]+-\d+)\]/);
        return match ? match[1] : null;
    }

    function showError(message) {
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

})();