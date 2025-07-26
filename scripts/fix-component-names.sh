#!/bin/bash

# Script to rename component files to follow PascalCase convention
# This is safe because TypeScript imports are case-sensitive

echo "Renaming component files to PascalCase..."

# List of files to rename
declare -A renames=(
  ["src/components/list/list.tsx"]="src/components/list/List.tsx"
  ["src/components/poll/poll.tsx"]="src/components/poll/Poll.tsx"
  ["src/components/randomiser/randomiser.tsx"]="src/components/randomiser/Randomiser.tsx"
  ["src/components/timer/timer.tsx"]="src/components/timer/Timer.tsx"
  ["src/components/trafficLight/trafficLight.tsx"]="src/components/trafficLight/TrafficLight.tsx"
  ["src/components/volumeLevel/volumeLevel.tsx"]="src/components/volumeLevel/VolumeLevel.tsx"
  ["src/components/shortenLink/shortenLink.tsx"]="src/components/shortenLink/ShortenLink.tsx"
  ["src/components/textBanner/textBanner.tsx"]="src/components/textBanner/TextBanner.tsx"
  ["src/components/imageDisplay/imageDisplay.tsx"]="src/components/imageDisplay/ImageDisplay.tsx"
  ["src/components/soundEffects/soundEffects.tsx"]="src/components/soundEffects/SoundEffects.tsx"
  ["src/components/sticker/sticker.tsx"]="src/components/sticker/Sticker.tsx"
  ["src/components/qrcode/qrcode.tsx"]="src/components/qrcode/QRCode.tsx"
  ["src/components/rtFeedback/rtFeedback.tsx"]="src/components/rtFeedback/RTFeedback.tsx"
  ["src/components/taskCue/taskCue.tsx"]="src/components/taskCue/TaskCue.tsx"
)

# Rename each file
for old_name in "${!renames[@]}"; do
  new_name="${renames[$old_name]}"
  if [ -f "$old_name" ]; then
    echo "Renaming: $old_name -> $new_name"
    git mv "$old_name" "$new_name"
  else
    echo "File not found: $old_name"
  fi
done

echo "Done! Don't forget to update the index.tsx files in each component folder."