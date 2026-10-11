import { afterEach, describe, expect, it } from "vitest";
import { assertLoginRateLimit, clearLoginRateLimits, LOGIN_RATE_LIMIT_MESSAGE, recordFailedLogin, resetLoginRateLimit } from "@/server/login-rate-limit.server";

afterEach(() => {
  delete process.env["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"];
  delete process.env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"];
  clearLoginRateLimits();
});

describe("login rate limit", () => {
  it("blocks an identifier after the configured number of failed attempts", () => {
    process.env["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"] = "2";
    process.env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"] = "60";

    recordFailedLogin("USER@example.ch", 1_000);
    assertLoginRateLimit("user@example.ch", 2_000);
    recordFailedLogin("user@example.ch", 3_000);

    expect(() => assertLoginRateLimit("user@example.ch", 4_000)).toThrow(LOGIN_RATE_LIMIT_MESSAGE);
  });

  it("allows attempts after the configured window expires", () => {
    process.env["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"] = "1";
    process.env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"] = "2";

    recordFailedLogin("user@example.ch", 1_000);
    expect(() => assertLoginRateLimit("user@example.ch", 2_000)).toThrow(LOGIN_RATE_LIMIT_MESSAGE);
    expect(() => assertLoginRateLimit("user@example.ch", 3_001)).not.toThrow();
  });

  it("can be disabled with a zero max attempt setting", () => {
    process.env["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"] = "0";
    process.env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"] = "60";

    recordFailedLogin("user@example.ch", 1_000);

    expect(() => assertLoginRateLimit("user@example.ch", 2_000)).not.toThrow();
  });

  it("clears failed attempts after a successful login", () => {
    process.env["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"] = "1";
    process.env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"] = "60";

    recordFailedLogin("user@example.ch", 1_000);
    resetLoginRateLimit("user@example.ch");

    expect(() => assertLoginRateLimit("user@example.ch", 2_000)).not.toThrow();
  });
});
