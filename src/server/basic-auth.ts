import { timingSafeEqual } from "node:crypto";

const REALM = "EH Passport";

function equal(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function credentials(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export function requireBasicAuth(request: Request) {
  const expectedPassword = process.env["HTTP_BASIC_AUTH_PASSWORD"];
  if (!expectedPassword) return null;
  const expectedUsername = process.env["HTTP_BASIC_AUTH_USERNAME"] || "eh-passport";
  const supplied = credentials(request);
  if (supplied && equal(supplied.username, expectedUsername) && equal(supplied.password, expectedPassword)) return null;
  return new Response("Authentification requise", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}
