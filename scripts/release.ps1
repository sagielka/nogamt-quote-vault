# Release script for Windows PowerShell
param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "Error: Version must be in format X.Y.Z (e.g., 1.0.8)" -ForegroundColor Red
    exit 1
}

Write-Host "Releasing version $Version..." -ForegroundColor Cyan

# Update package.json version
$packageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 100 | Set-Content -Path "package.json" -Encoding UTF8

Write-Host "Updated package.json to version $Version" -ForegroundColor Green

# Run npm install to update package-lock.json
Write-Host "Updating package-lock.json..." -ForegroundColor Cyan
npm install

# Git operations
Write-Host "Committing changes..." -ForegroundColor Cyan
git add .
git commit -m "Bump version to $Version"

Write-Host "Pushing to remote..." -ForegroundColor Cyan
git push

Write-Host "Creating and pushing tag v$Version..." -ForegroundColor Cyan
git tag "v$Version"
git push origin "v$Version"

Write-Host "`nRelease v$Version initiated!" -ForegroundColor Green
Write-Host "GitHub Actions will now build and publish the release." -ForegroundColor Cyan
Write-Host "Check progress at: https://github.com/sagielka/nogamt-quote-vault/actions" -ForegroundColor Cyan
