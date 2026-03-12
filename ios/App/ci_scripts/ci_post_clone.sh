#!/bin/sh
set -e

# Install Homebrew if needed
which brew || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node if needed  
which node || brew install node

# Go to repo root and install dependencies
cd "$CI_WORKSPACE_PATH"
npm install

# Sync Capacitor
npx cap sync ios

