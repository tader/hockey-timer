import Foundation

struct RemoteMatchCatalogClient {
    private let defaultApiBase = "http://192.168.1.153:8787"
    private let deviceIdKey = "hockey_timer_ios_device_id"
    private let sequenceKey = "hockey_timer_ios_sequence"

    func fetchMatches() async throws -> [MatchListItem] {
        guard let authorization = AppleApiEndpointSync.shared.currentAuthorizationHeader() else {
            return []
        }

        let apiBase = AppleApiEndpointSync.shared.currentEndpoint(default: defaultApiBase)
        guard let url = URL(string: "\(apiBase)/matches") else {
            throw NSError(domain: "RemoteMatchCatalogClient", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid matches URL"])
        }

        var request = URLRequest(url: url)
        request.addValue(authorization, forHTTPHeaderField: "authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "RemoteMatchCatalogClient", code: 2, userInfo: [NSLocalizedDescriptionKey: "Match catalog fetch failed"])
        }

        let payload = try JSONDecoder().decode(RemoteMatchCatalogResponse.self, from: data)
        return payload.matches.map { $0.matchListItem }
    }

    func publishMetadata(_ match: MatchListItem, eventType: String) async throws {
        guard let authorization = AppleApiEndpointSync.shared.currentAuthorizationHeader() else {
            return
        }

        let apiBase = AppleApiEndpointSync.shared.currentEndpoint(default: defaultApiBase)
        guard let url = URL(string: "\(apiBase)/matches/\(match.id)/events:batchUpsert") else {
            throw NSError(domain: "RemoteMatchCatalogClient", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid metadata URL"])
        }

        let event = MatchEventDTO(
            eventId: UUID().uuidString.lowercased(),
            matchId: match.id,
            eventType: eventType,
            occurredAt: Self.isoString(Date()),
            originDeviceId: deviceId(),
            originPlatform: "ios",
            sequence: nextSequence(),
            payload: .metadata(
                source: match.source,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                matchDateTime: match.matchDateTime.map(Self.isoString),
                clubName: match.clubName,
                teamName: match.teamName,
                knhbMatchId: match.knhbMatchId
            ),
            version: 1
        )
        let body = MatchBatchUpsertBody(events: [event])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "content-type")
        request.addValue(authorization, forHTTPHeaderField: "authorization")
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "RemoteMatchCatalogClient", code: 4, userInfo: [NSLocalizedDescriptionKey: "Match metadata publish failed"])
        }
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

    private static func isoString(_ date: Date) -> String {
        outputFormatter.string(from: date)
    }

    private static let outputFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

private struct RemoteMatchCatalogResponse: Decodable {
    let matches: [RemoteMatchCatalogItem]
}

private struct RemoteMatchCatalogItem: Decodable {
    let id: String
    let source: String?
    let createdAt: String?
    let matchDateTime: String?
    let homeTeam: String?
    let awayTeam: String?
    let clubName: String?
    let teamName: String?
    let knhbMatchId: String?

    var matchListItem: MatchListItem {
        MatchListItem(
            id: id,
            source: source ?? "remote",
            createdAt: Self.parseDate(createdAt) ?? Date(),
            matchDateTime: Self.parseDate(matchDateTime),
            homeTeam: homeTeam?.isEmpty == false ? homeTeam! : "Home",
            awayTeam: awayTeam?.isEmpty == false ? awayTeam! : "Away",
            clubName: clubName,
            teamName: teamName,
            knhbMatchId: knhbMatchId
        )
    }

    private static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        return basicFormatter.date(from: value)
    }

    private static let fractionalFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let basicFormatter = ISO8601DateFormatter()
}
