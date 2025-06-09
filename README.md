# 🤖 Claude PR Reviewer - Extension Chrome

Extension Chrome qui utilise l'API Claude d'Anthropic pour reviewer automatiquement les pull requests GitHub et fournir des conseils d'amélioration du code.

## ✨ Fonctionnalités

- **Review automatique** des pull requests GitHub
- **Analyse intelligente** du code avec Claude
- **Détection des bugs** et problèmes de sécurité potentiels
- **Suggestions d'amélioration** (best practices, lisibilité, performance)
- **Support multi-langages** (JavaScript, Python, Java, C++, etc.)
- **Interface intégrée** directement dans GitHub
- **Configuration simple** via popup

## 🚀 Installation

### 1. Télécharger les fichiers
Créez un dossier pour l'extension et téléchargez tous les fichiers fournis :
- `manifest.json`
- `popup.html`
- `popup.js`
- `content.js`
- `styles.css`
- `background.js`

### 2. Créer les icônes (optionnel)
Créez des icônes PNG de 16x16, 48x48 et 128x128 pixels nommées :
- `icon16.png`
- `icon48.png`
- `icon128.png`

Ou utilisez des icônes temporaires avec un simple carré coloré.

### 3. Installer l'extension dans Chrome

1. Ouvrez Chrome et allez sur `chrome://extensions/`
2. Activez le "Mode développeur" (coin supérieur droit)
3. Cliquez sur "Charger l'extension non empaquetée"
4. Sélectionnez le dossier contenant les fichiers de l'extension
5. L'extension devrait apparaître dans votre liste d'extensions

## ⚙️ Configuration

### 1. Obtenir une clé API Claude
1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com)
2. Générez une clé API (commence par `sk-ant-`)
3. Notez votre clé API

### 2. Obtenir un token GitHub (optionnel)
Requis uniquement pour les repositories privés :
1. Allez sur GitHub → Settings → Developer settings → Personal access tokens
2. Générez un token avec les permissions `repo`
3. Notez votre token

### 3. Configurer l'extension
1. Cliquez sur l'icône