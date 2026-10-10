import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const root = () => resolve(process.env["MEDIA_ROOT"] || "storage/media");
const secret = () => {
  const value = process.env["MEDIA_SIGNING_SECRET"];
  if (!value || value.length < 24) throw new Error("MEDIA_SIGNING_SECRET must contain at least 24 characters.");
  return value;
};
const signature = (path: string, expires: number) => createHmac("sha256", secret()).update(`${path}:${expires}`).digest("base64url");

export function mediaFile(path: string) {
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const file = resolve(root(), clean);
  if (!file.startsWith(`${root()}${sep}`)) throw new Error("Invalid media path");
  return file;
}
export async function ensureMediaParent(path: string) { await mkdir(dirname(mediaFile(path)), { recursive: true }); }
export function signedMediaUrl(path: string, hours = 6) {
  const expires = Math.floor(Date.now() / 1000) + hours * 3600;
  return `/api/media?path=${encodeURIComponent(path)}&expires=${expires}&signature=${encodeURIComponent(signature(path, expires))}`;
}
export function verifyMediaSignature(path: string, expires: number, supplied: string) {
  if (!Number.isSafeInteger(expires) || expires < Date.now() / 1000) return false;
  const expected = Buffer.from(signature(path, expires));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
