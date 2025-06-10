// Gestionnaire de l'API Claude
const ClaudeAPI = {
    async callAPI(prData, apiKey, jiraInfo = null) {
        const prompt = this.generateReviewPrompt(prData, jiraInfo);

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
    },

    generateReviewPrompt(prData, jiraInfo = null) {
        let jiraSection = '';

        if (jiraInfo && jiraInfo.ticket) {
            jiraSection = `
**Informations du ticket Jira ${jiraInfo.ticket}:**
- **Titre Jira:** ${jiraInfo.title || 'Non disponible'}
- **Description Jira:** ${jiraInfo.description || 'Non disponible'}
- **Statut:** ${jiraInfo.status || 'Non disponible'}
`;
        }

        return `Tu es un expert en review de code. Analyse cette pull request GitHub et signale UNIQUEMENT les problèmes concrets que tu identifies dans le code fourni.

**Pull Request: ${prData.title}**
${prData.description ? `**Description:** ${prData.description}` : '**Description:** Aucune description fournie'}

${jiraSection}

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

**Cohérence avec le ticket:**
${jiraInfo && jiraInfo.ticket ? `
- Le code implémente-t-il ce qui est décrit dans le ticket "${jiraInfo.title}" ?
- Les modifications correspondent-elles aux exigences du ticket Jira ?
- Y a-t-il des fonctionnalités développées qui ne sont pas mentionnées dans le ticket ?
- Le scope du développement reste-t-il dans les limites du ticket ?
` : `
- Vérifier si les modifications correspondent bien au titre de la PR
- S'assurer que le scope reste cohérent avec l'objectif annoncé
`}

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

Cohérence avec le ticket:
[Problèmes d'alignement avec les exigences du ticket ou "Rien à signaler"]

Qualité:
[Problèmes de qualité dans fichier:ligne ou "Rien à signaler"]

Tests:
[Problèmes de tests ou "Rien à signaler"]

Refacto:
[Améliorations possibles dans fichier:ligne ou "Rien à signaler"]

**RAPPEL:** Ne signale QUE ce que tu vois réellement dans le code fourni. Pas de suppositions, pas d'inventions.`;
    }
};