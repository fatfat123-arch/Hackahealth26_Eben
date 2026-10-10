import { afterEach, describe, expect, it } from "vitest";
import { requireBasicAuth } from "@/server/basic-auth";

const originalUsername = process.env["HTTP_BASIC_AUTH_USERNAME"];
const originalPassword = process.env["HTTP_BASIC_AUTH_PASSWORD"];

afterEach(() => {
  if (originalUsername === undefined) delete process.env["HTTP_BASIC_AUTH_USERNAME"];
  else process.env["HTTP_BASIC_AUTH_USERNAME"] = originalUsername;
  if (originalPassword === undefined) delete process.env["HTTP_BASIC_AUTH_PASSWORD"];
  else process.env["HTTP_BASIC_AUTH_PASSWORD"] = originalPassword;
});

describe("HTTP Basic authentication", () => {
  it("is disabled when no password is configured", () => {
    delete process.env["HTTP_BASIC_AUTH_PASSWORD"];
    expect(requireBasicAuth(new Request("https://eh-passport.ch/"))).toBeNull();
  });

  it("challenges missing credentials", () => {
    process.env["HTTP_BASIC_AUTH_PASSWORD"] = "secret";
    const response = requireBasicAuth(new Request("https://eh-passport.ch/"));
    expect(response?.status).toBe(401);
    expect(response?.headers.get("www-authenticate")).toContain("Basic");
  });

  it("accepts configured credentials including colons in the password", () => {
    process.env["HTTP_BASIC_AUTH_USERNAME"] = "jury";
    process.env["HTTP_BASIC_AUTH_PASSWORD"] = "secret:2026";
    const token = Buffer.from("jury:secret:2026").toString("base64");
    const request = new Request("https://eh-passport.ch/", { headers: { authorization: `Basic ${token}` } });
    expect(requireBasicAuth(request)).toBeNull();
  });
});
