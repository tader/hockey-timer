import Foundation

struct WatchPresentation {
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
