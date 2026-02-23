import SwiftUI

struct ScoreTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel

    var body: some View {
        VStack(spacing: 8) {
            Text("SCORE")
                .font(.headline)

            Text("\(model.periodLabel) \(model.stateLabel)")
                .font(.caption2)

            Text(model.timeLabel)
                .font(.caption)

            Text("HOME \(model.homeScore) - \(model.awayScore) AWAY")
                .font(.subheadline)

            HStack {
                Button("+HOME") { model.incrementHome() }
                    .buttonStyle(.borderedProminent)
                Button("+AWAY") { model.incrementAway() }
                    .buttonStyle(.borderedProminent)
            }

            HStack {
                Button("-HOME") { model.decrementHome() }
                    .buttonStyle(.bordered)
                Button("-AWAY") { model.decrementAway() }
                    .buttonStyle(.bordered)
            }
        }
        .padding(8)
    }
}

#Preview {
    ScoreTabView()
        .environmentObject(WatchMatchViewModel())
}
