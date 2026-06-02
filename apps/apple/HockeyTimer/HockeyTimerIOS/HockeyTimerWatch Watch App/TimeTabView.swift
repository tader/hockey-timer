import SwiftUI

struct TimeTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel
    @State private var showFormatPicker = false

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
                TimelineView(.periodic(from: .now, by: 0.25)) { timeline in
                    Text(model.watchTimeText(on: timeline.date))
                        .font(.system(size: 64, weight: .medium, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.45)
                        .lineLimit(1)
                        .foregroundColor(model.watchTimeIsOvertime(on: timeline.date) ? .red : .yellow)
                }

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
                Text("ENDED")
                    .font(.headline)
                    .foregroundColor(.gray)

                Button(action: createDefaultMatch) {
                    VStack(spacing: 2) {
                        Text(WatchPresentation.primaryNewMatchFormatLabel)
                            .font(.title3.weight(.semibold))
                        Text("New Match")
                            .font(.caption2)
                    }
                }
                .glassEffect()
                .buttonStyle(.borderedProminent)
                .tint(.green)

                Button("Other Format") {
                    showFormatPicker = true
                }
                .buttonStyle(.bordered)
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
        .sheet(isPresented: $showFormatPicker) {
            NewMatchFormatPickerView()
                .environmentObject(model)
        }
    }

    private func startPeriod() {
        if model.currentPeriod == 1 && model.currentPeriodPlayedSeconds == 0 {
            model.start()
        } else {
            model.resume()
        }
    }

    private func createDefaultMatch() {
        model.createQuickMatch()
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
