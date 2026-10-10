import { rm } from "node:fs/promises";
import type { RowDataPacket } from "mysql2";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth.functions";
import { db, iso, json } from "@/server/db.server";
import { mediaFile, signedMediaUrl } from "@/server/media.server";

type PatientRecord = RowDataPacket & {
  id: string; name: string; age: number | null; birth_date: string | Date | null; phone: string; phone_note: string; address: string;
  about: string; how_to: string; reminder: string; photo_path: string | null; dictionary: unknown;
  communicates: unknown; understanding_needs: unknown; tools: unknown; facilitators: unknown; interests: unknown;
  dislikes: unknown; additional: unknown; section_order: unknown; created_by: string | null;
  created_at: string | Date; updated_at: string | Date; archived_at: string | Date | null;
};
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type PatientResult = {
  id: string; name: string; age: number | null; birth_date: string | null; phone: string; phone_note: string; address: string;
  about: string; how_to: string; reminder: string; photo_path: string | null; created_by: string | null;
  created_at: string | null; updated_at: string | null; archived_at: string | null;
  dictionary: JsonValue[]; communicates: string[]; understanding_needs: string[]; tools: string[]; facilitators: string[];
  interests: string[]; dislikes: string[]; additional: string[]; section_order: string[];
};

const idSchema = z.string().uuid();
const JSON_COLUMNS = new Set(["dictionary", "communicates", "understanding_needs", "tools", "facilitators", "interests", "dislikes", "additional", "section_order"]);
const EDITABLE = new Set(["name", "age", "phone", "phone_note", "address", "about", "how_to", "reminder", "photo_path", ...JSON_COLUMNS]);

function editableValues(values: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(values).filter(([key]) => EDITABLE.has(key)));
  if ("age" in clean && clean["age"] !== null) {
    const age = Number(clean["age"]);
    if (!Number.isInteger(age) || age < 0 || age > 130) throw new Error("L’âge doit être compris entre 0 et 130 ans.");
    clean["age"] = age;
  }
  return clean;
}

function patient(row: PatientRecord): PatientResult {
  return { ...row, birth_date: row.birth_date ? String(row.birth_date).slice(0, 10) : null,
    dictionary: json<JsonValue[]>(row.dictionary, []), communicates: json(row.communicates, []), understanding_needs: json(row.understanding_needs, []),
    tools: json(row.tools, []), facilitators: json(row.facilitators, []), interests: json(row.interests, []), dislikes: json(row.dislikes, []),
    additional: json(row.additional, []), section_order: json(row.section_order, []), created_at: iso(row.created_at), updated_at: iso(row.updated_at), archived_at: iso(row.archived_at) };
}
function paths(row: PatientResult) {
  const result: string[] = [];
  if (row.photo_path) result.push(row.photo_path);
  for (const item of json<{ path?: string; originalPath?: string; posterPath?: string }[]>(row.dictionary, [])) {
    if (item.path) result.push(item.path); if (item.originalPath) result.push(item.originalPath); if (item.posterPath) result.push(item.posterPath);
  }
  return result;
}

export const signMediaPaths = createServerFn({ method: "POST" }).middleware([requireAuth])
  .inputValidator((v: unknown) => z.object({ paths: z.array(z.string().max(500)).max(250) }).parse(v))
  .handler(async ({ data }) => Object.fromEntries([...new Set(data.paths.filter(Boolean))].map((p) => [p, signedMediaUrl(p)])));

export const listPatients = createServerFn({ method: "GET" }).middleware([requireAuth]).handler(async () => {
  const [rows] = await db().query<PatientRecord[]>("SELECT * FROM patients ORDER BY name");
  return rows.map((r) => patient(r));
});
export const getPatient = createServerFn({ method: "GET" }).middleware([requireAuth]).inputValidator((v: unknown) => idSchema.parse(v)).handler(async ({ data }) => {
  const [rows] = await db().execute<PatientRecord[]>("SELECT * FROM patients WHERE id=? LIMIT 1", [data]);
  return rows[0] ? patient(rows[0]) : null;
});
export const createPatient = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((v: unknown) => z.object({ id: idSchema, row: z.record(z.unknown()) }).parse(v)).handler(async ({ data, context }) => {
  const clean = editableValues(data.row);
  const keys = Object.keys(clean); const values = keys.map((k) => JSON_COLUMNS.has(k) ? JSON.stringify(clean[k] ?? []) : clean[k]) as (string | number | boolean | Date | null)[];
  await db().execute(`INSERT INTO patients (id,created_by,${keys.map((k) => `\`${k}\``).join(",")}) VALUES (?,?,${keys.map(() => "?").join(",")})`, [data.id, context.user.id, ...values]);
  return { ok: true };
});
export const updatePatient = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((v: unknown) => z.object({ id: idSchema, changes: z.record(z.unknown()) }).parse(v)).handler(async ({ data }) => {
  const entries = Object.entries(editableValues(data.changes));
  if (!entries.length) return { ok: true };
  const values = entries.map(([k, v]) => JSON_COLUMNS.has(k) ? JSON.stringify(v ?? []) : v) as (string | number | boolean | Date | null)[];
  await db().execute(`UPDATE patients SET ${entries.map(([k]) => `\`${k}\`=?`).join(",")} WHERE id=?`, [...values, data.id]);
  return { ok: true };
});
export const archivePatient = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((v: unknown) => z.object({ id: idSchema, archived: z.boolean() }).parse(v)).handler(async ({ data }) => {
  await db().execute("UPDATE patients SET archived_at=? WHERE id=?", [data.archived ? new Date() : null, data.id]); return { ok: true };
});
export const deletePatient = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((v: unknown) => idSchema.parse(v)).handler(async ({ data }) => {
  const [rows] = await db().execute<PatientRecord[]>("SELECT * FROM patients WHERE id=?", [data]);
  if (rows[0]) await Promise.all(paths(patient(rows[0])).map((p) => rm(mediaFile(p), { force: true }).catch(() => {})));
  await db().execute("DELETE FROM patients WHERE id=?", [data]); return { ok: true };
});
