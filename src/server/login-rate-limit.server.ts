import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "@/server/db.server";

const DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export const LOGIN_RATE_LIMIT_MESSAGE =
  "Trop de tentatives de connexion. Réessayez dans quelques minutes.";

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
    maxAttempts: nonNegativeInteger(
      process.env["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"],
      DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    ),
    windowMs:
      nonNegativeInteger(
        process.env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"],
        DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      ) * 1000,
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
  attempts.set(normalized, {
    count: (attempt?.count ?? 0) + 1,
    resetAt: attempt?.resetAt ?? now + windowMs,
  });
}

export function resetLoginRateLimit(identifier: string) {
  attempts.delete(key(identifier));
}

export function clearLoginRateLimits() {
  attempts.clear();
}

const identifierHash = (identifier: string) =>
  createHash("sha256").update(key(identifier)).digest("hex");

export async function assertPersistentLoginRateLimit(identifiers: string[]) {
  const { maxAttempts, windowMs } = config();
  if (maxAttempts === 0 || windowMs === 0) return;
  identifiers.forEach((identifier) => assertLoginRateLimit(identifier));
  const hashes = identifiers.map(identifierHash);
  const placeholders = hashes.map(() => "?").join(",");
  const [rows] = await db().execute<(RowDataPacket & { attempt_count: number })[]>(
    `SELECT attempt_count FROM login_rate_limits WHERE identifier_hash IN (${placeholders}) AND reset_at>NOW()`,
    hashes,
  );
  if (rows.some((row) => Number(row.attempt_count) >= maxAttempts))
    throw new Error(LOGIN_RATE_LIMIT_MESSAGE);
}

export async function recordPersistentFailedLogin(identifiers: string[]) {
  const { maxAttempts, windowMs } = config();
  if (maxAttempts === 0 || windowMs === 0) return;
  identifiers.forEach((identifier) => recordFailedLogin(identifier));
  const resetAt = new Date(Date.now() + windowMs);
  await Promise.all(
    identifiers.map((identifier) =>
      db().execute(
        `INSERT INTO login_rate_limits (identifier_hash,attempt_count,reset_at) VALUES (?,1,?)
         ON DUPLICATE KEY UPDATE
           attempt_count=IF(reset_at<=NOW(),1,attempt_count+1),
           reset_at=IF(reset_at<=NOW(),VALUES(reset_at),reset_at)`,
        [identifierHash(identifier), resetAt],
      ),
    ),
  );
}

export async function resetPersistentLoginRateLimit(identifier: string) {
  resetLoginRateLimit(identifier);
  await db().execute("DELETE FROM login_rate_limits WHERE identifier_hash=?", [
    identifierHash(identifier),
  ]);
}
