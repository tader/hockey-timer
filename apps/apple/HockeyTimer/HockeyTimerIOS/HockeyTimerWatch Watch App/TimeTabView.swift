import SwiftUI

struct TimeTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Button(action: model.incrementHome) {
                    Text("\(model.homeScore)")
                        .font(.title2)
                        .frame(minWidth: 44)
                }
                .glassEffect()
                .tint(.red)
                .foregroundColor(.white)
                .buttonBorderShape(.roundedRectangle(radius: 10))
                .disabled(model.isEnded)

                Text("-")
                    .font(.title3.weight(.black))

                Button(action: model.incrementAway) {
                    Text("\(model.awayScore)")
                        .font(.title2)
                        .frame(minWidth: 44)
                }
                .glassEffect()
                .tint(.blue)
                .foregroundColor(.white)
                .buttonBorderShape(.roundedRectangle(radius: 10))
                .disabled(model.isEnded)
            }

            Spacer(minLength: 4)

            if model.isRunning {
                Text(model.watchTimeText)
                    .font(.system(size: 64, weight: .medium, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.45)
                    .lineLimit(1)
                    .foregroundColor(model.watchTimeIsOvertime ? .red : .yellow)

                Text(model.periodProgressLabel)
                    .font(.footnote)
                    .foregroundColor(.gray)

                Button(action: model.pause) {
                    Image(systemName: "pause.fill")
                }
                .glassEffect()
                .buttonStyle(.borderedProminent)
                .tint(.orange)
            } else if model.isEnded {
                Text(model.watchTimeText)
                    .font(.system(size: 46, weight: .medium, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(.gray)

                Text("ENDED")
                    .font(.footnote)
                    .foregroundColor(.gray)
            } else {
                Button(action: startPeriod) {
                    Text(model.nextPeriodTitle)
                }
                .glassEffect()
                .tint(.green)
                .buttonStyle(.borderedProminent)
                .disabled(model.isEnded)

                Text(model.periodProgressLabel)
                    .font(.footnote)
                    .foregroundColor(.gray)
            }

            Spacer(minLength: 4)

            if model.pendingEventCount > 0 {
                Text("\(model.pendingEventCount) pending")
                    .font(.caption2)
                    .foregroundColor(.orange)
            }
        }
        .padding(.horizontal, 8)
    }

    private func startPeriod() {
        if model.currentPeriod == 1 && model.currentPeriodPlayedSeconds == 0 {
            model.start()
        } else {
            model.resume()
        }
    }
}
