import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/backoffice/login-form";
import { LOGIN_HEAD } from "@/lib/login-head";

export const Route = createFileRoute("/connexion")({
  head: () => LOGIN_HEAD,
  component: LoginForm,
});
