import SwiftUI

struct TimeTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel

    var body: some View {
        VStack(spacing: 8) {
            Text("TIME")
                .font(.headline)

            HStack {
                Button("HOME \(model.homeScore)") {
                    model.incrementHome()
                }
                .buttonStyle(.bordered)

                Button("\(model.awayScore) AWAY") {
                    model.incrementAway()
                }
                .buttonStyle(.bordered)
            }

            Text(model.timeLabel)
                .font(.system(size: 20, weight: .bold, design: .rounded))

            Text("\(model.periodLabel) \(model.stateLabel)")
                .font(.subheadline)

            HStack {
                Button("Start") { model.start() }
                    .buttonStyle(.borderedProminent)

                Button("Pause") { model.pause() }
                    .buttonStyle(.borderedProminent)
            }

            HStack {
                Button("Resume") { model.resume() }
                    .buttonStyle(.bordered)

                Button("End P") { model.endPeriod() }
                    .buttonStyle(.bordered)
            }

            Button("End Match") { model.endMatch() }
                .buttonStyle(.bordered)
                .tint(.red)
        }
        .padding(8)
    }
}

#Preview {
    TimeTabView()
        .environmentObject(WatchMatchViewModel())
}
