import SwiftUI

struct MatchListItem: Identifiable, Codable, Hashable {
    let id: String
    let source: String
    let createdAt: Date
    let matchDateTime: Date?
    let homeTeam: String
    let awayTeam: String
    let clubName: String?
    let teamName: String?
    let knhbMatchId: String?

    var title: String {
        "\(homeTeam) – \(awayTeam)"
    }

    var subtitle: String {
        var parts: [String] = []
        if let matchDateTime {
            parts.append(MatchDateFormatters.display(matchDateTime))
        }
        if let clubName, !clubName.isEmpty {
            parts.append(clubName)
        }
        if let teamName, !teamName.isEmpty {
            parts.append(teamName)
        }
        if parts.isEmpty {
            return "No metadata"
        }
        return parts.joined(separator: " • ")
    }

    init(
        id: String,
        source: String,
        createdAt: Date = Date(),
        matchDateTime: Date? = nil,
        homeTeam: String,
        awayTeam: String,
        clubName: String? = nil,
        teamName: String? = nil,
        knhbMatchId: String? = nil
    ) {
        self.id = id
        self.source = source
        self.createdAt = createdAt
        self.matchDateTime = matchDateTime
        self.homeTeam = homeTeam
        self.awayTeam = awayTeam
        self.clubName = clubName
        self.teamName = teamName
        self.knhbMatchId = knhbMatchId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        source = (try? container.decode(String.self, forKey: .source)) ?? "local"
        createdAt = (try? container.decode(Date.self, forKey: .createdAt)) ?? Date()
        matchDateTime = try? container.decode(Date.self, forKey: .matchDateTime)
        clubName = try? container.decode(String.self, forKey: .clubName)
        teamName = try? container.decode(String.self, forKey: .teamName)
        knhbMatchId = try? container.decode(String.self, forKey: .knhbMatchId)

        if let home = try? container.decode(String.self, forKey: .homeTeam),
           let away = try? container.decode(String.self, forKey: .awayTeam) {
            homeTeam = home
            awayTeam = away
            return
        }

        let legacyContainer = try decoder.container(keyedBy: LegacyCodingKeys.self)
        let legacyTitle = (try? legacyContainer.decode(String.self, forKey: .title)) ?? "Home vs Away"
        let split = legacyTitle.components(separatedBy: " vs ")
        if split.count == 2 {
            homeTeam = split[0]
            awayTeam = split[1]
        } else {
            homeTeam = legacyTitle
            awayTeam = "Away"
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case source
        case createdAt
        case matchDateTime
        case homeTeam
        case awayTeam
        case clubName
        case teamName
        case knhbMatchId
    }

    private enum LegacyCodingKeys: String, CodingKey {
        case title
    }
}

enum MatchListSheet: String, Identifiable {
    case custom
    case knhb

    var id: String { rawValue }
}

struct MatchListView: View {
    @State private var matches: [MatchListItem]
    @State private var activeSheet: MatchListSheet?
    @State private var filterHome = ""
    @State private var filterAway = ""
    @State private var filterClub = ""
    @State private var filterTeam = ""
    @State private var syncMessage = ""
    private let hasInjectedMatches: Bool
    private let persistenceEnabled: Bool

    init(
        matches: [MatchListItem]? = nil,
        persistenceEnabled: Bool = true
    ) {
        _matches = State(initialValue: matches ?? [])
        hasInjectedMatches = matches != nil
        self.persistenceEnabled = persistenceEnabled
    }

    var body: some View {
        List {
            Section("Account") {
                AppleAuthAccountView()
                if !syncMessage.isEmpty {
                    Text(syncMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Filters") {
                TextField("Home team", text: $filterHome)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Away team", text: $filterAway)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Club", text: $filterClub)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Team", text: $filterTeam)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }

            Section("Public Matches") {
                ForEach(filteredAndSortedMatches) { match in
                    NavigationLink {
                        MatchDetailView(
                            match: match,
                            model: persistenceEnabled ? nil : IOSMatchViewModel.preview(),
                            persistsMetadata: persistenceEnabled
                        ) { updated in
                            if persistenceEnabled {
                                matches = MatchStore.shared.load()
                            } else {
                                upsertInMemory(updated)
                            }
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(match.title)
                                .font(.headline)
                            Text(match.subtitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Hockey Timer")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu("Add Match") {
                    Button("Custom Match") {
                        activeSheet = .custom
                    }
                    Button("Import KNHB") {
                        activeSheet = .knhb
                    }
                }
            }
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .custom:
                NavigationStack {
                    MatchMetadataEditorView(
                        title: "New Match",
                        match: persistenceEnabled
                            ? MatchListItem(
                                id: "custom-\(UUID().uuidString.lowercased())",
                                source: "custom",
                                homeTeam: "Home",
                                awayTeam: "Away"
                            )
                            : IOSPreviewFixtures.matches[0]
                    ) { created in
                        if persistenceEnabled {
                            MatchStore.shared.upsert(created)
                            matches = MatchStore.shared.load()
                        } else {
                            upsertInMemory(created)
                        }
                        activeSheet = nil
                    }
                }
            case .knhb:
                NavigationStack {
                    KNHBBrowserView(
                        model: persistenceEnabled ? nil : KNHBBrowserViewModel.preview(),
                        initialFavorites: persistenceEnabled ? nil : [IOSPreviewFixtures.favorite],
                        usesFavoriteStore: persistenceEnabled,
                        automaticallyLoadsClubs: persistenceEnabled
                    ) { imported in
                        if persistenceEnabled {
                            MatchStore.shared.upsert(imported)
                            matches = MatchStore.shared.load()
                        } else {
                            upsertInMemory(imported)
                        }
                        activeSheet = nil
                    }
                }
            }
        }
        .onAppear {
            if persistenceEnabled && !hasInjectedMatches {
                matches = MatchStore.shared.load()
                refreshRemoteMatches()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: AppleApiEndpointSync.authStateDidChange)) { _ in
            refreshRemoteMatches()
        }
    }

    private func refreshRemoteMatches() {
        guard persistenceEnabled else { return }
        guard AppleApiEndpointSync.shared.currentAuthorizationHeader() != nil else {
            syncMessage = "Signed out. Showing local matches."
            return
        }

        syncMessage = "Loading signed-in matches..."
        Task {
            do {
                let remoteMatches = try await RemoteMatchCatalogClient().fetchMatches()
                await MainActor.run {
                    MatchStore.shared.merge(remoteMatches)
                    matches = MatchStore.shared.load()
                    syncMessage = remoteMatches.isEmpty
                        ? "No signed-in matches found."
                        : "Loaded \(remoteMatches.count) signed-in matches."
                }
            } catch {
                await MainActor.run {
                    syncMessage = error.localizedDescription
                }
            }
        }
    }

    private func upsertInMemory(_ match: MatchListItem) {
        if let index = matches.firstIndex(where: { $0.id == match.id }) {
            matches[index] = match
        } else {
            matches.append(match)
        }
    }

    private var filteredAndSortedMatches: [MatchListItem] {
        matches
            .filter { match in
                (filterHome.isEmpty || match.homeTeam.localizedCaseInsensitiveContains(filterHome))
                && (filterAway.isEmpty || match.awayTeam.localizedCaseInsensitiveContains(filterAway))
                && (filterClub.isEmpty || (match.clubName ?? "").localizedCaseInsensitiveContains(filterClub))
                && (filterTeam.isEmpty || (match.teamName ?? "").localizedCaseInsensitiveContains(filterTeam))
            }
            .sorted { lhs, rhs in
                let leftDate = lhs.matchDateTime ?? lhs.createdAt
                let rightDate = rhs.matchDateTime ?? rhs.createdAt
                return leftDate > rightDate
            }
    }
}

final class MatchStore {
    static let shared = MatchStore()

    private let key = "hockey_timer_ios_matches"
    private let defaults = UserDefaults.standard

    func load() -> [MatchListItem] {
        guard let data = defaults.data(forKey: key),
              let decoded = try? JSONDecoder().decode([MatchListItem].self, from: data),
              !decoded.isEmpty else {
            let initial = [MatchListItem(
                id: "demo-match",
                source: "local",
                matchDateTime: Date(),
                homeTeam: "Home",
                awayTeam: "Away",
                clubName: "Demo Club",
                teamName: "Demo Team"
            )]
            save(initial)
            return initial
        }
        return decoded
    }

    func upsert(_ match: MatchListItem) {
        var items = load()
        if let existingIndex = items.firstIndex(where: { $0.id == match.id }) {
            items[existingIndex] = match
        } else {
            items.append(match)
        }
        save(items)
    }

    func merge(_ remoteMatches: [MatchListItem]) {
        guard !remoteMatches.isEmpty else { return }
        var items = load()
        for match in remoteMatches {
            if let existingIndex = items.firstIndex(where: { $0.id == match.id }) {
                items[existingIndex] = match
            } else {
                items.append(match)
            }
        }
        save(items)
    }

    private func save(_ matches: [MatchListItem]) {
        guard let data = try? JSONEncoder().encode(matches) else { return }
        defaults.set(data, forKey: key)
    }
}

struct MatchMetadataEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let match: MatchListItem
    let onSave: (MatchListItem) -> Void

    @State private var homeTeam = ""
    @State private var awayTeam = ""
    @State private var clubName = ""
    @State private var teamName = ""
    @State private var hasDate = true
    @State private var matchDate = Date()

    var body: some View {
        Form {
            Section("Teams") {
                TextField("Home team", text: $homeTeam)
                TextField("Away team", text: $awayTeam)
            }
            Section("Metadata") {
                Toggle("Set match date/time", isOn: $hasDate)
                if hasDate {
                    DatePicker("Match date/time", selection: $matchDate)
                }
                TextField("Club", text: $clubName)
                TextField("Team", text: $teamName)
            }
        }
        .navigationTitle(title)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    let updated = MatchListItem(
                        id: match.id,
                        source: match.source,
                        createdAt: match.createdAt,
                        matchDateTime: hasDate ? matchDate : nil,
                        homeTeam: homeTeam.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Home" : homeTeam.trimmingCharacters(in: .whitespacesAndNewlines),
                        awayTeam: awayTeam.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Away" : awayTeam.trimmingCharacters(in: .whitespacesAndNewlines),
                        clubName: clubName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : clubName.trimmingCharacters(in: .whitespacesAndNewlines),
                        teamName: teamName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : teamName.trimmingCharacters(in: .whitespacesAndNewlines),
                        knhbMatchId: match.knhbMatchId
                    )
                    onSave(updated)
                    dismiss()
                }
            }
        }
        .onAppear {
            homeTeam = match.homeTeam
            awayTeam = match.awayTeam
            clubName = match.clubName ?? ""
            teamName = match.teamName ?? ""
            if let matchDateTime = match.matchDateTime {
                hasDate = true
                matchDate = matchDateTime
            } else {
                hasDate = false
                matchDate = Date()
            }
        }
    }
}

enum MatchDateFormatters {
    static let amsterdamTimeZone = TimeZone(identifier: "Europe/Amsterdam") ?? .current

    static let list: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "nl_NL")
        formatter.timeZone = amsterdamTimeZone
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static func display(_ date: Date) -> String {
        list.string(from: date)
    }
}

#Preview("MatchListView populated") {
    NavigationStack {
        MatchListView(
            matches: IOSPreviewFixtures.matches,
            persistenceEnabled: false
        )
    }
}

#Preview("MatchMetadataEditorView populated") {
    NavigationStack {
        MatchMetadataEditorView(
            title: "Edit Match",
            match: IOSPreviewFixtures.matches[1],
            onSave: { _ in }
        )
    }
}
