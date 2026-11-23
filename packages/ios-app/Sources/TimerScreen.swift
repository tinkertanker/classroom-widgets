import SwiftUI
import UIKit

@MainActor
struct TimerScreen: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("classroom.timer.sound-mode") private var soundMode = "short"
    @AppStorage("classroom.timer.muted") private var isMuted = false

    @State private var timer: CountdownTimer
    @State private var notifications = TimerNotificationScheduler()
    @State private var audioPlayer = TimerAudioPlayer()
    @State private var activeSheet: ActiveSheet?
    @State private var controlsVisible = true
    @State private var lastInteraction = Date()
    @State private var backgroundedSinceLastActive = false
    @State private var runnerStartedAt = Date()
    @State private var didHandleCompletion = false

    private let quickAdds: [QuickAddOption] = [
        QuickAddOption(seconds: 60, label: "+1 min"),
        QuickAddOption(seconds: 120, label: "+2 min"),
        QuickAddOption(seconds: 300, label: "+5 min")
    ]

    init() {
        if ProcessInfo.processInfo.arguments.contains("--ui-testing") {
            UserDefaults.standard.removeObject(forKey: TimerPersistence.key)
            UserDefaults.standard.removeObject(forKey: "classroom.timer.sound-mode")
            UserDefaults.standard.removeObject(forKey: "classroom.timer.muted")
        }
        _timer = State(initialValue: CountdownTimer(snapshot: TimerPersistence.load()))
    }

    private var isDark: Bool { colorScheme == .dark }
    private var canvas: Color { isDark ? Color(hex: 0x171715) : Color(hex: 0xFDFCFB) }
    private var card: Color { isDark ? Color(hex: 0x242320) : Color(hex: 0xF5F3F0) }
    private var track: Color { isDark ? Color(hex: 0x3C3934) : Color(hex: 0xE8E5E0) }
    private var primaryText: Color { isDark ? Color(hex: 0xF4F1EC) : Color(hex: 0x2D2926) }
    private var secondaryText: Color { isDark ? Color(hex: 0xB9B3AA) : Color(hex: 0x77716A) }
    private var sage: Color { isDark ? Color(hex: 0x6EA77C) : TimerColors.sage }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                canvas.ignoresSafeArea()

                if timer.isRunning && !controlsVisible {
                    focusView(in: geometry.size)
                        .transition(reduceMotion ? .identity : .opacity)
                } else {
                    timerControls(in: geometry.size)
                        .transition(reduceMotion ? .identity : .opacity)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .simultaneousGesture(TapGesture().onEnded { _ in registerInteraction() })
            .sheet(item: $activeSheet) { sheet in
                switch sheet {
                case .setup:
                    TimerSetupSheet(
                        initialDuration: timer.state == .paused ? timer.remaining : timer.duration,
                        allowsEndAt: timer.state == .ready,
                        onApplyDuration: applyDuration,
                        onApplyEndAt: applyEndTime
                    )
                    .preferredColorScheme(colorScheme)
                case .sound:
                    TimerSoundSheet(muted: $isMuted, soundMode: $soundMode)
                        .preferredColorScheme(colorScheme)
                }
            }
            .onAppear(perform: onAppear)
            .onChange(of: timer.revision) { _, _ in persistAndSchedule() }
            .onChange(of: timer.state) { _, state in
                if state != .running {
                    controlsVisible = true
                }
                if state == .finished {
                    completeTimer(playSound: !backgroundedSinceLastActive)
                }
            }
            .onChange(of: isMuted) { _, muted in
                if muted { audioPlayer.stop() }
                persistAndSchedule()
            }
            .onChange(of: scenePhase) { _, phase in
                handleScenePhase(phase)
            }
            .task {
                await updateTimerAndFocusUntilCancelled()
            }
        }
    }

    private func focusView(in size: CGSize) -> some View {
        let dialSize = min(360, min(size.width - 32, size.height - 32))
        return Button {
            registerInteraction()
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                controlsVisible = true
            }
        } label: {
            TimerDial(
                size: dialSize,
                remaining: timer.remaining,
                progress: timer.progress,
                state: timer.state,
                startedAt: runnerStartedAt,
                reduceMotion: reduceMotion,
                card: card,
                track: track,
                primaryText: primaryText,
                secondaryText: secondaryText
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(timer.state.title), \(timerDisplayText(for: timer.remaining))")
        .accessibilityHint("Tap to show timer controls. The countdown keeps running.")
        .accessibilityIdentifier("focus-countdown")
    }

    private func timerControls(in size: CGSize) -> some View {
        let dialSize = min(304, min(size.width - 48, size.height * 0.42))
        return VStack(spacing: 0) {
            header
                .padding(.top, 7)

            Spacer(minLength: 12)

            TimerDial(
                size: dialSize,
                remaining: timer.remaining,
                progress: timer.progress,
                state: timer.state,
                startedAt: runnerStartedAt,
                reduceMotion: reduceMotion,
                card: card,
                track: track,
                primaryText: primaryText,
                secondaryText: secondaryText
            )

            Spacer(minLength: 16)

            if timer.state != .finished {
                quickAddRow
                    .padding(.bottom, 14)
            }

            actionRows
                .padding(.bottom, 10)
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .frame(minHeight: 0)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("CLASSROOM WIDGETS")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .tracking(1.5)
                    .foregroundStyle(secondaryText)
                Text("Timer")
                    .font(.system(size: 28, weight: .semibold, design: .rounded))
                    .foregroundStyle(primaryText)
            }

            Spacer()

            Button {
                registerInteraction()
                activeSheet = .sound
            } label: {
                Image(systemName: isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(isMuted ? Color(hex: 0xB85D5D) : secondaryText)
                    .frame(width: 48, height: 48)
                    .background(card, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Sound settings")
            .accessibilityIdentifier("sound-settings-button")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var quickAddRow: some View {
        HStack(spacing: 10) {
            ForEach(quickAdds) { option in
                Button {
                    registerInteraction()
                    timer.addTime(option.seconds)
                } label: {
                    Text(option.label)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(primaryText)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(card, in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(!timer.canAddTime(option.seconds))
                .opacity(timer.canAddTime(option.seconds) ? 1 : 0.42)
                .accessibilityLabel("Add \(Int(option.seconds / 60)) minute\(option.seconds == 60 ? "" : "s")")
                .accessibilityIdentifier("quick-add-\(Int(option.seconds / 60))")
            }
        }
    }

    @ViewBuilder
    private var actionRows: some View {
        switch timer.state {
        case .ready:
            HStack(spacing: 10) {
                primaryButton(title: "Start", symbol: "play.fill", identifier: "start-button", action: startTimer)
                secondaryButton(title: "Set time", symbol: "clock", identifier: "set-time-button") {
                    registerInteraction()
                    activeSheet = .setup
                }
            }
        case .running:
            HStack(spacing: 10) {
                primaryButton(title: "Pause", symbol: "pause.fill", identifier: "pause-button") {
                    registerInteraction()
                    timer.pause()
                }
                secondaryButton(title: "Restart", symbol: "arrow.counterclockwise", identifier: "restart-button", action: restartTimer)
            }
        case .paused:
            VStack(spacing: 10) {
                HStack(spacing: 10) {
                    primaryButton(title: "Resume", symbol: "play.fill", identifier: "resume-button", action: resumeTimer)
                    secondaryButton(title: "Restart", symbol: "arrow.counterclockwise", identifier: "restart-button", action: restartTimer)
                }
                secondaryButton(title: "Edit remaining", symbol: "clock", identifier: "edit-remaining-button") {
                    registerInteraction()
                    activeSheet = .setup
                }
            }
        case .finished:
            primaryButton(title: "Restart", symbol: "arrow.counterclockwise", identifier: "restart-button", action: restartTimer)
        }
    }

    private func primaryButton(
        title: String,
        symbol: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            Label(title, systemImage: symbol)
                .font(.system(size: 17, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(sage, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func secondaryButton(
        title: String,
        symbol: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            Label(title, systemImage: symbol)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(primaryText)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(card, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func startTimer() {
        registerInteraction()
        didHandleCompletion = false
        runnerStartedAt = Date()
        timer.start()
    }

    private func resumeTimer() {
        registerInteraction()
        didHandleCompletion = false
        runnerStartedAt = Date()
        timer.resume()
    }

    private func restartTimer() {
        registerInteraction()
        didHandleCompletion = false
        audioPlayer.stop()
        timer.restart()
    }

    private func applyDuration(_ duration: TimeInterval) {
        registerInteraction()
        if timer.state == .paused {
            timer.editRemaining(duration)
        } else {
            timer.setDuration(duration)
        }
    }

    private func applyEndTime(_ selection: ClockTimeSelection) {
        registerInteraction()
        let target = nextClockTime(selection, after: Date())
        let duration = ceil(target.timeIntervalSinceNow)
        timer.setDuration(min(CountdownTimer.maximumDuration, duration))
    }

    private func registerInteraction() {
        lastInteraction = Date()
        if timer.isRunning && !controlsVisible {
            controlsVisible = true
        }
    }

    private func onAppear() {
        lastInteraction = Date()
        TimerPersistence.save(timer.snapshot)
        if timer.isRunning {
            scheduleNotification()
        } else if timer.isFinished {
            didHandleCompletion = true
            notifications.cancel()
        }
    }

    private func persistAndSchedule() {
        TimerPersistence.save(timer.snapshot)
        if timer.isRunning {
            scheduleNotification()
        } else {
            notifications.cancel()
        }
    }

    private func scheduleNotification() {
        guard let deadline = timer.snapshot.deadline else { return }
        notifications.schedule(deadline: deadline, muted: isMuted)
    }

    private func handleScenePhase(_ phase: ScenePhase) {
        if phase == .background {
            backgroundedSinceLastActive = true
            return
        }
        guard phase == .active else { return }

        if timer.update() {
            completeTimer(playSound: false)
        } else if timer.isRunning {
            backgroundedSinceLastActive = false
            scheduleNotification()
        } else {
            backgroundedSinceLastActive = false
        }
        controlsVisible = true
    }

    private func completeTimer(playSound: Bool) {
        guard !didHandleCompletion else { return }
        didHandleCompletion = true
        notifications.cancel()
        controlsVisible = true
        UIAccessibility.post(notification: .announcement, argument: "Time’s up!")
        if playSound && !isMuted {
            audioPlayer.play(mode: soundMode)
        }
        backgroundedSinceLastActive = false
    }

    private func updateTimerAndFocusUntilCancelled() async {
        while !Task.isCancelled {
            if scenePhase == .active {
                let didFinish = timer.update()
                if didFinish {
                    completeTimer(playSound: !backgroundedSinceLastActive)
                }

                if timer.isRunning && controlsVisible && Date().timeIntervalSince(lastInteraction) >= 5 {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) {
                        controlsVisible = false
                    }
                }
            }

            do {
                try await Task.sleep(nanoseconds: 1_000_000_000)
            } catch {
                return
            }
        }
    }
}

private enum ActiveSheet: String, Identifiable {
    case setup
    case sound

    var id: String { rawValue }
}

private struct QuickAddOption: Identifiable {
    let seconds: TimeInterval
    let label: String
    var id: TimeInterval { seconds }
}

private enum TimerPersistence {
    static let key = "classroom.timer.snapshot"

    static func load() -> CountdownSnapshot? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(CountdownSnapshot.self, from: data)
    }

    static func save(_ snapshot: CountdownSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}

private struct TimerDial: View {
    let size: CGFloat
    let remaining: TimeInterval
    let progress: Double
    let state: CountdownState
    let startedAt: Date
    let reduceMotion: Bool
    let card: Color
    let track: Color
    let primaryText: Color
    let secondaryText: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(card)
                .shadow(color: .black.opacity(0.045), radius: 18, y: 7)

            Circle()
                .stroke(track, lineWidth: 9)

            if progress > 0 {
                Circle()
                    .trim(from: 0, to: CGFloat(progress))
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color(hex: 0xB84040),
                                Color(hex: 0xB86538),
                                Color(hex: 0xAE6C13),
                                Color(hex: 0x39744C),
                                Color(hex: 0x4759A0),
                                Color(hex: 0x7657A0)
                            ],
                            startPoint: .bottomLeading,
                            endPoint: .topTrailing
                        ),
                        style: StrokeStyle(lineWidth: 9, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
            }

            VStack(spacing: 8) {
                Text(state.title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .tracking(0.3)
                    .foregroundStyle(state == .finished ? Color(hex: 0xB85D5D) : secondaryText)
                    .accessibilityLabel(state.title)
                    .accessibilityIdentifier(state == .finished ? "timer-finished" : "timer-state")

                Text(timerDisplayText(for: remaining))
                    .font(.system(size: remaining >= 3_600 ? 52 : 76, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(primaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.45)
                    .accessibilityLabel(timerDisplayText(for: remaining))
                    .accessibilityIdentifier("timer-countdown")
            }
            .padding(.horizontal, 36)

            if state == .running && !reduceMotion {
                HamsterRunner(progress: progress, startedAt: startedAt, size: size)
                    .accessibilityHidden(true)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .contain)
    }
}

private struct HamsterRunner: View {
    let progress: Double
    let startedAt: Date
    let size: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
            let angle = -context.date.timeIntervalSince(startedAt) * 120
            let radians = (angle - 90) * .pi / 180
            let radius = size * 0.37
            let centerX = size / 2 + CGFloat(cos(radians)) * radius
            let centerY = size / 2 + CGFloat(sin(radians)) * radius
            let art = isOnColoredArc(angle: angle, progress: progress) ? "HamsterCalm" : "HamsterShocked"

            Image(art)
                .resizable()
                .scaledToFit()
                .frame(width: 48, height: 42)
                .rotationEffect(.degrees(angle))
                .position(x: centerX, y: centerY)
                .frame(width: size, height: size)
        }
        .frame(width: size, height: size)
        .allowsHitTesting(false)
    }

    private func isOnColoredArc(angle: Double, progress: Double) -> Bool {
        if progress <= 0 { return false }
        if progress >= 0.9999 { return true }

        var angleInArcCoordinates = (angle - 90).truncatingRemainder(dividingBy: 360)
        if angleInArcCoordinates < 0 {
            angleInArcCoordinates += 360
        }
        var angleFromStart = angleInArcCoordinates - 270
        if angleFromStart < 0 {
            angleFromStart += 360
        }
        return angleFromStart <= progress * 360
    }
}

private extension CountdownState {
    var title: String {
        switch self {
        case .ready: "Ready"
        case .running: "Running"
        case .paused: "Paused"
        case .finished: "Time’s up!"
        }
    }
}
