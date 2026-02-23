import SwiftUI

struct AdminTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel
    @State private var showApiSettings = false

    var body: some View {
        VStack(spacing: 8) {
            Text("ADMIN")
                .font(.headline)

            Text("\(model.periodLabel) \(model.stateLabel)")
                .font(.caption2)
            Text(model.timeLabel)
                .font(.caption)

            Button("End Period") { model.endPeriod() }
                .buttonStyle(.borderedProminent)

            Button("Format") {}
            Button("Events") {}
            Button("Share") {}
            Button("API Settings") { showApiSettings = true }
            Button("End Match") { model.endMatch() }
                .tint(.red)
        }
        .buttonStyle(.bordered)
        .padding(8)
        .sheet(isPresented: $showApiSettings) {
            WatchApiSettingsView()
                .environmentObject(model)
        }
    }
}
