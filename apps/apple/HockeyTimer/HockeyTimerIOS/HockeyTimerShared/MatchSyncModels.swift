import Foundation

struct MatchProjectionDTO: Decodable {
    let homeScore: Int
    let awayScore: Int
    let isRunning: Bool
    let isEnded: Bool
    let currentPeriod: Int
    let currentPeriodPlayedSeconds: Int
    let format: MatchFormatDTO
}

struct MatchFormatDTO: Decodable {
    let periodCount: Int
    let periodDurationSeconds: [Int]
}

struct MatchEventPayload: Codable {
    let team: String?
    let delta: Int?
    let reason: String?
    let periodCount: Int?
    let periodDurationSeconds: [Int]?

    static let empty = MatchEventPayload(
        team: nil,
        delta: nil,
        reason: nil,
        periodCount: nil,
        periodDurationSeconds: nil
    )

    static func score(team: String, delta: Int, reason: String) -> MatchEventPayload {
        MatchEventPayload(
            team: team,
            delta: delta,
            reason: reason,
            periodCount: nil,
            periodDurationSeconds: nil
        )
    }

    static func format(periodCount: Int, periodDurationSeconds: [Int]) -> MatchEventPayload {
        MatchEventPayload(
            team: nil,
            delta: nil,
            reason: nil,
            periodCount: periodCount,
            periodDurationSeconds: periodDurationSeconds
        )
    }
}

struct MatchEventDTO: Codable {
    let eventId: String
    let matchId: String
    let eventType: String
    let occurredAt: String
    let originDeviceId: String
    let originPlatform: String
    let sequence: Int
    let payload: MatchEventPayload
    let version: Int
}

struct MatchBatchUpsertBody: Codable {
    let events: [MatchEventDTO]
}
