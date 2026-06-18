type ApiEventWithHeaders = {
  headers?: Record<string, string | undefined>;
};

type AuthResult =
  | { ok: true; subject?: string }
  | { ok: false; statusCode: number; error: string };

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtPayload = {
  aud?: string | string[];
  exp?: number;
  iss?: string;
  sub?: string;
};

type Jwk = {
  alg?: string;
  e?: string;
  kid?: string;
  kty?: string;
  n?: string;
  use?: string;
};

type Jwks = {
  keys?: Jwk[];
};

const encoder = new TextEncoder();
let cachedJwks: Jwks | undefined;

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(Buffer.from(base64UrlDecode(value)).toString("utf8")) as T;
}

function authorizationHeader(event: ApiEventWithHeaders): string | undefined {
  const headers = event.headers ?? {};
  return headers.authorization ?? headers.Authorization;
}

function audienceMatches(actual: string | string[] | undefined, expected: string | undefined): boolean {
  if (!expected) return true;
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

async function getJwks(): Promise<Jwks> {
  if (cachedJwks) return cachedJwks;
  const jwksUrl = process.env.AUTH_JWKS_URL;
  if (!jwksUrl) {
    throw new Error("AUTH_JWKS_URL is required when AUTH_MODE=required");
  }
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`JWKS fetch failed: ${response.status}`);
  }
  cachedJwks = (await response.json()) as Jwks;
  return cachedJwks;
}

async function verifyJwt(token: string): Promise<JwtPayload> {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("malformed bearer token");
  }

  const header = decodeJwtPart<JwtHeader>(headerPart);
  const payload = decodeJwtPart<JwtPayload>(payloadPart);
  if (header.alg !== "RS256") {
    throw new Error("unsupported token algorithm");
  }

  const jwks = await getJwks();
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!key || key.kty !== "RSA" || !key.n || !key.e) {
    throw new Error("matching JWKS key not found");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signed = encoder.encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, base64UrlDecode(signaturePart), signed);
  if (!valid) {
    throw new Error("invalid token signature");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.sub) throw new Error("token subject required");
  if (payload.exp && payload.exp <= nowSeconds) throw new Error("token expired");
  if (process.env.AUTH_ISSUER && payload.iss !== process.env.AUTH_ISSUER) {
    throw new Error("token issuer mismatch");
  }
  if (!audienceMatches(payload.aud, process.env.AUTH_AUDIENCE)) {
    throw new Error("token audience mismatch");
  }

  return payload;
}

export async function authorize(event: ApiEventWithHeaders): Promise<AuthResult> {
  if (process.env.AUTH_MODE !== "required") {
    return { ok: true };
  }

  const header = authorizationHeader(event);
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { ok: false, statusCode: 401, error: "authentication required" };
  }

  if (process.env.AUTH_DEV_BEARER_TOKEN && token === process.env.AUTH_DEV_BEARER_TOKEN) {
    return { ok: true, subject: "dev-user" };
  }

  try {
    const payload = await verifyJwt(token);
    return { ok: true, subject: payload.sub };
  } catch (error) {
    return { ok: false, statusCode: 401, error: (error as Error).message };
  }
}

export function __resetAuthCacheForTests(): void {
  cachedJwks = undefined;
}
