Faster startup and less background work.

- Web and desktop: load widget code when it is needed rather than loading every widget at startup.
- macOS, Windows and Linux: reuse unchanged compact-widget state snapshots while editing, reducing unnecessary copying and signature work.
- Linux: create never-shown hidden passive widgets only when first shown. Running Timers and Sound Effects stay available in the background; already-created panels are retained when hidden.
- Web sessions: stop redundant activity state requests, send live feedback aggregates only to the teacher, and preserve valid session identity after a rejected join.
- Web activities: retain only the five recent response summaries already shown, without changing response counters, scores, ordering or reset behavior.
