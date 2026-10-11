// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mediaContentMatches, mediaExtension, mediaFileError, mediaKind } from "@/lib/media-limits";

describe("media upload limits", () => {
  it("accepts MP3 audio within the audio limit", () => {
    expect(mediaFileError({ type: "audio/mpeg", size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("accepts another audio MIME type", () => {
    expect(mediaFileError({ type: "audio/flac", size: 20 * 1024 * 1024 })).toBeNull();
  });

  it("rejects oversized media with the relevant limit", () => {
    expect(mediaFileError({ type: "audio/mpeg", size: 31 * 1024 * 1024 })).toContain("30 Mo");
    expect(mediaFileError({ type: "video/mp4", size: 101 * 1024 * 1024 })).toContain("100 Mo");
  });

  it("refuse les types génériques ou exécutables déguisés en média", () => {
    expect(mediaKind("image/svg+xml")).toBeNull();
    expect(mediaKind("text/html")).toBeNull();
    expect(mediaExtension("image/png")).toBe(".png");
    expect(mediaExtension("video/mp4")).toBe(".mp4");
  });

  it("vérifie la signature réelle du contenu", async () => {
    const png = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "image.png",
      { type: "image/png" },
    );
    const fake = new File(["<script>alert(1)</script>"], "image.png", { type: "image/png" });
    await expect(mediaContentMatches(png)).resolves.toBe(true);
    await expect(mediaContentMatches(fake)).resolves.toBe(false);
  });
});
