import AVFoundation
import Foundation

@MainActor
final class TimerAudioPlayer {
    private var player: AVAudioPlayer?
    private var lastShortSound: String?
    private let shortSounds = [
        "short-original",
        "glockenspiel",
        "marimba",
        "musicbox",
        "steeldrum",
        "ukulele"
    ]

    func play(mode: String) {
        stop()
        let soundName: String
        if mode == "long" {
            soundName = "long"
        } else {
            let available = shortSounds.filter { $0 != lastShortSound }
            soundName = available.randomElement() ?? shortSounds[0]
            lastShortSound = soundName
        }

        guard let url = Bundle.main.url(forResource: soundName, withExtension: "mp3") else { return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            let nextPlayer = try AVAudioPlayer(contentsOf: url)
            nextPlayer.prepareToPlay()
            nextPlayer.play()
            player = nextPlayer
        } catch {
            player = nil
        }
    }

    func stop() {
        player?.stop()
        player = nil
    }
}
