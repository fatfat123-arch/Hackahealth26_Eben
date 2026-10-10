import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cartoonise")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cartooniseRequest } = await import("@/server/cartoonise.server");
        return cartooniseRequest(request);
      },
    },
  },
});
