import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMe } from "@/lib/session";

export const Route = createFileRoute("/connexion")({
  head: () => ({ meta: [
    { title: "Connexion — Passeport de communication" },
    { name: "description", content: "Espace réservé aux administrateurs et aux accompagnants." },
    { property: "og:title", content: "Connexion — Passeport de communication" },
    { property: "og:description", content: "Espace réservé aux administrateurs et aux accompagnants." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Login,
});

function Login() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); setError("Adresse e-mail ou mot de passe incorrect."); return; }
    queryClient.removeQueries({ queryKey: ["me"] });
    const me = await fetchMe();
    queryClient.setQueryData(["me"], me);
    setBusy(false);
    if (!me?.isStaff) { await supabase.auth.signOut(); setError("Ce compte n’a pas accès à l’espace professionnel."); return; }
    navigate({ to: me.isAdmin ? "/espace" : "/espace/patients" });
  }

  return (
    <div className="bo-login">
      <div className="heading-symbol" aria-hidden="true"><MessageCircle size={32} strokeWidth={1.6} /></div>
      <h1 className="bo-title">Connexion</h1>
      <div className="title-underline" />
      <p className="bo-lead">Espace réservé aux administrateurs et aux accompagnants.</p>
      <form onSubmit={submit} className="bo-form" noValidate>
        <label className="bo-field"><span>Adresse e-mail</span>
          <input className="bo-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="bo-field"><span>Mot de passe</span>
          <input className="bo-input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error && <p className="bo-error" role="alert">{error}</p>}
        <button className="bo-btn bo-btn-primary" type="submit" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
    </div>
  );
}
