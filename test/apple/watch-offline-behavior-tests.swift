import Foundation

@main
struct WatchOfflineBehaviorTests {
    static func main() {
        let suffix = UUID().uuidString.lowercased()
        let model = MatchSyncViewModel(
            matchId: "offline-test-\(suffix)",
            originPlatform: "watchos",
            deviceIdKey: "offline-test-device-\(suffix)",
            sequenceKey: "offline-test-sequence-\(suffix)",
            apiBaseKey: "offline-test-api-\(suffix)",
            defaultApiBase: "http://127.0.0.1:1",
            activeMatchIdKey: "offline-test-active-\(suffix)"
        )

        model.createQuickMatch()
        assertEqual(model.homeScore, 0, "new offline match home score")
        assertEqual(model.awayScore, 0, "new offline match away score")
        assertEqual(model.isEnded, false, "new offline match is not ended")
        assertEqual(model.periodCount, 4, "new offline match period count")
        assertEqual(model.periodDurationSeconds, 17 * 60 + 30, "new offline match duration")

        model.incrementHome()
        model.incrementAway()
        model.incrementAway()
        assertEqual(model.homeScore, 1, "home score updates offline")
        assertEqual(model.awayScore, 2, "away score updates offline")

        model.start()
        assertEqual(model.isRunning, true, "clock starts offline")
        assert(model.localCurrentPeriodPlayedSeconds(on: Date().addingTimeInterval(2)) >= 1, "clock advances offline")

        model.pause()
        assertEqual(model.isRunning, false, "clock pauses offline")

        let restored = MatchSyncViewModel(
            matchId: "offline-test-\(suffix)",
            originPlatform: "watchos",
            deviceIdKey: "offline-test-device-\(suffix)",
            sequenceKey: "offline-test-sequence-\(suffix)",
            apiBaseKey: "offline-test-api-\(suffix)",
            defaultApiBase: "http://127.0.0.1:1",
            activeMatchIdKey: "offline-test-active-\(suffix)"
        )
        assertEqual(restored.homeScore, 1, "offline home score persists")
        assertEqual(restored.awayScore, 2, "offline away score persists")
        assertEqual(restored.periodCount, 4, "offline format persists")

        print("watch offline behavior tests passed")
    }

    private static func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ message: String) {
        if actual != expected {
            fatalError("\(message): expected \(expected), got \(actual)")
        }
    }

    private static func assert(_ condition: Bool, _ message: String) {
        if !condition {
            fatalError(message)
        }
    }
}
