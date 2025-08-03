#!/bin/bash

# Setup symlinks for shared files in development
echo "Setting up shared symlinks for development..."

# Remove existing shared directory if it exists
rm -rf shared

# Create shared directory structure
mkdir -p shared/constants shared/utils

# Create symlinks to main app's shared files
ln -sf ../../../../src/shared/constants/studentQuestionColors.ts shared/constants/
ln -sf ../../../../src/shared/constants/studentPollColors.ts shared/constants/
ln -sf ../../../../src/shared/constants/colors.ts shared/constants/
ln -sf ../../../../src/shared/utils/validation.ts shared/utils/

echo "Symlinks created successfully!"
ls -la shared/constants/
ls -la shared/utils/