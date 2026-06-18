import Foundation
import WatchConnectivity

final class AppleApiEndpointSync: NSObject, WCSessionDelegate {
    static let shared = AppleApiEndpointSync()

    private static let apiBaseKey = "hockey_timer_api_base"
    private static let endpointPayloadKey = "apiBase"
    private var isStarted = false

    private override init() {}

    func start() {
        guard WCSession.isSupported(), !isStarted else { return }
        isStarted = true
        let session = WCSession.default
        session.delegate = self
        session.activate()
        publishCurrentEndpoint()
    }

    func updateEndpoint(_ value: String) {
        let sanitized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else { return }
        UserDefaults.standard.set(sanitized, forKey: Self.apiBaseKey)
        publishCurrentEndpoint()
    }

    func publishCurrentEndpoint() {
        guard WCSession.isSupported(),
              let endpoint = UserDefaults.standard.string(forKey: Self.apiBaseKey),
              !endpoint.isEmpty else { return }

        let payload = [Self.endpointPayloadKey: endpoint]
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
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        applyEndpoint(from: applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        applyEndpoint(from: message)
    }

    private func applyEndpoint(from payload: [String: Any]) {
        guard let endpoint = payload[Self.endpointPayloadKey] as? String else { return }
        let sanitized = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else { return }
        UserDefaults.standard.set(sanitized, forKey: Self.apiBaseKey)
    }

    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
    #endif
}
