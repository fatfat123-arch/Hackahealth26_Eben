import { createFileRoute, notFound } from "@tanstack/react-router";
import { PassportView } from "@/components/passport/passport-view";
import { getPublicPassport } from "@/lib/public-passport.functions";
import { Mascot } from "@/components/mascot";
import { rowToDraft, toViewData, type PatientRow } from "@/lib/patients";

export const Route = createFileRoute("/passeport/$id")({
  loader: async ({ params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const res = await getPublicPassport({ data: { id: params.id } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const name = loaderData && !loaderData.archived ? loaderData.row.name : "Passeport";
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
  staleTime: 0,
  errorComponent: () => <div className="passport-page status-page"><h1 className="bo-title">Le passeport n’a pas pu être chargé.</h1><p>Merci de réessayer dans un instant.</p></div>,
  notFoundComponent: () => <div className="passport-page status-page"><Mascot pose="inquiete" size={140} /><h1 className="bo-title">Passeport introuvable</h1><p>Désolé, ce passeport n’existe pas ou n’est plus disponible.</p></div>,
  component: PublicPassport,
});

function PublicPassport() {
  const res = Route.useLoaderData();
  if (res.archived) return <div className="passport-page status-page"><Mascot pose="inquiete" size={140} /><h1 className="bo-title">Ce passeport n’est plus actif.</h1><p>Merci de votre attention et de votre gentillesse.</p></div>;
  const { row, urls } = res;
  const r = row as unknown as PatientRow;
  return <PassportView data={toViewData(rowToDraft(r), urls, r.updated_at, typeof r.age === "string" ? r.age : undefined)} />;
}
