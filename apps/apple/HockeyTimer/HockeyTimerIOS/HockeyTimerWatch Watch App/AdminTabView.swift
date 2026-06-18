import SwiftUI

struct AdminTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                HStack {
                    labeledIconButton(
                        icon: "xmark",
                        label: "Period",
                        tint: .red,
                        disabled: model.isEnded,
                        action: model.endPeriod
                    )

                    labeledIconButton(
                        icon: "flag.checkered",
                        label: "Match",
                        tint: .red,
                        disabled: model.isEnded,
                        action: model.endMatch
                    )
                }

                if model.isRunning {
                    labeledIconButton(
                        icon: "pause.fill",
                        label: "Pause",
                        tint: .orange,
                        disabled: false,
                        action: model.pause
                    )
                } else {
                    labeledIconButton(
                        icon: model.isEnded ? "plus" : "play.fill",
                        label: model.isEnded ? "New Match" : "Start",
                        tint: .green,
                        disabled: false,
                        action: startPeriod
                    )
                }

                HStack {
                    Button("Events") {}
                        .disabled(true)
                    Button("Share") {}
                        .disabled(true)
                }

                Text("\(model.periodProgressLabel) \(model.stateLabel)")
                    .font(.caption2)
                    .foregroundColor(.gray)

                if model.pendingEventCount > 0 {
                    Text("\(model.pendingEventCount) pending")
                        .font(.caption2)
                        .foregroundColor(.orange)
                }
            }
        }
        .buttonStyle(.bordered)
        .padding(8)
    }

    private func labeledIconButton(
        icon: String,
        label: String,
        tint: Color,
        disabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        VStack(spacing: 2) {
            Button(action: action) {
                Image(systemName: icon)
            }
            .glassEffect()
            .buttonStyle(.borderedProminent)
            .tint(tint)
            .disabled(disabled)

            Text(label)
                .font(.caption2)
                .foregroundColor(disabled ? .gray : nil)
        }
    }

    private func startPeriod() {
        if model.isEnded {
            model.createQuickMatch()
            return
        }

        if model.currentPeriod == 1 && model.currentPeriodPlayedSeconds == 0 {
            model.start()
        } else {
            model.resume()
        }
    }
}

#Preview("AdminTabView - Paused") {
    AdminTabView()
        .environmentObject(
            WatchMatchViewModel.preview(
                homeScore: 2,
                awayScore: 1,
                currentPeriod: 3,
                currentPeriodPlayedSeconds: 4 * 60,
                pendingEventCount: 3
            )
        )
}
