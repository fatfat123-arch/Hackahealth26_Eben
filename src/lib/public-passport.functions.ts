import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public read of ONE patient by id (the QR code target). Only this patient's media gets signed URLs.
export const getPublicPassport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("patients")
      .select("id,name,birth_date,phone,phone_note,address,about,how_to,reminder,photo_path,dictionary,communicates,understanding_needs,tools,facilitators,interests,dislikes,additional,updated_at,archived_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return null;
    if (row.archived_at) return { archived: true as const };
    const paths: string[] = [];
    if (row.photo_path) paths.push(row.photo_path);
    for (const e of (Array.isArray(row.dictionary) ? row.dictionary : []) as { path?: string; posterPath?: string }[]) {
      if (e.path) paths.push(e.path);
      if (e.posterPath) paths.push(e.posterPath);
    }
    const urls: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await supabaseAdmin.storage.from("passport-media").createSignedUrls(paths, 60 * 60 * 6);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    }
    return { archived: false as const, row, urls };
  });
