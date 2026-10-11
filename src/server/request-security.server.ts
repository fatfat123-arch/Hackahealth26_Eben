const FORM_OVERHEAD_BYTES = 1024 * 1024;

export class RequestBodyTooLargeError extends Error {}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = process.env["PUBLISHED_ORIGIN"] || new URL(request.url).origin;
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

export function rejectCrossOrigin(request: Request) {
  return isSameOriginRequest(request)
    ? null
    : new Response("Origine non autorisée", {
        status: 403,
        headers: { "cache-control": "no-store" },
      });
}

export async function limitedFormData(request: Request, payloadLimit: number) {
  const limit = payloadLimit + FORM_OVERHEAD_BYTES;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new RequestBodyTooLargeError();
  if (!request.body) return request.formData();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(request.headers);
  headers.set("content-length", String(length));
  return new Request(request.url, { method: request.method, headers, body }).formData();
}

export function applySecurityHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set(
    "content-security-policy",
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:",
  );
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("origin-agent-cluster", "?1");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-dns-prefetch-control", "off");
  headers.set("x-permitted-cross-domain-policies", "none");
  headers.set("x-frame-options", "DENY");
  const path = new URL(request.url).pathname;
  if (
    path === "/connexion" ||
    path.startsWith("/espace") ||
    path.startsWith("/_serverFn/") ||
    path === "/api/upload" ||
    path === "/api/cartoonise" ||
    response.headers.has("set-cookie")
  )
    headers.set("cache-control", "no-store");
  if (new URL(request.url).protocol === "https:")
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
