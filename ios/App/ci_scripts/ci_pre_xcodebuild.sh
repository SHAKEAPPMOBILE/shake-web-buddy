#!/bin/sh
set -e

# Xcode Cloud pre-xcodebuild script.
# Swift Package Manager (CapApp-SPM) needs node_modules for local Capacitor/RevenueCat packages.
# CI_WORKSPACE can be empty in Xcode Cloud; use CI_PRIMARY_REPOSITORY_PATH or derive from script path.

if [ -n "$CI_PRIMARY_REPOSITORY_PATH" ]; then
  REPO_ROOT="$CI_PRIMARY_REPOSITORY_PATH"
elif [ -n "$CI_WORKSPACE" ]; then
  REPO_ROOT="$CI_WORKSPACE"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

cd "$REPO_ROOT" || exit 1
npm ci

