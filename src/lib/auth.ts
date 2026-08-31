// Authentication utilities for AIDMUR Admin Panel
// Uses Web Crypto API for zero-dependency HMAC-SHA256 signature

const SESSION_COOKIE_NAME = 'aidmur_admin_session';
const SESSION_SECRET = process.env.ADMIN_SECRET || 'aidmur_secret_jwt_key_2026_super_secure';

const DEFAULT_ADMIN_USER = process.env.ADMIN_USER || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aidmur2026!';

export function validateCredentials(username: string, password: string): boolean {
  if (!username || !password) return false;
  return username.trim() === DEFAULT_ADMIN_USER && password === DEFAULT_ADMIN_PASSWORD;
}

async function signData(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(username: string): Promise<string> {
  const payload = {
    u: username,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days expiration
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = await signData(payloadBase64, SESSION_SECRET);
  return `${payloadBase64}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<{ valid: boolean; username?: string }> {
  if (!token || !token.includes('.')) return { valid: false };
  const [payloadBase64, providedSig] = token.split('.');
  if (!payloadBase64 || !providedSig) return { valid: false };

  try {
    const expectedSig = await signData(payloadBase64, SESSION_SECRET);
    if (expectedSig !== providedSig) return { valid: false };

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
    if (payload.exp < Date.now()) return { valid: false };

    return { valid: true, username: payload.u };
  } catch {
    return { valid: false };
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, str) => {
    const [key, ...vals] = str.trim().split('=');
    if (key) acc[key] = decodeURIComponent(vals.join('='));
    return acc;
  }, {} as Record<string, string>);
}

export async function getAdminSession(request: Request): Promise<{ authenticated: boolean; username?: string }> {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return { authenticated: false };

  const verification = await verifySessionToken(token);
  if (!verification.valid) return { authenticated: false };

  return { authenticated: true, username: verification.username };
}

export function getSessionCookieHeader(token: string, maxAgeSeconds: number = 60 * 60 * 24 * 7): string {
  const isProd = process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${isProd ? '; Secure' : ''}`;
}

export function getClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
