import Foundation

final class WatchMatchViewModel: MatchSyncViewModel {
    init(isPreview: Bool = false, previewApiBase: String? = nil) {
        if !isPreview {
            AppleApiEndpointSync.shared.start()
        }
        super.init(
            matchId: "demo-match",
            originPlatform: "watchos",
            deviceIdKey: "hockey_timer_watch_device_id",
            sequenceKey: "hockey_timer_watch_sequence",
            apiBaseKey: "hockey_timer_api_base",
            defaultApiBase: "http://192.168.1.153:8787",
            activeMatchIdKey: "hockey_timer_watch_active_match_id",
            isPreview: isPreview,
            previewApiBase: previewApiBase
        )
    }

    static func preview(
        homeScore: Int = 2,
        awayScore: Int = 1,
        isRunning: Bool = false,
        isEnded: Bool = false,
        currentPeriod: Int = 2,
        currentPeriodPlayedSeconds: Int = 8 * 60,
        periodCount: Int = 4,
        periodDurationSeconds: Int = 17 * 60 + 30,
        pendingEventCount: Int = 0,
        runningStartedAt: Date? = nil,
        lastError: String? = nil,
        previewApiBase: String? = nil
    ) -> WatchMatchViewModel {
        let model = WatchMatchViewModel(isPreview: true, previewApiBase: previewApiBase)
        model.seedPreview(
            homeScore: homeScore,
            awayScore: awayScore,
            isRunning: isRunning,
            isEnded: isEnded,
            currentPeriod: currentPeriod,
            currentPeriodPlayedSeconds: currentPeriodPlayedSeconds,
            periodCount: periodCount,
            periodDurationSeconds: periodDurationSeconds,
            pendingEventCount: pendingEventCount,
            runningStartedAt: runningStartedAt,
            lastError: lastError
        )
        return model
    }
}
