// Gestionnaire d'affichage des reviews
const ReviewDisplay = {
    displayReview(review, prData) {
        // Supprimer l'ancien panneau s'il existe
        const existingPanel = document.querySelector('#claude-review-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'claude-review-panel';
        panel.className = 'claude-review-panel';

        // Trouver l'endroit idéal pour l'insertion
        const insertionPoint = this.findInsertionPoint();

        if (insertionPoint) {
            insertionPoint.parentNode.insertBefore(panel, insertionPoint.nextSibling);
        } else {
            // Fallback
            const mainContent = document.querySelector('.repository-content, main .container-xl, main');
            if (mainContent) {
                mainContent.insertBefore(panel, mainContent.firstChild);
            } else {
                document.body.appendChild(panel);
            }
        }

        // Parser et formater le contenu
        const sections = this.parseReviewSections(review);
        const formattedContent = this.formatReviewSections(sections);

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
        JiraManager.fetchJiraInfo(prData).then(jiraHtml => {
            const container = panel.querySelector('#jira-info-container');
            if (container && jiraHtml) {
                container.innerHTML = jiraHtml;
            } else if (container) {
                container.innerHTML = '';
            }
        }).catch(error => {
            console.warn('Erreur lors de la récupération Jira:', error);
            const container = panel.querySelector('#jira-info-container');
            if (container) {
                container.innerHTML = '';
            }
        });

        panel.style.display = 'block';

        // Scroll vers le panneau
        setTimeout(() => {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    },

    findInsertionPoint() {
        const insertionPoints = [
            '.gh-header-meta',
            '.TimelineItem-body',
            '.js-issue-header',
            '.gh-header',
            '.Box-header',
            '.discussion-timeline-actions'
        ];

        for (const selector of insertionPoints) {
            const element = document.querySelector(selector);
            if (element) {
                console.log(`📍 Point d'insertion trouvé: ${selector}`);
                return element;
            }
        }

        return null;
    },

    parseReviewSections(review) {
        const sections = {
            'Pull Request': [],
            'Ménage': [],
            'Typage': [],
            'Cohérence': [],
            'Cohérence avec le ticket': [],
            'Qualité': [],
            'Tests': [],
            'Refactoring': []
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
    },

    formatReviewSections(sections) {
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
};