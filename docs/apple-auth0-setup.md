# Apple Auth0 Setup

The iPhone app uses Auth0 Universal Login with Authorization Code + PKCE.
The watch does not sign in directly; it receives the iPhone access token through
Watch Connectivity.

## Auth0 Native App
1. Create an Auth0 **Native** application.
2. Enable the same social connections as the web app.
3. Add allowed callback URL:
   `nl.thomsoft.hockeytimerios://auth/callback`
4. Add allowed logout URL:
   `nl.thomsoft.hockeytimerios://auth/callback`
5. Authorize the app for API audience:
   `https://hockey-api.tader.nl`

## iPhone App
Set the native app client id in
`apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS/AppleAuthConfiguration.swift`.

The configured URL scheme is declared in
`apps/apple/HockeyTimer/HockeyTimerIOS/HockeyTimerIOS-Info.plist`.
