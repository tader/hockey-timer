import SwiftUI

struct AdminTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel

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
            Button("Settings") {}
            Button("End Match") { model.endMatch() }
                .tint(.red)
        }
        .buttonStyle(.bordered)
        .padding(8)
    }
}

#Preview {
    AdminTabView()
        .environmentObject(WatchMatchViewModel())
}
