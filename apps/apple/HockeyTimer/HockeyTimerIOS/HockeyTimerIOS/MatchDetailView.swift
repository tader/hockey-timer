import SwiftUI
import Combine

struct MatchDetailView: View {
    @State private var editableMatch: MatchListItem
    @StateObject private var model: IOSMatchViewModel
    let onMetadataSaved: ((MatchListItem) -> Void)?
    private let persistsMetadata: Bool
    private let poller = Timer.publish(every: 3, on: .main, in: .common).autoconnect()
    @State private var apiBaseDraft = ""
    @State private var authStatusLabel = AppleApiEndpointSync.shared.currentAuthStatusLabel()
    @State private var authMessage = "Sign in on iPhone to sync through the hosted API and paired watch."
    @State private var isEditingMetadata = false
    @State private var isSigningIn = false

    init(
        match: MatchListItem = MatchListItem(id: "demo-match", source: "local", homeTeam: "Home", awayTeam: "Away"),
        model: IOSMatchViewModel? = nil,
        persistsMetadata: Bool = true,
        onMetadataSaved: ((MatchListItem) -> Void)? = nil
    ) {
        _editableMatch = State(initialValue: match)
        self.onMetadataSaved = onMetadataSaved
        self.persistsMetadata = persistsMetadata
        _model = StateObject(wrappedValue: model ?? IOSMatchViewModel(matchId: match.id))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(editableMatch.title)
                .font(.title2)
                .bold()
            Text(editableMatch.subtitle)
                .font(.subheadline)

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
            Text("Polling sync: every few seconds")
            Button("Edit Match Metadata") {
                isEditingMetadata = true
            }
            Text("Account")
                .font(.headline)
            Text(authStatusLabel)
                .font(.subheadline)
            Text(authMessage)
                .font(.caption)
                .foregroundStyle(.secondary)
            Button(isSigningIn ? "Signing In..." : "Sign In") {
                handleSignIn()
            }
            .disabled(isSigningIn)
            Button("Sign Out") {
                AppleApiEndpointSync.shared.clearAuthState()
                refreshAuthStatus(message: "Signed out. Local match operation still works.")
            }
            Text("API Base")
                .font(.headline)
            Text("Configure API connection here; watch uses phone-managed settings.")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("http://192.168.1.153:8787", text: $apiBaseDraft)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Save API Base") {
                    model.updateApiBase(apiBaseDraft)
                    AppleApiEndpointSync.shared.updateEndpoint(apiBaseDraft)
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
        .sheet(isPresented: $isEditingMetadata) {
            NavigationStack {
                MatchMetadataEditorView(title: "Edit Match", match: editableMatch) { updated in
                    editableMatch = updated
                    if persistsMetadata {
                        MatchStore.shared.upsert(updated)
                    }
                    onMetadataSaved?(updated)
                }
            }
        }
        .onAppear {
            apiBaseDraft = model.currentApiBase
            refreshAuthStatus(message: authMessage)
            model.refreshProjection()
        }
        .onReceive(poller) { _ in
            model.refreshProjection()
        }
    }

    private func handleSignIn() {
        guard AppleAuthConfiguration.isConfigured else {
            refreshAuthStatus(message: "Configure Auth0 client id in AppleAuthConfiguration.swift.")
            return
        }

        isSigningIn = true
        refreshAuthStatus(message: "Opening \(AppleAuthConfiguration.issuerLabel) sign-in.")
        AppleAuthSession.shared.signIn { result in
            DispatchQueue.main.async {
                isSigningIn = false
                switch result {
                case .success(let token):
                    AppleApiEndpointSync.shared.updateAuthState(
                        accessToken: token.accessToken,
                        expiresAt: token.expiresAt
                    )
                    refreshAuthStatus(message: "Signed in. Watch sync state updated.")
                case .failure(let error):
                    refreshAuthStatus(message: error.localizedDescription)
                }
            }
        }
    }

    private func refreshAuthStatus(message: String) {
        authStatusLabel = AppleApiEndpointSync.shared.currentAuthStatusLabel()
        authMessage = message
    }
}

#Preview("MatchDetailView populated") {
    NavigationStack {
        MatchDetailView(
            match: IOSPreviewFixtures.matches[1],
            model: IOSMatchViewModel.preview(
                homeScore: 3,
                awayScore: 2,
                isRunning: true,
                currentPeriod: 3,
                currentPeriodPlayedSeconds: 6 * 60 + 14,
                pendingEventCount: 1,
                runningStartedAt: IOSPreviewFixtures.createdAt,
                previewApiBase: "https://preview.hockey-timer.invalid"
            ),
            persistsMetadata: false
        )
    }
}
