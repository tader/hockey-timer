import SwiftUI

struct MatchListView: View {
    var body: some View {
        List {
            Section("Public Matches") {
                NavigationLink("Demo Match") {
                    MatchDetailView()
                }
            }
        }
        .navigationTitle("Hockey Timer")
    }
}

#Preview {
    NavigationStack {
        MatchListView()
    }
}
