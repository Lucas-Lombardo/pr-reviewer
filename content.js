// Content script qui s'exécute sur les pages GitHub PR
(function() {
    'use strict';

    console.log('🚀 Claude PR Reviewer - Content script chargé!');
    console.log('URL:', window.location.href);

    let reviewButton = null;
    let isReviewing = false;

    // Attendre que la page soit chargée
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        console.log('🚀 Initialisation de Claude PR Reviewer...');
        console.log('URL:', window.location.href);
        console.log('Pathname:', window.location.pathname);

        // Vérifier qu'on est bien sur une page de PR avec une regex plus flexible
        const isPRPage = /\/pull\/\d+/.test(window.location.pathname);
        console.log('Est une page PR?', isPRPage);

        if (!isPRPage) {
            console.log('❌ Pas une page de PR, arrêt');
            return;
        }

        console.log('✅ Page PR détectée, injection des styles...');
        injectStyles();

        console.log('✅ Création du bouton de review...');
        createReviewButton();

        // Observer les changements DOM pour maintenir le bouton et gérer la navigation SPA
        const observer = new MutationObserver((mutations) => {
            // Vérifier si on est toujours sur une page PR
            const isPRPage = /\/pull\/\d+/.test(window.location.pathname);

            if (isPRPage && !document.querySelector('#claude-review-btn')) {
                console.log('🔄 Bouton manquant détecté, recréation...');
                setTimeout(createReviewButton, 500);
            } else if (!isPRPage && document.querySelector('#claude-review-btn')) {
                // Supprimer le bouton si on n'est plus sur une page PR
                const btn = document.querySelector('#claude-review-btn');
                if (btn) btn.remove();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function injectStyles() {
        // Éviter d'injecter les styles plusieurs fois
        if (document.querySelector('#claude-review-styles')) return;

        const styles = `
        /* Styles pour l'extension Claude PR Reviewer */
        .claude-review-panel {
            background: #f6f8fa;
            border: 1px solid #d1d9e0;
            border-radius: 8px;
            margin: 16px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        }

        .claude-review-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 16px;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .claude-review-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }

        .claude-close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .claude-close-btn:hover {
            background: rgba(255,255,255,0.3);
        }

        .claude-review-content {
            padding: 20px;
            line-height: 1.6;
            color: #24292f;
        }

        .claude-review-content h2 {
            color: #0969da;
            border-bottom: 2px solid #eee;
            padding-bottom: 8px;
            margin-top: 24px;
            margin-bottom: 16px;
            font-size: 20px;
        }

        .claude-review-content h3 {
            color: #0969da;
            margin-top: 20px;
            margin-bottom: 12px;
            font-size: 18px;
        }

        .claude-review-content h4 {
            color: #656d76;
            margin-top: 16px;
            margin-bottom: 8px;
            font-size: 16px;
        }

        .claude-review-content p {
            margin-bottom: 12px;
        }

        .claude-review-content code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 13px;
            color: #d73a49;
        }

        .claude-review-content pre {
            background: #f6f8fa;
            border: 1px solid #d1d9e0;
            border-radius: 6px;
            padding: 12px;
            overflow-x: auto;
            margin: 12px 0;
        }

        .claude-review-content pre code {
            background: none;
            padding: 0;
            color: #24292f;
            font-size: 12px;
        }

        .claude-review-content strong {
            color: #0969da;
            font-weight: 600;
        }

        .claude-review-content em {
            color: #656d76;
            font-style: italic;
        }

        .claude-error {
            background: #ffeaea;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 12px 16px;
            border-radius: 6px;
            margin: 16px;
            position: relative;
        }

        .claude-error button {
            background: none;
            border: none;
            color: #721c24;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
        }

        #claude-review-btn {
            transition: all 0.2s ease;
            position: relative;
        }

        #claude-review-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        #claude-review-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .claude-context-section {
            background: #f8f9fa;
            border-left: 4px solid #0969da;
            padding: 12px 16px;
            margin: 16px 0;
            border-radius: 0 6px 6px 0;
            color: #24292f;
        }
        
        .claude-context-section strong {
            color: #0969da;
            font-weight: 600;
        }
        
        .claude-context-section a {
            color: #0969da;
            text-decoration: none;
        }
        
        .claude-context-section a:hover {
            text-decoration: underline;
        }

        .claude-breaking-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-left: 4px solid #f39c12;
            padding: 12px 16px;
            margin: 16px 0;
            border-radius: 0 6px 6px 0;
            color: #856404;
        }
        
        .claude-breaking-warning strong {
            color: #b45309;
            font-weight: 600;
        }

        .claude-breaking-danger {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-left: 4px solid #dc3545;
            padding: 12px 16px;
            margin: 16px 0;
            border-radius: 0 6px 6px 0;
            color: #721c24;
        }
        
        .claude-breaking-danger strong {
            color: #721c24;
            font-weight: 600;
        }

        @media (max-width: 768px) {
            .claude-review-panel {
                margin: 8px;
                border-radius: 6px;
            }
            
            .claude-review-content {
                padding: 16px;
                font-size: 14px;
            }
            
            .claude-review-header {
                padding: 10px 12px;
            }
            
            .claude-review-header h3 {
                font-size: 14px;
            }
        }

        .claude-review-content pre code {
            white-space: pre-wrap;
            word-break: break-word;
        }

        .claude-review-content ul, .claude-review-content ol {
            padding-left: 20px;
            margin-bottom: 12px;
        }

        .claude-review-content li {
            margin-bottom: 4px;
        }

        .claude-review-content h2:first-child {
            margin-top: 0;
        }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = 'claude-review-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    function createReviewButton() {
        // Éviter les doublons
        if (document.querySelector('#claude-review-btn')) return;

        console.log('🤖 Tentative de création du bouton de review...');
        console.log('URL actuelle:', window.location.href);
        console.log('Pathname:', window.location.pathname);

        // Essayer plusieurs sélecteurs pour trouver où placer le bouton
        const possibleContainers = [
            '.gh-header-actions',
            '.js-issue-header-actions',
            '.TableObject-item--primary',
            '[data-testid="pull-request-header-actions"]',
            '.pr-toolbar',
            '.js-issue-header',
            '.gh-header-meta',
            '.flex-auto.min-width-0 .d-flex',
            '.Box-header .d-flex'
        ];

        let buttonContainer = null;
        for (const selector of possibleContainers) {
            buttonContainer = document.querySelector(selector);
            if (buttonContainer) {
                console.log('📍 Container trouvé:', selector);
                break;
            }
        }

        if (!buttonContainer) {
            console.log('❌ Aucun container trouvé, essai avec fallback...');
            // Fallback: créer notre propre container
            const prHeader = document.querySelector('.js-issue-header') ||
                document.querySelector('[data-hpc]') ||
                document.querySelector('.gh-header');

            if (prHeader) {
                buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = 'margin: 10px 0; text-align: right;';
                prHeader.appendChild(buttonContainer);
                console.log('✅ Container fallback créé');
            } else {
                console.log('❌ Impossible de trouver un endroit pour le bouton, retry...');
                setTimeout(createReviewButton, 1000);
                return;
            }
        }

        reviewButton = document.createElement('button');
        reviewButton.id = 'claude-review-btn';
        reviewButton.className = 'btn btn-sm btn-outline';
        reviewButton.innerHTML = '🤖 Review with Claude';
        reviewButton.style.cssText = 'margin-left: 8px; background-color: #f3f4f6; border: 1px solid #d1d9e0; color: #24292f; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;';

        reviewButton.addEventListener('click', handleReviewClick);

        buttonContainer.appendChild(reviewButton);
        console.log('✅ Bouton de review créé avec succès!');
    }

    async function handleReviewClick() {
        if (isReviewing) return;

        isReviewing = true;
        reviewButton.disabled = true;
        reviewButton.innerHTML = '⏳ Analyzing...';

        try {
            // Vérifier la configuration
            const config = await chrome.storage.local.get(['claudeApiKey', 'githubToken']);
            if (!config.claudeApiKey) {
                throw new Error('Clé API Claude non configurée. Utilisez l\'icône de l\'extension pour la configurer.');
            }

            // Récupérer les informations de la PR
            const prInfo = extractPRInfo();
            console.log('PR Info:', prInfo);

            // Récupérer le code de la PR avec analyse contextuelle
            const prData = await fetchPRData(prInfo, config.githubToken);
            console.log('PR Data fetched with contextual analysis');

            // Envoyer à Claude pour review
            const review = await sendToClaudeForReview(prData, config.claudeApiKey);

            // Afficher le résultat
            displayReview(review, prData.contextualData);

        } catch (error) {
            console.error('Erreur lors de la review:', error);
            showError('Erreur: ' + error.message);
        } finally {
            isReviewing = false;
            reviewButton.disabled = false;
            reviewButton.innerHTML = '🤖 Review with Claude';
        }
    }

    function extractPRInfo() {
        const pathParts = window.location.pathname.split('/');
        const owner = pathParts[1];
        const repo = pathParts[2];
        const prNumber = pathParts[4];

        return { owner, repo, prNumber };
    }

    async function fetchPRData(prInfo, githubToken) {
        const { owner, repo, prNumber } = prInfo;

        // Utiliser le background script pour éviter les problèmes CORS
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'fetchGitHub',
                owner: owner,
                repo: repo,
                prNumber: prNumber,
                githubToken: githubToken
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.result);
                }
            });
        });
    }

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

    async function sendToClaudeForReview(prData, apiKey) {
        // Construction du contexte enrichi
        const contextualInfo = buildContextualInfo(prData.contextualData);

        const prompt = `Tu es un expert en review de code. Analyse cette pull request GitHub et signale UNIQUEMENT les problèmes concrets que tu identifies dans le code fourni.

**Pull Request: ${prData.title}**
${prData.description ? `**Description:** ${prData.description}` : '**Description:** Aucune description fournie'}

${contextualInfo}

**Fichiers modifiés (${prData.files.length}/${prData.totalFiles}):**

${prData.files.map(file => `
### ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})
\`\`\`${file.language}
${file.patch}
\`\`\`
`).join('\n')}

**INSTRUCTIONS IMPORTANTES:**
- Analyse UNIQUEMENT le code fourni ci-dessus
- Prends en compte le contexte fourni (commits, Jira, breaking changes)
- Ne signale QUE les problèmes que tu peux VOIR concrètement dans le code
- N'invente AUCUN problème, ne fais AUCUNE supposition
- Si tu ne vois pas de problème dans une catégorie, écris "Rien à signaler"
- Sois très précis sur les numéros de ligne et noms de fichiers

**Checklist à vérifier:**

**Pull Request:**
- Titre respecte le format : <gitmoji><espace>[INTL-1234]<espace>Titre en français
- Description contient un lien Jira si applicable
- Description contient des instructions de déploiement si nécessaire
- Cohérence avec les tickets Jira mentionnés
- Branche cible appropriée

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
- Cohérence avec l'historique des commits

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

**Breaking Changes:**
- Vérification de la cohérence avec les changements détectés
- Impact sur l'API publique
- Documentation des breaking changes

**Refactoring:**
- Code dupliqué identique
- Méthodes trop longues (>20 lignes)
- Classes avec trop de responsabilités

**FORMAT DE RÉPONSE OBLIGATOIRE:**

Pull Request:
[Problèmes du titre/description/contexte de la PR ou "Rien à signaler"]

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

Breaking Changes:
[Problèmes de compatibilité ou "Rien à signaler"]

Refacto:
[Améliorations possibles dans fichier:ligne ou "Rien à signaler"]

**RAPPEL:** Ne signale QUE ce que tu vois réellement dans le code fourni. Utilise le contexte pour mieux comprendre mais reste factuel.`;

        // Utiliser le background script pour éviter les problèmes CORS
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'callClaude',
                prompt: prompt,
                apiKey: apiKey
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.result);
                }
            });
        });
    }

    function buildContextualInfo(contextualData) {
        if (!contextualData) return '';

        let contextInfo = '\n**CONTEXTE ENRICHI:**\n';

        // Informations sur les branches et métadonnées
        if (contextualData.prMetadata) {
            const meta = contextualData.prMetadata;
            contextInfo += `
**Métadonnées:**
- Branche source: ${meta.headBranch} → Branche cible: ${meta.baseBranch}
- Statut: ${meta.isDraft ? 'Draft' : 'Prêt pour review'}
- Modifications: +${meta.additions}/-${meta.deletions} lignes sur ${meta.changedFiles} fichiers
`;
        }

        // Informations Jira
        if (contextualData.jiraInfo && contextualData.jiraInfo.hasJiraReference) {
            contextInfo += `
**Tickets Jira liés:**
- Tickets détectés: ${contextualData.jiraInfo.tickets.join(', ')}
- Liens directs: ${contextualData.jiraInfo.links.length} lien(s) trouvé(s)
`;
        }

        // Historique des commits
        if (contextualData.commits && contextualData.commits.length > 0) {
            contextInfo += `
**Historique des commits (${contextualData.commits.length} commits):**
${contextualData.commits.slice(0, 5).map(commit =>
                `- ${commit.sha}: ${commit.message.split('\n')[0]} (${commit.author})`
            ).join('\n')}
${contextualData.commits.length > 5 ? `\n... et ${contextualData.commits.length - 5} autres commits` : ''}
`;
        }

        // Breaking changes
        if (contextualData.breakingChanges && contextualData.breakingChanges.hasBreakingChanges) {
            contextInfo += `
**⚠️ BREAKING CHANGES DÉTECTÉS (Risque: ${contextualData.breakingChanges.riskLevel}):**
${contextualData.breakingChanges.indicators.map(indicator =>
                `- ${indicator.type}: ${indicator.detail} (source: ${indicator.source})`
            ).join('\n')}
`;
        }

        // Analyse du code
        if (contextualData.codeAnalysis) {
            const analysis = contextualData.codeAnalysis;
            contextInfo += `
**Analyse du code:**
- Langages: ${Object.keys(analysis.languages).join(', ')}
- Total des modifications: ${analysis.totalChanges} lignes
- Fichier le plus modifié: ${analysis.largestFile ? `${analysis.largestFile.name} (${analysis.largestFile.changes} changements)` : 'N/A'}
- Fichiers de test: ${analysis.testFiles.length} fichier(s)
- Fichiers de config: ${analysis.configFiles.length} fichier(s)
- Nouveaux fichiers: ${analysis.hasNewFiles ? 'Oui' : 'Non'}
- Fichiers supprimés: ${analysis.hasRemovedFiles ? 'Oui' : 'Non'}
`;
        }

        return contextInfo + '\n';
    }

    function displayReview(review, contextualData) {
        // Créer ou mettre à jour le panneau de review
        let reviewPanel = document.querySelector('#claude-review-panel');

        if (!reviewPanel) {
            reviewPanel = document.createElement('div');
            reviewPanel.id = 'claude-review-panel';
            reviewPanel.className = 'claude-review-panel';

            // Insérer après l'header de la PR
            const insertAfter = document.querySelector('.gh-header') ||
                document.querySelector('.js-issue-header') ||
                document.querySelector('.pr-toolbar');

            if (insertAfter) {
                insertAfter.parentNode.insertBefore(reviewPanel, insertAfter.nextSibling);
            } else {
                document.body.appendChild(reviewPanel);
            }
        }

        // Construire les alertes contextuelles
        const contextAlerts = buildContextAlerts(contextualData);

        reviewPanel.innerHTML = `
            <div class="claude-review-header">
                <h3>🤖 Claude Code Review ${contextualData?.breakingChanges?.hasBreakingChanges ? '⚠️' : ''}</h3>
                <button class="claude-close-btn" onclick="this.closest('#claude-review-panel').style.display='none'">×</button>
            </div>
            ${contextAlerts}
            <div class="claude-review-content">
                ${formatReviewContent(review)}
            </div>
        `;

        reviewPanel.style.display = 'block';
        reviewPanel.scrollIntoView({ behavior: 'smooth' });
    }

    function buildContextAlerts(contextualData) {
        if (!contextualData) return '';

        let alerts = '';

        // Alerte breaking changes
        if (contextualData.breakingChanges && contextualData.breakingChanges.hasBreakingChanges) {
            const riskLevel = contextualData.breakingChanges.riskLevel;
            const alertClass = riskLevel === 'high' ? 'claude-breaking-danger' : 'claude-breaking-warning';
            const icon = riskLevel === 'high' ? '🚨' : '⚠️';

            alerts += `
                <div class="${alertClass}">
                    <strong>${icon} Breaking Changes Détectés (Risque: ${riskLevel})</strong><br>
                    ${contextualData.breakingChanges.indicators.slice(0, 3).map(indicator =>
                `• ${indicator.detail}`
            ).join('<br>')}
                    ${contextualData.breakingChanges.indicators.length > 3 ?
                `<br>... et ${contextualData.breakingChanges.indicators.length - 3} autre(s)` : ''}
                </div>
            `;
        }

        // Alerte Jira
        if (contextualData.jiraInfo && contextualData.jiraInfo.hasJiraReference) {
            alerts += `
                <div class="claude-context-section">
                    <strong>🎫 Tickets Jira liés:</strong> ${contextualData.jiraInfo.tickets.join(', ')}
                    ${contextualData.jiraInfo.links.length > 0 ?
                `<br><strong>Liens:</strong> ${contextualData.jiraInfo.links.map(link =>
                    `<a href="${link.url}" target="_blank">${link.ticket}</a>`
                ).join(', ')}` : ''}
                </div>
            `;
        }

        // Résumé de l'analyse
        if (contextualData.codeAnalysis) {
            const analysis = contextualData.codeAnalysis;
            alerts += `
                <div class="claude-context-section">
                    <strong>📊 Résumé:</strong> 
                    ${analysis.totalChanges} lignes modifiées • 
                    ${Object.keys(analysis.languages).length} langage(s) • 
                    ${analysis.testFiles.length} test(s) • 
                    ${contextualData.commits ? contextualData.commits.length : 0} commit(s)
                </div>
            `;
        }

        return alerts;
    }

    function formatReviewContent(review) {
        // Convertir le markdown en HTML simple
        return review
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/```(\w+)?\n([\s\S]+?)\n```/g, '<pre><code>$2</code></pre>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'claude-error';
        errorDiv.innerHTML = `
            <strong>Erreur Claude PR Reviewer:</strong><br>
            ${message}
            <button onclick="this.parentElement.remove()" style="float: right;">×</button>
        `;

        document.body.insertBefore(errorDiv, document.body.firstChild);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }
})();