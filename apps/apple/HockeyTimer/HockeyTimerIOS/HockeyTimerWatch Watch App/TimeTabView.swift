import SwiftUI

struct TimeTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                scoreButton(score: model.homeScore, tint: .red, action: model.incrementHome)

                Text("-")
                    .font(.title3.weight(.black))

                scoreButton(score: model.awayScore, tint: .blue, action: model.incrementAway)
            }

            Spacer(minLength: 2)

            if model.isRunning {
                TimelineView(.periodic(from: .now, by: 0.25)) { timeline in
                    Text(model.watchTimeText(on: timeline.date))
                        .font(.system(size: 76, weight: .medium, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.35)
                        .lineLimit(1)
                        .foregroundColor(model.watchTimeIsOvertime(on: timeline.date) ? .red : .yellow)
                }

                Text(model.periodProgressLabel)
                    .font(.footnote)
                    .foregroundColor(.gray)
            } else if model.isEnded {
                Text("ENDED")
                    .font(.system(size: 42, weight: .semibold, design: .rounded))
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

    private func scoreButton(score: Int, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text("\(score)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.65)
                .lineLimit(1)
                .frame(width: 68, height: 52)
                .foregroundStyle(.white)
                .background(tint, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(model.isEnded)
    }
}

struct NewMatchFormatPickerView: View {
    @EnvironmentObject private var model: WatchMatchViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("New Match")
                    .font(.headline)

                ForEach(WatchPresentation.newMatchFormats) { format in
                    Button(action: {
                        model.createQuickMatch(format: format)
                        dismiss()
                    }) {
                        Text(format.label)
                            .font(format == WatchPresentation.defaultNewMatchFormat ? .headline : .body)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(format == WatchPresentation.defaultNewMatchFormat ? .green : nil)
                }
            }
        }
        .padding(8)
    }
}

#Preview("TimeTabView - Running") {
    TimeTabView()
        .environmentObject(
            WatchMatchViewModel.preview(
                homeScore: 2,
                awayScore: 1,
                isRunning: true,
                currentPeriod: 2,
                currentPeriodPlayedSeconds: 9 * 60,
                pendingEventCount: 2
            )
        )
}

#Preview("NewMatchFormatPickerView - Formats") {
    NewMatchFormatPickerView()
        .environmentObject(
            WatchMatchViewModel.preview(
                homeScore: 2,
                awayScore: 2,
                isEnded: true,
                currentPeriod: 4,
                currentPeriodPlayedSeconds: 17 * 60 + 30
            )
        )
}
