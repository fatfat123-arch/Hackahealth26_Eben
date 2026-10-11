import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";
import {
  MEDIA_LIMITS,
  mediaContentMatches,
  mediaExtension,
  mediaFileError,
  mediaKind,
} from "@/lib/media-limits";
import {
  limitedFormData,
  rejectCrossOrigin,
  RequestBodyTooLargeError,
} from "@/server/request-security.server";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const originError = rejectCrossOrigin(request);
        if (originError) return originError;
        const cookie = request.headers
          .get("cookie")
          ?.match(/(?:^|;\s*)(?:__Host-)?eh_session=([^;]+)/)?.[1];
        const { sessionUserFromToken } = await import("@/server/auth.server");
        const user = await sessionUserFromToken(cookie ? decodeURIComponent(cookie) : null);
        if (!user || user.archived_at) return new Response("Non autorisé", { status: 401 });
        let form: FormData;
        try {
          form = await limitedFormData(request, MEDIA_LIMITS.video);
        } catch (error) {
          if (error instanceof RequestBodyTooLargeError)
            return new Response("Fichier trop volumineux", { status: 413 });
          throw error;
        }
        const file = form.get("file");
        const patientId = String(form.get("patientId") || "");
        if (!(file instanceof File) || !mediaKind(file.type) || !/^[0-9a-f-]{36}$/i.test(patientId))
          return new Response("Fichier invalide", { status: 400 });
        const validationError = mediaFileError(file);
        if (validationError) return new Response(validationError, { status: 413 });
        if (!(await mediaContentMatches(file)))
          return new Response("Le contenu du fichier ne correspond pas à son format.", {
            status: 415,
          });
        const safeExt = mediaExtension(file.type);
        if (!safeExt) return new Response("Type de fichier non autorisé", { status: 415 });
        const path = `patients/${patientId}/${randomUUID()}${safeExt}`;
        const { ensureMediaParent, mediaFile, signedMediaUrl } =
          await import("@/server/media.server");
        await ensureMediaParent(path);
        await writeFile(mediaFile(path), new Uint8Array(await file.arrayBuffer()));
        return Response.json({ path, url: signedMediaUrl(path) });
      },
    },
  },
});
