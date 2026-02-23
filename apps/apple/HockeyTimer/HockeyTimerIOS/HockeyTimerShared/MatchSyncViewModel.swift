import Foundation
import Combine

class MatchSyncViewModel: ObservableObject {
    @Published var homeScore: Int = 0
    @Published var awayScore: Int = 0
    @Published var isRunning: Bool = false
    @Published var isEnded: Bool = false
    @Published var currentPeriod: Int = 1
    @Published var currentPeriodPlayedSeconds: Int = 0
    @Published var periodCount: Int = 4
    @Published var periodDurationSeconds: Int = 17 * 60 + 30
    @Published var lastError: String?

    private let matchId: String
    private let apiBase: String
    private let originPlatform: String
    private let deviceIdKey: String
    private let sequenceKey: String

    init(
        matchId: String,
        apiBase: String,
        originPlatform: String,
        deviceIdKey: String,
        sequenceKey: String
    ) {
        self.matchId = matchId
        self.apiBase = apiBase
        self.originPlatform = originPlatform
        self.deviceIdKey = deviceIdKey
        self.sequenceKey = sequenceKey
    }

    var stateLabel: String {
        if isEnded { return "ENDED" }
        return isRunning ? "RUNNING" : "PAUSED"
    }

    var periodLabel: String {
        "P\(currentPeriod)"
    }

    var timeLabel: String {
        let remaining = periodDurationSeconds - currentPeriodPlayedSeconds
        if remaining >= 0 {
            return "\(format(seconds: remaining)) remaining"
        }
        return "+\(format(seconds: abs(remaining))) over"
    }

    func refreshProjection() {
        Task {
            do {
                let projection = try await fetchProjection()
                await MainActor.run {
                    homeScore = projection.homeScore
                    awayScore = projection.awayScore
                    isRunning = projection.isRunning
                    isEnded = projection.isEnded
                    currentPeriod = projection.currentPeriod
                    currentPeriodPlayedSeconds = projection.currentPeriodPlayedSeconds
                    periodCount = projection.format.periodCount
                    let periodIndex = max(0, projection.currentPeriod - 1)
                    periodDurationSeconds = projection.format.periodDurationSeconds.indices.contains(periodIndex)
                        ? projection.format.periodDurationSeconds[periodIndex]
                        : 0
                    lastError = nil
                }
            } catch {
                await MainActor.run {
                    lastError = error.localizedDescription
                }
            }
        }
    }

    func start() { push(eventType: "match.started", payload: .empty) }
    func pause() { push(eventType: "match.paused", payload: .empty) }
    func resume() { push(eventType: "match.resumed", payload: .empty) }
    func endPeriod() { push(eventType: "period.ended", payload: .empty) }
    func endMatch() { push(eventType: "match.ended", payload: .empty) }

    func incrementHome() {
        push(eventType: "score.changed", payload: MatchEventPayload(team: "home", delta: 1, reason: "goal"))
    }

    func incrementAway() {
        push(eventType: "score.changed", payload: MatchEventPayload(team: "away", delta: 1, reason: "goal"))
    }

    func decrementHome() {
        push(eventType: "score.changed", payload: MatchEventPayload(team: "home", delta: -1, reason: "correction"))
    }

    func decrementAway() {
        push(eventType: "score.changed", payload: MatchEventPayload(team: "away", delta: -1, reason: "correction"))
    }

    private func push(eventType: String, payload: MatchEventPayload) {
        Task {
            do {
                try await pushEvent(eventType: eventType, payload: payload)
                refreshProjection()
            } catch {
                await MainActor.run {
                    lastError = error.localizedDescription
                }
            }
        }
    }

    private func pushEvent(eventType: String, payload: MatchEventPayload) async throws {
        guard let url = URL(string: "\(apiBase)/matches/\(matchId)/events:batchUpsert") else {
            return
        }

        let event = MatchEventDTO(
            eventId: UUID().uuidString.lowercased(),
            matchId: matchId,
            eventType: eventType,
            occurredAt: ISO8601DateFormatter().string(from: Date()),
            originDeviceId: deviceId(),
            originPlatform: originPlatform,
            sequence: nextSequence(),
            payload: payload,
            version: 1
        )

        let body = MatchBatchUpsertBody(events: [event])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "MatchSyncViewModel", code: 1, userInfo: [NSLocalizedDescriptionKey: "Event upsert failed"])
        }
    }

    private func fetchProjection() async throws -> MatchProjectionDTO {
        guard let url = URL(string: "\(apiBase)/matches/\(matchId)/projection") else {
            throw NSError(domain: "MatchSyncViewModel", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid projection URL"])
        }

        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "MatchSyncViewModel", code: 3, userInfo: [NSLocalizedDescriptionKey: "Projection fetch failed"])
        }

        return try JSONDecoder().decode(MatchProjectionDTO.self, from: data)
    }

    private func deviceId() -> String {
        if let existing = UserDefaults.standard.string(forKey: deviceIdKey), !existing.isEmpty {
            return existing
        }

        let created = UUID().uuidString.lowercased()
        UserDefaults.standard.set(created, forKey: deviceIdKey)
        return created
    }

    private func nextSequence() -> Int {
        let current = UserDefaults.standard.integer(forKey: sequenceKey)
        let next = current + 1
        UserDefaults.standard.set(next, forKey: sequenceKey)
        return next
    }

    private func format(seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}
