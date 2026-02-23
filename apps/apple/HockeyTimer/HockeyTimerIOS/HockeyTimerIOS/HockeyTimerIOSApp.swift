import SwiftUI

@main
struct HockeyTimerIOSApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                MatchListView()
            }
        }
    }
}
