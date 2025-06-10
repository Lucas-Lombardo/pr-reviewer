// Content script principal - Claude PR Reviewer
(function() {
    'use strict';

    console.log('🚀 Claude PR Reviewer - Version modulaire');

    let reviewButton = null;
    let isReviewing = false;

    // Initialisation
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }

    function init() {
        const isPRPage = /\/pull\/\d+/.test(window.location.pathname);
        if (!isPRPage) return;

        UIManager.injectStyles();
        UIManager.createReviewButton(handleReviewClick);
        UIManager.setupObserver();
    }

    async function handleReviewClick() {
        if (isReviewing) return;

        console.log('🤖 Début de la review...');
        isReviewing = true;
        reviewButton = document.querySelector('#claude-review-btn');
        reviewButton.disabled = true;

        try {
            // Étape 1: Configuration
            updateProgress('🔑 Vérification de la configuration...');
            const config = await chrome.storage.local.get(['claudeApiKey', 'githubToken']);
            if (!config.claudeApiKey) {
                throw new Error('Clé API Claude non configurée. Cliquez sur l\'icône de l\'extension pour la configurer.');
            }

            // Étape 2: Extraction PR info
            updateProgress('📍 Extraction des informations de la PR...');
            const prInfo = GitHubAPI.extractPRInfo();

            // Étape 3: Récupération GitHub
            updateProgress('📥 Récupération des données GitHub...');
            const prData = await GitHubAPI.fetchPRData(prInfo, config.githubToken);

            // Étape 4: Récupération Jira
            updateProgress('🎫 Récupération des infos Jira...');
            const jiraInfo = await JiraManager.getJiraInfoForPrompt(prData);

            // Étape 5: Appel Claude
            updateProgress('🤖 Analyse par Claude AI...');
            const review = await ClaudeAPI.callAPI(prData, config.claudeApiKey, jiraInfo);

            // Étape 6: Affichage
            updateProgress('✨ Finalisation...');
            ReviewDisplay.displayReview(review, prData);

            updateProgress('🎉 Terminé!');

        } catch (error) {
            console.error('❌ Erreur:', error);
            UIManager.showError(`Erreur: ${error.message}`);
        } finally {
            isReviewing = false;
            if (reviewButton) {
                reviewButton.disabled = false;
                reviewButton.innerHTML = '🤖 Review with Claude';
            }
        }
    }

    function updateProgress(message) {
        if (reviewButton) {
            reviewButton.innerHTML = message;
        }
        console.log(message);
    }

})();