import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };

function byteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
    end = Math.min(end, size - 1);
  }
  return start < 0 || start >= size || end < start ? null : { start, end };
}

async function serve(request: Request, head = false) {
  const url = new URL(request.url); const path = url.searchParams.get("path") || ""; const expires = Number(url.searchParams.get("expires")); const sig = url.searchParams.get("signature") || "";
  const { mediaFile, verifyMediaSignature } = await import("@/server/media.server");
  if (!verifyMediaSignature(path, expires, sig)) return new Response("Lien invalide ou expiré", { status: 403 });
  try {
    const file = mediaFile(path);
    const size = (await stat(file)).size;
    const headers = new Headers({
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
      "content-type": TYPES[extname(path).toLowerCase()] || "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    const requested = request.headers.get("range");
    if (requested) {
      const range = byteRange(requested, size);
      if (!range) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
      const length = range.end - range.start + 1;
      headers.set("content-length", String(length));
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      const body = head ? null : Readable.toWeb(createReadStream(file, range)) as ReadableStream;
      return new Response(body, { status: 206, headers });
    }
    headers.set("content-length", String(size));
    const body = head ? null : Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(body, { headers });
  } catch {
    return new Response("Fichier introuvable", { status: 404 });
  }
}

export const Route = createFileRoute("/api/media")({
  server: { handlers: {
    GET: ({ request }) => serve(request),
    HEAD: ({ request }) => serve(request, true),
  } },
});
