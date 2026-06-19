import SwiftUI

struct AppleAuthAccountView: View {
    @State private var authStatusLabel = AppleApiEndpointSync.shared.currentAuthStatusLabel()
    @State private var authMessage = "Sign in on iPhone to sync through the hosted API and paired watch."
    @State private var isSigningIn = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(authStatusLabel)
                .font(.subheadline)
            Text(authMessage)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Button(isSigningIn ? "Signing In..." : "Sign In") {
                    handleSignIn()
                }
                .disabled(isSigningIn)
                Button("Sign Out") {
                    AppleApiEndpointSync.shared.clearAuthState()
                    refreshAuthStatus(message: "Signed out. Local match operation still works.")
                }
            }
        }
        .onAppear {
            refreshAuthStatus(message: authMessage)
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

#Preview("AppleAuthAccountView") {
    AppleAuthAccountView()
        .padding()
}
