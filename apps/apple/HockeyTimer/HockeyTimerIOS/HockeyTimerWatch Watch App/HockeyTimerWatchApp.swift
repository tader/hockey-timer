import SwiftUI

@main
struct HockeyTimerWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchRootTabView()
                .onAppear {
                    AppleApiEndpointSync.shared.start()
                }
        }
    }
}
