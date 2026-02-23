import SwiftUI

struct WatchApiSettingsView: View {
    @EnvironmentObject private var model: WatchMatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var apiBaseDraft = ""

    var body: some View {
        VStack(spacing: 8) {
            Text("API Base")
                .font(.headline)
            TextField("http://192.168.1.153:8787", text: $apiBaseDraft)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("Save") {
                model.updateApiBase(apiBaseDraft)
                model.refreshProjection()
                dismiss()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(8)
        .onAppear {
            apiBaseDraft = model.currentApiBase
        }
    }
}

