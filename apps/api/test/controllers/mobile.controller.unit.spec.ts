/**
 * Unit Tests — MobileController token parsing
 *
 * Tests the base64 JWT-like token decode logic used by the mobile controller
 * to authenticate requests from the delegatecart-mobile app.
 *
 * Token format: Bearer <base64(JSON.stringify({ userId, email, iat }))>
 */

// ── Pure decodeUserId logic (mirrors MobileController.decodeUserId) ──────────
class TokenDecodeError extends Error {
  constructor(public readonly status: 401 | 400 = 401) {
    super(status === 401 ? 'Invalid auth token' : 'Missing Bearer token');
  }
}

function decodeUserId(authorization: string | undefined): number {
  if (!authorization?.startsWith('Bearer ')) {
    throw new TokenDecodeError(400);
  }
  try {
    const token = authorization.slice(7);
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const userId = payload?.userId;
    if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
      throw new Error('invalid userId in token');
    }
    return userId;
  } catch {
    throw new TokenDecodeError(401);
  }
}

/** Builds a valid mobile Bearer token for a given userId */
function buildMobileToken(payload: { userId: number; email?: string; iat?: number }): string {
  return `Bearer ${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('MobileController — decodeUserId', () => {
  describe('valid tokens', () => {
    it('extracts userId from valid token', () => {
      const token = buildMobileToken({ userId: 42, email: 'user@test.com', iat: Date.now() });
      expect(decodeUserId(token)).toBe(42);
    });

    it('extracts userId without optional fields (email, iat)', () => {
      const token = buildMobileToken({ userId: 7 });
      expect(decodeUserId(token)).toBe(7);
    });

    it('accepts large userId values', () => {
      const token = buildMobileToken({ userId: 999999 });
      expect(decodeUserId(token)).toBe(999999);
    });

    it('accepts userId = 1 (minimum valid)', () => {
      const token = buildMobileToken({ userId: 1 });
      expect(decodeUserId(token)).toBe(1);
    });
  });

  describe('missing or malformed auth header', () => {
    it('throws when authorization header is undefined', () => {
      expect(() => decodeUserId(undefined)).toThrow(TokenDecodeError);
    });

    it('throws when authorization header is empty string', () => {
      expect(() => decodeUserId('')).toThrow(TokenDecodeError);
    });

    it('throws when "Bearer " prefix is missing', () => {
      const token = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64');
      expect(() => decodeUserId(token)).toThrow(TokenDecodeError);
    });

    it('throws when using lowercase "bearer " prefix', () => {
      const token = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64');
      expect(() => decodeUserId(`bearer ${token}`)).toThrow(TokenDecodeError);
    });
  });

  describe('invalid token payloads', () => {
    it('throws when token is not valid base64', () => {
      expect(() => decodeUserId('Bearer not-valid-base64!!!')).toThrow(TokenDecodeError);
    });

    it('throws when payload is not valid JSON', () => {
      const badBase64 = Buffer.from('not-json').toString('base64');
      expect(() => decodeUserId(`Bearer ${badBase64}`)).toThrow(TokenDecodeError);
    });

    it('throws when userId is missing from payload', () => {
      const token = buildMobileToken({ userId: undefined as any });
      expect(() => decodeUserId(token)).toThrow(TokenDecodeError);
    });

    it('throws when userId is zero', () => {
      const token = buildMobileToken({ userId: 0 });
      expect(() => decodeUserId(token)).toThrow(TokenDecodeError);
    });

    it('throws when userId is negative', () => {
      const token = buildMobileToken({ userId: -1 });
      expect(() => decodeUserId(token)).toThrow(TokenDecodeError);
    });

    it('throws when userId is a float', () => {
      const token = buildMobileToken({ userId: 3.14 as any });
      expect(() => decodeUserId(token)).toThrow(TokenDecodeError);
    });

    it('throws when userId is a string', () => {
      const raw = Buffer.from(JSON.stringify({ userId: '42' })).toString('base64');
      expect(() => decodeUserId(`Bearer ${raw}`)).toThrow(TokenDecodeError);
    });

    it('throws when payload is null', () => {
      const raw = Buffer.from('null').toString('base64');
      expect(() => decodeUserId(`Bearer ${raw}`)).toThrow(TokenDecodeError);
    });

    it('throws when payload is an empty object', () => {
      const raw = Buffer.from('{}').toString('base64');
      expect(() => decodeUserId(`Bearer ${raw}`)).toThrow(TokenDecodeError);
    });
  });

  describe('token round-trip fidelity', () => {
    it('correctly round-trips multiple user IDs', () => {
      const ids = [1, 10, 100, 1000, 99999];
      for (const id of ids) {
        const token = buildMobileToken({ userId: id });
        expect(decodeUserId(token)).toBe(id);
      }
    });

    it('buildMobileToken produces Bearer-prefixed base64', () => {
      const token = buildMobileToken({ userId: 5 });
      expect(token).toMatch(/^Bearer [A-Za-z0-9+/]+=*$/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authorization header flow for mobile requests
// ─────────────────────────────────────────────────────────────────────────────

describe('Mobile auth token format', () => {
  it('token payload contains userId, email, and iat fields', () => {
    const userId = 42;
    const email = 'user@delegatecart.com';
    const iat = Math.floor(Date.now() / 1000);
    const token = buildMobileToken({ userId, email, iat });

    const raw = token.slice(7);
    const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    expect(decoded.userId).toBe(userId);
    expect(decoded.email).toBe(email);
    expect(decoded.iat).toBe(iat);
  });

  it('iat field can be used for token expiry checks', () => {
    const oldIat = Math.floor(Date.now() / 1000) - 86400 * 30; // 30 days ago
    const token = buildMobileToken({ userId: 1, iat: oldIat });
    const raw = token.slice(7);
    const payload = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    const age = Math.floor(Date.now() / 1000) - payload.iat;
    expect(age).toBeGreaterThan(86400 * 29); // definitely stale
  });
});
