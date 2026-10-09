import { createFileRoute, notFound } from "@tanstack/react-router";
import { PassportView } from "@/components/passport/passport-view";
import { getPublicPassport } from "@/lib/public-passport.functions";
import { rowToDraft, toViewData, type PatientRow } from "@/lib/patients";

export const Route = createFileRoute("/passeport/$id")({
  loader: async ({ params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const res = await getPublicPassport({ data: { id: params.id } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.row.name ?? "Passeport";
    return { meta: [
      { title: `Passeport de communication — ${name}` },
      { name: "description", content: `Comment communiquer avec ${name} : ses gestes, ses centres d’intérêt et ce qui est important pour cette personne.` },
      { property: "og:title", content: `Passeport de communication — ${name}` },
      { property: "og:description", content: `Prendre le temps de comprendre ${name}.` },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ] };
  },
  notFoundComponent: () => <div className="passport-page"><h1 className="bo-title">Passeport introuvable</h1><p>Ce passeport n’existe pas ou n’est plus disponible.</p></div>,
  component: PublicPassport,
});

function PublicPassport() {
  const { row, urls } = Route.useLoaderData();
  const r = row as unknown as PatientRow;
  return <PassportView data={toViewData(rowToDraft(r), urls, r.updated_at)} />;
}
