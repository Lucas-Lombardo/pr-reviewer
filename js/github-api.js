// Gestionnaire de l'API GitHub
const GitHubAPI = {
    extractPRInfo() {
        const pathParts = window.location.pathname.split('/');
        const owner = pathParts[1];
        const repo = pathParts[2];
        const prNumber = pathParts[4];

        if (!owner || !repo || !prNumber) {
            throw new Error('Impossible d\'extraire les informations de la PR');
        }

        return { owner, repo, prNumber };
    },

    async fetchPRData(prInfo, githubToken) {
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
                .slice(0, 10) // Limiter à 10 fichiers
                .map(file => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch,
                    language: this.detectLanguage(file.filename)
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
    },

    detectLanguage(filename) {
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
};