import Foundation

@main
struct WatchPresentationTests {
    static func main() {
        assertEqual(
            WatchPresentation.timeText(periodDurationSeconds: 17 * 60 + 30, playedSeconds: 61),
            "16:29",
            "remaining time formats without suffix"
        )

        assertEqual(
            WatchPresentation.timeText(periodDurationSeconds: 60, playedSeconds: 75),
            "+00:15",
            "overtime formats with plus prefix"
        )

        assertEqual(
            WatchPresentation.isOvertime(periodDurationSeconds: 60, playedSeconds: 75),
            true,
            "overtime flag set after period duration"
        )

        assertEqual(
            WatchPresentation.periodProgressLabel(currentPeriod: 2, periodCount: 4),
            "2/4",
            "period progress label uses current and total periods"
        )

        assertEqual(
            WatchPresentation.nextPeriodTitle(currentPeriod: 2, periodCount: 4),
            "Start 2nd Period",
            "start period title uses current projection period"
        )

        assertEqual(
            WatchPresentation.nextPeriodTitle(currentPeriod: 4, periodCount: 4),
            "Start 4th Period",
            "final period remains startable"
        )

        assertEqual(
            WatchPresentation.primaryNewMatchFormatLabel,
            "4 x 17½",
            "primary quick new-match format is prominent field-hockey default"
        )

        print("watch presentation tests passed")
    }

    private static func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ message: String) {
        if actual != expected {
            fatalError("\(message): expected \(expected), got \(actual)")
        }
    }
}
