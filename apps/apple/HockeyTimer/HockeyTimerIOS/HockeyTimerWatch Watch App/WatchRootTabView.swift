import SwiftUI
import Combine

struct WatchRootTabView: View {
    @StateObject private var model = WatchMatchViewModel()
    private let poller = Timer.publish(every: 3, on: .main, in: .common).autoconnect()

    var body: some View {
        TabView {
            TimeTabView()
            ScoreTabView()
            AdminTabView()
        }
        .tabViewStyle(.page(indexDisplayMode: .automatic))
        .environmentObject(model)
        .onAppear {
            model.refreshProjection()
        }
        .onReceive(poller) { _ in
            model.refreshProjection()
        }
    }
}
