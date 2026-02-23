import SwiftUI
import Combine

struct MatchDetailView: View {
    @StateObject private var model = IOSMatchViewModel()
    private let poller = Timer.publish(every: 3, on: .main, in: .common).autoconnect()
    @State private var apiBaseDraft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Demo Match")
                .font(.title2)
                .bold()

            Text("Home \(model.homeScore) - \(model.awayScore) Away")
                .font(.headline)

            Text("\(model.periodLabel) \(model.stateLabel)")
            Text(model.timeLabel)

            HStack {
                Button("Start") { model.start() }
                Button("Pause") { model.pause() }
                Button("Resume") { model.resume() }
            }

            HStack {
                Button("+ Home") { model.incrementHome() }
                Button("+ Away") { model.incrementAway() }
                Button("- Home") { model.decrementHome() }
                Button("- Away") { model.decrementAway() }
            }

            HStack {
                Button("End Period") { model.endPeriod() }
                Button("End Match") { model.endMatch() }
                    .tint(.red)
            }

            Text("Role: RO (default join)")
            Text("Sign-in optional")
            Text("Polling sync: every few seconds")
            Text("API Base")
                .font(.headline)
            TextField("http://192.168.1.153:8787", text: $apiBaseDraft)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Save API Base") {
                    model.updateApiBase(apiBaseDraft)
                    model.refreshProjection()
                }
                Button("Reload") {
                    apiBaseDraft = model.currentApiBase
                }
            }
            if let error = model.lastError {
                Text("Error: \(error)")
                    .foregroundStyle(.red)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding()
        .navigationTitle("Match")
        .onAppear {
            apiBaseDraft = model.currentApiBase
            model.refreshProjection()
        }
        .onReceive(poller) { _ in
            model.refreshProjection()
        }
    }
}

#Preview {
    NavigationStack {
        MatchDetailView()
    }
}
