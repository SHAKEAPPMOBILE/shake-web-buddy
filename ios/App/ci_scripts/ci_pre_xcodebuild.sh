#!/bin/sh
set -e

# Xcode Cloud pre-xcodebuild script.
# Runs from the repository root so we can install JS dependencies.

cd "$CI_WORKSPACE"
npm ci

