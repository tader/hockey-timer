import Foundation

final class WatchMatchViewModel: MatchSyncViewModel {
    init() {
        super.init(
            matchId: "demo-match",
            apiBase: "http://192.168.1.153:8787",
            originPlatform: "watchos",
            deviceIdKey: "hockey_timer_watch_device_id",
            sequenceKey: "hockey_timer_watch_sequence"
        )
    }
}
