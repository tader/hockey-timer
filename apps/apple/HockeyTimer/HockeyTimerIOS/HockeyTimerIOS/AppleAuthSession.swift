import AuthenticationServices
import CryptoKit
import Foundation
import Security
import UIKit

struct AppleAuthToken {
    let accessToken: String
    let expiresAt: Date
}

enum AppleAuthSessionError: LocalizedError {
    case cancelled
    case notConfigured
    case invalidCallback
    case stateMismatch
    case tokenRequestFailed(Int)
    case missingAccessToken

    var errorDescription: String? {
        switch self {
        case .cancelled:
            return "Sign-in cancelled."
        case .notConfigured:
            return "Auth0 client id is not configured."
        case .invalidCallback:
            return "Sign-in callback was invalid."
        case .stateMismatch:
            return "Sign-in callback state did not match."
        case .tokenRequestFailed(let status):
            return "Token exchange failed with status \(status)."
        case .missingAccessToken:
            return "Token response did not include an access token."
        }
    }
}

final class AppleAuthSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AppleAuthSession()

    private var webSession: ASWebAuthenticationSession?

    private override init() {}

    func signIn(completion: @escaping (Result<AppleAuthToken, Error>) -> Void) {
        guard AppleAuthConfiguration.isConfigured else {
            completion(.failure(AppleAuthSessionError.notConfigured))
            return
        }

        let verifier = Self.randomBase64URL(byteCount: 32)
        let state = Self.randomBase64URL(byteCount: 16)
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var components = URLComponents(url: AppleAuthConfiguration.authorizationEndpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: AppleAuthConfiguration.clientID),
            URLQueryItem(name: "redirect_uri", value: AppleAuthConfiguration.redirectURI),
            URLQueryItem(name: "scope", value: AppleAuthConfiguration.scope),
            URLQueryItem(name: "audience", value: AppleAuthConfiguration.audience),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
        ]

        guard let authURL = components.url else {
            completion(.failure(AppleAuthSessionError.invalidCallback))
            return
        }

        let session = ASWebAuthenticationSession(
            url: authURL,
            callbackURLScheme: AppleAuthConfiguration.callbackScheme
        ) { callbackURL, error in
            if error != nil {
                completion(.failure(AppleAuthSessionError.cancelled))
                return
            }
            guard let callbackURL,
                  let callback = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                  let code = callback.queryItems?.first(where: { $0.name == "code" })?.value,
                  let returnedState = callback.queryItems?.first(where: { $0.name == "state" })?.value else {
                completion(.failure(AppleAuthSessionError.invalidCallback))
                return
            }
            guard returnedState == state else {
                completion(.failure(AppleAuthSessionError.stateMismatch))
                return
            }

            Task {
                do {
                    completion(.success(try await Self.exchangeCode(code, verifier: verifier)))
                } catch {
                    completion(.failure(error))
                }
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        webSession = session
        session.start()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let foregroundScene = scenes.first { $0.activationState == .foregroundActive }
        return foregroundScene?.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    private static func exchangeCode(_ code: String, verifier: String) async throws -> AppleAuthToken {
        var request = URLRequest(url: AppleAuthConfiguration.tokenEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "content-type")
        request.httpBody = URLComponents.formEncoded([
            "grant_type": "authorization_code",
            "client_id": AppleAuthConfiguration.clientID,
            "code": code,
            "code_verifier": verifier,
            "redirect_uri": AppleAuthConfiguration.redirectURI,
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(statusCode) else {
            throw AppleAuthSessionError.tokenRequestFailed(statusCode)
        }

        let token = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard let accessToken = token.accessToken, !accessToken.isEmpty else {
            throw AppleAuthSessionError.missingAccessToken
        }
        return AppleAuthToken(
            accessToken: accessToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(token.expiresIn ?? 3600))
        )
    }

    private static func randomBase64URL(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        _ = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        return base64URL(Data(bytes))
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private struct TokenResponse: Decodable {
    let accessToken: String?
    let expiresIn: Int?

    private enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case expiresIn = "expires_in"
    }
}

private extension URLComponents {
    static func formEncoded(_ values: [String: String]) -> Data {
        var components = URLComponents()
        components.queryItems = values.map { URLQueryItem(name: $0.key, value: $0.value) }
        return Data((components.percentEncodedQuery ?? "").utf8)
    }
}
