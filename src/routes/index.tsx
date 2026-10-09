import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/backoffice/login-form";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Connexion — Passeport de communication" },
    { name: "description", content: "Espace réservé aux administrateurs et aux accompagnants." },
    { property: "og:title", content: "Connexion — Passeport de communication" },
    { property: "og:description", content: "Espace réservé aux administrateurs et aux accompagnants." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: LoginForm,
});
