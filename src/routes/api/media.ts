import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };
export const Route = createFileRoute("/api/media")({ server: { handlers: { GET: async ({ request }) => {
  const url = new URL(request.url); const path = url.searchParams.get("path") || ""; const expires = Number(url.searchParams.get("expires")); const sig = url.searchParams.get("signature") || "";
  const { mediaFile, verifyMediaSignature } = await import("@/server/media.server");
  if (!verifyMediaSignature(path, expires, sig)) return new Response("Lien invalide ou expiré", { status: 403 });
  try { return new Response(new Uint8Array(await readFile(mediaFile(path))), { headers: { "content-type": TYPES[extname(path).toLowerCase()] || "application/octet-stream", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } }); }
  catch { return new Response("Fichier introuvable", { status: 404 }); }
} } } });
