import { createFileRoute } from "@tanstack/react-router";
import { PassportView } from "@/components/passport/passport-view";
import { passport } from "@/data/passport";

export const Route = createFileRoute("/demo")({
  component: Demo,
  head: () => ({ meta: [
    { title: "Passeport de communication — Julien Morel" },
    { name: "description", content: "Découvrez comment communiquer avec Julien : ses gestes, ses centres d’intérêt et ce qui est important pour lui." },
    { property: "og:title", content: "Passeport de communication — Julien Morel" },
    { property: "og:description", content: "Prendre le temps de comprendre Julien, ses gestes et ses besoins." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

function Demo() {
  return <PassportView data={passport} demo />;
}
