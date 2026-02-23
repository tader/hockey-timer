import SwiftUI
import Foundation
import Combine

struct KNHBOption: Identifiable, Hashable {
    let id: String
    let name: String
    let subtitle: String?
    let abbreviation: String?

    var displayName: String {
        if let abbreviation, !abbreviation.isEmpty, (subtitle == nil || subtitle?.isEmpty == true) {
            return abbreviation
        }
        guard let subtitle, !subtitle.isEmpty else { return name }
        return "\(name) (\(subtitle))"
    }
}

struct KNHBUpcomingMatch: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String
}

@MainActor
final class KNHBBrowserViewModel: ObservableObject {
    @Published var clubs: [KNHBOption] = []
    @Published var teams: [KNHBOption] = []
    @Published var matches: [KNHBUpcomingMatch] = []
    @Published var selectedClubId: String?
    @Published var selectedTeamId: String?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let api = KNHBApiClient()

    func loadClubs() {
        Task {
            await runLoading { [self] in
                self.clubs = try await self.api.fetchClubs()
                self.teams = []
                self.matches = []
                self.selectedClubId = nil
                self.selectedTeamId = nil
            }
        }
    }

    func loadTeams() {
        guard let clubId = selectedClubId else { return }
        Task {
            await runLoading { [self] in
                self.teams = try await self.api.fetchTeams(clubId: clubId)
                self.matches = []
                self.selectedTeamId = nil
            }
        }
    }

    func loadMatches() {
        guard let teamId = selectedTeamId else { return }
        Task {
            await runLoading { [self] in
                self.matches = try await self.api.fetchUpcomingMatches(teamId: teamId)
            }
        }
    }

    private func runLoading(_ operation: @escaping () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct KNHBBrowserView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = KNHBBrowserViewModel()
    @State private var clubQuery = ""

    let onSelect: (MatchListItem) -> Void

    var body: some View {
        List {
            Section("1. Club") {
                if model.clubs.isEmpty {
                    Button("Load Clubs") { model.loadClubs() }
                } else {
                    TextField("Search club", text: $clubQuery)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    if clubQuery.isEmpty {
                        Text("Type to filter clubs")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(filteredClubs.prefix(25)) { club in
                            Button {
                                model.selectedClubId = club.id
                            } label: {
                                HStack {
                                    Text(club.displayName)
                                    Spacer()
                                    if model.selectedClubId == club.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.green)
                                    }
                                }
                            }
                        }
                    }

                    Button("Load Teams") { model.loadTeams() }
                        .disabled(model.selectedClubId == nil)
                }
            }

            Section("2. Team") {
                if model.teams.isEmpty {
                    Text("Load teams for a club")
                        .foregroundStyle(.secondary)
                } else {
                    Picker("Select Team", selection: $model.selectedTeamId) {
                        Text("Choose team").tag(String?.none)
                        ForEach(model.teams) { team in
                            Text(team.displayName).tag(String?.some(team.id))
                        }
                    }
                    Button("Load Upcoming Matches") { model.loadMatches() }
                        .disabled(model.selectedTeamId == nil)
                }
            }

            Section("3. Upcoming Match") {
                if model.matches.isEmpty {
                    Text("Load upcoming matches for a team")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(model.matches) { match in
                        Button {
                            let item = MatchListItem(
                                id: "knhb-\(match.id)",
                                source: "knhb",
                                matchDateTime: parseKNHBDate(match.subtitle),
                                homeTeam: splitTeams(from: match.title).home,
                                awayTeam: splitTeams(from: match.title).away,
                                clubName: selectedClubName,
                                teamName: selectedTeamName,
                                knhbMatchId: match.id
                            )
                            onSelect(item)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(match.title)
                                    .foregroundStyle(.primary)
                                Text(match.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            if let errorMessage = model.errorMessage {
                Section("Error") {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }
        }
        .overlay {
            if model.isLoading {
                ProgressView("Loading...")
            }
        }
        .navigationTitle("Import KNHB")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") { dismiss() }
            }
        }
        .onAppear {
            if model.clubs.isEmpty {
                model.loadClubs()
            }
        }
    }

    private var filteredClubs: [KNHBOption] {
        let normalized = clubQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return [] }
        return model.clubs.filter { $0.name.localizedCaseInsensitiveContains(normalized) }
    }

    private var selectedClubName: String? {
        guard let selectedClubId = model.selectedClubId else { return nil }
        let club = model.clubs.first(where: { $0.id == selectedClubId })
        return club?.abbreviation ?? club?.name
    }

    private var selectedTeamName: String? {
        guard let selectedTeamId = model.selectedTeamId else { return nil }
        return model.teams.first(where: { $0.id == selectedTeamId })?.displayName
    }

    private func splitTeams(from title: String) -> (home: String, away: String) {
        let separators = [" – ", " vs ", " VS ", " - ", " tegen "]
        for separator in separators {
            let parts = title.components(separatedBy: separator)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if parts.count == 2 {
                return (parts[0], parts[1])
            }
        }
        return (title, "Away")
    }

    private func parseKNHBDate(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let epochMs = Double(trimmed), epochMs > 10_000_000_000 {
            return Date(timeIntervalSince1970: epochMs / 1000)
        }
        if let epoch = Double(trimmed), epoch > 1_000_000_000 {
            return Date(timeIntervalSince1970: epoch)
        }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: trimmed) {
            return date
        }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: trimmed) {
            return date
        }

        let fallback = DateFormatter()
        fallback.locale = Locale(identifier: "nl_NL")
        let formats = [
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
            "yyyy-MM-dd'T'HH:mm:ssXXXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX",
            "dd-MM-yyyy HH:mm",
            "dd-MM-yyyy HH:mm:ss"
        ]
        for format in formats {
            fallback.dateFormat = format
            if let date = fallback.date(from: trimmed) {
                return date
            }
        }

        if let dateOnly = parseDateOnly(trimmed) {
            return dateOnly
        }
        return nil
    }

    private func parseDateOnly(_ value: String) -> Date? {
        let formats = ["yyyy-MM-dd", "dd-MM-yyyy"]
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)

        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: value) {
                return date
            }
        }

        return nil
    }
}

struct KNHBApiClient {
    private let base = "https://publicaties.hockeyweerelt.nl/mc"

    func fetchClubs() async throws -> [KNHBOption] {
        try await fetchOptions(urlString: "\(base)/clubs", preferredNameKeys: ["name", "naam", "clubnaam"])
    }

    func fetchTeams(clubId: String) async throws -> [KNHBOption] {
        guard let url = URL(string: "\(base)/clubs/\(clubId)/teams") else {
            throw NSError(domain: "KNHBApiClient", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid KNHB URL"])
        }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "KNHBApiClient", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to load KNHB data"])
        }

        return try jsonObjects(from: data).compactMap { dict in
            guard let id = stringValue(in: dict, keys: ["id", "teamId", "code"]) else {
                return nil
            }
            guard let name = stringValue(in: dict, keys: ["name", "naam", "teamnaam"]) else {
                return nil
            }

            let type = firstString(in: dict, keys: ["type", "soort", "discipline", "veldZaal", "veld_zaal", "competitionType"])
            return KNHBOption(id: id, name: name, subtitle: type, abbreviation: nil)
        }
    }

    func fetchUpcomingMatches(teamId: String) async throws -> [KNHBUpcomingMatch] {
        guard let url = URL(string: "\(base)/teams/\(teamId)/matches/upcoming") else {
            throw NSError(domain: "KNHBApiClient", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid KNHB URL"])
        }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "KNHBApiClient", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to load KNHB matches"])
        }

        let objects = try jsonObjects(from: data)
        return objects.compactMap { dict in
            guard let id = firstString(
                in: dict,
                keys: ["id", "matchId", "wedstrijdcode", "wedstrijdnummer", "code"]
            ) else {
                return nil
            }

            let titleCandidate = firstString(
                in: dict,
                keys: ["title", "naam", "name", "omschrijving", "wedstrijd"]
            )
            let parsedTitle = parseTeams(fromDisplay: titleCandidate)

            let home = firstString(
                in: dict,
                keys: [
                    "homeTeamName", "homeTeam", "teamhome", "teamHome", "thuisteam", "thuisTeam",
                    "thuisteamnaam", "home_team_name", "team_thuis", "thuis_team", "home_name",
                    "home", "thuis"
                ]
            ) ?? extractTeamBySide(in: dict, side: "home")
              ?? parsedTitle.home
              ?? "Home"
            let away = firstString(
                in: dict,
                keys: [
                    "awayTeamName", "awayTeam", "teamaway", "teamAway", "uitteam", "uitTeam",
                    "uitteamnaam", "away_team_name", "team_uit", "uit_team", "away_name",
                    "away", "uit"
                ]
            ) ?? extractTeamBySide(in: dict, side: "away")
              ?? parsedTitle.away
              ?? "Away"
            let date = firstString(
                in: dict,
                keys: [
                    "date", "datum", "startDateTime", "start",
                    "starttime", "starttijd", "aanvang", "aanvangstijd",
                    "plannedStart", "beginDateTime", "speeldatum", "datetime"
                ]
            ) ?? "Date unknown"

            return KNHBUpcomingMatch(id: id, title: "\(home) – \(away)", subtitle: date)
        }
    }

    private func parseTeams(fromDisplay display: String?) -> (home: String?, away: String?) {
        guard let display, !display.isEmpty else { return (nil, nil) }

        let separators = [" vs ", " VS ", " - ", " tegen "]
        for separator in separators {
            let parts = display.components(separatedBy: separator)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if parts.count == 2 {
                return (parts[0], parts[1])
            }
        }
        return (nil, nil)
    }

    private func extractTeamBySide(in dict: [String: Any], side: String) -> String? {
        let sideTokens: [String] = side == "home"
            ? ["home", "thuis", "host", "h"]
            : ["away", "uit", "guest", "a"]

        func walk(_ value: Any) -> String? {
            if let array = value as? [Any] {
                for item in array {
                    if let found = walk(item) {
                        return found
                    }
                }
                return nil
            }

            guard let object = value as? [String: Any] else {
                return nil
            }

            if let sideHint = firstString(in: object, keys: ["side", "type", "thuisUit", "thuisuit", "rol", "role"]) {
                let loweredSideHint = sideHint.lowercased()
                if sideTokens.contains(where: loweredSideHint.contains) {
                    if let name = firstString(in: object, keys: ["name", "naam", "teamnaam", "teamName", "omschrijving", "title"]) {
                        return name
                    }
                }
            }

            for (key, nested) in object {
                let loweredKey = key.lowercased()
                if sideTokens.contains(where: loweredKey.contains), let direct = scalarString(from: nested) {
                    return direct
                }
            }

            for nested in object.values {
                if let found = walk(nested) {
                    return found
                }
            }

            return nil
        }

        return walk(dict)
    }

    private func fetchOptions(urlString: String, preferredNameKeys: [String]) async throws -> [KNHBOption] {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "KNHBApiClient", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid KNHB URL"])
        }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "KNHBApiClient", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to load KNHB data"])
        }

        return try jsonObjects(from: data).compactMap { dict in
            guard let id = stringValue(in: dict, keys: ["id", "clubId", "teamId", "code"]) else {
                return nil
            }
            guard let name = stringValue(in: dict, keys: preferredNameKeys) else {
                return nil
            }
            let abbreviation = firstString(in: dict, keys: ["abbreviation", "afkorting", "abbr", "kortenaam"])
            return KNHBOption(id: id, name: name, subtitle: nil, abbreviation: abbreviation)
        }
    }

    private func jsonObjects(from data: Data) throws -> [[String: Any]] {
        let root = try JSONSerialization.jsonObject(with: data)

        if let items = root as? [[String: Any]] {
            return items
        }

        guard let dict = root as? [String: Any] else {
            return []
        }

        for key in ["items", "data", "results", "clubs", "teams", "matches"] {
            if let items = dict[key] as? [[String: Any]] {
                return items
            }
        }

        return []
    }

    private func stringValue(in dict: [String: Any], keys: [String]) -> String? {
        for key in keys {
            if let value = dict[key] as? String, !value.isEmpty {
                return value
            }
            if let value = dict[key] as? Int {
                return String(value)
            }
        }
        return nil
    }

    private func firstString(in dict: [String: Any], keys: [String]) -> String? {
        let lowerKeys = Set(keys.map { $0.lowercased() })
        return recursiveString(in: dict, allowedLowerKeys: lowerKeys)
    }

    private func recursiveString(in value: Any, allowedLowerKeys: Set<String>) -> String? {
        if let dict = value as? [String: Any] {
            for (key, nested) in dict {
                if allowedLowerKeys.contains(key.lowercased()) {
                    if let string = scalarString(from: nested) {
                        return string
                    }
                }
            }
            for (_, nested) in dict {
                if let found = recursiveString(in: nested, allowedLowerKeys: allowedLowerKeys) {
                    return found
                }
            }
            return nil
        }

        if let array = value as? [Any] {
            for nested in array {
                if let found = recursiveString(in: nested, allowedLowerKeys: allowedLowerKeys) {
                    return found
                }
            }
        }
        return nil
    }

    private func scalarString(from value: Any) -> String? {
        if let string = value as? String, !string.isEmpty {
            return string
        }
        if let int = value as? Int {
            return String(int)
        }
        if let number = value as? NSNumber {
            return number.stringValue
        }
        if let nested = value as? [String: Any] {
            for key in ["name", "naam", "teamnaam", "omschrijving", "label", "value", "text"] {
                if let direct = nested[key] as? String, !direct.isEmpty {
                    return direct
                }
            }
        }
        return nil
    }
}
