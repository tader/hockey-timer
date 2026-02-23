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

    static let empty = MatchEventPayload(team: nil, delta: nil, reason: nil)
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
