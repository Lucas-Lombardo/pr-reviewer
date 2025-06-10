# 🤖 Claude PR Reviewer - Extension Chrome

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/your-repo/claude-pr-reviewer)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)
[![Claude AI](https://img.shields.io/badge/Claude-AI-purple.svg)](https://www.anthropic.com/claude)

Extension Chrome qui utilise l'API Claude d'Anthropic pour reviewer automatiquement les pull requests GitHub et fournir des conseils d'amélioration du code professionnels et détaillés.

## ✨ Fonctionnalités

### 🔍 **Analyse Intelligente**
- **Review automatique** des pull requests GitHub avec IA
- **Détection des bugs** et problèmes de sécurité potentiels
- **Suggestions d'amélioration** (best practices, lisibilité, performance)
- **Analyse en 7 catégories** : PR, Ménage, Typage, Cohérence, Qualité, Tests, Refactoring

### 🌐 **Support Multi-langages**
- JavaScript/TypeScript (React, Node.js, etc.)
- Python, PHP, Java, C++, C#
- HTML/CSS/SCSS, JSON, YAML
- Et plus de 25 langages supportés

### ⚡ **Performance & UX**
- **Interface intégrée** directement dans GitHub
- **Cache intelligent** pour éviter les requêtes redondantes
- **Rate limiting** automatique pour respecter les limites API
- **Retry automatique** en cas d'erreur temporaire
- **Design responsive** mobile-friendly

### 🔧 **Configuration Avancée**
- **3 modèles Claude** : Haiku (rapide), Sonnet (équilibré), Opus (précis)
- **Limitation intelligente** du nombre de fichiers analysés
- **Support repos privés** via token GitHub
- **Validation en temps réel** des clés API

## 🚀 Installation

### 1. Télécharger l'extension

Clonez ce repository ou téléchargez les fichiers :

```bash
git clone https://github.com/your-repo/claude-pr-reviewer.git
cd claude-pr-reviewer
```

### 2. Préparer les icônes (optionnel)

Créez des icônes PNG ou utilisez un générateur d'icônes :
- `icons/icon16.png` (16x16px)
- `icons/icon48.png` (48x48px)
- `icons/icon128.png` (128x128px)

### 3. Installer dans Chrome

1. Ouvrez Chrome et allez sur `chrome://extensions/`
2. Activez le **"Mode développeur"** (coin supérieur droit)
3. Cliquez sur **"Charger l'extension non empaquetée"**
4. Sélectionnez le dossier contenant les fichiers de l'extension
5. L'extension apparaît dans votre liste avec une icône dans la barre d'outils

## ⚙️ Configuration

### 1. Obtenir une clé API Claude

1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com)
2. Allez dans **API Keys** et générez une nouvelle clé
3. Copiez la clé (commence par `sk-ant-`)
4. ⚠️ **Important** : Gardez cette clé secrète et ne la partagez jamais

### 2. Obtenir un token GitHub (optionnel)

**Requis uniquement pour les repositories privés :**

1. Allez sur GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Cliquez sur **"Generate new token (classic)"**
3. Sélectionnez les permissions :
    - `repo` (accès complet aux repos privés)
    - `read:org` (si vous travaillez avec des orgs)
4. Générez et copiez le token (commence par `ghp_`)

### 3. Configurer l'extension

1. Cliquez sur l'icône de l'extension dans la barre d'outils Chrome
2. Entrez votre **clé API Claude** (obligatoire)
3. Entrez votre **token GitHub** (optionnel, pour repos privés)
4. Choisissez votre **modèle Claude** :
    - **Haiku** : Rapide et économique (recommandé)
    - **Sonnet** : Équilibré entre vitesse et précision
    - **Opus** : Maximum de précision (plus coûteux)
5. Cliquez sur **"Sauvegarder"**

## 🎯 Utilisation

### Review automatique

1. **Rendez-vous sur une pull request GitHub**
2. **Cliquez sur le bouton "🤖 Review with Claude"** qui apparaît automatiquement
3. **Attendez l'analyse** (30 secondes à 2 minutes selon la taille)
4. **Consultez les résultats** dans le panneau qui s'affiche

### Raccourcis clavier

- **Ctrl +