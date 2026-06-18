import SwiftUI
import Combine

enum WatchTab {
    case timer
    case score
    case admin

    var title: String {
        switch self {
        case .timer: return "Timer"
        case .score: return "Edit Score"
        case .admin: return "Game"
        }
    }
}

struct WatchRootTabView: View {
    @StateObject private var model: WatchMatchViewModel
    @State private var selectedTab = WatchTab.timer
    private let poller = Timer.publish(every: 3, on: .main, in: .common).autoconnect()

    init(model: WatchMatchViewModel = WatchMatchViewModel()) {
        _model = StateObject(wrappedValue: model)
    }

    var body: some View {
        NavigationStack {
            TabView(selection: $selectedTab) {
                AdminTabView()
                    .tag(WatchTab.admin)
                TimeTabView()
                    .tag(WatchTab.timer)
                ScoreTabView()
                    .tag(WatchTab.score)
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))
            .navigationTitle(selectedTab.title)
        }
        .environmentObject(model)
        .onAppear {
            model.refreshProjection()
        }
        .onReceive(poller) { _ in
            model.refreshProjection()
        }
    }
}

#Preview("WatchRootTabView - Running") {
    WatchRootTabView(
        model: WatchMatchViewModel.preview(
            homeScore: 2,
            awayScore: 1,
            isRunning: true,
            currentPeriod: 2,
            currentPeriodPlayedSeconds: 9 * 60,
            pendingEventCount: 2
        )
    )
}
