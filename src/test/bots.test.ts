import { describe, expect, it } from "vitest";
import { blockBotRequest, isBotUserAgent, ROBOTS_TAG, withNoIndex } from "@/server/bots.server";

describe("bot access policy", () => {
  it("blocks common crawler user agents", () => {
    const response = blockBotRequest(
      new Request("https://eh-passport.ch", { headers: { "user-agent": "Googlebot/2.1" } }),
    );

    expect(response?.status).toBe(403);
    expect(response?.headers.get("x-robots-tag")).toBe(ROBOTS_TAG);
  });

  it("allows normal browser user agents", () => {
    expect(isBotUserAgent("Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0 Safari/537.36")).toBe(false);
  });

  it("adds noindex headers to normal responses", () => {
    const response = withNoIndex(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("x-robots-tag")).toBe(ROBOTS_TAG);
  });
});
