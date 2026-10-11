const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|slurp|duckduckgo|baiduspider|yandex|sogou|exabot|facebot|facebookexternalhit|twitterbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkshare|whatsapp|telegrambot|discordbot|applebot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot/i;

export const ROBOTS_TAG = "noindex, nofollow, noarchive, nosnippet, noimageindex";

export function isBotUserAgent(userAgent: string | null) {
  return BOT_USER_AGENT_PATTERN.test(userAgent ?? "");
}

export function blockBotRequest(request: Request) {
  if (!isBotUserAgent(request.headers.get("user-agent"))) return null;
  return new Response("Bots are not allowed", {
    status: 403,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": ROBOTS_TAG,
    },
  });
}

export function withNoIndex(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", ROBOTS_TAG);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
