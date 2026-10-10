import { describe, expect, it } from "vitest";
import { mediaFileError } from "@/lib/media-limits";

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
});
