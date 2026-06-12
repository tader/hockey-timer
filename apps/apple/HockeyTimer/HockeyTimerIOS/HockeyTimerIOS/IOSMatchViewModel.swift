import Foundation

final class IOSMatchViewModel: MatchSyncViewModel {
    init(
        matchId: String = "demo-match",
        isPreview: Bool = false,
        previewApiBase: String? = nil
    ) {
        super.init(
            matchId: matchId,
            originPlatform: "ios",
            deviceIdKey: "hockey_timer_ios_device_id",
            sequenceKey: "hockey_timer_ios_sequence",
            apiBaseKey: "hockey_timer_api_base",
            defaultApiBase: "http://192.168.1.153:8787",
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
    ) -> IOSMatchViewModel {
        let model = IOSMatchViewModel(isPreview: true, previewApiBase: previewApiBase)
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
