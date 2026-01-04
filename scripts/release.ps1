# Release script for Windows PowerShell
param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = 'Stop'

# Navigate to project root (parent of scripts folder)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot
Write-Host "Working from: $projectRoot" -ForegroundColor Gray

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "Error: Version must be in format X.Y.Z (e.g., 1.0.8)" -ForegroundColor Red
    exit 1
}

Write-Host "Releasing version $Version..." -ForegroundColor Cyan

# 1) Require clean working tree (prevents accidental commits of build artifacts)
if (-not [string]::IsNullOrWhiteSpace((git status --porcelain))) {
    Write-Host "Error: Working tree is not clean. Commit or stash changes first." -ForegroundColor Red
    git status --short
    exit 1
}

# 2) Pull latest changes first
Write-Host "Pulling latest changes from remote..." -ForegroundColor Cyan
git pull --rebase

# 3) Update package.json version using Node (more reliable than ConvertFrom-Json for encoding/BOM issues)
Write-Host "Updating package.json to version $Version..." -ForegroundColor Cyan
node -e "const fs=require('fs'); const p='package.json'; const pkg=JSON.parse(fs.readFileSync(p,'utf8')); pkg.version='${Version}'; fs.writeFileSync(p, JSON.stringify(pkg,null,2)+'\n','utf8');"
Write-Host "Updated package.json to version $Version" -ForegroundColor Green

# 4) Update package-lock.json (keep in sync for CI)
Write-Host "Updating package-lock.json..." -ForegroundColor Cyan
npm install --package-lock-only

# 5) Commit ONLY the version bump files (never git add .)
Write-Host "Committing changes..." -ForegroundColor Cyan
git add package.json package-lock.json
git commit -m "Bump version to $Version"

Write-Host "Pushing to remote..." -ForegroundColor Cyan
git push

Write-Host "Creating and pushing tag v$Version..." -ForegroundColor Cyan
git tag "v$Version"
git push origin "v$Version"

Write-Host "`nRelease v$Version initiated!" -ForegroundColor Green
Write-Host "GitHub Actions will now build and publish the release." -ForegroundColor Cyan
Write-Host "Check progress at: https://github.com/sagielka/nogamt-quote-vault/actions" -ForegroundColor Cyan

