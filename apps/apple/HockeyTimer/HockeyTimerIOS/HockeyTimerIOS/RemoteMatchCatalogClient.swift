import Foundation

struct RemoteMatchCatalogClient {
    private let defaultApiBase = "http://192.168.1.153:8787"

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
