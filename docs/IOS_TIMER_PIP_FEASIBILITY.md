# iOS timer PiP feasibility

## Recommendation

A floating timer is technically possible without a prerecorded video. Prototype it separately from the regular timer using `AVPictureInPictureController` with an `AVSampleBufferDisplayLayer` content source. Apple supports this path on iOS 15 and later and provides a playback delegate for the system PiP controls.

PiP is a system-managed, movable video window—not a general overlay. The app cannot put arbitrary SwiftUI controls over other apps; while in PiP, the system owns the visible playback controls.

## Proposed prototype

- Keep the existing deadline-based countdown model as the source of truth.
- Render the timer face (digits and ring) into live sample buffers and enqueue them to `AVSampleBufferDisplayLayer`; no generated MP4 is required.
- Connect that layer through `AVPictureInPictureController.ContentSource` and retain the controller for the life of the timer.
- Handle PiP play/pause requests through `AVPictureInPictureSampleBufferPlaybackDelegate`, mapping them to the timer’s pause/resume state. Prototype the system’s skip/timeline controls before deciding whether they should change time or be unavailable for this live timer.
- Start PiP from a clear user action. Apple’s custom-player guidance says not to start PiP programmatically; only consider automatic entry when the inline content is the user’s primary focus.

## Product and platform constraints

- The sample-buffer delegate must report playback state and a time range, and respond to PiP size changes and user playback requests. A timer is live, non-seekable content, so the PiP timeline and skip controls need a deliberate, tested behavior.
- Apple’s custom-player setup guidance calls for configuring the playback audio session and PiP background mode. A timer-only app should validate this requirement on a real device and avoid adding silent audio solely to keep the app alive.
- PiP availability depends on the device and current system context. Test both `isPictureInPictureSupported()` and `isPictureInPicturePossible`; Simulator success alone does not establish real-device or App Review suitability for a silent timer.
- The regular timer already has local expiry notifications, so PiP should remain an optional visual convenience rather than a prerequisite for background expiry alerts.

## Apple references

- [Adopting Picture in Picture in a custom player](https://developer.apple.com/documentation/avkit/adopting-picture-in-picture-in-a-custom-player) — audio/background setup, supported layer sources, explicit user initiation, restoration, and PiP availability.
- [AVPictureInPictureSampleBufferPlaybackDelegate](https://developer.apple.com/documentation/avkit/avpictureinpicturesamplebufferplaybackdelegate) — playback, time-range, skip, paused-state, and render-size callbacks; available on iOS 15+.
- [What’s new in AVKit (WWDC21)](https://developer.apple.com/videos/play/wwdc2021/10290/) — live sample-buffer content sources and the delegate responsibilities for playback controls.
