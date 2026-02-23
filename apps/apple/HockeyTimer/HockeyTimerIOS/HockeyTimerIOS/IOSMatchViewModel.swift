import Foundation

final class IOSMatchViewModel: MatchSyncViewModel {
    init() {
        super.init(
            matchId: "demo-match",
            apiBase: "http://192.168.1.153:8787",
            originPlatform: "ios",
            deviceIdKey: "hockey_timer_ios_device_id",
            sequenceKey: "hockey_timer_ios_sequence"
        )
    }
}
