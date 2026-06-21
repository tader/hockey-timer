import Foundation

struct WatchMatchFormat: Equatable, Identifiable {
    let id: String
    let label: String
    let periodCount: Int
    let periodDurationSeconds: [Int]

    static func custom(periodCountRaw: String, minutesRaw: String, secondsRaw: String) -> WatchMatchFormat {
        let parsedCount = Int(periodCountRaw) ?? 4
        let parsedMinutes = Int(minutesRaw) ?? 17
        let parsedSeconds = Int(secondsRaw) ?? 30
        let periodCount = min(12, max(1, parsedCount))
        let minutes = min(180, max(0, parsedMinutes))
        let seconds = min(59, max(0, parsedSeconds))
        let duration = max(1, minutes * 60 + seconds)
        return WatchMatchFormat(
            id: "custom-\(periodCount)x\(duration)",
            label: "\(periodCount) x \(formatDuration(duration))",
            periodCount: periodCount,
            periodDurationSeconds: Array(repeating: duration, count: periodCount)
        )
    }

    private static func formatDuration(_ seconds: Int) -> String {
        "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }
}

struct WatchPresentation {
    static let primaryNewMatchFormatLabel = "4 x 17½"

    static let defaultNewMatchFormat = WatchMatchFormat(
        id: "4x17_5",
        label: primaryNewMatchFormatLabel,
        periodCount: 4,
        periodDurationSeconds: Array(repeating: 17 * 60 + 30, count: 4)
    )

    static let newMatchFormats = [
        defaultNewMatchFormat,
        WatchMatchFormat(
            id: "2x20",
            label: "2 x 20",
            periodCount: 2,
            periodDurationSeconds: Array(repeating: 20 * 60, count: 2)
        ),
        WatchMatchFormat(
            id: "2x25",
            label: "2 x 25",
            periodCount: 2,
            periodDurationSeconds: Array(repeating: 25 * 60, count: 2)
        ),
        WatchMatchFormat(
            id: "2x30",
            label: "2 x 30",
            periodCount: 2,
            periodDurationSeconds: Array(repeating: 30 * 60, count: 2)
        ),
        WatchMatchFormat(
            id: "2x35",
            label: "2 x 35",
            periodCount: 2,
            periodDurationSeconds: Array(repeating: 35 * 60, count: 2)
        ),
    ]

    static func timeText(periodDurationSeconds: Int, playedSeconds: Int) -> String {
        let remaining = periodDurationSeconds - playedSeconds
        if remaining >= 0 {
            return format(seconds: remaining)
        }

        return "+\(format(seconds: abs(remaining)))"
    }

    static func isOvertime(periodDurationSeconds: Int, playedSeconds: Int) -> Bool {
        playedSeconds > periodDurationSeconds
    }

    static func periodProgressLabel(currentPeriod: Int, periodCount: Int) -> String {
        "\(currentPeriod)/\(periodCount)"
    }

    static func nextPeriodTitle(currentPeriod: Int, periodCount: Int) -> String {
        let boundedPeriod = min(max(1, currentPeriod), periodCount)
        return "Start \(ordinal(boundedPeriod)) Period"
    }

    private static func format(seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }

    private static func ordinal(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .ordinal
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}
