import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { dateOnly, db, iso, json } from "@/server/db.server";
import { signedMediaUrl } from "@/server/media.server";
import { ageFromBirthDate } from "@/lib/patients";
type PublicRow = RowDataPacket & {
  id: string;
  public_id: string;
  name: string;
  birth_date: Date | string | null;
  phone: string;
  phone_note: string;
  about: string;
  how_to: string;
  reminder: string;
  photo_path: string | null;
  photo_position_y: number;
  dictionary: unknown;
  communicates: unknown;
  understanding_needs: unknown;
  tools: unknown;
  facilitators: unknown;
  interests: unknown;
  dislikes: unknown;
  additional: unknown;
  section_order: unknown;
  updated_at: Date | string;
  archived_at: Date | string | null;
};

// Public read of ONE patient by public URL id (the QR/NFC target). Only this patient's media gets signed URLs.
export const getPublicPassport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const [rows] = await db().execute<PublicRow[]>(
      "SELECT id,public_id,name,birth_date,phone,phone_note,about,how_to,reminder,photo_path,photo_position_y,dictionary,communicates,understanding_needs,tools,facilitators,interests,dislikes,additional,section_order,updated_at,archived_at FROM patients WHERE public_id=? LIMIT 1",
      [data.id],
    );
    const raw = rows[0];
    const row = raw
      ? {
          ...raw,
          dictionary: json(raw.dictionary, []),
          communicates: json(raw.communicates, []),
          understanding_needs: json(raw.understanding_needs, []),
          tools: json(raw.tools, []),
          facilitators: json(raw.facilitators, []),
          interests: json(raw.interests, []),
          dislikes: json(raw.dislikes, []),
          additional: json(raw.additional, []),
          section_order: json(raw.section_order, []),
          updated_at: iso(raw.updated_at),
          archived_at: iso(raw.archived_at),
          age: ageFromBirthDate(dateOnly(raw.birth_date)),
        }
      : null;
    if (!row) return null;
    if (row.archived_at) return { archived: true as const };
    // The exact birth date and internal identifiers are private: public QR-code responses expose only the calculated age.
    const { birth_date: _birthDate, id: _id, public_id: _publicId, ...publicRow } = row;
    const paths: string[] = [];
    if (row.photo_path) paths.push(row.photo_path);
    for (const e of (Array.isArray(row.dictionary) ? row.dictionary : []) as {
      path?: string;
      posterPath?: string;
    }[]) {
      if (e.path) paths.push(e.path);
      if (e.posterPath) paths.push(e.posterPath);
    }
    const urls: Record<string, string> = {};
    if (paths.length) {
      for (const path of paths) urls[path] = signedMediaUrl(path);
    }
    return { archived: false as const, row: publicRow, urls };
  });
