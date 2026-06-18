import Foundation
import WatchConnectivity

final class AppleApiEndpointSync: NSObject, WCSessionDelegate {
    static let shared = AppleApiEndpointSync()

    private static let apiBaseKey = "hockey_timer_api_base"
    private static let authAccessTokenKey = "hockey_timer_auth_access_token"
    private static let authExpiresAtKey = "hockey_timer_auth_expires_at"
    private static let endpointPayloadKey = "apiBase"
    private static let authAccessTokenPayloadKey = "authAccessToken"
    private static let authExpiresAtPayloadKey = "authExpiresAt"
    private var isStarted = false

    private override init() {}

    func start() {
        guard WCSession.isSupported(), !isStarted else { return }
        isStarted = true
        let session = WCSession.default
        session.delegate = self
        session.activate()
        publishCurrentEndpoint()
        publishCurrentAuthState()
    }

    func updateEndpoint(_ value: String) {
        let sanitized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else { return }
        UserDefaults.standard.set(sanitized, forKey: Self.apiBaseKey)
        publishCurrentEndpoint()
    }

    func updateAuthState(accessToken: String, expiresAt: Date) {
        let sanitized = accessToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else { return }
        UserDefaults.standard.set(sanitized, forKey: Self.authAccessTokenKey)
        UserDefaults.standard.set(expiresAt.timeIntervalSince1970, forKey: Self.authExpiresAtKey)
        publishCurrentAuthState()
    }

    func clearAuthState() {
        UserDefaults.standard.removeObject(forKey: Self.authAccessTokenKey)
        UserDefaults.standard.removeObject(forKey: Self.authExpiresAtKey)
        publishCurrentAuthState()
    }

    func currentAuthorizationHeader() -> String? {
        guard let token = UserDefaults.standard.string(forKey: Self.authAccessTokenKey),
              !token.isEmpty else { return nil }

        let expiresAt = UserDefaults.standard.double(forKey: Self.authExpiresAtKey)
        if expiresAt > 0 && Date(timeIntervalSince1970: expiresAt) <= Date() {
            clearAuthState()
            return nil
        }

        return "Bearer \(token)"
    }

    func publishCurrentEndpoint() {
        publishCurrentContext()
    }

    func publishCurrentAuthState() {
        guard WCSession.isSupported() else { return }
        publishCurrentContext()
    }

    private func currentContextPayload() -> [String: Any] {
        var payload: [String: Any] = [:]
        if let endpoint = UserDefaults.standard.string(forKey: Self.apiBaseKey), !endpoint.isEmpty {
            payload[Self.endpointPayloadKey] = endpoint
        }
        if let token = UserDefaults.standard.string(forKey: Self.authAccessTokenKey), !token.isEmpty {
            payload[Self.authAccessTokenPayloadKey] = token
            payload[Self.authExpiresAtPayloadKey] = UserDefaults.standard.double(forKey: Self.authExpiresAtKey)
        } else {
            payload[Self.authAccessTokenPayloadKey] = ""
            payload[Self.authExpiresAtPayloadKey] = 0.0
        }
        return payload
    }

    private func publishCurrentContext() {
        guard WCSession.isSupported() else { return }
        let payload = currentContextPayload()
        try? WCSession.default.updateApplicationContext(payload)

        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        publishCurrentEndpoint()
        publishCurrentAuthState()
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        applyEndpoint(from: applicationContext)
        applyAuthState(from: applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        applyEndpoint(from: message)
        applyAuthState(from: message)
    }

    private func applyEndpoint(from payload: [String: Any]) {
        guard let endpoint = payload[Self.endpointPayloadKey] as? String else { return }
        let sanitized = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else { return }
        UserDefaults.standard.set(sanitized, forKey: Self.apiBaseKey)
    }

    private func applyAuthState(from payload: [String: Any]) {
        guard payload[Self.authAccessTokenPayloadKey] != nil else { return }
        let token = (payload[Self.authAccessTokenPayloadKey] as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            UserDefaults.standard.removeObject(forKey: Self.authAccessTokenKey)
            UserDefaults.standard.removeObject(forKey: Self.authExpiresAtKey)
            return
        }

        UserDefaults.standard.set(token, forKey: Self.authAccessTokenKey)
        UserDefaults.standard.set(payload[Self.authExpiresAtPayloadKey] as? Double ?? 0.0, forKey: Self.authExpiresAtKey)
    }

    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
    #endif
}
