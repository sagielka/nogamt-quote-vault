#!/bin/bash

# Electron Release Script
# This script automates the version bump and tag process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Electron Release Script ===${NC}"

# Check if version argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide a version number${NC}"
    echo "Usage: ./scripts/release.sh 1.0.6"
    exit 1
fi

NEW_VERSION=$1

# Validate version format (simple check for x.y.z)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format. Use semantic versioning (e.g., 1.0.6)${NC}"
    exit 1
fi

echo -e "${GREEN}Releasing version: v${NEW_VERSION}${NC}"

# Step 1: Check for uncommitted changes
echo -e "\n${YELLOW}Step 1: Checking for uncommitted changes...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
    git status --short
    exit 1
fi
echo -e "${GREEN}✓ Working directory is clean${NC}"

# Step 2: Pull latest changes
echo -e "\n${YELLOW}Step 2: Pulling latest changes...${NC}"
git pull origin main || git pull origin master
echo -e "${GREEN}✓ Latest changes pulled${NC}"

# Step 3: Update package.json version
echo -e "\n${YELLOW}Step 3: Updating package.json version to ${NEW_VERSION}...${NC}"

# Use node to update package.json (cross-platform compatible)
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Updated package.json version to ${NEW_VERSION}');
"
echo -e "${GREEN}✓ package.json updated${NC}"

# Step 4: Update package-lock.json
echo -e "\n${YELLOW}Step 4: Updating package-lock.json...${NC}"
npm install --package-lock-only
echo -e "${GREEN}✓ package-lock.json updated${NC}"

# Step 5: Pull latest changes
echo -e "\n${YELLOW}Step 5: Pulling latest changes from remote...${NC}"
git pull --rebase
echo -e "${GREEN}✓ Latest changes pulled${NC}"

# Step 6: Commit the version bump
echo -e "\n${YELLOW}Step 6: Committing version bump...${NC}"
git add package.json package-lock.json
git commit -m "Bump version to ${NEW_VERSION}"
echo -e "${GREEN}✓ Version bump committed${NC}"

# Step 7: Push the commit
echo -e "\n${YELLOW}Step 7: Pushing commit to remote...${NC}"
git push
echo -e "${GREEN}✓ Commit pushed${NC}"

# Step 8: Create and push the tag
echo -e "\n${YELLOW}Step 8: Creating and pushing tag v${NEW_VERSION}...${NC}"
git tag "v${NEW_VERSION}"
git push origin "v${NEW_VERSION}"
echo -e "${GREEN}✓ Tag v${NEW_VERSION} created and pushed${NC}"

echo -e "\n${GREEN}=== Release v${NEW_VERSION} initiated! ===${NC}"
echo -e "GitHub Actions will now build and publish the release."
echo -e "Check progress at: https://github.com/sagielka/nogamt-quote-vault/actions"
echo -e "\nOnce complete, the release will be available at:"
echo -e "https://github.com/sagielka/nogamt-quote-vault/releases/tag/v${NEW_VERSION}"
