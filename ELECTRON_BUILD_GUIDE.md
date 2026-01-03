# Building Windows .exe with Auto-Updates

## Prerequisites
- Node.js 18+ installed
- Git installed
- GitHub account with repository created

## Setup Steps

### 1. Export to GitHub
In Lovable, go to Settings → GitHub and connect/create a repository.

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Install project dependencies
npm install

# Install Electron dependencies
npm install --save-dev electron electron-builder
npm install electron-updater
```

### 3. Update package.json
Add these scripts to your `package.json`:
```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "npm run build && electron .",
    "electron:build": "npm run build && electron-builder --win"
  }
}
```

### 4. Configure GitHub for Auto-Updates
1. Update `electron-builder.json`:
   - Replace `YOUR_GITHUB_USERNAME` with your GitHub username
   - Replace `YOUR_REPO_NAME` with your repository name

2. Create a GitHub Personal Access Token:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate a token with `repo` scope
   - Set environment variable: `GH_TOKEN=your_token_here`

### 5. Build the .exe
```bash
# Set your GitHub token (Windows PowerShell)
$env:GH_TOKEN="your_github_token"

# Build the application
npm run electron:build
```

The `.exe` installer will be in the `release` folder.

### 6. Publish Updates (Automated)

Use the release script for error-free releases:

```bash
# Make the script executable (first time only)
chmod +x scripts/release.sh

# Release a new version
./scripts/release.sh 1.0.6
```

The script automatically:
1. Validates version format
2. Updates package.json
3. Syncs package-lock.json
4. Commits and pushes changes
5. Creates and pushes the version tag
6. Triggers GitHub Actions build

### 6b. Publish Updates (Manual)

If you prefer manual releases, follow this checklist **IN ORDER**:

- [ ] 1. Update `version` in `package.json` (e.g., "1.0.5" → "1.0.6")
- [ ] 2. Run `npm install` to sync package-lock.json
- [ ] 3. Commit changes: `git add . && git commit -m "Bump version to 1.0.6"`
- [ ] 4. Push to GitHub: `git push`
- [ ] 5. Wait for push to complete
- [ ] 6. Create tag: `git tag v1.0.6`
- [ ] 7. Push tag: `git push origin v1.0.6`

⚠️ **IMPORTANT**: Never create the tag before pushing the package.json update!

This creates a GitHub Release with the new version. Existing installations will auto-update!

## How Auto-Updates Work
1. App checks GitHub Releases on startup
2. If new version found, downloads in background
3. Installs automatically when app is closed
4. User gets new version on next launch

## Troubleshooting
- **Build fails**: Ensure all dependencies are installed
- **Updates not working**: Verify GH_TOKEN and publish settings
- **App won't start**: Check electron/main.js paths are correct
