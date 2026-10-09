import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function BackLink({ children, ...props }: LinkProps & { children: ReactNode }) {
  return <Link {...props} className="bo-back"><ArrowLeft aria-hidden="true" />{children}</Link>;
}
