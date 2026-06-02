import SwiftUI

struct ScoreTabView: View {
    @EnvironmentObject private var model: WatchMatchViewModel

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                scoreColumn(
                    score: model.homeScore,
                    increment: model.incrementHome,
                    decrement: model.decrementHome,
                    canDecrement: model.canDecrementHome,
                    tint: .red
                )

                Text("-")
                    .font(.title3.weight(.black))

                scoreColumn(
                    score: model.awayScore,
                    increment: model.incrementAway,
                    decrement: model.decrementAway,
                    canDecrement: model.canDecrementAway,
                    tint: .blue
                )
            }

            Spacer(minLength: 4)

            Button(action: model.resetScore) {
                Text("Reset Score")
            }
            .tint(.orange)
            .buttonStyle(.borderless)
            .disabled(!model.canResetScore || model.isEnded)
        }
        .padding(8)
    }

    private func scoreColumn(
        score: Int,
        increment: @escaping () -> Void,
        decrement: @escaping () -> Void,
        canDecrement: Bool,
        tint: Color
    ) -> some View {
        VStack(spacing: 5) {
            Button(action: increment) {
                Image(systemName: "chevron.up")
            }
            .glassEffect()
            .tint(tint)
            .disabled(model.isEnded)

            Text("\(score)")
                .font(.title3)
                .monospacedDigit()

            Button(action: decrement) {
                Image(systemName: "chevron.down")
            }
            .glassEffect()
            .disabled(!canDecrement || model.isEnded)
        }
    }
}
