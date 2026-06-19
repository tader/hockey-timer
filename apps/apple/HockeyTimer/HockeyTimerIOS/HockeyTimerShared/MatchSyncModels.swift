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
    let source: String?
    let homeTeam: String?
    let awayTeam: String?
    let matchDateTime: String?
    let clubName: String?
    let location: String?
    let teamName: String?
    let knhbMatchId: String?

    init(
        team: String? = nil,
        delta: Int? = nil,
        reason: String? = nil,
        periodCount: Int? = nil,
        periodDurationSeconds: [Int]? = nil,
        source: String? = nil,
        homeTeam: String? = nil,
        awayTeam: String? = nil,
        matchDateTime: String? = nil,
        clubName: String? = nil,
        location: String? = nil,
        teamName: String? = nil,
        knhbMatchId: String? = nil
    ) {
        self.team = team
        self.delta = delta
        self.reason = reason
        self.periodCount = periodCount
        self.periodDurationSeconds = periodDurationSeconds
        self.source = source
        self.homeTeam = homeTeam
        self.awayTeam = awayTeam
        self.matchDateTime = matchDateTime
        self.clubName = clubName
        self.location = location
        self.teamName = teamName
        self.knhbMatchId = knhbMatchId
    }

    static let empty = MatchEventPayload()

    static func score(team: String, delta: Int, reason: String) -> MatchEventPayload {
        MatchEventPayload(
            team: team,
            delta: delta,
            reason: reason
        )
    }

    static func format(periodCount: Int, periodDurationSeconds: [Int]) -> MatchEventPayload {
        MatchEventPayload(
            periodCount: periodCount,
            periodDurationSeconds: periodDurationSeconds
        )
    }

    static func metadata(
        source: String,
        homeTeam: String,
        awayTeam: String,
        matchDateTime: String?,
        clubName: String?,
        teamName: String?,
        knhbMatchId: String?
    ) -> MatchEventPayload {
        MatchEventPayload(
            source: source,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            matchDateTime: matchDateTime,
            clubName: clubName,
            location: clubName,
            teamName: teamName,
            knhbMatchId: knhbMatchId
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
