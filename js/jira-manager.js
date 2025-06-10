// Gestionnaire Jira
const JiraManager = {
    async getJiraInfoForPrompt(prData) {
        try {
            const jiraTicket = this.extractJiraTicket(prData.title);
            if (!jiraTicket) return null;

            // Essayer de récupérer les infos Jira détaillées
            try {
                const jiraResponse = await Utils.sendMessage('callJiraAPI', {
                    ticketKey: jiraTicket
                });

                if (jiraResponse.success && jiraResponse.data) {
                    const fields = jiraResponse.data.fields;
                    return {
                        ticket: jiraTicket,
                        title: fields.summary || 'Non disponible',
                        description: this.extractJiraDescription(fields.description),
                        status: fields.status?.name || 'Non disponible'
                    };
                }
            } catch (error) {
                console.warn('Jira API non disponible pour le prompt:', error.message);
            }

            // Fallback: retourner juste le numéro du ticket
            return {
                ticket: jiraTicket,
                title: 'Non disponible (API Jira non configurée)',
                description: 'Non disponible (API Jira non configurée)',
                status: 'Non disponible'
            };

        } catch (error) {
            console.error('Erreur récupération Jira pour prompt:', error);
            return null;
        }
    },

    async fetchJiraInfo(prData) {
        try {
            const jiraTicket = this.extractJiraTicket(prData.title);
            if (!jiraTicket) return null;

            const config = await chrome.storage.local.get(['jiraUrl', 'jiraEmail', 'jiraApiToken']);

            if (!config.jiraUrl || !config.jiraEmail || !config.jiraApiToken) {
                console.warn('Configuration Jira incomplète');
                return this.generateBasicJiraInfo(jiraTicket, null);
            }

            try {
                const jiraResponse = await Utils.sendMessage('callJiraAPI', {
                    ticketKey: jiraTicket
                });

                if (jiraResponse.success && jiraResponse.data) {
                    return this.generateEnhancedJiraInfo(jiraTicket, jiraResponse.data, config.jiraUrl);
                } else {
                    console.warn('Erreur API Jira:', jiraResponse.error);
                    return this.generateBasicJiraInfo(jiraTicket, config.jiraUrl);
                }
            } catch (error) {
                console.warn('Fallback Jira - API non disponible:', error.message);
                return this.generateBasicJiraInfo(jiraTicket, config.jiraUrl);
            }

        } catch (error) {
            console.error('Erreur Jira:', error);
            const jiraTicket = this.extractJiraTicket(prData.title);
            return jiraTicket ? this.generateBasicJiraInfo(jiraTicket, null) : null;
        }
    },

    extractJiraTicket(title) {
        const match = title.match(/\[([A-Z]+-\d+)\]/);
        return match ? match[1] : null;
    },

    extractJiraDescription(description) {
        if (!description) return 'Non disponible';

        if (typeof description === 'string') {
            return description.substring(0, 500) + (description.length > 500 ? '...' : '');
        }

        if (description.content) {
            const text = this.extractTextFromADF(description);
            return text.substring(0, 500) + (text.length > 500 ? '...' : '');
        }

        return 'Non disponible';
    },

    extractTextFromADF(adfContent) {
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

            if (node.type === 'paragraph' || node.type === 'heading') {
                text += ' ';
            }

            return text;
        }

        return extractText(adfContent).trim();
    },

    generateBasicJiraInfo(ticketKey, jiraUrl) {
        const hasJiraConfig = !!jiraUrl;
        const ticketUrl = jiraUrl ? `${jiraUrl}/browse/${ticketKey}` : `https://onatera.atlassian.net/browse/${ticketKey}`;

        return `
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border: 1px solid #bbdefb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; color: #1976d2; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    🎫 Ticket Jira
                </h4>
                <div style="margin-bottom: 8px;">
                    <strong>Ticket:</strong> 
                    <a href="${ticketUrl}" target="_blank" style="color: #1976d2; text-decoration: none; font-weight: 600;">${ticketKey}</a>
                    ${hasJiraConfig ?
            '<span style="font-size: 12px; color: #666; margin-left: 8px;">🔗 Cliquez pour ouvrir dans Jira</span>' :
            '<span style="font-size: 12px; color: #666; margin-left: 8px;">⚠️ Configurez l\'API Jira pour plus d\'infos</span>'
        }
                </div>
                ${hasJiraConfig ? `
                    <div style="font-size: 12px; color: #666; margin-top: 8px; padding: 8px; background: rgba(25, 118, 210, 0.1); border-radius: 4px;">
                        💡 <strong>Astuce:</strong> L'API Jira nécessite des permissions spéciales. 
                        Pour l'instant, cliquez sur le lien pour voir les détails du ticket.
                    </div>
                ` : ''}
            </div>
        `;
    },

    generateEnhancedJiraInfo(ticketKey, jiraData, jiraUrl) {
        const fields = jiraData.fields;
        const ticketUrl = `${jiraUrl}/browse/${ticketKey}`;

        let description = 'Pas de description';
        if (fields.description) {
            if (typeof fields.description === 'string') {
                description = fields.description.substring(0, 300);
            } else if (fields.description.content) {
                description = this.extractTextFromADF(fields.description).substring(0, 300);
            }
        }

        const createdDate = new Date(fields.created).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const updatedDate = new Date(fields.updated).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const statusInfo = this.getStatusInfo(fields.status?.name);
        const priorityIcon = this.getPriorityIcon(fields.priority?.name);

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
    },

    getStatusInfo(status) {
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
    },

    getPriorityIcon(priority) {
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
};