const DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export const LOGIN_RATE_LIMIT_MESSAGE = "Trop de tentatives de connexion. Réessayez dans quelques minutes.";

type LoginAttempt = {
  count: number;
  resetAt: number;
};

type LoginRateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
};

const attempts = new Map<string, LoginAttempt>();

function nonNegativeInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function config(): LoginRateLimitConfig {
  return {
    maxAttempts: nonNegativeInteger(process.env["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"], DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS),
    windowMs: nonNegativeInteger(process.env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"], DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS) * 1000,
  };
}

function key(identifier: string) {
  return identifier.trim().toLowerCase();
}

function activeAttempt(identifier: string, now: number) {
  const attempt = attempts.get(key(identifier));
  if (!attempt) return null;
  if (attempt.resetAt <= now) {
    attempts.delete(key(identifier));
    return null;
  }
  return attempt;
}

export function assertLoginRateLimit(identifier: string, now = Date.now()) {
  const { maxAttempts, windowMs } = config();
  if (maxAttempts === 0 || windowMs === 0) return;
  const attempt = activeAttempt(identifier, now);
  if (attempt && attempt.count >= maxAttempts) throw new Error(LOGIN_RATE_LIMIT_MESSAGE);
}

export function recordFailedLogin(identifier: string, now = Date.now()) {
  const { maxAttempts, windowMs } = config();
  if (maxAttempts === 0 || windowMs === 0) return;
  const attempt = activeAttempt(identifier, now);
  const normalized = key(identifier);
  attempts.set(normalized, { count: (attempt?.count ?? 0) + 1, resetAt: attempt?.resetAt ?? now + windowMs });
}

export function resetLoginRateLimit(identifier: string) {
  attempts.delete(key(identifier));
}

export function clearLoginRateLimits() {
  attempts.clear();
}
