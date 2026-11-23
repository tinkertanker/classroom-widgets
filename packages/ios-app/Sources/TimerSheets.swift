import SwiftUI

private enum TimerSetupTab: String, CaseIterable, Identifiable {
    case duration
    case endAt

    var id: String { rawValue }
    var title: String { self == .duration ? "Duration" : "End at" }
}

struct TimerSetupSheet: View {
    @Environment(\.dismiss) private var dismiss

    let allowsEndAt: Bool
    let onApplyDuration: (TimeInterval) -> Void
    let onApplyEndAt: (ClockTimeSelection) -> Void

    @State private var tab: TimerSetupTab = .duration
    @State private var hours: Int
    @State private var minutes: Int
    @State private var seconds: Int
    @State private var endHour: Int
    @State private var endMinute: Int
    @State private var endPeriod: ClockPeriod
    @State private var previewUpdatedAt = Date()
    @State private var confirmsEndTimeRollover = false

    init(
        initialDuration: TimeInterval,
        allowsEndAt: Bool,
        onApplyDuration: @escaping (TimeInterval) -> Void,
        onApplyEndAt: @escaping (ClockTimeSelection) -> Void
    ) {
        self.allowsEndAt = allowsEndAt
        self.onApplyDuration = onApplyDuration
        self.onApplyEndAt = onApplyEndAt

        let total = min(Int(CountdownTimer.maximumDuration), max(0, Int(ceil(initialDuration))))
        let endSelection = defaultEndTimeSelection()
        _hours = State(initialValue: total / 3_600)
        _minutes = State(initialValue: total % 3_600 / 60)
        _seconds = State(initialValue: total % 60)
        _endHour = State(initialValue: endSelection.hour)
        _endMinute = State(initialValue: endSelection.minute)
        _endPeriod = State(initialValue: endSelection.period)
    }

    private var selectedDuration: TimeInterval {
        TimeInterval(hours * 3_600 + minutes * 60 + seconds)
    }

    private var selectedEndTime: ClockTimeSelection {
        ClockTimeSelection(hour: endHour, minute: endMinute, period: endPeriod)
    }

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                Text(allowsEndAt ? "Set timer" : "Edit remaining")
                    .font(.system(size: 21, weight: .semibold, design: .rounded))
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 34, height: 34)
                        .background(.quaternary, in: Circle())
                }
                .accessibilityLabel("Cancel")
                .accessibilityIdentifier("cancel-timer-setup")
            }

            if allowsEndAt {
                Picker("Set timer mode", selection: $tab) {
                    ForEach(TimerSetupTab.allCases) { option in
                        Text(option.title).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("timer-setup-mode")
            }

            if tab == .duration {
                durationPicker
            } else {
                endAtPicker
            }

            Button(action: applySelection) {
                Text(applyTitle)
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(isApplyDisabled ? TimerColors.muted : TimerColors.sage, in: RoundedRectangle(cornerRadius: 16))
            }
            .disabled(isApplyDisabled)
            .accessibilityIdentifier(tab == .duration ? "apply-duration-button" : "apply-end-at-button")
        }
        .padding(.horizontal, 22)
        .padding(.top, 26)
        .padding(.bottom, 18)
        .presentationDetents([.height(450), .large])
        .presentationDragIndicator(.visible)
        .onChange(of: selectedEndTime) { _, _ in
            previewUpdatedAt = Date()
        }
        .task(id: tab) {
            guard tab == .endAt else { return }
            while !Task.isCancelled {
                previewUpdatedAt = Date()
                do {
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                } catch {
                    return
                }
            }
        }
        .alert("End time has passed", isPresented: $confirmsEndTimeRollover) {
            Button("Use next occurrence") {
                onApplyEndAt(selectedEndTime)
                dismiss()
            }
            Button("Keep editing", role: .cancel) {}
        } message: {
            Text("The selected clock time passed while the preview was showing. Set a countdown to its next occurrence instead?")
        }
    }

    private var durationPicker: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                durationWheel(title: "Hours", identifier: "duration-hours", selection: $hours, range: 0...99)
                durationWheel(title: "Minutes", identifier: "duration-minutes", selection: $minutes, range: 0...59)
                durationWheel(title: "Seconds", identifier: "duration-seconds", selection: $seconds, range: 0...59)
            }
            .frame(height: 208)

            Text("Choose a duration up to 99 hours, 59 minutes, and 59 seconds.")
                .font(.system(size: 12, weight: .regular, design: .rounded))
                .foregroundStyle(TimerColors.secondaryText)
                .multilineTextAlignment(.center)
        }
    }

    private func durationWheel(
        title: String,
        identifier: String,
        selection: Binding<Int>,
        range: ClosedRange<Int>
    ) -> some View {
        Picker(title, selection: selection) {
            ForEach(range, id: \.self) { value in
                Text(String(format: "%02d", value)).tag(value)
            }
        }
        .pickerStyle(.wheel)
        .labelsHidden()
        .accessibilityLabel(title)
        .accessibilityIdentifier(identifier)
        .frame(maxWidth: .infinity)
        .clipped()
    }

    private var endAtPicker: some View {
        VStack(spacing: 10) {
            HStack(spacing: 0) {
                Picker("Hour", selection: $endHour) {
                    ForEach(1...12, id: \.self) { value in
                        Text(String(value)).tag(value)
                    }
                }
                .pickerStyle(.wheel)
                .labelsHidden()
                .accessibilityLabel("Hour")
                .accessibilityIdentifier("end-time-hour")

                Picker("Minute", selection: $endMinute) {
                    ForEach(Array(stride(from: 0, to: 60, by: 5)), id: \.self) { value in
                        Text(String(format: "%02d", value)).tag(value)
                    }
                }
                .pickerStyle(.wheel)
                .labelsHidden()
                .accessibilityLabel("Minute")
                .accessibilityIdentifier("end-time-minute")

                Picker("AM or PM", selection: $endPeriod) {
                    Text("AM").tag(ClockPeriod.am)
                    Text("PM").tag(ClockPeriod.pm)
                }
                .pickerStyle(.wheel)
                .labelsHidden()
                .accessibilityIdentifier("end-time-period")
            }
            .frame(height: 208)

            endAtPreview
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(TimerColors.secondaryText)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("end-time-preview")
        }
    }

    private var endAtPreview: some View {
        let target = nextClockTime(selectedEndTime, after: previewUpdatedAt)
        let label = Calendar.current.isDateInToday(target) ? "Today" : "Tomorrow"
        return Text("\(label) · about \(approximateDuration(target.timeIntervalSince(previewUpdatedAt)))")
    }

    private var applyTitle: String {
        tab == .duration ? "Apply duration" : "Set end time"
    }

    private var isApplyDisabled: Bool {
        tab == .duration && selectedDuration == 0
    }

    private func applySelection() {
        if tab == .duration {
            onApplyDuration(selectedDuration)
            dismiss()
            return
        }

        let now = Date()
        guard !clockTimeOccurrenceRolledOver(selectedEndTime, from: previewUpdatedAt, to: now) else {
            confirmsEndTimeRollover = true
            return
        }

        onApplyEndAt(selectedEndTime)
        dismiss()
    }

    private func approximateDuration(_ interval: TimeInterval) -> String {
        let totalMinutes = max(1, Int(ceil(interval / 60)))
        if totalMinutes < 60 {
            return "\(totalMinutes) min"
        }
        let hours = totalMinutes / 60
        let remainingMinutes = totalMinutes % 60
        return remainingMinutes == 0 ? "\(hours) hr" : "\(hours) hr \(remainingMinutes) min"
    }
}

struct TimerSoundSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var muted: Bool
    @Binding var soundMode: String

    var body: some View {
        VStack(spacing: 24) {
            HStack {
                Text("Sound")
                    .font(.system(size: 21, weight: .semibold, design: .rounded))
                Spacer()
                Button("Done") { dismiss() }
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .accessibilityIdentifier("sound-done-button")
            }

            Toggle(isOn: $muted) {
                Label("Mute", systemImage: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                    .font(.system(size: 16, weight: .medium, design: .rounded))
            }
            .tint(TimerColors.sage)
            .accessibilityIdentifier("mute-sound-toggle")

            Picker("Timer sound length", selection: $soundMode) {
                Text("Short").tag("short")
                Text("Long").tag("long")
            }
            .pickerStyle(.segmented)
            .disabled(muted)
            .accessibilityIdentifier("sound-mode-picker")

            Text("The selected sound plays when the countdown ends.")
                .font(.system(size: 13, weight: .regular, design: .rounded))
                .foregroundStyle(TimerColors.secondaryText)
                .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 0)
        }
        .padding(24)
        .presentationDetents([.height(300), .medium])
        .presentationDragIndicator(.visible)
    }
}

enum TimerColors {
    static let sage = Color(hex: 0x39744C)
    static let muted = Color(hex: 0xA7A39D)
    static let secondaryText = Color(hex: 0x77716A)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: 1
        )
    }
}
