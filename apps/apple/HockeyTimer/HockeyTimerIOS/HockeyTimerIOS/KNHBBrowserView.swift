import SwiftUI
import Foundation
import Combine

struct KNHBOption: Identifiable, Hashable {
    let id: String
    let name: String
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
                                    Text(club.name)
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
                            Text(team.name).tag(String?.some(team.id))
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
                                awayTeam: splitTeams(from: match.title).away
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

    private func splitTeams(from title: String) -> (home: String, away: String) {
        let parts = title.components(separatedBy: " vs ")
        if parts.count == 2 {
            return (parts[0], parts[1])
        }
        return (title, "Away")
    }

    private func parseKNHBDate(_ value: String) -> Date? {
        let iso = ISO8601DateFormatter()
        if let date = iso.date(from: value) {
            return date
        }

        let fallback = DateFormatter()
        fallback.locale = Locale(identifier: "nl_NL")
        fallback.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return fallback.date(from: value)
    }
}

struct KNHBApiClient {
    private let base = "https://publicaties.hockeyweerelt.nl/mc"

    func fetchClubs() async throws -> [KNHBOption] {
        try await fetchOptions(urlString: "\(base)/clubs", preferredNameKeys: ["name", "naam", "clubnaam"])
    }

    func fetchTeams(clubId: String) async throws -> [KNHBOption] {
        try await fetchOptions(
            urlString: "\(base)/clubs/\(clubId)/teams",
            preferredNameKeys: ["name", "naam", "teamnaam"]
        )
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
            guard let id = stringValue(in: dict, keys: ["id", "matchId", "wedstrijdcode"]) else {
                return nil
            }

            let home = stringValue(in: dict, keys: ["homeTeamName", "homeTeam", "thuisteam", "teamhome"]) ?? "Home"
            let away = stringValue(in: dict, keys: ["awayTeamName", "awayTeam", "uitteam", "teamaway"]) ?? "Away"
            let date = stringValue(in: dict, keys: ["date", "datum", "startDateTime", "start"])
                ?? "Date unknown"

            return KNHBUpcomingMatch(id: id, title: "\(home) vs \(away)", subtitle: date)
        }
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
            return KNHBOption(id: id, name: name)
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
}
