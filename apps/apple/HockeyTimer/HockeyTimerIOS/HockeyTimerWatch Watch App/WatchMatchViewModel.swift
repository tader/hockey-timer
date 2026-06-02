import Foundation

final class WatchMatchViewModel: MatchSyncViewModel {
    init() {
        super.init(
            matchId: "demo-match",
            originPlatform: "watchos",
            deviceIdKey: "hockey_timer_watch_device_id",
            sequenceKey: "hockey_timer_watch_sequence",
            apiBaseKey: "hockey_timer_api_base",
            defaultApiBase: "http://192.168.1.153:8787",
            activeMatchIdKey: "hockey_timer_watch_active_match_id"
        )
    }
}
