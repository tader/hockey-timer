import SwiftUI

struct AdminTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel
    @State private var showApiSettings = false

    var body: some View {
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
                    icon: "play.fill",
                    label: "Start",
                    tint: .green,
                    disabled: model.isEnded,
                    action: startPeriod
                )
            }

            HStack {
                Button("Events") {}
                    .disabled(true)
                Button("Share") {}
                    .disabled(true)
            }

            Button("API Settings") { showApiSettings = true }

            Text("\(model.periodProgressLabel) \(model.stateLabel)")
                .font(.caption2)
                .foregroundColor(.gray)
        }
        .buttonStyle(.bordered)
        .padding(8)
        .sheet(isPresented: $showApiSettings) {
            WatchApiSettingsView()
                .environmentObject(model)
        }
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
        if model.currentPeriod == 1 && model.currentPeriodPlayedSeconds == 0 {
            model.start()
        } else {
            model.resume()
        }
    }
}
