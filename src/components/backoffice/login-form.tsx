import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { login, logout } from "@/lib/auth.functions";

export function LoginForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    let me;
    try { me = await login({ data: { email: email.trim(), password } }); }
    catch { setBusy(false); setError("Adresse e-mail ou mot de passe incorrect."); return; }
    queryClient.removeQueries({ queryKey: ["me"] });
    queryClient.setQueryData(["me"], me);
    setBusy(false);
    if (!me?.isStaff) { await logout(); setError("Ce compte n’a pas accès à l’espace professionnel."); return; }
    navigate({ to: me.isAdmin ? "/espace" : "/espace/patients" });
  }

  return (
    <div className="login-scene">
    <div className="bo-login">
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
    </div>
  );
}
