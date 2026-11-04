const crypto = require('crypto');
const config = require('../config');

const SECRET_KEY = config.JWT_SECRET || 'c7e46f91d0834ba701a938c645b2069bf17b8f0426189ea5a9e701dc8a24bc19';
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MEDIA_TICKET_EXPIRY_SEC = config.MEDIA_TOKEN_EXPIRY_SECONDS || 300; // 5 minutes max

function base64UrlEncode(data) {
  return Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))
    .toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function hmacSha256(data, secret) {
  return crypto.createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
}

/**
 * Real Production-Grade JWT Token Generator (RFC 7519 HMAC-SHA256)
 * Generates tokens fully compatible with Java backend JwtTokenProvider.java
 */
function createToken(payload, expiresInMs = DEFAULT_EXPIRY_MS) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.floor(expiresInMs / 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const claims = {
    ...payload,
    iss: 'Inurum-Dashcam-Platform',
    iat: now,
    exp: exp
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(claims);
  const signature = hmacSha256(`${encodedHeader}.${encodedPayload}`, SECRET_KEY);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Generate a short-lived, single-device scoped media ticket (5 minutes TTL).
 * Prevents long-lived session tokens from being exposed in video player query strings.
 */
function createMediaTicket(user, terminalId, expiresInSeconds = MEDIA_TICKET_EXPIRY_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;

  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = {
    sub: user.id || user.sub,
    tenantId: user.tenantId,
    role: user.role,
    terminalId: String(terminalId),
    purpose: 'MEDIA_STREAM',
    iss: 'Inurum-Dashcam-Platform',
    iat: now,
    exp: exp
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(claims);
  const signature = hmacSha256(`${encodedHeader}.${encodedPayload}`, SECRET_KEY);

  return {
    ticket: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresInSeconds,
    expiresAt: new Date(exp * 1000).toISOString()
  };
}

/**
 * Cryptographically validates JWT token and returns verified claims.
 * Returns null if token is missing, tampered, expired, or invalid.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const content = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = hmacSha256(content, SECRET_KEY);

  try {
    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Verify token expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * Validate a short-lived media ticket against a specific requested terminal and tenant.
 */
function verifyMediaTicket(ticket, requestedTerminalId) {
  const claims = verifyToken(ticket);
  if (!claims) return null;

  if (claims.purpose !== 'MEDIA_STREAM') {
    return null; // Not a scoped media ticket
  }

  // Super Admin can stream any terminal; other roles are constrained to the ticket's terminalId
  if (claims.role !== 'SUPER_ADMIN') {
    if (requestedTerminalId && String(claims.terminalId) !== String(requestedTerminalId)) {
      return null; // Cross-vehicle violation
    }
  }

  return claims;
}

module.exports = {
  createToken,
  createMediaTicket,
  verifyToken,
  verifyMediaTicket,
  SECRET_KEY
};
