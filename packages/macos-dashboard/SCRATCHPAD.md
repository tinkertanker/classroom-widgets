# Native Display shortcut contract

- Display reuses the Show/Dismiss binding values, but owns its registrations independently of teacher inventory. Menus and the launcher still call Show. Equal assigned keys toggle window presence.
- Preserve the legacy Show preference keys. Missing Dismiss inherits Show, including unassignment; freeze that inherited value before editing Show. A stored Dismiss key code of -1 means explicitly unassigned.
- Registration tokens are lifetime-owned objects. Display replacement retains working tokens until the whole replacement succeeds, and reuses an equal Show/Dismiss key instead of registering it twice. Inject the registration closure in tests; do not reserve real global hotkeys.
- Reserve accepted and pending bindings, including saved widgets absent from the current inventory. The startup gate checks new Display assignments against the first real widget defaults before registration.
- Dismiss closes the native window through its existing delegate cleanup. Closing must flush its debounced frame write so immediate reopen restores the latest frame.
- Reset tests exposed a Swift exclusivity trap: evaluate reservations/bindings before mutating `shortcutState`, not inside an argument to its mutating method.
- Native coordinator tests use isolated preferences, synthetic display descriptions and injected capture discovery/permission closures. They create disposable AppKit windows, not the installed app or real capture streams; they require a macOS WindowServer session.
