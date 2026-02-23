import SwiftUI

struct MatchListItem: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let subtitle: String?
    let source: String
}

struct MatchListView: View {
    @State private var matches: [MatchListItem] = []
    @State private var isShowingKNHB = false

    var body: some View {
        List {
            Section("Public Matches") {
                ForEach(matches) { match in
                    NavigationLink(match.title) {
                        MatchDetailView(match: match)
                    }
                }
            }
        }
        .navigationTitle("Hockey Timer")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Import KNHB") {
                    isShowingKNHB = true
                }
            }
        }
        .sheet(isPresented: $isShowingKNHB) {
            NavigationStack {
                KNHBBrowserView { imported in
                    MatchStore.shared.upsert(imported)
                    matches = MatchStore.shared.load()
                    isShowingKNHB = false
                }
            }
        }
        .onAppear {
            matches = MatchStore.shared.load()
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
            let initial = [MatchListItem(id: "demo-match", title: "Demo Match", subtitle: nil, source: "local")]
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

    private func save(_ matches: [MatchListItem]) {
        guard let data = try? JSONEncoder().encode(matches) else { return }
        defaults.set(data, forKey: key)
    }
}
