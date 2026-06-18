globalThis.__API_BASE__ = globalThis.__API_BASE__ ?? "http://localhost:8787";
globalThis.__AUTH_ISSUER__ = globalThis.__AUTH_ISSUER__ ?? "";
globalThis.__AUTH_AUTHORIZATION_ENDPOINT__ = globalThis.__AUTH_AUTHORIZATION_ENDPOINT__ ?? "";
globalThis.__AUTH_TOKEN_ENDPOINT__ = globalThis.__AUTH_TOKEN_ENDPOINT__ ?? "";
globalThis.__AUTH_CLIENT_ID__ = globalThis.__AUTH_CLIENT_ID__ ?? "";
globalThis.__AUTH_AUDIENCE__ = globalThis.__AUTH_AUDIENCE__ ?? "";
globalThis.__AUTH_SCOPE__ = globalThis.__AUTH_SCOPE__ ?? "openid profile email";
globalThis.__AUTH_REDIRECT_URI__ = globalThis.__AUTH_REDIRECT_URI__ ?? globalThis.location?.origin ?? "";
