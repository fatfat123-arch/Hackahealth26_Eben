import { afterEach, describe, expect, it } from "vitest";
import {
  applySecurityHeaders,
  isSameOriginRequest,
  limitedFormData,
  RequestBodyTooLargeError,
} from "@/server/request-security.server";

afterEach(() => delete process.env["PUBLISHED_ORIGIN"]);

describe("sécurité des requêtes", () => {
  it("refuse une origine différente du domaine publié", () => {
    process.env["PUBLISHED_ORIGIN"] = "https://eh-passport.ch";
    expect(
      isSameOriginRequest(
        new Request("https://eh-passport.ch/api/upload", {
          headers: { origin: "https://attaque.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        new Request("https://eh-passport.ch/api/upload", {
          headers: { origin: "https://eh-passport.ch" },
        }),
      ),
    ).toBe(true);
  });

  it("interrompt un corps HTTP qui dépasse la limite", async () => {
    const request = new Request("https://eh-passport.ch/api/upload", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array(1024 * 1024 + 2),
    });
    await expect(limitedFormData(request, 1)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("ajoute les protections HTTP globales", () => {
    const secured = applySecurityHeaders(
      new Request("https://eh-passport.ch/connexion"),
      new Response("ok"),
    );
    expect(secured.headers.get("x-frame-options")).toBe("DENY");
    expect(secured.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(secured.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });
});
