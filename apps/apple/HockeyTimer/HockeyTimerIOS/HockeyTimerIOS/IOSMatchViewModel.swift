import Foundation

final class IOSMatchViewModel: MatchSyncViewModel {
    init(matchId: String = "demo-match") {
        super.init(
            matchId: matchId,
            originPlatform: "ios",
            deviceIdKey: "hockey_timer_ios_device_id",
            sequenceKey: "hockey_timer_ios_sequence",
            apiBaseKey: "hockey_timer_api_base",
            defaultApiBase: "http://192.168.1.153:8787"
        )
    }
}
