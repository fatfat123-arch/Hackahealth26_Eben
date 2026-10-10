import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/upload")({ server: { handlers: { POST: async ({ request }) => {
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)eh_session=([^;]+)/)?.[1];
  const { sessionUserFromToken } = await import("@/server/auth.server");
  const user = await sessionUserFromToken(cookie ? decodeURIComponent(cookie) : null);
  if (!user || user.archived_at) return new Response("Non autorisé", { status: 401 });
  const form = await request.formData(); const file = form.get("file"); const patientId = String(form.get("patientId") || "");
  const allowed = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm)|audio\/(mpeg|wav|ogg))$/;
  if (!(file instanceof File) || !allowed.test(file.type) || !/^[0-9a-f-]{36}$/i.test(patientId) || file.size > 100 * 1024 * 1024) return new Response("Fichier invalide", { status: 400 });
  const safeExt = extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  const path = `patients/${patientId}/${randomUUID()}${safeExt}`;
  const { ensureMediaParent, mediaFile, signedMediaUrl } = await import("@/server/media.server");
  await ensureMediaParent(path); await writeFile(mediaFile(path), new Uint8Array(await file.arrayBuffer()));
  return Response.json({ path, url: signedMediaUrl(path) });
} } } });
