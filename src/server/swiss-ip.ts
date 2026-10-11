import { isIP } from "node:net";
import swissRanges from "../../config/swiss-ip-ranges.json" with { type: "json" };

type Range = { family: "ipv4" | "ipv6"; start: string; value: number };

function normalize(value: string) {
  const candidate = value.trim().replace(/^\[|\]$/g, "");
  if (candidate.startsWith("::ffff:")) return candidate.slice(7);
  return candidate;
}

function ipv4Number(address: string) {
  return address.split(".").reduce((value, part) => value * 256 + Number(part), 0);
}

function ipv6Number(address: string) {
  const [left = "", right = ""] = address.toLowerCase().split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const fill = Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill("0");
  return [...leftParts, ...fill, ...rightParts].reduce(
    (value, part) => (value << 16n) + BigInt(`0x${part || "0"}`),
    0n,
  );
}

function inRange(address: string, range: Range) {
  if (range.family === "ipv4") {
    if (isIP(address) !== 4) return false;
    const value = ipv4Number(address);
    const start = ipv4Number(range.start);
    return value >= start && value < start + range.value;
  }
  if (isIP(address) !== 6) return false;
  const prefix = BigInt(range.value);
  const shift = 128n - prefix;
  return ipv6Number(address) >> shift === ipv6Number(range.start) >> shift;
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const chain = forwarded.split(",").map(normalize);
  const configuredHops = Number(process.env["TRUSTED_PROXY_HOPS"] || 0);
  const trustedHops =
    Number.isSafeInteger(configuredHops) && configuredHops >= 0 ? configuredHops : 0;
  const address = chain[Math.max(0, chain.length - 1 - trustedHops)] || "";
  return isIP(address) ? address : null;
}

export function isSwissIp(address: string) {
  const normalized = normalize(address);
  if (normalized === "127.0.0.1" || normalized === "::1") return true;
  return (swissRanges as Range[]).some((range) => inRange(normalized, range));
}

export function requireSwissIp(request: Request) {
  if (process.env["SWISS_IP_ONLY"] !== "true") return null;
  const address = clientIp(request);
  if (address && isSwissIp(address)) return null;
  return new Response("", {
    status: 403,
    headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
  });
}
