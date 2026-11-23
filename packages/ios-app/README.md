# Classroom Timer for iPhone

The native iOS timer targets iOS 17 and uses the design handoff in [PR #303](https://github.com/tinkertanker/classroom-widgets/pull/303).

## Run

Open `ClassroomWidgets.xcodeproj`, select the shared `ClassroomWidgets` scheme and an iPhone Simulator, then press Run. To install on a physical device, select a development team under **Signing & Capabilities**.

## Test

```sh
swift test --package-path packages/ios-app/Core
xcodebuild test \
  -project packages/ios-app/ClassroomWidgets.xcodeproj \
  -scheme ClassroomWidgets \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=NO
```

The Swift package tests countdown state, deadline restoration, duration edits, quick-add limits, end-time selection, notification scheduling delays, and display formatting. The Xcode UI tests exercise full-face focus mode, controls staying visible through a sound sheet, and controls returning at expiry.
