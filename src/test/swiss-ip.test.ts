import { afterEach, describe, expect, it } from "vitest";
import { clientIp, isSwissIp, requireSwissIp } from "@/server/swiss-ip";

afterEach(() => {
  delete process.env["SWISS_IP_ONLY"];
  delete process.env["TRUSTED_PROXY_HOPS"];
});

describe("Swiss IP restriction", () => {
  it("uses the last address supplied by Infomaniak's proxy chain", () => {
    const request = new Request("https://eh-passport.ch", {
      headers: { "x-forwarded-for": "198.51.100.2, 83.166.133.15, 2a02:1210::1" },
    });
    expect(clientIp(request)).toBe("2a02:1210::1");
  });

  it("ignores the configured number of trusted proxy hops", () => {
    process.env["TRUSTED_PROXY_HOPS"] = "1";
    const request = new Request("https://eh-passport.ch", {
      headers: { "x-forwarded-for": "198.51.100.2, 83.166.133.15" },
    });
    expect(clientIp(request)).toBe("198.51.100.2");
  });

  it("recognizes Swiss and non-Swiss addresses", () => {
    expect(isSwissIp("2a02:1210::1")).toBe(true);
    expect(isSwissIp("8.8.8.8")).toBe(false);
  });

  it("returns 403 when enabled and the request is not Swiss", () => {
    process.env["SWISS_IP_ONLY"] = "true";
    const response = requireSwissIp(
      new Request("https://eh-passport.ch", { headers: { "x-forwarded-for": "8.8.8.8" } }),
    );
    expect(response?.status).toBe(403);
  });
});
