import Carbon
import Foundation

enum DashboardHotKeyError: Error {
    case installHandler(OSStatus)
    case register(OSStatus)
}

@MainActor
final class DashboardHotKey {
    private static let signature = OSType(0x43574447)
    private let id: UInt32
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private let handler: @MainActor () -> Void

    init(id: UInt32, keyCode: UInt32, modifiers: UInt32, handler: @escaping @MainActor () -> Void) throws {
        self.id = id
        self.handler = handler

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: OSType(kEventHotKeyPressed))
        let callback: EventHandlerUPP = { _, event, userData in
            guard let userData else { return noErr }
            let instance = Unmanaged<DashboardHotKey>.fromOpaque(userData).takeUnretainedValue()

            var hotKeyID = EventHotKeyID()
            let status = GetEventParameter(
                event,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &hotKeyID
            )

            return MainActor.assumeIsolated {
                guard status == noErr,
                      hotKeyID.signature == DashboardHotKey.signature,
                      hotKeyID.id == instance.id
                else {
                    return OSStatus(eventNotHandledErr)
                }

                instance.handler()
                return noErr
            }
        }

        let installStatus = InstallEventHandler(
            GetApplicationEventTarget(),
            callback,
            1,
            &eventType,
            Unmanaged.passUnretained(self).toOpaque(),
            &eventHandler
        )
        guard installStatus == noErr else {
            throw DashboardHotKeyError.installHandler(installStatus)
        }

        let hotKeyID = EventHotKeyID(signature: Self.signature, id: id)
        let registerStatus = RegisterEventHotKey(keyCode, modifiers, hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
        guard registerStatus == noErr else {
            if let eventHandler {
                RemoveEventHandler(eventHandler)
            }
            eventHandler = nil
            throw DashboardHotKeyError.register(registerStatus)
        }
    }

    deinit {
        MainActor.assumeIsolated {
            if let hotKeyRef {
                UnregisterEventHotKey(hotKeyRef)
            }
            if let eventHandler {
                RemoveEventHandler(eventHandler)
            }
        }
    }
}
