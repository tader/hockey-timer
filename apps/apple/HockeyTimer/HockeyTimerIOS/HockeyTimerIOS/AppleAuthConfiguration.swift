import Foundation

enum AppleAuthConfiguration {
    static let domain = "tader.eu.auth0.com"
    static let clientID = ""
    static let audience = "https://hockey-api.tader.nl"
    static let callbackScheme = "nl.thomsoft.hockeytimerios"
    static let redirectURI = "\(callbackScheme)://auth/callback"
    static let scope = "openid profile email"

    static var isConfigured: Bool {
        !clientID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    static var issuerLabel: String {
        "https://\(domain)/"
    }

    static var authorizationEndpoint: URL {
        URL(string: "https://\(domain)/authorize")!
    }

    static var tokenEndpoint: URL {
        URL(string: "https://\(domain)/oauth/token")!
    }
}
